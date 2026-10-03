import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { supabase } from '../../lib/supabase'
import { useColorScheme } from '../../lib/useColorScheme'
import { Skeleton } from '../ui/skeleton'

export interface TopSkill {
  slug: string
  label: string
  /** Share of this cohort with at least one full course in the skill. */
  share_pct: number
  /** The same share across every student with a transcript. */
  overall_pct: number
}

export function useCohortPublic(by: { id?: number; slug?: string }) {
  return useQuery({
    queryKey: ['cohort-public', by.id ?? by.slug],
    queryFn: async () => {
      let query = supabase.from('v_cohort_public').select('*')
      query = by.id != null ? query.eq('id', by.id) : query.eq('slug', by.slug!)
      const { data, error } = await query.maybeSingle()
      if (error) throw error
      return data
    },
  })
}

const BAR = {
  light: { cohort: '#1d60bc', overall: '#c4cad2', label: '#636972' },
  dark: { cohort: '#6aa7f4', overall: '#3a4048', label: '#8d9399' },
}

/** This cohort's share next to all students', for the skills that set the cohort apart. */
export function SkillBars({ skills, limit = 6 }: { skills: TopSkill[]; limit?: number }) {
  const scheme = useColorScheme()
  const colors = BAR[scheme]
  const data = skills.slice(0, limit)
  return (
    <div className="flex flex-col gap-2">
      <div style={{ height: data.length * 34 + 8 }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 36, bottom: 0, left: 0 }} barCategoryGap={7} barGap={1}>
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis type="category" dataKey="label" width={150} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: colors.label }} />
            <Bar dataKey="share_pct" fill={colors.cohort} radius={[0, 2, 2, 0]} isAnimationActive={false} barSize={9}
              label={{ position: 'right', fontSize: 11, fill: colors.label, formatter: (v: unknown) => `${v}%` }} />
            <Bar dataKey="overall_pct" fill={colors.overall} radius={[0, 2, 2, 0]} isAnimationActive={false} barSize={5} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="flex items-center gap-4 text-xs text-ink-3">
        <span className="flex items-center gap-1.5"><span aria-hidden className="h-2 w-3 rounded-[1px]" style={{ background: colors.cohort }} />This cohort</span>
        <span className="flex items-center gap-1.5"><span aria-hidden className="h-1.5 w-3 rounded-[1px]" style={{ background: colors.overall }} />All students</span>
      </p>
      <ul className="sr-only">
        {data.map((s) => (
          <li key={s.slug}>
            {s.label}: {s.share_pct}% of this cohort, {s.overall_pct}% of all students
          </li>
        ))}
      </ul>
    </div>
  )
}

export function CohortProfile({ cohortId, slug, title }: { cohortId: number; slug: string; title: string }) {
  const { data, isPending } = useCohortPublic({ id: cohortId })
  const skills = (data?.top_skills ?? []) as unknown as TopSkill[]
  return (
    <section aria-labelledby="cohort-heading" className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-col gap-0.5">
        <h2 id="cohort-heading" className="text-md font-semibold">
          The cohort
        </h2>
        <Link to={`/cohorts/${slug}`} className="text-sm text-ink-2 underline">
          {title}
        </Link>
      </div>
      {isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : data ? (
        <>
          <p className="text-sm text-ink-2">
            About <span className="font-semibold text-ink">{data.member_count_rounded}</span> people today. Where they took at least one full
            course, compared with all students:
          </p>
          <SkillBars skills={skills} />
        </>
      ) : (
        <p className="text-sm text-ink-2">This cohort’s live profile is hidden because it has fallen below 25 people.</p>
      )}
    </section>
  )
}
