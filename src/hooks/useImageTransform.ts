import { useCallback, useEffect, useRef, useState } from 'react'
import {
  clampImageTransform,
  type ImageTransform,
  type ObjectContainLayout,
} from '@/lib/imageLayout'

const MIN_SCALE = 1
const MAX_SCALE = 4
const PAN_THRESHOLD_PX = 6

interface PointerPoint {
  x: number
  y: number
}

interface PanGesture {
  mode: 'pan'
  startTranslateX: number
  startTranslateY: number
  startX: number
  startY: number
}

interface PinchGesture {
  mode: 'pinch'
  startScale: number
  startTranslateX: number
  startTranslateY: number
  startDistance: number
  anchorX: number
  anchorY: number
}

type ActiveGesture = PanGesture | PinchGesture

function distance(a: PointerPoint, b: PointerPoint): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.hypot(dx, dy)
}

function midpoint(a: PointerPoint, b: PointerPoint): PointerPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function toContainerPoint(
  clientX: number,
  clientY: number,
  container: HTMLElement,
): PointerPoint {
  const rect = container.getBoundingClientRect()
  return { x: clientX - rect.left, y: clientY - rect.top }
}

function isMarkUiTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('[data-mark-ui]') !== null
}

export function useImageTransform(
  containerRef: React.RefObject<HTMLElement | null>,
  layout: ObjectContainLayout,
  containerSize: { width: number; height: number },
) {
  const [transform, setTransform] = useState<ImageTransform>({
    scale: 1,
    translateX: 0,
    translateY: 0,
  })

  const pointersRef = useRef(new Map<number, PointerPoint>())
  const gestureRef = useRef<ActiveGesture | null>(null)
  const didGestureRef = useRef(false)

  const applyTransform = useCallback(
    (next: ImageTransform) => {
      setTransform(
        clampImageTransform(
          next,
          layout,
          containerSize.width,
          containerSize.height,
        ),
      )
    },
    [containerSize.height, containerSize.width, layout],
  )

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (isMarkUiTarget(event.target)) {
        return
      }

      const container = containerRef.current
      if (!container) {
        return
      }

      container.setPointerCapture(event.pointerId)
      pointersRef.current.set(
        event.pointerId,
        toContainerPoint(event.clientX, event.clientY, container),
      )

      const points = [...pointersRef.current.values()]

      if (points.length === 2) {
        const center = midpoint(points[0], points[1])
        gestureRef.current = {
          mode: 'pinch',
          startScale: transform.scale,
          startTranslateX: transform.translateX,
          startTranslateY: transform.translateY,
          startDistance: distance(points[0], points[1]),
          anchorX: center.x,
          anchorY: center.y,
        }
        didGestureRef.current = true
      } else if (points.length === 1 && transform.scale > MIN_SCALE) {
        gestureRef.current = {
          mode: 'pan',
          startTranslateX: transform.translateX,
          startTranslateY: transform.translateY,
          startX: points[0].x,
          startY: points[0].y,
        }
      }
    },
    [containerRef, transform.scale, transform.translateX, transform.translateY],
  )

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const container = containerRef.current
      const gesture = gestureRef.current
      if (!container || !gesture) {
        return
      }

      const point = toContainerPoint(event.clientX, event.clientY, container)
      pointersRef.current.set(event.pointerId, point)

      if (gesture.mode === 'pan') {
        const dx = point.x - gesture.startX
        const dy = point.y - gesture.startY

        if (
          !didGestureRef.current &&
          Math.hypot(dx, dy) >= PAN_THRESHOLD_PX
        ) {
          didGestureRef.current = true
        }

        applyTransform({
          scale: transform.scale,
          translateX: gesture.startTranslateX + dx,
          translateY: gesture.startTranslateY + dy,
        })
        return
      }

      const points = [...pointersRef.current.values()]
      if (points.length < 2) {
        return
      }

      const nextDistance = distance(points[0], points[1])
      if (gesture.startDistance <= 0) {
        return
      }

      const center = midpoint(points[0], points[1])
      const nextScale = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, gesture.startScale * (nextDistance / gesture.startDistance)),
      )

      const localX =
        (gesture.anchorX - layout.offsetX - gesture.startTranslateX) /
        gesture.startScale
      const localY =
        (gesture.anchorY - layout.offsetY - gesture.startTranslateY) /
        gesture.startScale

      applyTransform({
        scale: nextScale,
        translateX: center.x - layout.offsetX - localX * nextScale,
        translateY: center.y - layout.offsetY - localY * nextScale,
      })
      didGestureRef.current = true
    },
    [
      applyTransform,
      containerRef,
      layout.offsetX,
      layout.offsetY,
      transform.scale,
    ],
  )

  const endPointer = useCallback((pointerId: number) => {
    pointersRef.current.delete(pointerId)

    if (pointersRef.current.size < 2 && gestureRef.current?.mode === 'pinch') {
      gestureRef.current = null
    }

    if (pointersRef.current.size === 0) {
      gestureRef.current = null
    }
  }, [])

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      endPointer(event.pointerId)
      event.currentTarget.releasePointerCapture(event.pointerId)
    },
    [endPointer],
  )

  const handlePointerCancel = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      endPointer(event.pointerId)
    },
    [endPointer],
  )

  const consumeGesture = useCallback(() => {
    const didGesture = didGestureRef.current
    didGestureRef.current = false
    return didGesture
  }, [])

  const transformRef = useRef(transform)
  transformRef.current = transform

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const handleWheel = (event: WheelEvent) => {
      if (isMarkUiTarget(event.target)) {
        return
      }

      // Pinch на трекпаде (ctrlKey) и Ctrl+колёсико на десктопе.
      if (!event.ctrlKey && !event.metaKey) {
        return
      }

      event.preventDefault()

      const current = transformRef.current
      const point = toContainerPoint(event.clientX, event.clientY, container)
      const zoomFactor = Math.exp(-event.deltaY * 0.01)
      const nextScale = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, current.scale * zoomFactor),
      )

      if (nextScale === current.scale) {
        return
      }

      const localX =
        (point.x - layout.offsetX - current.translateX) / current.scale
      const localY =
        (point.y - layout.offsetY - current.translateY) / current.scale

      applyTransform({
        scale: nextScale,
        translateX: point.x - layout.offsetX - localX * nextScale,
        translateY: point.y - layout.offsetY - localY * nextScale,
      })
      didGestureRef.current = true
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [applyTransform, containerRef, layout.offsetX, layout.offsetY])

  return {
    transform,
    gestureHandlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
    },
    consumeGesture,
  }
}
