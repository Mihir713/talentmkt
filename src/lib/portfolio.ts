import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useUserId } from './auth'
import { lmsrPrice } from './lmsr'
import { supabase, type Views } from './supabase'

export type PortfolioRow = Views<'v_portfolio'>

export function usePortfolio() {
  const userId = useUserId()
  return useQuery({
    queryKey: ['portfolio', userId],
    enabled: !!userId,
    queryFn: async () => {
      const [positions, funding] = await Promise.all([
        supabase.from('v_portfolio').select('*').order('updated_at', { ascending: false }),
        supabase.from('ledger_entries').select('amount').in('kind', ['signup_grant', 'admin_adjust']),
      ])
      if (positions.error) throw positions.error
      if (funding.error) throw funding.error
      return {
        positions: positions.data,
        granted: funding.data.reduce((sum, r) => sum + Number(r.amount), 0),
      }
    },
  })
}

export function useTradeHistory() {
  const userId = useUserId()
  return useQuery({
    queryKey: ['portfolio', 'trades', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trades')
        .select('id, market_id, side, action, shares, cost, fee, price_after, created_at, market:markets(question)')
        .order('created_at', { ascending: false })
        .limit(2000)
      if (error) throw error
      return data
    },
  })
}

/** Live mark-to-market: patch prices from market updates; refetch when own positions or balance change. */
export function usePortfolioRealtime() {
  const queryClient = useQueryClient()
  const userId = useUserId()
  const [connected, setConnected] = useState(false)
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`portfolio:${userId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'markets' }, (payload) => {
        const m = payload.new as { id: number; q_yes: number; q_no: number; b: number; status: PortfolioRow['status'] }
        queryClient.setQueryData<{ positions: PortfolioRow[]; granted: number }>(['portfolio', userId], (data) =>
          data && {
            ...data,
            positions: data.positions.map((p) =>
              p.market_id === m.id ? { ...p, q_yes: m.q_yes, q_no: m.q_no, p_yes: lmsrPrice(Number(m.q_yes), Number(m.q_no), Number(m.b)), status: m.status } : p,
            ),
          },
        )
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'positions', filter: `user_id=eq.${userId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['portfolio'] })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'accounts', filter: `user_id=eq.${userId}` }, (payload) => {
        queryClient.setQueryData(['balance', userId], Number((payload.new as { balance: number }).balance))
      })
      .subscribe((status) => setConnected(status === 'SUBSCRIBED'))
    return () => {
      setConnected(false)
      supabase.removeChannel(channel)
    }
  }, [queryClient, userId])
  return connected
}

/** Mark value of an open position at the current price. */
export function markValue(p: PortfolioRow): number {
  if (p.settled_at) return 0
  const price = p.p_yes ?? 0.5
  return Number(p.yes_shares) * price + Number(p.no_shares) * (1 - price)
}
