import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  canUseInAppCamera,
  canUseNativeCameraCapture,
  isMobileDevice,
} from '@/lib/capture/cameraSupport'

describe('cameraSupport', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function stubSecureCameraContext() {
    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      configurable: true,
    })
  }

  it('isMobileDevice определяет смартфоны по userAgentData', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0',
      userAgentData: { mobile: true },
      maxTouchPoints: 5,
    })

    expect(isMobileDevice()).toBe(true)
  })

  it('isMobileDevice определяет iPhone по userAgent', () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      maxTouchPoints: 5,
    })

    expect(isMobileDevice()).toBe(true)
  })

  it('canUseInAppCamera отключает кастомный UI на мобильных', () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile',
      userAgentData: { mobile: true },
      maxTouchPoints: 5,
      mediaDevices: { getUserMedia: vi.fn() },
    })
    vi.stubGlobal('ImageCapture', class ImageCapture {})
    stubSecureCameraContext()

    expect(canUseInAppCamera()).toBe(false)
    expect(canUseNativeCameraCapture()).toBe(true)
  })

  it('canUseInAppCamera включает кастомный UI на десктопе с ImageCapture', () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120',
      userAgentData: { mobile: false },
      maxTouchPoints: 0,
      mediaDevices: { getUserMedia: vi.fn() },
    })
    vi.stubGlobal('ImageCapture', class ImageCapture {})
    stubSecureCameraContext()

    expect(canUseInAppCamera()).toBe(true)
    expect(canUseNativeCameraCapture()).toBe(false)
  })
})
