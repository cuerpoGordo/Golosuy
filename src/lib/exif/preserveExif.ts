import piexif, { type ExifDict } from 'piexifjs'
import {
  arrayBufferToBinaryString,
  binaryStringToArrayBuffer,
  binaryStringToUint8Array,
} from '@/lib/exif/exifBinary'
import { strings } from '@/ui/strings'

export const DEFAULT_JPEG_QUALITY = 0.92

const EXIF_HEADER = 'Exif\x00\x00'
const JPEG_SOI = 0xffd8
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const

export function isJpegArrayBuffer(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 2) {
    return false
  }
  const view = new DataView(buffer)
  return view.getUint16(0) === JPEG_SOI
}

export function isPngArrayBuffer(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < PNG_SIGNATURE.length) {
    return false
  }
  const bytes = new Uint8Array(buffer)
  return PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)
}

/**
 * Извлекает сырой EXIF-блок (Exif\\x00\\x00 + TIFF) из JPEG APP1-сегмента.
 * Байты не парсятся и не изменяются.
 */
export function extractExifBytesFromJpeg(jpegBuffer: ArrayBuffer): string | null {
  if (!isJpegArrayBuffer(jpegBuffer)) {
    return null
  }

  const data = arrayBufferToBinaryString(jpegBuffer)
  let offset = 2

  while (offset + 4 <= data.length) {
    if (data.charCodeAt(offset) !== 0xff) {
      break
    }

    const marker = data.charCodeAt(offset + 1)
    if (marker === 0xd9) {
      break
    }

    const segmentLength =
      (data.charCodeAt(offset + 2) << 8) + data.charCodeAt(offset + 3)
    if (segmentLength < 2 || offset + 2 + segmentLength > data.length) {
      break
    }

    if (marker === 0xe1) {
      const segmentPayload = data.slice(offset + 4, offset + 2 + segmentLength)
      if (segmentPayload.startsWith(EXIF_HEADER)) {
        return segmentPayload
      }
    }

    offset += 2 + segmentLength
  }

  return null
}

/**
 * Извлекает сырой EXIF из PNG-чанка eXIf.
 */
export function extractExifBytesFromPng(pngBuffer: ArrayBuffer): string | null {
  if (!isPngArrayBuffer(pngBuffer)) {
    return null
  }

  const bytes = new Uint8Array(pngBuffer)
  let offset = PNG_SIGNATURE.length

  while (offset + 12 <= bytes.length) {
    const length =
      (bytes[offset]! << 24) |
      (bytes[offset + 1]! << 16) |
      (bytes[offset + 2]! << 8) |
      bytes[offset + 3]!
    const chunkType = String.fromCharCode(
      bytes[offset + 4]!,
      bytes[offset + 5]!,
      bytes[offset + 6]!,
      bytes[offset + 7]!,
    )
    const dataStart = offset + 8
    const dataEnd = dataStart + length

    if (dataEnd + 4 > bytes.length) {
      break
    }

    if (chunkType === 'eXIf') {
      const chunkData = bytes.slice(dataStart, dataEnd)
      let binary = ''
      for (let i = 0; i < chunkData.length; i++) {
        binary += String.fromCharCode(chunkData[i]!)
      }
      if (binary.startsWith(EXIF_HEADER)) {
        return binary
      }
      return null
    }

    if (chunkType === 'IEND') {
      break
    }

    offset = dataEnd + 4
  }

  return null
}

/**
 * Извлекает EXIF из исходного файла.
 * JPEG и PNG (eXIf) — сырой блок без пересборки.
 * HEIC/WebP и прочие форматы — null (iPhone HEIC: метаданные часто недоступны как сырой блок).
 */
export function extractExifFromImage(
  arrayBuffer: ArrayBuffer,
  mimeType?: string,
): string | null {
  if (isJpegArrayBuffer(arrayBuffer) || mimeType === 'image/jpeg') {
    return extractExifBytesFromJpeg(arrayBuffer)
  }

  if (isPngArrayBuffer(arrayBuffer) || mimeType === 'image/png') {
    return extractExifBytesFromPng(arrayBuffer)
  }

  return null
}

export function insertExifIntoJpeg(
  exifBytes: string,
  jpegBuffer: ArrayBuffer,
): ArrayBuffer {
  const jpegBinary = arrayBufferToBinaryString(jpegBuffer)
  const resultBinary = piexif.insert(exifBytes, jpegBinary)
  return binaryStringToArrayBuffer(resultBinary)
}

export async function canvasToJpegBlob(
  canvas: HTMLCanvasElement,
  quality = DEFAULT_JPEG_QUALITY,
): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
          return
        }
        reject(new Error(strings.errors.exportJpegFailed))
      },
      'image/jpeg',
      quality,
    )
  })
}

/**
 * Экспорт canvas в JPEG с вставкой оригинального EXIF-блока.
 */
export async function exportCanvasToJpegWithExif(
  canvas: HTMLCanvasElement,
  exifBytes: string | null,
  quality = DEFAULT_JPEG_QUALITY,
): Promise<Blob> {
  const jpegBlob = await canvasToJpegBlob(canvas, quality)

  if (!exifBytes) {
    return jpegBlob
  }

  const jpegBuffer = await jpegBlob.arrayBuffer()
  const withExif = insertExifIntoJpeg(exifBytes, jpegBuffer)
  return new Blob([withExif], { type: 'image/jpeg' })
}

export function loadExifTags(jpegBuffer: ArrayBuffer): ExifDict {
  return piexif.load(arrayBufferToBinaryString(jpegBuffer))
}

const EXIF_IFD_NAMES = ['0th', 'Exif', 'GPS', 'Interop', '1st'] as const

function normalizeTagValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value
  }
  if (value instanceof Uint8Array) {
    return Array.from(value)
  }
  if (Array.isArray(value)) {
    return value.map(normalizeTagValue)
  }
  return value
}

function areTagRecordsEqual(
  left: Record<number, unknown>,
  right: Record<number, unknown>,
): boolean {
  const leftKeys = Object.keys(left).map(Number).sort((a, b) => a - b)
  const rightKeys = Object.keys(right).map(Number).sort((a, b) => a - b)

  if (leftKeys.length !== rightKeys.length) {
    return false
  }

  return leftKeys.every((key, index) => {
    if (rightKeys[index] !== key) {
      return false
    }
    const leftValue = normalizeTagValue(left[key])
    const rightValue = normalizeTagValue(right[key])
    return JSON.stringify(leftValue) === JSON.stringify(rightValue)
  })
}

/** Сравнивает EXIF-теги двух JPEG (для тестов и проверки сохранности метаданных). */
export function areExifTagsEqual(original: ExifDict, exported: ExifDict): boolean {
  for (const ifdName of EXIF_IFD_NAMES) {
    if (!areTagRecordsEqual(original[ifdName], exported[ifdName])) {
      return false
    }
  }

  const originalThumb = original.thumbnail
  const exportedThumb = exported.thumbnail

  if (originalThumb === null && exportedThumb === null) {
    return true
  }

  if (originalThumb === null || exportedThumb === null) {
    return false
  }

  return originalThumb === exportedThumb
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function canShareBlob(blob: Blob, filename: string): boolean {
  if (typeof navigator.share !== 'function') {
    return false
  }

  const file = new File([blob], filename, { type: blob.type || 'image/jpeg' })

  if (typeof navigator.canShare === 'function') {
    return navigator.canShare({ files: [file] })
  }

  return true
}

export async function shareBlob(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: blob.type || 'image/jpeg' })

  if (!canShareBlob(blob, filename)) {
    throw new Error(strings.errors.shareNotSupported)
  }

  await navigator.share({ files: [file] })
}

export { binaryStringToUint8Array }
