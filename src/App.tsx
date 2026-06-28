import { useEffect, useReducer } from 'react'
import { BallotEditor } from '@/components/BallotEditor'
import { CameraCapture } from '@/components/CameraCapture'
import { FlowSteps } from '@/components/FlowHint'
import { ResultDownload } from '@/components/ResultDownload'
import { revokeCapturedImagePreview } from '@/lib/capture/createCapturedImage'
import { strings } from '@/ui/strings'
import type { CapturedImage } from '@/lib/capture/types'
import { getImageDimensions } from '@/lib/cv/decodeImage'
import {
  addMarkAt,
  moveMark,
  prepareForEditing,
  proceedToExport,
  removeMark,
  resetPipeline,
  resizeMark,
  type PipelineState,
} from '@/lib/pipeline'

type PipelineAction =
  | { type: 'capture'; image: CapturedImage }
  | {
      type: 'prepare-complete'
      imageDimensions: NonNullable<PipelineState['imageDimensions']>
    }
  | {
      type: 'prepare-failed'
      error: string
    }
  | {
      type: 'add-mark'
      centerX: number
      centerY: number
    }
  | { type: 'remove-mark'; index: number }
  | { type: 'move-mark'; index: number; centerX: number; centerY: number }
  | { type: 'resize-mark'; index: number; direction: 'increase' | 'decrease' }
  | { type: 'download-complete' }
  | { type: 'retake' }

function pipelineReducer(state: PipelineState, action: PipelineAction): PipelineState {
  switch (action.type) {
    case 'capture':
      return {
        step: 'detect',
        image: action.image,
        checkboxes: [],
        marks: {},
        markSession: null,
        imageDimensions: null,
        detectionError: null,
      }
    case 'prepare-complete':
      return prepareForEditing(state, action.imageDimensions)
    case 'prepare-failed':
      return {
        ...state,
        step: 'select',
        detectionError: action.error,
      }
    case 'add-mark':
      return addMarkAt(state, action.centerX, action.centerY)
    case 'remove-mark':
      return removeMark(state, action.index)
    case 'move-mark':
      return moveMark(state, action.index, action.centerX, action.centerY)
    case 'resize-mark':
      return resizeMark(state, action.index, action.direction)
    case 'download-complete':
      return proceedToExport(state)
    case 'retake':
      return resetPipeline()
    default:
      return state
  }
}

function App() {
  const [pipeline, dispatch] = useReducer(
    pipelineReducer,
    undefined,
    resetPipeline,
  )

  useEffect(() => {
    if (pipeline.step !== 'detect' || !pipeline.image) {
      return
    }

    let cancelled = false

    const prepareImage = async () => {
      try {
        const dimensions = await getImageDimensions(
          pipeline.image!.arrayBuffer,
          pipeline.image!.file.type,
        )

        if (cancelled) {
          return
        }

        dispatch({ type: 'prepare-complete', imageDimensions: dimensions })
      } catch {
        if (!cancelled) {
          dispatch({
            type: 'prepare-failed',
            error: strings.app.photoLoadFailed,
          })
        }
      }
    }

    void prepareImage()

    return () => {
      cancelled = true
    }
  }, [pipeline.step, pipeline.image])

  const handleCapture = (image: CapturedImage) => {
    dispatch({ type: 'capture', image })
  }

  const handleRetake = () => {
    if (pipeline.image) {
      revokeCapturedImagePreview(pipeline.image)
    }
    dispatch({ type: 'retake' })
  }

  if (pipeline.step === 'detect' && pipeline.image) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 p-6">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-accent border-t-transparent"
          role="status"
          aria-label={strings.app.loadingPhotoAria}
        />
        <p className="text-center text-lg font-medium">{strings.app.loadingPhoto}</p>
        <p className="max-w-xs text-center text-sm text-text-muted">
          {strings.app.loadingPrivacyNote}
        </p>
        <button
          type="button"
          onClick={handleRetake}
          className="rounded-xl border border-surface-raised px-6 py-3 text-base font-medium text-text transition-colors hover:border-accent/50"
        >
          {strings.app.startOver}
        </button>
      </div>
    )
  }

  if (pipeline.step === 'select' && pipeline.image && !pipeline.imageDimensions) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 p-6">
        <p className="max-w-sm text-center text-red-400">
          {pipeline.detectionError ?? strings.app.photoProcessFailed}
        </p>
        <button
          type="button"
          onClick={handleRetake}
          className="rounded-xl bg-accent px-6 py-3 text-base font-medium text-surface transition-colors hover:bg-accent-hover"
        >
          {strings.app.startOver}
        </button>
      </div>
    )
  }

  if (pipeline.step === 'select' && pipeline.image && pipeline.imageDimensions) {
    return (
      <BallotEditor
        image={pipeline.image}
        checkboxes={pipeline.checkboxes}
        imageDimensions={pipeline.imageDimensions}
        marks={pipeline.marks}
        markSession={pipeline.markSession}
        onAddMark={(centerX, centerY) =>
          dispatch({ type: 'add-mark', centerX, centerY })
        }
        onRemoveMark={(index) => dispatch({ type: 'remove-mark', index })}
        onMoveMark={(index, centerX, centerY) =>
          dispatch({ type: 'move-mark', index, centerX, centerY })
        }
        onResizeMark={(index, direction) =>
          dispatch({ type: 'resize-mark', index, direction })
        }
        onDownloaded={() => dispatch({ type: 'download-complete' })}
        onRetake={handleRetake}
      />
    )
  }

  if (pipeline.step === 'export' && pipeline.image) {
    return (
      <ResultDownload
        exifPreserved={pipeline.image.exifBytes !== null}
        onRetake={handleRetake}
      />
    )
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-6 p-6">
      <FlowSteps current={1} />

      <header className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">{strings.app.title}</h1>
        <p className="mt-2 max-w-md text-text-muted">
          {strings.app.tagline}
        </p>
      </header>

      <p className="max-w-md text-center text font-medium">
        {strings.app.uploadPrompt}
      </p>

      <CameraCapture onCapture={handleCapture} />
    </div>
  )
}

export default App
