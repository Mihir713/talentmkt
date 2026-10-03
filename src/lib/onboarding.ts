import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F' | 'P' | 'IP'
export const GRADES: Grade[] = ['A', 'B', 'C', 'D', 'F', 'P', 'IP']

export interface SuggestedTag {
  slug: string
  weight: number
}

/** One editable row in the review table. */
export interface ReviewRow {
  key: string
  code: string
  title: string
  term: string
  grade: Grade | ''
  courseId: number | null
  known: boolean
  tags: SuggestedTag[]
}

export interface ParsedTranscript {
  university_guess: string | null
  program_guess: string | null
  grad_year_guess: number | null
  courses: {
    code: string
    title: string
    term: string | null
    grade: Grade | null
    course_id: number | null
    known: boolean
    tags: SuggestedTag[]
  }[]
}

export type ParseStep = 'uploading' | 'reading' | 'matching' | 'tagging' | 'ready'
export type ParseEvent =
  | { step: Exclude<ParseStep, 'uploading'>; found?: number; unknown?: number; courses?: number }
  | { step: 'error'; code: 'not_configured' | 'failed' | string; message: string }

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  return {
    Authorization: `Bearer ${data.session?.access_token ?? ''}`,
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
  }
}

/** Calls parse-transcript and yields its newline-delimited progress events as they arrive. */
export async function* streamParse(uploadId: string): AsyncGenerator<ParseEvent> {
  const res = await fetch(`${FUNCTIONS_URL}/parse-transcript`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ upload_id: uploadId }),
  })
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => ({}))
    yield { step: 'error', code: body.error ?? 'failed', message: body.message ?? 'The transcript couldn’t be read.' }
    return
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += value
    let newline = buffer.indexOf('\n')
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim()
      buffer = buffer.slice(newline + 1)
      if (line) yield JSON.parse(line) as ParseEvent
      newline = buffer.indexOf('\n')
    }
  }
}

export async function confirmTranscript(payload: {
  upload_id: string
  program_id: number
  grad_year: number
  courses: unknown[]
}): Promise<{ courses: number; cohort_ids: number[]; file_deleted: boolean }> {
  const res = await fetch(`${FUNCTIONS_URL}/confirm-transcript`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.message ?? 'The courses couldn’t be saved.')
  return body
}

export function usePrograms(universityId: number | null | undefined) {
  return useQuery({
    queryKey: ['programs', universityId],
    enabled: universityId != null,
    queryFn: async () => {
      const { data, error } = await supabase.from('programs').select('id, name').eq('university_id', universityId!).order('name')
      if (error) throw error
      return data
    },
    staleTime: Infinity,
  })
}

export function useMySkillProfile(enabled = true) {
  return useQuery({
    queryKey: ['my-skill-profile'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_skill_profile')
      if (error) throw error
      return data.map((r) => ({ ...r, weighted: Number(r.weighted) }))
    },
  })
}

/** Plausible terms, newest first, for the review table's term picker. */
export function termOptions(): string[] {
  const out: string[] = []
  for (let year = 2027; year >= 2018; year--) {
    for (const season of ['Fall', 'Summer', 'Spring', 'Winter']) out.push(`${season} ${year}`)
  }
  return out
}

/** Best-effort program match from the parser's guess. */
export function matchProgram(guess: string | null, programs: { id: number; name: string }[]): number | null {
  if (!guess) return null
  const g = guess.toLowerCase()
  return programs.find((p) => g.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(g))?.id ?? null
}
