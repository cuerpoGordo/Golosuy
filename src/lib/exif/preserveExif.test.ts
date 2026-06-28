import piexif from 'piexifjs'
import { describe, expect, it } from 'vitest'
import {
  createJpegWithExifFixture,
  loadMinimalJpegBuffer,
} from '@/lib/exif/__fixtures__/jpegWithExif'
import {
  arrayBufferToBinaryString,
  binaryStringToArrayBuffer,
} from '@/lib/exif/exifBinary'
import {
  areExifTagsEqual,
  extractExifBytesFromJpeg,
  extractExifFromImage,
  insertExifIntoJpeg,
  loadExifTags,
} from '@/lib/exif/preserveExif'

describe('preserveExif', () => {
  it('извлекает сырой EXIF-блок из JPEG без изменений', () => {
    const { jpegBuffer, exifBytes } = createJpegWithExifFixture()
    const extracted = extractExifBytesFromJpeg(jpegBuffer)

    expect(extracted).not.toBeNull()
    expect(extracted).toBe(exifBytes)
  })

  it('extractExifFromImage возвращает null для JPEG без EXIF', () => {
    const buffer = loadMinimalJpegBuffer()
    expect(extractExifFromImage(buffer, 'image/jpeg')).toBeNull()
  })

  it('вставляет оригинальный EXIF в новый JPEG через piexif.insert', () => {
    const { exifBytes, exifTags } = createJpegWithExifFixture()
    const plainJpeg = loadMinimalJpegBuffer()

    const exportedBuffer = insertExifIntoJpeg(exifBytes, plainJpeg)
    const exportedTags = loadExifTags(exportedBuffer)

    expect(areExifTagsEqual(exifTags, exportedTags)).toBe(true)
  })

  it('JPEG без EXIF остаётся без EXIF после insert с null-проверкой', () => {
    const plainJpeg = loadMinimalJpegBuffer()
    expect(extractExifBytesFromJpeg(plainJpeg)).toBeNull()
  })

  it('round-trip: EXIF-сегмент после вставки совпадает с оригиналом', () => {
    const { jpegBuffer, exifBytes } = createJpegWithExifFixture()
    const originalExif = extractExifBytesFromJpeg(jpegBuffer)
    expect(originalExif).not.toBeNull()

    const plainJpeg = piexif.remove(arrayBufferToBinaryString(jpegBuffer))
    const reinserted = insertExifIntoJpeg(
      exifBytes,
      binaryStringToArrayBuffer(plainJpeg),
    )
    const reinsertedExif = extractExifBytesFromJpeg(reinserted)

    expect(reinsertedExif).toBe(originalExif)
  })
})
