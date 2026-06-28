import { describe, expect, it } from 'vitest'
import {
  buildCameraFilename,
  isGenericFilename,
  resolveGalleryFilename,
} from '@/lib/capture/imageFilename'

describe('imageFilename', () => {
  it('buildCameraFilename формирует имя в формате IMG_YYYYMMDD_HHMMSS', () => {
    const date = new Date(2026, 5, 28, 11, 31, 21)
    expect(buildCameraFilename('image/jpeg', date)).toBe('IMG_20260628_113121.jpg')
    expect(buildCameraFilename('image/png', date)).toBe('IMG_20260628_113121.png')
  })

  it('isGenericFilename распознаёт типовые имена Android photo picker', () => {
    expect(isGenericFilename('image.jpg')).toBe(true)
    expect(isGenericFilename('1000000022.jpg')).toBe(true)
    expect(isGenericFilename('IMG_20260628_113121.jpg')).toBe(false)
    expect(isGenericFilename('ballot_scan.jpeg')).toBe(false)
  })

  it('resolveGalleryFilename сохраняет осмысленное имя файла', async () => {
    const file = new File(['jpeg'], 'ballot_scan.jpeg', { type: 'image/jpeg' })
    const arrayBuffer = await file.arrayBuffer()

    await expect(resolveGalleryFilename(file, arrayBuffer)).resolves.toBe(
      'ballot_scan.jpeg',
    )
  })

  it('resolveGalleryFilename заменяет generic-имя на дату из EXIF', async () => {
    const { jpegBuffer } = await import('@/lib/exif/__fixtures__/jpegWithExif').then(
      (module) => module.createJpegWithExifFixture(),
    )
    const file = new File([jpegBuffer], 'image.jpg', {
      type: 'image/jpeg',
      lastModified: Date.UTC(2020, 0, 1),
    })

    await expect(resolveGalleryFilename(file, jpegBuffer)).resolves.toBe(
      'IMG_20260615_120000.jpg',
    )
  })
})
