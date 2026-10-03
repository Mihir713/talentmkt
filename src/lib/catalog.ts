import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'

export function useSkillTags() {
  return useQuery({
    queryKey: ['skill-tags'],
    queryFn: async () => {
      const { data, error } = await supabase.from('skill_tags').select('id, slug, label, category').order('category').order('label')
      if (error) throw error
      return data
    },
    staleTime: Infinity,
  })
}

export const METRIC_LABELS = {
  employed_in_field: 'Working in the field',
  employed_in_region: 'Employed in a region',
  salary_at_least: 'Salary threshold',
  grad_school: 'Graduate school',
} as const
