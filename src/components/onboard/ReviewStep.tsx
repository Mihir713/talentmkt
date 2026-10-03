import { Plus, Trash, X } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useSkillTags } from '../../lib/catalog'
import { cn } from '../../lib/cn'
import { confirmTranscript, GRADES, matchProgram, termOptions, usePrograms, type ParsedTranscript, type ReviewRow } from '../../lib/onboarding'
import { supabase } from '../../lib/supabase'
import { Button } from '../ui/button'

const field = 'h-8 w-full rounded-md border border-line bg-bg px-2 text-sm text-ink outline-none transition-colors focus-visible:border-focus'
const TERMS = termOptions()

function rowsFrom(parsed: ParsedTranscript | null): ReviewRow[] {
  return (parsed?.courses ?? []).map((c, i) => ({
    key: `p${i}`,
    code: c.code,
    title: c.title,
    term: c.term ?? '',
    grade: c.grade ?? '',
    courseId: c.course_id,
    known: c.known,
    tags: c.tags,
  }))
}

function CourseSearch({ universityId, onAdd }: { universityId: number; onAdd: (row: Omit<ReviewRow, 'key'>) => void }) {
  const [q, setQ] = useState('')
  const { data: hits = [], isFetching } = useQuery({
    queryKey: ['course-search', universityId, q],
    enabled: q.trim().length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('search_courses', { p_university_id: universityId, p_query: q, p_limit: 6 })
      if (error) throw error
      return data
    },
  })
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-ink">Add a course</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by code or title" className={cn(field, 'h-9 max-w-md')} />
      </label>
      {q.trim().length >= 2 && (
        <ul className="flex max-w-md flex-col rounded-md border border-line bg-surface">
          {hits.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                onClick={() => {
                  onAdd({ code: h.code, title: h.title, term: '', grade: '', courseId: h.id, known: true, tags: [] })
                  setQ('')
                }}
                className="flex w-full items-baseline gap-2 px-3 py-2 text-left text-sm hover:bg-surface-2"
              >
                <span className="font-medium text-ink">{h.code}</span>
                <span className="truncate text-ink-2">{h.title}</span>
              </button>
            </li>
          ))}
          {isFetching && <li className="px-3 py-2 text-sm text-ink-3">Searching the catalog…</li>}
          {!isFetching && <li>
            <button
              type="button"
              onClick={() => {
                onAdd({ code: q.trim().toUpperCase(), title: '', term: '', grade: '', courseId: null, known: false, tags: [] })
                setQ('')
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-2 hover:bg-surface-2"
            >
              <Plus aria-hidden className="size-3.5" /> Add “{q.trim()}” as a course we don’t have yet
            </button>
          </li>}
        </ul>
      )}
    </div>
  )
}

export function ReviewStep({
  uploadId,
  universityId,
  parsed,
  notice,
  onConfirmed,
}: {
  uploadId: string
  universityId: number
  parsed: ParsedTranscript | null
  notice?: string
  onConfirmed: (result: { cohortIds: number[] }) => void
}) {
  const { data: programs = [] } = usePrograms(universityId)
  const { data: tags = [] } = useSkillTags()
  const [rows, setRows] = useState<ReviewRow[]>(() => rowsFrom(parsed))
  const [programId, setProgramId] = useState<number | null>(null)
  const [gradYear, setGradYear] = useState<number | null>(parsed?.grad_year_guess ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nextKey, setNextKey] = useState(0)

  const guessedProgram = useMemo(() => matchProgram(parsed?.program_guess ?? null, programs), [parsed, programs])
  const program = programId ?? guessedProgram
  const tagLabel = useMemo(() => new Map(tags.map((t) => [t.slug, t.label])), [tags])

  const update = (key: string, patch: Partial<ReviewRow>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  const remove = (key: string) => setRows((rs) => rs.filter((r) => r.key !== key))
  const add = (row: Omit<ReviewRow, 'key'>) => {
    setRows((rs) => [...rs, { ...row, key: `n${nextKey}` }])
    setNextKey((k) => k + 1)
  }

  const problems = rows.flatMap((r) => {
    const out: string[] = []
    if (!r.code.trim()) out.push('A course is missing its code.')
    if (!r.term) out.push(`${r.code || 'A course'} needs a term.`)
    if (!r.known && !r.title.trim()) out.push(`${r.code} needs a title.`)
    if (!r.known && r.tags.length === 0) out.push(`Pick at least one skill for ${r.code}.`)
    return out
  })
  if (!program) problems.push('Choose your program.')
  if (!gradYear) problems.push('Choose your graduation year.')
  if (rows.length === 0) problems.push('Add at least one course.')

  const confirm = async () => {
    if (problems.length || !program || !gradYear) return
    setBusy(true)
    setError(null)
    try {
      const result = await confirmTranscript({
        upload_id: uploadId,
        program_id: program,
        grad_year: gradYear,
        courses: rows.map((r) => ({ code: r.code, title: r.title, term: r.term, grade: r.grade || null, tags: r.known ? undefined : r.tags })),
      })
      onConfirmed({ cohortIds: result.cohort_ids ?? [] })
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  const unknownCount = rows.filter((r) => !r.known).length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-[-0.015em]">Check your courses</h1>
        <p className="text-md text-ink-2">
          {parsed
            ? `We found ${rows.length} courses. Fix anything we got wrong; nothing is saved until you confirm.`
            : 'Add your courses below. Nothing is saved until you confirm.'}
          {unknownCount > 0 && ` ${unknownCount} aren’t in our catalog yet, so confirm their skills.`}
        </p>
        {notice && <p className="rounded-md bg-caution-soft px-3 py-2 text-sm text-caution">{notice}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink">Program</span>
          <select className={cn(field, 'h-9')} value={program ?? ''} onChange={(e) => setProgramId(Number(e.target.value) || null)} data-testid="program-select">
            <option value="">Choose your program</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-ink">Graduation year</span>
          <select className={cn(field, 'h-9')} value={gradYear ?? ''} onChange={(e) => setGradYear(Number(e.target.value) || null)} data-testid="grad-year-select">
            <option value="">Choose a year</option>
            {Array.from({ length: 9 }, (_, i) => 2024 + i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-3">
              <th className="w-[130px] px-3 py-2 font-medium">Code</th>
              <th className="px-3 py-2 font-medium">Title and skills</th>
              <th className="w-[140px] px-3 py-2 font-medium">Term</th>
              <th className="w-[90px] px-3 py-2 font-medium">Grade</th>
              <th className="w-10 px-2 py-2">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-line align-top last:border-b-0" data-testid="review-row">
                <td className="px-3 py-2">
                  <input aria-label="Course code" className={field} value={r.code} onChange={(e) => update(r.key, { code: e.target.value.toUpperCase(), known: false, courseId: null })} />
                </td>
                <td className="px-3 py-2">
                  {r.known ? (
                    <p className="py-1.5 break-words text-ink">{r.title}</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <input aria-label="Course title" className={field} value={r.title} placeholder="Course title" onChange={(e) => update(r.key, { title: e.target.value })} />
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs text-ink-3">Skills:</span>
                        {r.tags.map((t) => (
                          <span key={t.slug} className="inline-flex h-6 items-center gap-1 rounded-md bg-yes-soft pr-1 pl-2 text-xs text-yes-strong">
                            {tagLabel.get(t.slug) ?? t.slug}
                            <button type="button" aria-label={`Remove ${tagLabel.get(t.slug) ?? t.slug}`} onClick={() => update(r.key, { tags: r.tags.filter((x) => x.slug !== t.slug) })} className="rounded p-0.5 hover:bg-yes-line/40">
                              <X aria-hidden className="size-3" />
                            </button>
                          </span>
                        ))}
                        {r.tags.length < 3 && (
                          <select
                            aria-label="Add a skill"
                            className="h-6 rounded-md border border-line bg-bg px-1 text-xs text-ink-2"
                            value=""
                            onChange={(e) => e.target.value && update(r.key, { tags: [...r.tags, { slug: e.target.value, weight: r.tags.length ? 0.5 : 1 }] })}
                          >
                            <option value="">Add a skill</option>
                            {tags.filter((t) => !r.tags.some((x) => x.slug === t.slug)).map((t) => (
                              <option key={t.slug} value={t.slug}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  )}
                </td>
                <td className="px-3 py-2">
                  <select aria-label="Term" className={field} value={r.term} onChange={(e) => update(r.key, { term: e.target.value })}>
                    <option value="">Term</option>
                    {TERMS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select aria-label="Grade" className={field} value={r.grade} onChange={(e) => update(r.key, { grade: e.target.value as ReviewRow['grade'] })}>
                    <option value="">None</option>
                    {GRADES.map((g) => (
                      <option key={g} value={g}>
                        {g === 'IP' ? 'In progress' : g === 'P' ? 'Pass' : g}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-2">
                  <button type="button" aria-label={`Remove ${r.code}`} onClick={() => remove(r.key)} className="flex size-8 items-center justify-center rounded-md text-ink-3 hover:bg-surface-2 hover:text-danger">
                    <Trash aria-hidden className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-ink-3">
                  No courses yet. Search below to add them.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <CourseSearch universityId={universityId} onAdd={add} />

      <div className="flex flex-col gap-3 border-t border-line pt-5">
        {problems.length > 0 && (
          <ul className="flex flex-col gap-1 text-sm text-ink-2" aria-live="polite">
            {[...new Set(problems)].slice(0, 4).map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" size="lg" disabled={busy || problems.length > 0} onClick={confirm} data-testid="confirm-transcript">
            {busy ? 'Saving and deleting the PDF…' : `Confirm ${rows.length} courses`}
          </Button>
          <span className="text-sm text-ink-3">The PDF is deleted as soon as you confirm.</span>
        </div>
      </div>
    </div>
  )
}
