/** Блокирует pinch-zoom и gesture-zoom всей HTML-страницы (iOS Safari и др.). */
export function preventPageZoom(): void {
  const isPinchZoomTarget = (target: EventTarget | null): boolean =>
    target instanceof Element &&
    target.closest('[data-allow-pinch-zoom]') !== null

  const blockGesture = (event: Event) => {
    if (isPinchZoomTarget(event.target)) {
      return
    }
    event.preventDefault()
  }

  document.addEventListener('gesturestart', blockGesture, { passive: false })
  document.addEventListener('gesturechange', blockGesture, { passive: false })
  document.addEventListener('gestureend', blockGesture, { passive: false })

  document.addEventListener(
    'touchmove',
    (event) => {
      if (event.touches.length > 1 && !isPinchZoomTarget(event.target)) {
        event.preventDefault()
      }
    },
    { passive: false },
  )
}
