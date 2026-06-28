import exifr from 'exifr'

export function buildCameraFilename(mimeType: string, date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  const datePart = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('')
  const timePart = [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('')
  const extension = mimeType === 'image/png' ? 'png' : 'jpg'

  return `IMG_${datePart}_${timePart}.${extension}`
}

export function isGenericFilename(name: string): boolean {
  const trimmed = name.trim()
  if (!trimmed) {
    return true
  }

  const base = trimmed.replace(/\.[^.]+$/, '')
  const lower = base.toLowerCase()

  if (
    ['image', 'img', 'photo', 'picture', 'blob', 'download', 'file', 'unknown', 'temp', 'cache'].includes(
      lower,
    )
  ) {
    return true
  }

  if (/^\d+$/.test(base)) {
    return true
  }

  if (base.length <= 2) {
    return true
  }

  return false
}

function preferredFilenameFromFile(file: File): string {
  const fromPath = file.webkitRelativePath?.split('/').pop()
  if (fromPath && !isGenericFilename(fromPath)) {
    return fromPath
  }

  return file.name
}

async function filenameFromExif(
  arrayBuffer: ArrayBuffer,
  mimeType: string,
): Promise<string | null> {
  try {
    const metadata = await exifr.parse(arrayBuffer, {
      pick: ['DateTimeOriginal', 'CreateDate', 'ModifyDate'],
    })

    if (!metadata) {
      return null
    }

    const capturedAt =
      metadata.DateTimeOriginal ?? metadata.CreateDate ?? metadata.ModifyDate

    if (!(capturedAt instanceof Date) || Number.isNaN(capturedAt.getTime())) {
      return null
    }

    return buildCameraFilename(mimeType, capturedAt)
  } catch {
    return null
  }
}

export async function resolveGalleryFilename(
  file: File,
  arrayBuffer: ArrayBuffer,
): Promise<string> {
  const candidate = preferredFilenameFromFile(file)
  if (!isGenericFilename(candidate)) {
    return candidate
  }

  const mimeType = file.type || 'image/jpeg'
  const fromExif = await filenameFromExif(arrayBuffer, mimeType)
  if (fromExif) {
    return fromExif
  }

  return buildCameraFilename(
    mimeType,
    new Date(file.lastModified || Date.now()),
  )
}
