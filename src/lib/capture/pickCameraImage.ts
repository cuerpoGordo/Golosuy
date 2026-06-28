import { IMAGE_FILE_ACCEPT } from '@/lib/capture/pickGalleryImage'

export function pickCameraImage(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = IMAGE_FILE_ACCEPT
    input.capture = 'environment'
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
