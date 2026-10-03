import { AlertDialog } from '@base-ui/react/alert-dialog'
import { useState, type ReactNode } from 'react'
import { Button, buttonStyles } from './button'

/** Destructive confirmation. Optionally requires typing a word so it can't be clicked through. */
export function ConfirmDialog({
  trigger,
  title,
  children,
  confirmLabel,
  typeToConfirm,
  onConfirm,
}: {
  trigger: string
  title: string
  children: ReactNode
  confirmLabel: string
  typeToConfirm?: string
  onConfirm: () => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ready = !typeToConfirm || typed.trim().toLowerCase() === typeToConfirm
  return (
    <AlertDialog.Root open={open} onOpenChange={(o) => { setOpen(o); setTyped(''); setError(null) }}>
      <AlertDialog.Trigger className={buttonStyles({ variant: 'danger', size: 'sm' })}>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-ink/30 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-50 flex w-[min(460px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-lg border border-line bg-surface p-5 shadow-popover transition-[opacity,transform] duration-200 ease-[var(--ease-out)] data-[ending-style]:scale-[0.97] data-[ending-style]:opacity-0 data-[starting-style]:scale-[0.97] data-[starting-style]:opacity-0">
          <AlertDialog.Title className="text-lg font-semibold text-ink">{title}</AlertDialog.Title>
          <AlertDialog.Description render={<div />} className="flex flex-col gap-2 text-ink-2">
            {children}
          </AlertDialog.Description>
          {typeToConfirm && (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-ink">
                Type <span className="font-semibold">{typeToConfirm}</span> to confirm
              </span>
              <input value={typed} onChange={(e) => setTyped(e.target.value)} className="h-9 rounded-md border border-line-strong bg-bg px-3 text-ink outline-none focus-visible:border-focus" />
            </label>
          )}
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <AlertDialog.Close className={buttonStyles({ variant: 'ghost', size: 'md' })}>Cancel</AlertDialog.Close>
            <Button
              variant="danger"
              disabled={!ready || busy}
              onClick={async () => {
                setBusy(true)
                setError(null)
                try {
                  await onConfirm()
                  setOpen(false)
                } catch (e) {
                  setError((e as Error).message)
                } finally {
                  setBusy(false)
                }
              }}
            >
              {busy ? 'Working…' : confirmLabel}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
