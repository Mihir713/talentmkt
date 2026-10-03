import { Dialog } from '@base-ui/react/dialog'
import { ChartLine, Tag, UsersThree } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { Command } from 'cmdk'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { supabase } from '../lib/supabase'
import { useCommandPalette } from '../stores/ui'

type Hit = { kind: string; key: string; title: string; subtitle: string | null }

function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), ms)
    return () => window.clearTimeout(id)
  }, [value, ms])
  return debounced
}

const GROUPS: { kind: string; heading: string; Icon: typeof ChartLine }[] = [
  { kind: 'market', heading: 'Markets', Icon: ChartLine },
  { kind: 'cohort', heading: 'Cohorts', Icon: UsersThree },
  { kind: 'skill', heading: 'Skills', Icon: Tag },
]

/**
 * ⌘K: markets, live cohorts and skill tags. Opens and closes without animation: it's used many
 * times a day, so it should feel instant.
 */
export function CommandPalette() {
  const { open, setOpen } = useCommandPalette()
  const [query, setQuery] = useState('')
  const debounced = useDebounced(query.trim(), 120)
  const navigate = useNavigate()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(!useCommandPalette.getState().open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setOpen])

  const { data: hits = [], isFetching } = useQuery({
    queryKey: ['search', debounced],
    enabled: open && debounced.length >= 1,
    queryFn: async (): Promise<Hit[]> => {
      const { data, error } = await supabase.rpc('search_catalog', { p_query: debounced, p_limit: 6 })
      if (error) throw error
      return data
    },
    placeholderData: (previous) => previous,
    staleTime: 60_000,
  })

  const go = (hit: Hit) => {
    setOpen(false)
    setQuery('')
    if (hit.kind === 'market') navigate(`/markets/${hit.key}`)
    else if (hit.kind === 'cohort') navigate(`/cohorts/${hit.key}`)
    else navigate(`/markets?skill=${encodeURIComponent(hit.key)}`)
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-ink/25" />
        <Dialog.Popup className="fixed left-1/2 top-[12vh] z-50 w-[min(640px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-lg border border-line bg-surface shadow-popover">
          <Dialog.Title className="sr-only">Search</Dialog.Title>
          <Command shouldFilter={false} label="Search markets, cohorts and skills" className="flex flex-col">
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="Search markets, cohorts and skills"
              className="h-12 border-b border-line bg-transparent px-4 text-md text-ink outline-none placeholder:text-ink-3"
            />
            <Command.List className="max-h-[min(420px,60vh)] overflow-y-auto p-1.5">
              {debounced.length === 0 && (
                <p className="px-3 py-6 text-sm text-ink-3">Type a skill like “embedded”, a region like “Bay Area”, or part of a question.</p>
              )}
              {debounced.length > 0 && !isFetching && hits.length === 0 && (
                <Command.Empty className="px-3 py-6 text-sm text-ink-3">Nothing matches “{debounced}”.</Command.Empty>
              )}
              {GROUPS.map(({ kind, heading, Icon }) => {
                const items = hits.filter((h) => h.kind === kind)
                if (!items.length) return null
                return (
                  <Command.Group
                    key={kind}
                    heading={heading}
                    className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-ink-3"
                  >
                    {items.map((hit) => (
                      <Command.Item
                        key={`${hit.kind}:${hit.key}`}
                        value={`${hit.kind}:${hit.key}`}
                        onSelect={() => go(hit)}
                        className="flex cursor-default items-start gap-2.5 rounded-md px-2.5 py-2 text-sm text-ink-2 data-[selected=true]:bg-surface-2 data-[selected=true]:text-ink"
                      >
                        <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-3" />
                        <span className="flex min-w-0 flex-col">
                          <span className="line-clamp-2 text-ink">{hit.title}</span>
                          {hit.subtitle && <span className="truncate text-xs text-ink-3">{hit.subtitle}</span>}
                        </span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )
              })}
            </Command.List>
          </Command>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
