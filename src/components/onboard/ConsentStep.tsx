import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router'
import { supabase } from '../../lib/supabase'
import { ConsentFacts } from '../ConsentFacts'
import { Button } from '../ui/button'

export function ConsentStep({ universityName }: { universityName?: string }) {
  const queryClient = useQueryClient()
  const agree = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('give_student_consent')
      if (error) throw new Error(error.details ?? error.message)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['student-profile'] }),
  })
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-[-0.015em]">Before you upload anything</h1>
        <p className="text-md text-ink-2">
          {universityName ? `Your ${universityName} email checks out. ` : ''}Here is exactly what happens to your transcript. It takes about
          three minutes from here to seeing your cohorts.
        </p>
      </div>
      <ConsentFacts className="rounded-lg border border-line bg-surface p-5" />
      {agree.error && (
        <p role="alert" className="text-sm text-danger">
          {agree.error.message}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" size="lg" disabled={agree.isPending} onClick={() => agree.mutate()}>
          {agree.isPending ? 'Saving…' : 'I agree, continue'}
        </Button>
        <Link to="/markets" className="text-sm text-ink-3 underline">
          Not now, just browse markets
        </Link>
      </div>
    </div>
  )
}
