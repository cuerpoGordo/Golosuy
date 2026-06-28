const STORAGE_KEY = 'golosuy:checkbox-detect-debug'
const LOG_PREFIX = '[golosuy:checkbox-detect]'

export function isCheckboxDetectDebugEnabled(): boolean {
  if (import.meta.env.VITE_CHECKBOX_DETECT_DEBUG === 'true') {
    return true
  }

  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function enableCheckboxDetectDebug(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // localStorage недоступен (приватный режим и т.п.)
  }
  console.info(`${LOG_PREFIX} логирование включено`)
}

export function disableCheckboxDetectDebug(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
  console.info(`${LOG_PREFIX} логирование выключено`)
}

export function checkboxDetectDebugLog(
  message: string,
  data?: unknown,
): void {
  if (!isCheckboxDetectDebugEnabled()) {
    return
  }

  if (data === undefined) {
    console.log(`${LOG_PREFIX} ${message}`)
    return
  }

  console.log(`${LOG_PREFIX} ${message}`, data)
}

/** Один JSON-блок для копирования и отправки в анализ. */
export function checkboxDetectDebugReport(report: unknown): void {
  if (!isCheckboxDetectDebugEnabled()) {
    return
  }

  console.groupCollapsed(`${LOG_PREFIX} отчёт (скопируйте JSON ниже)`)
  console.log(JSON.stringify(report, null, 2))
  console.groupEnd()
}

export interface CheckboxDetectDebugControls {
  enable: () => void
  disable: () => void
  isEnabled: () => boolean
}

declare global {
  interface Window {
    golosuyCheckboxDetectDebug?: CheckboxDetectDebugControls
  }
}

function registerCheckboxDetectDebugGlobal(): void {
  window.golosuyCheckboxDetectDebug = {
    enable: enableCheckboxDetectDebug,
    disable: disableCheckboxDetectDebug,
    isEnabled: isCheckboxDetectDebugEnabled,
  }
}

if (typeof window !== 'undefined') {
  registerCheckboxDetectDebugGlobal()
}
