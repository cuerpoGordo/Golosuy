import { useEffect, useRef, useState } from 'react'
import { createCapturedImageFromFile } from '@/lib/capture/createCapturedImage'
import {
  canUseInAppCamera,
  canUseNativeCameraCapture,
} from '@/lib/capture/cameraSupport'
import { pickCameraImage } from '@/lib/capture/pickCameraImage'
import { pickGalleryImage } from '@/lib/capture/pickGalleryImage'
import type { CapturedImage, CaptureSource } from '@/lib/capture/types'
import { useCamera } from '@/hooks/useCamera'
import { strings } from '@/ui/strings'

interface CameraCaptureProps {
  onCapture: (image: CapturedImage) => void
}

export function CameraCapture({ onCapture }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const { stream, status, error, start, stop, capture } = useCamera()
  const [actionError, setActionError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const useInAppCamera = canUseInAppCamera()
  const useNativeCamera = canUseNativeCameraCapture()

  const isCameraActive = status === 'active' || status === 'starting'
  const displayError = actionError ?? error

  useEffect(() => {
    const video = videoRef.current
    if (!video || !stream) {
      return
    }

    video.srcObject = stream

    const playVideo = async () => {
      try {
        await video.play()
      } catch {
        setActionError(strings.camera.previewFailed)
      }
    }

    void playVideo()
  }, [stream])

  const processSelectedFile = async (
    file: File | null,
    source: CaptureSource = 'gallery',
  ) => {
    if (!file) {
      return
    }

    if (!file.type.startsWith('image/')) {
      setActionError(strings.camera.pickImageFile)
      return
    }

    setActionError(null)
    setIsProcessing(true)

    try {
      const image = await createCapturedImageFromFile(file, source)
      stop()
      onCapture(image)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : strings.camera.fileLoadFailed
      setActionError(message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleTakePhoto = async () => {
    if (useInAppCamera) {
      setActionError(null)
      try {
        await start()
      } catch {
        // Ошибка уже записана в useCamera.
      }
      return
    }

    if (!useNativeCamera) {
      return
    }

    setActionError(null)

    try {
      const file = await pickCameraImage()
      await processSelectedFile(file, 'camera')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : strings.camera.captureFailed
      setActionError(message)
    }
  }

  const handleCapture = async () => {
    if (!stream) {
      return
    }

    setActionError(null)
    setIsProcessing(true)

    try {
      const image = await capture()
      onCapture(image)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : strings.camera.captureFailed
      setActionError(message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handlePickGallery = async () => {
    setActionError(null)

    try {
      const file = await pickGalleryImage()
      await processSelectedFile(file)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : strings.camera.fileLoadFailed
      setActionError(message)
    }
  }

  if (isCameraActive) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-black">
        <video
          ref={videoRef}
          className="min-h-0 flex-1 object-cover"
          playsInline
          muted
          autoPlay
          aria-label={strings.camera.previewAria}
        />

        {status === 'starting' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div
              className="h-10 w-10 animate-spin rounded-full border-2 border-accent border-t-transparent"
              role="status"
              aria-label={strings.camera.startingAria}
            />
          </div>
        )}

        <div className="safe-area-bottom flex shrink-0 flex-col gap-3 bg-gradient-to-t from-black/80 to-transparent p-4 pt-8">
          {displayError && (
            <p className="rounded-lg bg-red-500/20 px-4 py-2 text-center text-sm text-red-300">
              {displayError}
            </p>
          )}

          <div className="flex items-center justify-center gap-6">
            <button
              type="button"
              onClick={() => stop()}
              disabled={isProcessing}
              className="rounded-full bg-surface-raised/90 px-6 py-4 text-base font-medium text-text backdrop-blur-sm transition-colors hover:bg-surface-raised disabled:opacity-50"
            >
              {strings.camera.cancel}
            </button>

            <button
              type="button"
              onClick={() => void handleCapture()}
              disabled={status !== 'active' || isProcessing}
              className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white/20 backdrop-blur-sm transition-transform active:scale-95 disabled:opacity-50"
              aria-label={strings.camera.captureAria}
            >
              <span className="h-14 w-14 rounded-full bg-white" />
            </button>

            <button
              type="button"
              onClick={() => void handlePickGallery()}
              disabled={isProcessing}
              className="rounded-full bg-surface-raised/90 px-6 py-4 text-base font-medium text-text backdrop-blur-sm transition-colors hover:bg-surface-raised disabled:opacity-50"
            >
              {strings.camera.gallery}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      {displayError && (
        <p className="rounded-lg bg-red-500/10 px-4 py-3 text-center text-sm text-red-400">
          {displayError}
        </p>
      )}

      {useInAppCamera || useNativeCamera ? (
        <button
          type="button"
          onClick={() => void handleTakePhoto()}
          disabled={isProcessing}
          className="w-full rounded-xl bg-accent px-6 py-4 text-lg font-medium text-surface transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {strings.camera.takePhoto}
        </button>
      ) : (
        <p className="rounded-lg bg-surface-raised px-4 py-3 text-center text-sm text-text-muted">
          {strings.camera.cameraUnavailable}
        </p>
      )}

      <button
        type="button"
        onClick={() => void handlePickGallery()}
        disabled={isProcessing}
        className="w-full rounded-xl border border-surface-raised bg-surface-raised px-6 py-4 text-lg font-medium text-text transition-colors hover:border-accent/50 disabled:opacity-50"
      >
        {strings.camera.pickFromGallery}
      </button>

      {isProcessing && (
        <div className="flex items-center justify-center gap-2 text-sm text-text-muted">
          <div
            className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent"
            role="status"
            aria-label={strings.camera.processingAria}
          />
          {strings.camera.processing}
        </div>
      )}
    </div>
  )
}
