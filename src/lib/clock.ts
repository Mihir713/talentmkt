import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Every time comparison in SQL goes through app_now(), which an admin can set for demos. The
// client mirrors it: ask the database for its now once, keep the offset from the browser clock.
export function useAppClockOffset() {
  return useQuery({
    queryKey: ['app-now'],
    queryFn: async () => {
      const before = Date.now()
      const { data, error } = await supabase.rpc('app_now')
      if (error) throw error
      const after = Date.now()
      return new Date(data).getTime() - (before + after) / 2
    },
    staleTime: 60_000,
  })
}

/** The app's current time in ms, re-rendering every `tickMs`. */
export function useAppNow(tickMs = 30_000): number {
  const offset = useAppClockOffset().data ?? 0
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), tickMs)
    return () => window.clearInterval(id)
  }, [tickMs])
  return now + offset
}

/** True when an admin has set the simulation clock (it differs from real time by over a minute). */
export function useIsSimulatedClock(): boolean {
  const offset = useAppClockOffset().data ?? 0
  return Math.abs(offset) > 60_000
}
