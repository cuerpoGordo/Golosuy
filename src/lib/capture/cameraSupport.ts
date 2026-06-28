import { strings } from '@/ui/strings'

export type CameraErrorCode =
  | 'no-https'
  | 'unsupported'
  | 'permission-denied'
  | 'not-found'
  | 'unknown'

const ERROR_MESSAGES: Record<CameraErrorCode, string> = {
  'no-https': strings.camera.errors.noHttps,
  unsupported: strings.camera.errors.unsupported,
  'permission-denied': strings.camera.errors.permissionDenied,
  'not-found': strings.camera.errors.notFound,
  unknown: strings.camera.errors.unknown,
}

export function isCameraSecureContext(): boolean {
  return window.isSecureContext
}

export function isCameraApiSupported(): boolean {
  return Boolean(navigator.mediaDevices?.getUserMedia)
}

export function canUseCamera(): boolean {
  return isCameraSecureContext() && isCameraApiSupported()
}

/** Смартфон или планшет — для них используем системную камеру через `<input capture>`. */
export function isMobileDevice(): boolean {
  const userAgentData = (
    navigator as Navigator & { userAgentData?: { mobile?: boolean } }
  ).userAgentData

  if (userAgentData?.mobile === true) {
    return true
  }

  const userAgent = navigator.userAgent

  if (/Android|iPhone|iPod|Mobile/i.test(userAgent)) {
    return true
  }

  if (/iPad/i.test(userAgent)) {
    return true
  }

  // iPadOS 13+ маскируется под Macintosh, но остаётся сенсорным.
  return navigator.maxTouchPoints > 1 && /Macintosh/i.test(userAgent)
}

/** Превью в приложении + съёмка takePhoto() в полном разрешении (десктоп). */
export function canUseInAppCamera(): boolean {
  return (
    canUseCamera() &&
    typeof ImageCapture !== 'undefined' &&
    !isMobileDevice()
  )
}

/** Системная камера через `<input type="file" capture>`. */
export function canUseNativeCameraCapture(): boolean {
  return canUseCamera() && !canUseInAppCamera()
}

export function getCameraErrorMessage(code: CameraErrorCode): string {
  return ERROR_MESSAGES[code]
}

export function mapGetUserMediaError(error: unknown): {
  code: CameraErrorCode
  message: string
} {
  if (error instanceof DOMException) {
    switch (error.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return {
          code: 'permission-denied',
          message: ERROR_MESSAGES['permission-denied'],
        }
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return {
          code: 'not-found',
          message: ERROR_MESSAGES['not-found'],
        }
      default:
        break
    }
  }

  return { code: 'unknown', message: ERROR_MESSAGES.unknown }
}
