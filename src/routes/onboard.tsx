import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, Navigate } from 'react-router'
import { ConsentStep } from '../components/onboard/ConsentStep'
import { RevealStep } from '../components/onboard/RevealStep'
import { ReviewStep } from '../components/onboard/ReviewStep'
import { Steps } from '../components/onboard/Steps'
import { UploadStep } from '../components/onboard/UploadStep'
import { buttonStyles } from '../components/ui/button'
import { Skeleton } from '../components/ui/skeleton'
import { useProfile, useSession, useStudentProfile } from '../lib/auth'
import { cn } from '../lib/cn'
import type { ParsedTranscript } from '../lib/onboarding'
import { supabase } from '../lib/supabase'

type Flow =
  | { stage: 'upload' }
  | { stage: 'review'; uploadId: string; notice?: string }
  | { stage: 'reveal'; cohortIds: number[] }

function NotAStudent() {
  const { data: universities } = useQuery({
    queryKey: ['universities'],
    queryFn: async () => {
      const { data, error } = await supabase.from('universities').select('name, email_domain').order('name')
      if (error) throw error
      return data
    },
  })
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold tracking-[-0.015em]">Students sign in with a university email</h1>
      <p className="text-ink-2">
        This account uses an email we don’t recognise as a university address, so it trades but can’t join cohorts. Sign out and sign in
        with one of these domains to join as a student:
      </p>
      <ul className="grid gap-1 text-sm sm:grid-cols-2">
        {universities?.map((u) => (
          <li key={u.email_domain} className="text-ink-2">
            {u.name} <span className="text-ink-3">(@{u.email_domain})</span>
          </li>
        ))}
      </ul>
      <Link to="/markets" className={cn(buttonStyles({ variant: 'secondary' }), 'self-start')}>
        Browse markets instead
      </Link>
    </div>
  )
}

export function Component() {
  const { session, ready } = useSession()
  const profile = useProfile()
  const student = useStudentProfile()
  const [flow, setFlow] = useState<Flow>({ stage: 'upload' })
  const [parsed, setParsed] = useState<ParsedTranscript | null>(null)

  if (ready && !session) return <Navigate to="/signin?next=/onboard" replace />

  const loading = !ready || profile.isPending || student.isPending
  const consented = !!student.data
  const stepIndex = !consented ? 0 : flow.stage === 'upload' ? 1 : flow.stage === 'review' ? 2 : 3
  const wide = flow.stage === 'review'

  let body
  if (loading) {
    body = (
      <div className="flex flex-col gap-4" aria-hidden>
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  } else if (profile.data?.role !== 'student') {
    body = <NotAStudent />
  } else if (!consented) {
    body = <ConsentStep universityName={undefined} />
  } else if (flow.stage === 'upload') {
    body = (
      <>
        {student.data?.grad_year && (
          <p className="mb-6 rounded-md bg-surface-2 px-3 py-2 text-sm text-ink-2">
            You’ve already confirmed a transcript. Uploading another replaces your courses and updates your cohorts.{' '}
            <Link to="/me" className="underline">
              Back to your page
            </Link>
          </p>
        )}
        <UploadStep
          onParsed={async ({ uploadId, notice }) => {
            const { data } = await supabase.from('transcript_uploads').select('parsed_json').eq('id', uploadId).single()
            setParsed((data?.parsed_json as unknown as ParsedTranscript) ?? null)
            setFlow({ stage: 'review', uploadId, notice })
          }}
        />
      </>
    )
  } else if (flow.stage === 'review') {
    body = (
      <ReviewStep
        uploadId={flow.uploadId}
        universityId={student.data!.university_id}
        parsed={parsed}
        notice={flow.notice}
        onConfirmed={({ cohortIds }) => {
          student.refetch()
          setFlow({ stage: 'reveal', cohortIds })
        }}
      />
    )
  } else {
    body = <RevealStep cohortIds={flow.cohortIds} />
  }

  return (
    <div className={cn('mx-auto flex w-full flex-col gap-8 px-4 py-10 sm:py-14', wide ? 'max-w-[960px]' : 'max-w-[640px]')}>
      {!loading && profile.data?.role === 'student' && <Steps current={stepIndex} />}
      {body}
    </div>
  )
}
