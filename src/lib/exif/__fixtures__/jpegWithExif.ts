import piexif, { type ExifDict } from 'piexifjs'
import {
  arrayBufferToBinaryString,
  binaryStringToArrayBuffer,
} from '@/lib/exif/exifBinary'

/** Минимальный валидный JPEG 1×1 без EXIF (ImageMagick -strip). */
const MINIMAL_JPEG_BASE64 =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDAREAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAAB//EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAH/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AIi2L3//Z'

/** Минимальный валидный JPEG 1×1 без EXIF. */
export function loadMinimalJpegBuffer(): ArrayBuffer {
  const binary = atob(MINIMAL_JPEG_BASE64)
  return binaryStringToArrayBuffer(binary)
}

export function createSampleExifDict(): ExifDict {
  return {
    '0th': {
      [piexif.ImageIFD.Make]: 'TestMake',
      [piexif.ImageIFD.Model]: 'TestModel',
      [piexif.ImageIFD.Software]: 'GolosuyTest',
      [piexif.ImageIFD.DateTime]: '2026:06:15 12:00:00',
    },
    Exif: {
      [piexif.ExifIFD.DateTimeOriginal]: '2026:06:15 12:00:00',
      [piexif.ExifIFD.DateTimeDigitized]: '2026:06:15 12:00:00',
      [piexif.ExifIFD.PixelXDimension]: 1,
      [piexif.ExifIFD.PixelYDimension]: 1,
    },
    GPS: {},
    Interop: {},
    '1st': {},
    thumbnail: null,
  }
}

export function createJpegWithExifFixture(): {
  jpegBuffer: ArrayBuffer
  exifBytes: string
  exifTags: ExifDict
} {
  const baseBuffer = loadMinimalJpegBuffer()
  const exifDict = createSampleExifDict()
  const exifBytes = piexif.dump(exifDict)
  const jpegBinary = piexif.insert(
    exifBytes,
    arrayBufferToBinaryString(baseBuffer),
  )
  const jpegBuffer = binaryStringToArrayBuffer(jpegBinary)

  return {
    jpegBuffer,
    exifBytes,
    exifTags: piexif.load(jpegBinary),
  }
}
