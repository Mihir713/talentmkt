import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { lmsrCost, lmsrPrice, type Side } from './lmsr'
import { supabase, type Enums, type Views } from './supabase'
import { useUserId } from './auth'

export type MarketStatus = Enums<'market_status'>
export type Metric = Enums<'market_metric'>

export interface MarketCard {
  id: number
  question: string
  status: MarketStatus
  metric: Metric
  params: Record<string, string | number>
  cohortId: number
  cohortSlug: string
  cohortTitle: string
  skillSlugs: string[]
  pYes: number
  change24h: number
  volume24h: number
  volumeTotal: number
  tradeCount: number
  traders: number
  opensAt: string
  closesAt: string
  resolvesAt: string
  outcome: Side | null
  resolvedAt: string | null
  resolvedPctRounded: number | null
  snapshotSizeRounded: number
  resolutionRule: string
  nonresponseRule: Enums<'nonresponse_rule'>
  quorumPct: number | null
  b: number
  qYes: number
  qNo: number
  feeBps: number
  createdAt: string
}

export function toMarketCard(row: Views<'v_market_cards'>): MarketCard {
  return {
    id: row.id!,
    question: row.question!,
    status: row.status!,
    metric: row.metric!,
    params: (row.params ?? {}) as Record<string, string | number>,
    cohortId: row.cohort_id!,
    cohortSlug: row.cohort_slug!,
    cohortTitle: row.cohort_title!,
    skillSlugs: row.skill_slugs ?? [],
    pYes: row.p_yes ?? 0.5,
    change24h: row.change_24h ?? 0,
    volume24h: Number(row.volume_24h ?? 0),
    volumeTotal: Number(row.volume_total ?? 0),
    tradeCount: row.trade_count ?? 0,
    traders: row.traders ?? 0,
    opensAt: row.opens_at!,
    closesAt: row.closes_at!,
    resolvesAt: row.resolves_at!,
    outcome: row.outcome ?? null,
    resolvedAt: row.resolved_at ?? null,
    resolvedPctRounded: row.resolved_pct_rounded ?? null,
    snapshotSizeRounded: row.snapshot_size_rounded ?? 0,
    resolutionRule: row.resolution_rule!,
    nonresponseRule: row.nonresponse_rule!,
    quorumPct: row.quorum_pct ?? null,
    b: Number(row.b),
    qYes: Number(row.q_yes),
    qNo: Number(row.q_no),
    feeBps: row.fee_bps ?? 100,
    createdAt: row.created_at!,
  }
}

export const marketKeys = {
  all: ['markets'] as const,
  list: () => ['markets', 'list'] as const,
  detail: (id: number) => ['markets', 'detail', id] as const,
  history: (id: number, range: string) => ['markets', 'history', id, range] as const,
  trades: (id: number) => ['markets', 'trades', id] as const,
  sparklines: (ids: number[]) => ['markets', 'sparklines', ids.join(',')] as const,
  canTrade: (id: number, userId: string | null) => ['markets', 'can-trade', id, userId] as const,
  position: (id: number, userId: string | null) => ['markets', 'position', id, userId] as const,
}

/** Every market card. The full set is small (~120 rows), so filters and sorts run client-side and feel instant. */
export function useMarketCards() {
  return useQuery({
    queryKey: marketKeys.list(),
    queryFn: async () => {
      const { data, error } = await supabase.from('v_market_cards').select('*').order('id')
      if (error) throw error
      return data.map(toMarketCard)
    },
    refetchInterval: 60_000,
  })
}

export function useMarket(id: number) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: marketKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await supabase.from('v_market_cards').select('*').eq('id', id).maybeSingle()
      if (error) throw error
      return data ? toMarketCard(data) : null
    },
    initialData: () => queryClient.getQueryData<MarketCard[]>(marketKeys.list())?.find((m) => m.id === id),
    initialDataUpdatedAt: () => queryClient.getQueryState(marketKeys.list())?.dataUpdatedAt,
  })
}

export function useSparklines(ids: number[]) {
  return useQuery({
    queryKey: marketKeys.sparklines(ids),
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('market_sparklines', { p_market_ids: ids, p_days: 7, p_points: 28 })
      if (error) throw error
      return new Map(data.map((r) => [r.market_id, r.points]))
    },
    staleTime: 5 * 60_000,
  })
}

export type HistoryRange = '1D' | '1W' | '1M' | 'ALL'
export interface PricePoint {
  ts: number
  p: number
}

const RANGE_DAYS: Record<HistoryRange, number | null> = { '1D': 1, '1W': 7, '1M': 30, ALL: null }

/** Price history: raw points for a day, hourly candle closes beyond that. */
export function usePriceHistory(id: number, range: HistoryRange, appNow: number) {
  return useQuery({
    queryKey: marketKeys.history(id, range),
    queryFn: async (): Promise<PricePoint[]> => {
      const days = RANGE_DAYS[range]
      const since = days ? new Date(appNow - days * 86_400_000).toISOString() : null
      if (range === '1D') {
        // The last point before the window anchors the line's left edge.
        const [inWindow, before] = await Promise.all([
          supabase.from('price_points').select('ts, p_yes').eq('market_id', id).gte('ts', since!).order('ts').order('id').limit(5000),
          supabase.from('price_points').select('ts, p_yes').eq('market_id', id).lt('ts', since!).order('ts', { ascending: false }).limit(1),
        ])
        if (inWindow.error) throw inWindow.error
        if (before.error) throw before.error
        // Liveline drops points outside its window, so the anchor sits just inside the left edge.
        const anchor = before.data[0] ? [{ ts: Date.parse(since!) + 120_000, p: before.data[0].p_yes }] : []
        return [...anchor, ...inWindow.data.map((r) => ({ ts: Date.parse(r.ts), p: r.p_yes }))]
      }
      let query = supabase.from('v_price_candles').select('bucket, close').eq('market_id', id).order('bucket')
      if (since) query = query.gte('bucket', since)
      const { data, error } = await query.limit(10000)
      if (error) throw error
      return data.map((r) => ({ ts: Date.parse(r.bucket!), p: r.close! }))
    },
    staleTime: 60_000,
  })
}

export type PublicTrade = Views<'v_public_trades'>

export function useTrades(id: number) {
  return useQuery({
    queryKey: marketKeys.trades(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_public_trades')
        .select('*')
        .eq('market_id', id)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(500)
      if (error) throw error
      return data
    },
  })
}

export type CanTradeReason = 'insider' | 'market_closed' | 'not_authenticated' | 'account_deleted' | 'market_not_found' | null

export function useCanTrade(id: number) {
  const userId = useUserId()
  return useQuery({
    queryKey: marketKeys.canTrade(id, userId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('can_trade', { p_market_id: id })
      if (error) throw error
      const result = data as { allowed: boolean; reason: CanTradeReason }
      return result
    },
  })
}

export interface Position {
  yesShares: number
  noShares: number
  costBasis: number
  realizedPnl: number
  settled: boolean
}

export function usePosition(id: number) {
  const userId = useUserId()
  return useQuery({
    queryKey: marketKeys.position(id, userId),
    enabled: !!userId,
    queryFn: async (): Promise<Position | null> => {
      const { data, error } = await supabase
        .from('positions')
        .select('yes_shares, no_shares, yes_cost_basis, no_cost_basis, realized_pnl, settled_at')
        .eq('market_id', id)
        .eq('user_id', userId!)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      return {
        yesShares: Number(data.yes_shares),
        noShares: Number(data.no_shares),
        costBasis: Number(data.yes_cost_basis) + Number(data.no_cost_basis),
        realizedPnl: Number(data.realized_pnl),
        settled: data.settled_at != null,
      }
    },
  })
}

export function useWatchlist() {
  const userId = useUserId()
  return useQuery({
    queryKey: ['watchlist', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from('watchlist').select('market_id')
      if (error) throw error
      return new Set(data.map((r) => r.market_id))
    },
  })
}

export function useToggleWatchlist() {
  const queryClient = useQueryClient()
  const userId = useUserId()
  return useMutation({
    mutationFn: async (marketId: number) => {
      const { data, error } = await supabase.rpc('toggle_watchlist', { p_market_id: marketId })
      if (error) throw error
      return data
    },
    onMutate: async (marketId) => {
      const key = ['watchlist', userId]
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Set<number>>(key)
      const next = new Set(previous)
      if (next.has(marketId)) next.delete(marketId)
      else next.add(marketId)
      queryClient.setQueryData(key, next)
      return { previous }
    },
    onError: (_e, _id, context) => queryClient.setQueryData(['watchlist', userId], context?.previous),
  })
}

// ---------------------------------------------------------------------------------------------
// Realtime: patch caches in place; never refetch whole lists.
// ---------------------------------------------------------------------------------------------

interface MarketRow {
  id: number
  q_yes: number
  q_no: number
  b: number
  status: MarketStatus
  outcome: Side | null
}

function patchMarket(card: MarketCard, row: MarketRow): MarketCard {
  const qYes = Number(row.q_yes)
  const qNo = Number(row.q_no)
  const pYes = lmsrPrice(qYes, qNo, card.b)
  // Volume moved by this update, from the change in the cost function (fee excluded).
  const traded = Math.abs(lmsrCost(qYes, qNo, card.b) - lmsrCost(card.qYes, card.qNo, card.b))
  return {
    ...card,
    qYes,
    qNo,
    pYes,
    change24h: card.change24h + (pYes - card.pYes),
    volume24h: card.volume24h + traded,
    volumeTotal: card.volumeTotal + traded,
    status: row.status,
    outcome: row.outcome,
  }
}

export function applyMarketUpdate(queryClient: QueryClient, row: MarketRow) {
  queryClient.setQueryData<MarketCard[]>(marketKeys.list(), (cards) =>
    cards?.map((c) => (c.id === row.id ? patchMarket(c, row) : c)),
  )
  queryClient.setQueryData<MarketCard | null>(marketKeys.detail(row.id), (card) => (card ? patchMarket(card, row) : card))
}

/** One subscription for the list page: every market row update. */
export function useMarketsRealtime() {
  const queryClient = useQueryClient()
  const [connected, setConnected] = useState(false)
  useEffect(() => {
    const channel = supabase
      .channel('markets-list')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'markets' }, (payload) =>
        applyMarketUpdate(queryClient, payload.new as MarketRow),
      )
      .subscribe((status) => setConnected(status === 'SUBSCRIBED'))
    return () => {
      setConnected(false)
      supabase.removeChannel(channel)
    }
  }, [queryClient])
  return connected
}

/** Market detail: its row updates plus the public trade tape (Broadcast, no user ids). */
export function useMarketRealtime(id: number, onTrade?: (trade: PublicTrade) => void) {
  const queryClient = useQueryClient()
  const userId = useUserId()
  const [connected, setConnected] = useState(false)
  useEffect(() => {
    const channel = supabase
      .channel(`market:${id}`)
      .on('broadcast', { event: 'trade' }, ({ payload }) => {
        const trade = payload as PublicTrade
        queryClient.setQueryData<PublicTrade[]>(marketKeys.trades(id), (trades) =>
          trades?.some((t) => t.id === trade.id) ? trades : [trade, ...(trades ?? [])].slice(0, 1000),
        )
        queryClient.setQueryData<PricePoint[]>(marketKeys.history(id, '1D'), (points) =>
          points ? [...points, { ts: Date.parse(trade.created_at!), p: trade.price_after! }] : points,
        )
        onTrade?.(trade)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'markets', filter: `id=eq.${id}` }, (payload) => {
        applyMarketUpdate(queryClient, payload.new as MarketRow)
        const row = payload.new as MarketRow
        if (row.status !== 'open') queryClient.invalidateQueries({ queryKey: marketKeys.canTrade(id, userId) })
      })
      .subscribe((status) => setConnected(status === 'SUBSCRIBED'))
    return () => {
      setConnected(false)
      supabase.removeChannel(channel)
    }
    // onTrade is intentionally not a dependency: resubscribing on every render would drop events.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, queryClient, userId])
  return connected
}
