// Parses a student's transcript PDF with Claude and stores the result for review.
//
// POST { upload_id } with the student's JWT. Streams newline-delimited JSON progress events:
//   {"step":"reading"} {"step":"matching"} {"step":"tagging"} {"step":"ready","courses":N}
//   or {"step":"error","code":"...","message":"..."}
// Nothing is written to transcript_courses here; the student reviews and confirms first
// (confirm_transcript). The model sees only this transcript and the skill-tag list.
import { encodeBase64 } from 'jsr:@std/encoding@1/base64'
import { callTool, MODEL, ModelOutputError, NotConfiguredError, type StrictTool } from '../_shared/claude.ts'
import { clients, cors, json } from '../_shared/http.ts'

const PARSE_PROMPT_VERSION = 'parse-transcript@2026-10-02'
const TAG_PROMPT_VERSION = 'tag-courses@2026-10-02'
const MAX_PDF_BYTES = 10 * 1024 * 1024

const GRADES = ['A', 'B', 'C', 'D', 'F', 'P', 'IP'] as const

interface ParsedCourse {
  code: string
  title: string
  term: string | null
  grade: (typeof GRADES)[number] | null
}

interface ParseResult {
  university_guess: string | null
  program_guess: string | null
  grad_year_guess: number | null
  courses: ParsedCourse[]
}

const PARSE_TOOL: StrictTool = {
  name: 'record_transcript',
  description: 'Record every course on the transcript, plus best guesses for the university, program and graduation year.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['university_guess', 'program_guess', 'grad_year_guess', 'courses'],
    properties: {
      university_guess: { type: ['string', 'null'], description: 'University name as printed, or null.' },
      program_guess: { type: ['string', 'null'], description: 'Degree program, e.g. "Computer Engineering", or null.' },
      grad_year_guess: { type: ['integer', 'null'], description: 'Expected graduation year if stated or clearly implied, else null.' },
      courses: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['code', 'title', 'term', 'grade'],
          properties: {
            code: { type: 'string', description: 'Course code as printed, e.g. "ECE 222".' },
            title: { type: 'string', description: 'Course title as printed.' },
            term: {
              type: ['string', 'null'],
              description: 'Term normalised to "Fall YYYY", "Winter YYYY", "Spring YYYY" or "Summer YYYY"; null if unknown.',
            },
            grade: {
              type: ['string', 'null'],
              enum: [...GRADES, null],
              description: 'Letter band (A, B, C, D, F), P for pass/credit, IP for in progress or no grade yet; null if not shown. Map percentages and GPA points to the letter band.',
            },
          },
        },
      },
    },
  },
}

const PARSE_SYSTEM = `You read university transcripts and extract course records.
Record every course exactly once per term it was taken, including in-progress courses. Skip transfer credits with no course code, term GPA rows, and totals.
Never record the student's name, student number, date of birth or any other personal identifier; only course records and the three guesses.
Answer only by calling the record_transcript tool.`

const TERM_RE = /^(Fall|Winter|Spring|Summer) (\d{4})$/

function normaliseTerm(term: string | null): string | null {
  if (!term) return null
  const m = term.trim().match(/(fall|winter|spring|summer)\D*(\d{4})/i)
  if (!m) return null
  const season = m[1]![0]!.toUpperCase() + m[1]!.slice(1).toLowerCase()
  const out = `${season} ${m[2]}`
  return TERM_RE.test(out) ? out : null
}

function normaliseCode(code: string): string {
  return code.trim().replace(/\s+/g, ' ').toUpperCase()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const { user, service } = clients(req)
  const { data: auth } = await user.auth.getUser()
  if (!auth.user) return json({ error: 'not_authenticated', message: 'Sign in first.' }, 401)

  let uploadId: string
  try {
    uploadId = (await req.json()).upload_id
  } catch {
    return json({ error: 'bad_request', message: 'Send { upload_id }.' }, 400)
  }

  // Through the student's own client, so RLS proves the upload is theirs.
  const { data: upload } = await user
    .from('transcript_uploads')
    .select('id, storage_path, status')
    .eq('id', uploadId)
    .maybeSingle()
  if (!upload) return json({ error: 'upload_not_found', message: 'No upload with that id.' }, 404)
  if (upload.status === 'confirmed') return json({ error: 'already_confirmed', message: 'This transcript is already confirmed.' }, 409)

  const { data: student } = await user.from('student_profiles').select('university_id').eq('user_id', auth.user.id).maybeSingle()
  if (!student) return json({ error: 'consent_required', message: 'Accept the consent step first.' }, 403)

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder()
      const send = (event: Record<string, unknown>) => controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'))
      const record = (status: string, extra: Record<string, unknown> = {}) =>
        service.rpc('record_transcript_parse', { p_upload_id: uploadId, p_status: status, ...extra })

      try {
        await record('parsing')
        send({ step: 'reading' })

        const { data: file, error: downloadError } = await service.storage.from('transcripts').download(upload.storage_path)
        if (downloadError || !file) throw new Error('The uploaded file could not be read. Upload it again.')
        if (file.size > MAX_PDF_BYTES) throw new Error('That PDF is larger than 10 MB.')
        const bytes = new Uint8Array(await file.arrayBuffer())
        if (!(bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) {
          throw new Error('That file isn’t a PDF.')
        }

        const parsed = await callTool<ParseResult>({
          system: PARSE_SYSTEM,
          tool: PARSE_TOOL,
          effort: 'medium',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: encodeBase64(bytes) } },
            { type: 'text', text: 'Extract every course from this transcript with record_transcript.' },
          ],
        })

        send({ step: 'matching', found: parsed.courses.length })
        const courses = parsed.courses
          .map((c) => ({ code: normaliseCode(c.code), title: c.title.trim(), term: normaliseTerm(c.term), grade: c.grade }))
          .filter((c) => c.code.length >= 2)
        const codes = [...new Set(courses.map((c) => c.code))]
        const { data: known } = await service
          .from('courses')
          .select('id, code, title')
          .eq('university_id', student.university_id)
          .in('code', codes.length ? codes : ['__none__'])
        const byCode = new Map((known ?? []).map((k) => [k.code as string, k]))

        // Unknown courses get suggested tags from a second call that may only use existing slugs.
        const unknown = [...new Map(courses.filter((c) => !byCode.has(c.code)).map((c) => [c.code, c])).values()]
        const suggested = new Map<string, { slug: string; weight: number }[]>()
        if (unknown.length) {
          send({ step: 'tagging', unknown: unknown.length })
          const { data: tags } = await service.from('skill_tags').select('slug, label, category').order('slug')
          const slugs = (tags ?? []).map((t) => t.slug as string)
          const tagTool: StrictTool = {
            name: 'tag_courses',
            description: 'Assign skill tags to each course.',
            input_schema: {
              type: 'object',
              additionalProperties: false,
              required: ['courses'],
              properties: {
                courses: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['code', 'tags'],
                    properties: {
                      code: { type: 'string' },
                      tags: {
                        type: 'array',
                        description: '1 to 3 tags. weight is how much of the course is about the skill: 1 = entirely, 0.3 = a minor part.',
                        items: {
                          type: 'object',
                          additionalProperties: false,
                          required: ['slug', 'weight'],
                          properties: { slug: { type: 'string', enum: slugs }, weight: { type: 'number' } },
                        },
                      },
                    },
                  },
                },
              },
            },
          }
          const result = await callTool<{ courses: { code: string; tags: { slug: string; weight: number }[] }[] }>({
            system: `You map university courses to a fixed skill taxonomy. Use only these tags:\n${(tags ?? [])
              .map((t) => `${t.slug}: ${t.label} (${t.category})`)
              .join('\n')}\nAnswer only by calling the tag_courses tool.`,
            tool: tagTool,
            effort: 'low',
            content: [{ type: 'text', text: unknown.map((c) => `${c.code}: ${c.title}`).join('\n') }],
          })
          for (const row of result.courses) {
            const tags = row.tags
              .filter((t) => slugs.includes(t.slug))
              .slice(0, 3)
              .map((t) => ({ slug: t.slug, weight: Math.round(Math.min(Math.max(t.weight, 0.1), 1) * 100) / 100 }))
            suggested.set(normaliseCode(row.code), tags)
          }
        }

        const review = {
          university_guess: parsed.university_guess,
          program_guess: parsed.program_guess,
          grad_year_guess: parsed.grad_year_guess,
          courses: courses.map((c) => {
            const match = byCode.get(c.code)
            return match
              ? { ...c, course_id: match.id, title: match.title, known: true, tags: [] }
              : { ...c, course_id: null, known: false, tags: suggested.get(c.code) ?? [] }
          }),
        }

        const { error: saveError } = await record('needs_review', {
          p_parsed_json: review,
          p_model: MODEL,
          p_prompt_version: unknown.length ? `${PARSE_PROMPT_VERSION}+${TAG_PROMPT_VERSION}` : PARSE_PROMPT_VERSION,
        })
        if (saveError) throw new Error('The parsed courses could not be saved.')
        send({ step: 'ready', courses: review.courses.length })
      } catch (e) {
        if (e instanceof NotConfiguredError) {
          // No API key: the student can still enter courses by hand on the review step.
          await record('needs_review', { p_error: 'parser_not_configured' })
          send({ step: 'error', code: 'not_configured', message: 'Automatic reading isn’t set up on this server. You can enter your courses by hand.' })
        } else {
          const message = e instanceof ModelOutputError || e instanceof Error ? e.message : 'Something went wrong.'
          await record('failed', { p_error: message })
          send({ step: 'error', code: 'failed', message })
        }
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, { headers: { ...cors, 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store' } })
})
