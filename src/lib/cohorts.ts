import { useQuery } from '@tanstack/react-query'
import { useUserId } from './auth'
import { supabase } from './supabase'

export interface CohortDefinition {
  skills: { tag: string; min_weighted_courses: number }[]
  grad_years?: number[]
  regions?: string[]
  universities?: string[]
}

const REGION_NAMES: Record<string, string> = { ON: 'Ontario' }

function list(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/** "Students with at least 3 weighted courses in Embedded systems, graduating 2027 or 2028, at universities in Ontario." */
export function describeDefinition(def: CohortDefinition, labels: Map<string, string>): string {
  const skills = def.skills.map((s) => `${s.min_weighted_courses} weighted ${s.min_weighted_courses === 1 ? 'course' : 'courses'} in ${labels.get(s.tag) ?? s.tag}`)
  let out = `Students with at least ${list(skills)}`
  if (def.grad_years?.length) {
    const years = [...def.grad_years].sort()
    out += `, graduating ${years.length === 1 ? years[0] : `${years.slice(0, -1).join(', ')} or ${years[years.length - 1]}`}`
  }
  if (def.universities?.length) out += `, at ${list(def.universities)}`
  if (def.regions?.length) out += `, at universities in ${list(def.regions.map((r) => REGION_NAMES[r] ?? r))}`
  return `${out}.`
}

/** The signed-in student's own live cohorts (RLS returns only their rows). */
export function useMyCohorts() {
  const userId = useUserId()
  return useQuery({
    queryKey: ['my-cohorts', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: rows, error } = await supabase.from('cohort_memberships').select('cohort_id')
      if (error) throw error
      const ids = rows.map((r) => r.cohort_id)
      if (!ids.length) return []
      const { data, error: e2 } = await supabase.from('v_cohort_public').select('*').in('id', ids).order('title')
      if (e2) throw e2
      return data
    },
  })
}
