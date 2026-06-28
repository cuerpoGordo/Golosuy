import type { ImageDimensions } from '@/lib/cv/types'
import { strings } from '@/ui/strings'

export async function getImageDimensions(
  arrayBuffer: ArrayBuffer,
  mimeType: string,
): Promise<ImageDimensions> {
  const blob = new Blob([arrayBuffer], { type: mimeType })
  const bitmap = await createImageBitmap(blob)

  try {
    return { width: bitmap.width, height: bitmap.height }
  } finally {
    bitmap.close()
  }
}

export async function decodeImageToImageData(
  arrayBuffer: ArrayBuffer,
  mimeType: string,
): Promise<{ imageData: ImageData; dimensions: ImageDimensions }> {
  const blob = new Blob([arrayBuffer], { type: mimeType })
  const bitmap = await createImageBitmap(blob)

  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const context = canvas.getContext('2d')

    if (!context) {
      throw new Error(strings.errors.decodeCanvasFailed)
    }

    context.drawImage(bitmap, 0, 0)
    const imageData = context.getImageData(0, 0, bitmap.width, bitmap.height)

    return {
      imageData,
      dimensions: { width: bitmap.width, height: bitmap.height },
    }
  } finally {
    bitmap.close()
  }
}
