import { Select as BaseSelect } from '@base-ui/react/select'
import { CaretUpDown, Check } from '@phosphor-icons/react'
import { cn } from '../../lib/cn'

export interface SelectItem {
  value: string
  label: string
  group?: string
}

interface Props {
  label: string
  value: string
  onChange: (value: string) => void
  items: SelectItem[]
  className?: string
}

/** Labelled single select. The label stays visible (never a placeholder standing in for one). */
export function Select({ label, value, onChange, items, className }: Props) {
  const groups = [...new Set(items.map((i) => i.group ?? ''))]
  return (
    <BaseSelect.Root
      value={value}
      onValueChange={(v) => v != null && onChange(v as string)}
      items={Object.fromEntries(items.map((i) => [i.value, i.label]))}
    >
      <BaseSelect.Trigger
        aria-label={label}
        className={cn(
          'flex h-8 min-w-0 items-center gap-1.5 rounded-md border border-line bg-surface pr-2 pl-2.5 text-sm text-ink transition-colors duration-150 hover:border-line-strong data-[popup-open]:border-line-strong',
          className,
        )}
      >
        <span className="shrink-0 text-ink-3">{label}</span>
        <BaseSelect.Value className="truncate font-medium" />
        <BaseSelect.Icon className="ml-auto shrink-0 text-ink-3">
          <CaretUpDown aria-hidden className="size-3.5" />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner sideOffset={4} alignItemWithTrigger={false} className="z-50 outline-none">
          <BaseSelect.Popup className="max-h-[min(400px,var(--available-height))] min-w-[var(--anchor-width)] origin-[var(--transform-origin)] overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-popover transition-[opacity,transform] duration-150 ease-[var(--ease-out)] data-[ending-style]:scale-[0.97] data-[ending-style]:opacity-0 data-[starting-style]:scale-[0.97] data-[starting-style]:opacity-0">
            <BaseSelect.List>
              {groups.map((group) => (
                <BaseSelect.Group key={group || 'all'}>
                  {group && <BaseSelect.GroupLabel className="px-2.5 pt-2 pb-1 text-xs font-medium text-ink-3">{group}</BaseSelect.GroupLabel>}
                  {items
                    .filter((i) => (i.group ?? '') === group)
                    .map((item) => (
                      <BaseSelect.Item
                        key={item.value}
                        value={item.value}
                        className="flex h-8 cursor-default items-center gap-2 rounded-md pr-8 pl-2.5 text-sm text-ink-2 outline-none select-none data-[highlighted]:bg-surface-2 data-[highlighted]:text-ink data-[selected]:text-ink"
                      >
                        <BaseSelect.ItemIndicator className="w-4">
                          <Check aria-hidden className="size-3.5" />
                        </BaseSelect.ItemIndicator>
                        <BaseSelect.ItemText>{item.label}</BaseSelect.ItemText>
                      </BaseSelect.Item>
                    ))}
                </BaseSelect.Group>
              ))}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  )
}
