import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useUserId } from './auth'
import { toAppError, type AppError } from './errors'
import { lmsrPrice, type Action, type Side } from './lmsr'
import { marketKeys, type MarketCard, type Position } from './markets'
import { supabase } from './supabase'

export interface TradeRequest {
  side: Side
  action: Action
  shares: number
  /** The quote the user saw; used for the optimistic update and the slippage bound. */
  quotedTotal: number
  /** Slippage tolerance as a fraction, e.g. 0.02 = 2%. */
  slippage: number
}

export interface TradeResult {
  trade_id: number
  shares: number
  cost: number
  fee: number
  total: number
  price_before: number
  price_after: number
  balance: number
}

interface Snapshot {
  balance: number | undefined
  position: Position | null | undefined
  market: MarketCard | null | undefined
}

/**
 * Optimistic trade: balance, position and price move immediately; any RPC error rolls all three
 * back. The server re-prices the trade and rejects it if it now costs more than
 * quotedTotal × (1 + slippage) (buys) or returns less than quotedTotal × (1 − slippage) (sells).
 */
export function useExecuteTrade(marketId: number) {
  const queryClient = useQueryClient()
  const userId = useUserId()
  const balanceKey = ['balance', userId]
  const positionKey = marketKeys.position(marketId, userId)
  const detailKey = marketKeys.detail(marketId)

  return useMutation<TradeResult, AppError, TradeRequest, Snapshot>({
    mutationFn: async (req) => {
      const { data, error } = await supabase.rpc('execute_trade', {
        p_market_id: marketId,
        p_side: req.side,
        p_action: req.action,
        p_shares: req.shares,
        ...(req.action === 'buy'
          ? { p_max_cost: Math.ceil(req.quotedTotal * (1 + req.slippage) * 1e6) / 1e6 }
          : { p_min_return: Math.floor(req.quotedTotal * (1 - req.slippage) * 1e6) / 1e6 }),
      })
      if (error) throw toAppError(error)
      return data as unknown as TradeResult
    },
    onMutate: async (req) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: balanceKey }),
        queryClient.cancelQueries({ queryKey: positionKey }),
      ])
      const snapshot: Snapshot = {
        balance: queryClient.getQueryData<number>(balanceKey),
        position: queryClient.getQueryData<Position | null>(positionKey),
        market: queryClient.getQueryData<MarketCard | null>(detailKey),
      }
      const sign = req.action === 'buy' ? 1 : -1
      queryClient.setQueryData<number>(balanceKey, (b) => (b == null ? b : b - sign * req.quotedTotal))
      queryClient.setQueryData<Position | null>(positionKey, (p) => {
        const base = p ?? { yesShares: 0, noShares: 0, costBasis: 0, realizedPnl: 0, settled: false }
        return {
          ...base,
          yesShares: base.yesShares + (req.side === 'yes' ? sign * req.shares : 0),
          noShares: base.noShares + (req.side === 'no' ? sign * req.shares : 0),
          costBasis: req.action === 'buy' ? base.costBasis + req.quotedTotal : base.costBasis,
        }
      })
      queryClient.setQueryData<MarketCard | null>(detailKey, (m) => {
        if (!m) return m
        const qYes = m.qYes + (req.side === 'yes' ? sign * req.shares : 0)
        const qNo = m.qNo + (req.side === 'no' ? sign * req.shares : 0)
        const pYes = lmsrPrice(qYes, qNo, m.b)
        return { ...m, qYes, qNo, pYes, change24h: m.change24h + (pYes - m.pYes) }
      })
      return snapshot
    },
    onError: (_error, _req, snapshot) => {
      if (!snapshot) return
      queryClient.setQueryData(balanceKey, snapshot.balance)
      queryClient.setQueryData(positionKey, snapshot.position)
      queryClient.setQueryData(detailKey, snapshot.market)
      queryClient.invalidateQueries({ queryKey: detailKey })
    },
    onSuccess: (result) => {
      queryClient.setQueryData(balanceKey, Number(result.balance))
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: positionKey })
      queryClient.invalidateQueries({ queryKey: ['portfolio'] })
    },
  })
}
