export type CaptureSource = 'camera' | 'gallery'

/** Исходное изображение с сохранённым буфером для EXIF. */
export interface CapturedImage {
  file: File
  arrayBuffer: ArrayBuffer
  /** Сырой EXIF-блок (Exif\\x00\\x00…) для piexif.insert, или null. */
  exifBytes: string | null
  previewUrl: string
  source: CaptureSource
}
