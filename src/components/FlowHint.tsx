import { strings } from '@/ui/strings'

interface FlowStepsProps {
  current: 1 | 2 | 3
}

export function FlowSteps({ current }: FlowStepsProps) {
  return (
    <div
      className="flex items-center justify-center gap-2"
      role="progressbar"
      aria-valuenow={current}
      aria-valuemin={1}
      aria-valuemax={3}
      aria-label={strings.flow.stepAria(current)}
    >
      {([1, 2, 3] as const).map((step) => (
        <div
          key={step}
          className={`h-1 w-8 rounded-full transition-colors ${
            step <= current ? 'bg-accent' : 'bg-surface-raised'
          }`}
        />
      ))}
    </div>
  )
}

interface FlowHintProps {
  children: React.ReactNode
  /** Подсказка поверх изображения — не перехватывает клики. */
  overlay?: boolean
}

export function FlowHint({ children, overlay = false }: FlowHintProps) {
  if (overlay) {
    return (
      <div
        className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center px-4"
        aria-live="polite"
      >
        <p className="max-w-xs rounded-xl border border-accent/25 bg-surface/85 px-4 py-2.5 text-center text-sm text-text shadow-lg backdrop-blur-sm">
          {children}
        </p>
      </div>
    )
  }

  return (
    <p
      className="text-center text-sm text-accent"
      aria-live="polite"
    >
      {children}
    </p>
  )
}
