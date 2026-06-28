declare module 'piexifjs' {
  export interface ExifDict {
    '0th': Record<number, unknown>
    Exif: Record<number, unknown>
    GPS: Record<number, unknown>
    Interop: Record<number, unknown>
    '1st': Record<number, unknown>
    thumbnail: string | null
  }

  export const ImageIFD: Record<string, number>
  export const ExifIFD: Record<string, number>
  export const GPSIFD: Record<string, number>

  export function load(data: string): ExifDict
  export function dump(exifDict: ExifDict): string
  export function insert(exifBytes: string, jpeg: string): string
  export function remove(jpeg: string): string
}
