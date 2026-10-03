import { Check, FilePdf, UploadSimple, WarningCircle } from '@phosphor-icons/react'
import { useRef, useState, type DragEvent } from 'react'
import { useUserId } from '../../lib/auth'
import { cn } from '../../lib/cn'
import { streamParse, type ParseStep } from '../../lib/onboarding'
import { supabase } from '../../lib/supabase'
import { Button } from '../ui/button'

const MAX_BYTES = 10 * 1024 * 1024
const STEP_LABELS: { step: ParseStep; label: string }[] = [
  { step: 'uploading', label: 'Uploading your PDF' },
  { step: 'reading', label: 'Reading your transcript' },
  { step: 'matching', label: 'Matching courses to the catalog' },
  { step: 'tagging', label: 'Tagging new courses with skills' },
  { step: 'ready', label: 'Ready for your review' },
]

type Outcome = { uploadId: string; manual: boolean; notice?: string }

export function UploadStep({ onParsed }: { onParsed: (outcome: Outcome) => void }) {
  const userId = useUserId()
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [step, setStep] = useState<ParseStep | null>(null)
  const [done, setDone] = useState<Set<ParseStep>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<string | null>(null)
  const [tagged, setTagged] = useState(false)

  const pick = (f: File | undefined) => {
    setError(null)
    if (!f) return
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) return setError('Choose a PDF. Most registrar portals let you download your transcript as one.')
    if (f.size > MAX_BYTES) return setError('That file is over 10 MB. Try exporting the transcript without scanned images.')
    setFile(f)
  }

  const run = async () => {
    if (!file || !userId) return
    setError(null)
    const mark = (s: ParseStep) => {
      setStep(s)
      setDone((prev) => {
        const next = new Set(prev)
        STEP_LABELS.forEach(({ step: k }) => {
          if (STEP_LABELS.findIndex((x) => x.step === k) < STEP_LABELS.findIndex((x) => x.step === s)) next.add(k)
        })
        return next
      })
    }
    try {
      mark('uploading')
      const path = `${userId}/${crypto.randomUUID()}.pdf`
      const up = await supabase.storage.from('transcripts').upload(path, file, { contentType: 'application/pdf', upsert: false })
      if (up.error) throw new Error('The upload didn’t go through. Check your connection and try again.')
      const begin = await supabase.rpc('begin_transcript_upload', { p_storage_path: path })
      if (begin.error) throw new Error(begin.error.details ?? begin.error.message)
      const uploadId = begin.data
      for await (const event of streamParse(uploadId)) {
        if (event.step === 'error') {
          if (event.code === 'not_configured') {
            onParsed({ uploadId, manual: true, notice: event.message })
            return
          }
          throw new Error(event.message)
        }
        if (event.step === 'matching' && event.found != null) setDetail(`${event.found} courses found`)
        if (event.step === 'tagging') {
          setTagged(true)
          if (event.unknown != null) setDetail(`${event.unknown} not in our catalog yet`)
        }
        mark(event.step)
        if (event.step === 'ready') {
          setDone(new Set(STEP_LABELS.map((s) => s.step)))
          onParsed({ uploadId, manual: false })
          return
        }
      }
    } catch (e) {
      setStep(null)
      setDone(new Set())
      setError((e as Error).message)
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    pick(e.dataTransfer.files[0])
  }

  if (step) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-[-0.015em]">Reading your transcript</h1>
          <p className="text-md text-ink-2">This usually takes under a minute. You’ll check everything before it’s saved.</p>
        </div>
        <ol className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-5" aria-live="polite">
          {STEP_LABELS.map(({ step: s, label }) => {
            const isDone = done.has(s)
            const active = step === s && !isDone
            const skipped = s === 'tagging' && isDone && !tagged
            return (
              <li key={s} className="flex items-center gap-3">
                <span
                  className={cn(
                    'flex size-5 shrink-0 items-center justify-center rounded-full border',
                    isDone ? 'border-ink bg-ink text-bg' : active ? 'border-ink' : 'border-line-strong',
                  )}
                >
                  {isDone && <Check aria-hidden weight="bold" className="size-3" />}
                  {active && <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-ink" />}
                </span>
                <span className={cn('text-base', isDone || active ? 'text-ink' : 'text-ink-3')}>
                  {label}
                  {skipped && <span className="text-ink-3"> (every course was already known)</span>}
                  {active && detail && <span className="text-ink-3"> · {detail}</span>}
                </span>
              </li>
            )
          })}
        </ol>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-[-0.015em]">Upload your transcript</h1>
        <p className="text-md text-ink-2">An unofficial transcript PDF from your registrar is fine. We read the courses, then delete the file.</p>
      </div>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center transition-colors duration-150',
          dragging ? 'border-focus bg-yes-soft' : 'border-line-strong bg-surface',
        )}
      >
        {file ? (
          <>
            <FilePdf aria-hidden className="size-8 text-ink-2" />
            <p className="max-w-full truncate font-medium text-ink">{file.name}</p>
            <p className="text-sm text-ink-3">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
            <button type="button" onClick={() => input.current?.click()} className="text-sm text-ink-2 underline">
              Choose a different file
            </button>
          </>
        ) : (
          <>
            <UploadSimple aria-hidden className="size-8 text-ink-3" />
            <p className="text-ink">
              Drag your PDF here, or{' '}
              <button type="button" onClick={() => input.current?.click()} className="font-medium underline">
                choose a file
              </button>
            </p>
            <p className="text-sm text-ink-3">PDF, up to 10 MB</p>
          </>
        )}
        <input ref={input} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} data-testid="transcript-input" />
      </div>
      {error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-danger">
          <WarningCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
      <div>
        <Button variant="primary" size="lg" disabled={!file} onClick={run}>
          Read my transcript
        </Button>
      </div>
    </div>
  )
}
