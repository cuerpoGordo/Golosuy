import { strings } from '@/ui/strings'

interface ResultDownloadProps {
  exifPreserved: boolean
  onRetake: () => void
}

export function ResultDownload({ exifPreserved, onRetake }: ResultDownloadProps) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-6 p-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/20 text-3xl">
        ✓
      </div>

      <div className="text-center">
        <h2 className="text-2xl font-bold">{strings.result.fileSaved}</h2>
        <p className="mt-2 max-w-sm text-text-muted">
          {exifPreserved
            ? strings.result.exifPreserved
            : strings.result.exifMissing}
        </p>
      </div>

      <button
        type="button"
        onClick={onRetake}
        className="w-full max-w-sm rounded-xl bg-accent px-6 py-4 text-lg font-medium text-surface transition-colors hover:bg-accent-hover"
      >
        {strings.app.startOver}
      </button>
    </div>
  )
}
