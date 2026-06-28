import { strings } from '@/ui/strings'

export function isImageCaptureSupported(): boolean {
  return typeof ImageCapture !== 'undefined'
}

async function buildPhotoSettings(
  imageCapture: ImageCapture,
): Promise<PhotoSettings> {
  const settings: PhotoSettings = {}

  try {
    const capabilities = await imageCapture.getPhotoCapabilities()
    const width = capabilities.imageWidth
    const height = capabilities.imageHeight

    if (width?.max) {
      settings.imageWidth = width.max
    }
    if (height?.max) {
      settings.imageHeight = height.max
    }
  } catch {
    // getPhotoCapabilities может быть недоступен — takePhoto() без настроек всё равно работает.
  }

  return settings
}

/** Снимок с камеры в полном разрешении через Image Capture API. */
export async function takePhotoFromStream(stream: MediaStream): Promise<Blob> {
  const track = stream.getVideoTracks()[0]
  if (!track) {
    throw new Error(strings.camera.notActive)
  }

  if (!isImageCaptureSupported()) {
    throw new Error(strings.camera.browserNoImageCapture)
  }

  const imageCapture = new ImageCapture(track)
  const settings = await buildPhotoSettings(imageCapture)
  const hasSettings = settings.imageWidth !== undefined || settings.imageHeight !== undefined

  try {
    return await imageCapture.takePhoto(hasSettings ? settings : undefined)
  } catch (err) {
    if (hasSettings) {
      return await imageCapture.takePhoto()
    }
    throw err instanceof Error
      ? err
      : new Error(strings.camera.captureFromStreamFailed)
  }
}
