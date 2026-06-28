export const IMAGE_FILE_ACCEPT =
  '.jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif'

type GalleryFileHandle = {
  name: string
  getFile(): Promise<File>
}

type GalleryOpenFilePicker = (options?: {
  types?: Array<{
    description: string
    accept: Record<string, string[]>
  }>
  multiple?: boolean
  startIn?: 'pictures'
}) => Promise<GalleryFileHandle[]>

const GALLERY_PICKER_OPTIONS = {
  types: [
    {
      description: 'Images',
      accept: {
        'image/jpeg': ['.jpg', '.jpeg'],
        'image/png': ['.png'],
        'image/webp': ['.webp'],
        'image/heic': ['.heic', '.HEIC'],
        'image/heif': ['.heif', '.HEIF'],
      },
    },
  ],
  multiple: false,
  startIn: 'pictures' as const,
}

function getGalleryFilePicker(): GalleryOpenFilePicker | null {
  const showOpenFilePicker = (
    window as Window & { showOpenFilePicker?: GalleryOpenFilePicker }
  ).showOpenFilePicker

  return typeof showOpenFilePicker === 'function' ? showOpenFilePicker : null
}

export function canUseGalleryFilePicker(): boolean {
  return getGalleryFilePicker() !== null
}

async function pickGalleryImageViaFileSystemAccess(): Promise<File | null> {
  const showOpenFilePicker = getGalleryFilePicker()
  if (!showOpenFilePicker) {
    return null
  }

  const [handle] = await showOpenFilePicker(GALLERY_PICKER_OPTIONS)
  const file = await handle.getFile()

  return new File([file], handle.name, {
    type: file.type || 'image/jpeg',
    lastModified: file.lastModified,
  })
}

function pickGalleryImageViaInput(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = IMAGE_FILE_ACCEPT
    input.style.display = 'none'
    document.body.appendChild(input)

    const cleanup = () => {
      input.remove()
    }

    input.addEventListener(
      'change',
      () => {
        cleanup()
        resolve(input.files?.[0] ?? null)
      },
      { once: true },
    )

    input.addEventListener(
      'cancel',
      () => {
        cleanup()
        resolve(null)
      },
      { once: true },
    )

    input.click()
  })
}

export async function pickGalleryImage(): Promise<File | null> {
  if (canUseGalleryFilePicker()) {
    try {
      return await pickGalleryImageViaFileSystemAccess()
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return null
      }
    }
  }

  return pickGalleryImageViaInput()
}
