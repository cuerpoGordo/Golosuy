import type { CapturedImage, CaptureSource } from '@/lib/capture/types'
import {
  buildCameraFilename,
  resolveGalleryFilename,
} from '@/lib/capture/imageFilename'
import { takePhotoFromStream } from '@/lib/capture/takePhoto'
import { extractExifFromImage } from '@/lib/exif/preserveExif'

async function buildCapturedImage(
  file: File,
  source: CaptureSource,
  existingArrayBuffer?: ArrayBuffer,
): Promise<CapturedImage> {
  const arrayBuffer = existingArrayBuffer ?? (await file.arrayBuffer())
  const exifBytes = extractExifFromImage(arrayBuffer, file.type)
  const previewUrl = URL.createObjectURL(file)

  return { file, arrayBuffer, exifBytes, previewUrl, source }
}

export async function createCapturedImageFromFile(
  file: File,
  source: CaptureSource = 'gallery',
): Promise<CapturedImage> {
  const arrayBuffer = await file.arrayBuffer()
  const resolvedName = await resolveGalleryFilename(file, arrayBuffer)
  const resolvedFile =
    resolvedName === file.name
      ? file
      : new File([file], resolvedName, {
          type: file.type,
          lastModified: file.lastModified,
        })

  return buildCapturedImage(resolvedFile, source, arrayBuffer)
}

export async function capturePhotoFromStream(
  stream: MediaStream,
): Promise<CapturedImage> {
  const blob = await takePhotoFromStream(stream)
  const mimeType = blob.type || 'image/jpeg'
  const file = new File([blob], buildCameraFilename(mimeType), {
    type: mimeType,
  })

  return buildCapturedImage(file, 'camera')
}

export function revokeCapturedImagePreview(image: CapturedImage): void {
  URL.revokeObjectURL(image.previewUrl)
}
