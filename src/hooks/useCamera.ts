import { useCallback, useEffect, useRef, useState } from 'react'
import {
  canUseInAppCamera,
  getCameraErrorMessage,
  isCameraApiSupported,
  isCameraSecureContext,
  mapGetUserMediaError,
} from '@/lib/capture/cameraSupport'
import { capturePhotoFromStream } from '@/lib/capture/createCapturedImage'
import type { CapturedImage } from '@/lib/capture/types'
import { strings } from '@/ui/strings'

export type CameraStatus = 'idle' | 'starting' | 'active' | 'error'

export function useCamera() {
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [status, setStatus] = useState<CameraStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setStream(null)
    setStatus('idle')
    setError(null)
  }, [])

  const start = useCallback(async () => {
    if (!isCameraSecureContext()) {
      const message = getCameraErrorMessage('no-https')
      setError(message)
      setStatus('error')
      throw new Error(message)
    }

    if (!isCameraApiSupported()) {
      const message = getCameraErrorMessage('unsupported')
      setError(message)
      setStatus('error')
      throw new Error(message)
    }

    if (!canUseInAppCamera()) {
      const message = strings.camera.browserNoFullResInApp
      setError(message)
      setStatus('error')
      throw new Error(message)
    }

    stop()
    setStatus('starting')
    setError(null)

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })

      streamRef.current = mediaStream
      setStream(mediaStream)
      setStatus('active')
    } catch (err) {
      const { message } = mapGetUserMediaError(err)
      setError(message)
      setStatus('error')
      throw new Error(message, { cause: err })
    }
  }, [stop])

  const capture = useCallback(async (): Promise<CapturedImage> => {
    const currentStream = streamRef.current
    if (!currentStream) {
      throw new Error(strings.camera.notActive)
    }

    const image = await capturePhotoFromStream(currentStream)
    stop()
    return image
  }, [stop])

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [])

  return {
    stream,
    status,
    error,
    start,
    stop,
    capture,
  }
}
