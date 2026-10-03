import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Segmented } from '../components/ui/segmented'
import { Skeleton } from '../components/ui/skeleton'
import { ErrorState } from '../components/ui/states'
import { cn } from '../lib/cn'
import { formatSignedCredits } from '../lib/format'
import { supabase, type Views } from '../lib/supabase'

type Board = 'pnl' | 'accuracy'

type LeaderRow = Views<'v_leaderboard'>

function Row({ r, board }: { r: LeaderRow; board: Board }) {
  return (
    <li className={cn('grid grid-cols-[48px_minmax(0,1fr)_120px_100px_90px] items-center gap-x-4 border-b border-line px-1 py-2.5 text-sm max-sm:grid-cols-[40px_minmax(0,1fr)_100px]', r.is_me && 'bg-yes-soft')}>
      <span className="font-semibold text-ink-2">{board === 'pnl' ? r.pnl_rank : r.accuracy_rank}</span>
      <span className="truncate font-medium text-ink">
        {r.handle}
        {r.is_me && <span className="ml-2 text-xs font-normal text-ink-3">you</span>}
      </span>
      {board === 'pnl' ? (
        <span className={cn('text-right font-semibold', Number(r.pnl) >= 0 ? 'text-yes' : 'text-no')}>{formatSignedCredits(r.pnl)}</span>
      ) : (
        <span className="text-right font-semibold text-ink">{Number(r.brier).toFixed(3)}</span>
      )}
      <span className="text-right text-ink-2 max-sm:hidden">{board === 'pnl' ? formatSignedCredits(r.realized_pnl) : formatSignedCredits(r.pnl)}</span>
      <span className="text-right text-ink-3 max-sm:hidden">{r.resolved_markets}</span>
    </li>
  )
}

export function Component() {
  const [board, setBoard] = useState<Board>('pnl')
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const { data, error } = await supabase.from('v_leaderboard').select('*')
      if (error) throw error
      return data
    },
    staleTime: 60_000,
  })
  const rows = (data ?? [])
    .filter((r) => (board === 'pnl' ? true : r.accuracy_rank != null))
    .sort((a, b) => (board === 'pnl' ? a.pnl_rank! - b.pnl_rank! : a.accuracy_rank! - b.accuracy_rank!))
  const top = rows.slice(0, 100)
  const me = rows.find((r) => r.is_me)
  const showMe = me && !top.includes(me)

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-[-0.015em]">Leaderboard</h1>
        <p className="max-w-[65ch] text-ink-2">
          {board === 'pnl'
            ? 'Profit: balance plus open positions at today’s prices, minus the credits each trader started with.'
            : 'Accuracy: Brier score on resolved markets, using the price each trader’s trades left the market at as their forecast. Lower is better; 0.25 is a coin flip. Ranked after 3 resolved markets.'}
        </p>
      </header>
      <Segmented
        ariaLabel="Ranking"
        value={board}
        onChange={setBoard}
        className="self-start"
        options={[
          { value: 'pnl', label: 'Profit' },
          { value: 'accuracy', label: 'Accuracy' },
        ]}
      />
      <div className="grid grid-cols-[48px_minmax(0,1fr)_120px_100px_90px] gap-x-4 border-b border-line-strong px-1 pb-2 text-xs font-medium text-ink-3 max-sm:grid-cols-[40px_minmax(0,1fr)_100px]">
        <span>Rank</span>
        <span>Trader</span>
        <span className="text-right">{board === 'pnl' ? 'Profit' : 'Brier'}</span>
        <span className="text-right max-sm:hidden">{board === 'pnl' ? 'Realized' : 'Profit'}</span>
        <span className="text-right max-sm:hidden">Resolved</span>
      </div>
      {isError ? (
        <ErrorState message="The leaderboard couldn’t be loaded." onRetry={() => refetch()} />
      ) : isPending ? (
        <Skeleton className="h-96 w-full" />
      ) : rows.length === 0 ? (
        <p className="py-6 text-ink-3">{board === 'pnl' ? 'Nobody has traded yet.' : 'No trader has 3 resolved markets yet.'}</p>
      ) : (
        <ul>
          {top.map((r) => <Row key={r.handle} r={r} board={board} />)}
          {showMe && (
            <>
              <li aria-hidden className="py-1 text-center text-ink-3">⋯</li>
              <Row r={me} board={board} />
            </>
          )}
        </ul>
      )}
    </div>
  )
}
