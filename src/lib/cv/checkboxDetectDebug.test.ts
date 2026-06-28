import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  disableCheckboxDetectDebug,
  enableCheckboxDetectDebug,
  isCheckboxDetectDebugEnabled,
} from '@/lib/cv/checkboxDetectDebug'

describe('checkboxDetectDebug', () => {
  afterEach(() => {
    disableCheckboxDetectDebug()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('выключен по умолчанию', () => {
    expect(isCheckboxDetectDebugEnabled()).toBe(false)
  })

  it('включается через localStorage', () => {
    const storage = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value)
      },
      removeItem: (key: string) => {
        storage.delete(key)
      },
    })

    enableCheckboxDetectDebug()
    expect(isCheckboxDetectDebugEnabled()).toBe(true)

    disableCheckboxDetectDebug()
    expect(isCheckboxDetectDebugEnabled()).toBe(false)
  })

  it('включается через VITE_CHECKBOX_DETECT_DEBUG', () => {
    vi.stubEnv('VITE_CHECKBOX_DETECT_DEBUG', 'true')
    expect(isCheckboxDetectDebugEnabled()).toBe(true)
  })
})
