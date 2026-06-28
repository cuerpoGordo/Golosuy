import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useImageTransform } from '@/hooks/useImageTransform'
import type { CapturedImage } from '@/lib/capture/types'
import type { Checkbox, ImageDimensions } from '@/lib/cv/types'
import {
  downloadBlob,
  exportCanvasToJpegWithExif,
  shareBlob,
} from '@/lib/exif/preserveExif'
import {
  bboxToImageLayerRect,
  computeObjectContainLayout,
  displayPointToImage,
  type ObjectContainLayout,
} from '@/lib/imageLayout'
import { FlowHint, FlowSteps } from '@/components/FlowHint'
import { hasMarks, type CheckboxMarks } from '@/lib/pipeline'
import { drawMark, renderMarkedImage, type MarkSession } from '@/lib/render/drawMark'
import { strings } from '@/ui/strings'

interface BallotEditorProps {
  image: CapturedImage
  checkboxes: Checkbox[]
  imageDimensions: ImageDimensions
  marks: CheckboxMarks
  markSession: MarkSession | null
  onAddMark: (centerX: number, centerY: number) => void
  onRemoveMark: (index: number) => void
  onMoveMark: (index: number, centerX: number, centerY: number) => void
  onResizeMark: (index: number, direction: 'increase' | 'decrease') => void
  onDownloaded: () => void
  onRetake: () => void
}

interface DragState {
  index: number
  offsetX: number
  offsetY: number
}

interface PendingDrag {
  index: number
  pointerId: number
  startClientX: number
  startClientY: number
  offsetX: number
  offsetY: number
}

const DRAG_THRESHOLD_PX = 5

function MinusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 3v10M3 8h10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 4h10M6 4V3h4v1M5 4v8.5h6V4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M10 3v9m0 0l3.5-3.5M10 12l-3.5-3.5M4 14v2.5A1.5 1.5 0 0 0 5.5 18h9a1.5 1.5 0 0 0 1.5-1.5V14"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M17 3L9 11M17 3l-5 14-3-6-6-3 14-5z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ButtonSpinner() {
  return (
    <span
      className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-surface/30 border-t-surface"
      role="status"
      aria-hidden="true"
    />
  )
}

const MARK_CONTROLS_WIDTH = 124
const MARK_CONTROLS_HEIGHT = 44
const MARK_CONTROLS_GAP = 8
/** Толщина красной рамки отметки в экранных px (компенсируется zoom). */
const MARK_OUTLINE_SCREEN_PX = 2

function computeMarkControlsAnchor(
  displayRect: { top: number; height: number },
  containerHeight: number,
): 'above' | 'below' {
  const spaceAbove = displayRect.top
  const spaceBelow =
    containerHeight - (displayRect.top + displayRect.height)

  if (spaceAbove >= MARK_CONTROLS_HEIGHT + MARK_CONTROLS_GAP) {
    return 'above'
  }

  if (spaceBelow >= MARK_CONTROLS_HEIGHT + MARK_CONTROLS_GAP) {
    return 'below'
  }

  return spaceAbove >= spaceBelow ? 'above' : 'below'
}

function isMarkUiTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('[data-mark-ui]') !== null
}

interface MarkOverlayProps {
  checkbox: Checkbox
  layout: ObjectContainLayout
  zoomScale: number
  onRemove: () => void
  onResize: (direction: 'increase' | 'decrease') => void
  onDragStart: (
    event: React.PointerEvent<HTMLElement>,
    index: number,
    options?: { immediate?: boolean },
  ) => void
  onControlAction: (action: () => void) => void
}

function MarkOverlay({
  checkbox,
  layout,
  zoomScale,
  onRemove,
  onResize,
  onDragStart,
  onControlAction,
}: MarkOverlayProps) {
  const displayRect = bboxToImageLayerRect(checkbox.bbox, layout)
  const controlsAnchor = computeMarkControlsAnchor(
    displayRect,
    layout.displayHeight,
  )
  const inverseZoomScale = 1 / zoomScale
  const controlsTransformOrigin =
    controlsAnchor === 'above' ? '50% 100%' : '50% 0%'

  return (
    <div
      className="pointer-events-auto absolute"
      data-mark-ui
      style={{
        left: displayRect.left,
        top: displayRect.top,
        width: displayRect.width,
        height: displayRect.height,
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div
        className="absolute inset-0 cursor-move touch-none border-solid border-red-500"
        style={{ borderWidth: `${MARK_OUTLINE_SCREEN_PX * inverseZoomScale}px` }}
        onPointerDown={(event) =>
          onDragStart(event, checkbox.index, { immediate: true })
        }
        aria-label={strings.ballotEditor.markDragAria(checkbox.index)}
      />

      <div
        className="pointer-events-auto absolute left-1/2 cursor-move touch-none"
        data-mark-ui
        style={{
          ...(controlsAnchor === 'above'
            ? { bottom: `calc(100% + ${MARK_CONTROLS_GAP}px)` }
            : { top: `calc(100% + ${MARK_CONTROLS_GAP}px)` }),
          transform: `translateX(-50%) scale(${inverseZoomScale})`,
          transformOrigin: controlsTransformOrigin,
        }}
        onPointerDown={(event) => onDragStart(event, checkbox.index)}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="flex gap-1 rounded-lg bg-black/75 p-1 shadow-lg"
          style={{ width: MARK_CONTROLS_WIDTH }}
        >
          <button
            type="button"
            aria-label={strings.ballotEditor.decreaseMarkAria}
            onPointerDown={(event) => {
              event.stopPropagation()
              onDragStart(event, checkbox.index)
            }}
            onClick={() => onControlAction(() => onResize('decrease'))}
            className="flex h-9 w-9 cursor-move items-center justify-center rounded-md text-white transition-colors hover:bg-white/20 touch-none"
          >
            <MinusIcon />
          </button>
          <button
            type="button"
            aria-label={strings.ballotEditor.deleteMarkAria}
            onPointerDown={(event) => {
              event.stopPropagation()
              onDragStart(event, checkbox.index)
            }}
            onClick={() => onControlAction(onRemove)}
            className="flex h-9 w-9 cursor-move items-center justify-center rounded-md text-red-300 transition-colors hover:bg-red-500/30 touch-none"
          >
            <TrashIcon />
          </button>
          <button
            type="button"
            aria-label={strings.ballotEditor.increaseMarkAria}
            onPointerDown={(event) => {
              event.stopPropagation()
              onDragStart(event, checkbox.index)
            }}
            onClick={() => onControlAction(() => onResize('increase'))}
            className="flex h-9 w-9 cursor-move items-center justify-center rounded-md text-white transition-colors hover:bg-white/20 touch-none"
          >
            <PlusIcon />
          </button>
        </div>
      </div>
    </div>
  )
}

export function BallotEditor({
  image,
  checkboxes,
  imageDimensions,
  marks,
  markSession,
  onAddMark,
  onRemoveMark,
  onMoveMark,
  onResizeMark,
  onDownloaded,
  onRetake,
}: BallotEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const dragStateRef = useRef<DragState | null>(null)
  const pendingDragRef = useRef<PendingDrag | null>(null)
  const didDragRef = useRef(false)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [shareError, setShareError] = useState<string | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isSharing, setIsSharing] = useState(false)

  const layout = computeObjectContainLayout(
    containerSize.width,
    containerSize.height,
    imageDimensions.width,
    imageDimensions.height,
  )

  const { transform, gestureHandlers, consumeGesture } = useImageTransform(
    containerRef,
    layout,
    containerSize,
  )

  const marked = hasMarks(marks) && markSession !== null

  useEffect(() => {
    const element = containerRef.current
    if (!element) {
      return
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) {
        return
      }

      setContainerSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      })
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    const canvas = overlayCanvasRef.current
    if (!canvas || layout.displayWidth <= 0 || layout.displayHeight <= 0) {
      return
    }

    const dpr = window.devicePixelRatio || 1
    const pixelWidth = Math.round(layout.displayWidth * dpr)
    const pixelHeight = Math.round(layout.displayHeight * dpr)
    canvas.width = pixelWidth
    canvas.height = pixelHeight

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, pixelWidth, pixelHeight)

    if (!marked || !markSession) {
      return
    }

    ctx.setTransform(
      layout.scale * dpr,
      0,
      0,
      layout.scale * dpr,
      0,
      0,
    )

    for (const checkbox of checkboxes) {
      const params = marks[checkbox.index]
      if (params) {
        drawMark(ctx, checkbox.bbox, markSession, params)
      }
    }
  }, [
    checkboxes,
    marks,
    markSession,
    marked,
    layout.displayWidth,
    layout.displayHeight,
    layout.scale,
  ])

  const getImagePointFromClient = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) {
        return null
      }

      const rect = containerRef.current.getBoundingClientRect()
      const displayX = clientX - rect.left
      const displayY = clientY - rect.top

      return displayPointToImage(
        displayX,
        displayY,
        layout,
        imageDimensions.width,
        imageDimensions.height,
        transform,
      )
    },
    [imageDimensions, layout, transform],
  )

  const handleImageTap = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (isMarkUiTarget(event.target)) {
        return
      }

      if (consumeGesture()) {
        return
      }

      const imagePoint = getImagePointFromClient(event.clientX, event.clientY)
      if (!imagePoint) {
        return
      }

      onAddMark(imagePoint.x, imagePoint.y)
    },
    [consumeGesture, getImagePointFromClient, onAddMark],
  )

  const handleDragStart = useCallback(
    (
      event: React.PointerEvent<HTMLElement>,
      index: number,
      options?: { immediate?: boolean },
    ) => {
      event.stopPropagation()
      didDragRef.current = false

      const imagePoint = getImagePointFromClient(event.clientX, event.clientY)
      const checkbox = checkboxes.find((item) => item.index === index)
      if (!imagePoint || !checkbox) {
        return
      }

      const centerX = checkbox.bbox.x + checkbox.bbox.width / 2
      const centerY = checkbox.bbox.y + checkbox.bbox.height / 2
      const offsetX = centerX - imagePoint.x
      const offsetY = centerY - imagePoint.y

      if (options?.immediate) {
        dragStateRef.current = { index, offsetX, offsetY }
      } else {
        pendingDragRef.current = {
          index,
          pointerId: event.pointerId,
          startClientX: event.clientX,
          startClientY: event.clientY,
          offsetX,
          offsetY,
        }
      }

      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [checkboxes, getImagePointFromClient],
  )

  const handleControlAction = useCallback((action: () => void) => {
    if (didDragRef.current) {
      didDragRef.current = false
      return
    }

    action()
  }, [])

  const handleDragMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const pendingDrag = pendingDragRef.current
      if (
        pendingDrag &&
        pendingDrag.pointerId === event.pointerId &&
        !dragStateRef.current
      ) {
        const deltaX = event.clientX - pendingDrag.startClientX
        const deltaY = event.clientY - pendingDrag.startClientY
        if (Math.hypot(deltaX, deltaY) >= DRAG_THRESHOLD_PX) {
          didDragRef.current = true
          dragStateRef.current = {
            index: pendingDrag.index,
            offsetX: pendingDrag.offsetX,
            offsetY: pendingDrag.offsetY,
          }
        }
      }

      const dragState = dragStateRef.current
      if (!dragState) {
        return
      }

      const imagePoint = getImagePointFromClient(event.clientX, event.clientY)
      if (!imagePoint) {
        return
      }

      onMoveMark(
        dragState.index,
        imagePoint.x + dragState.offsetX,
        imagePoint.y + dragState.offsetY,
      )
    },
    [getImagePointFromClient, onMoveMark],
  )

  const handleDragEnd = useCallback(() => {
    const hadActiveDrag = dragStateRef.current !== null
    const hadPendingDrag = pendingDragRef.current !== null
    pendingDragRef.current = null
    dragStateRef.current = null
    // Сбрасываем «хвост» прошлого drag, но оставляем флаг до click после текущего drag.
    if (!hadActiveDrag && !hadPendingDrag) {
      didDragRef.current = false
    }
  }, [])

  const exportMarkedJpeg = useCallback(async () => {
    if (!markSession) {
      throw new Error(strings.ballotEditor.markParamsFailed)
    }

    const { canvas } = await renderMarkedImage(
      image.file,
      checkboxes,
      marks,
      markSession,
    )
    return exportCanvasToJpegWithExif(canvas, image.exifBytes)
  }, [checkboxes, image.exifBytes, image.file, markSession, marks])

  const handleDownload = async () => {
    setIsDownloading(true)
    setDownloadError(null)
    setShareError(null)

    try {
      const blob = await exportMarkedJpeg()
      downloadBlob(blob, image.file.name)
      onDownloaded()
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : strings.ballotEditor.saveFailed
      setDownloadError(message)
    } finally {
      setIsDownloading(false)
    }
  }

  const handleShare = async () => {
    setIsSharing(true)
    setShareError(null)
    setDownloadError(null)

    try {
      const blob = await exportMarkedJpeg()
      await shareBlob(blob, image.file.name)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }

      const message =
        error instanceof Error
          ? error.message
          : strings.ballotEditor.shareFailed
      setShareError(message)
    } finally {
      setIsSharing(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="shrink-0 px-4 pt-3">
        <FlowSteps current={marked ? 3 : 2} />
      </div>

      <div
        ref={containerRef}
        className="relative min-h-0 flex-1 touch-none overflow-hidden bg-black"
        data-allow-pinch-zoom
        onClick={handleImageTap}
        onPointerMove={(event) => {
          gestureHandlers.onPointerMove(event)
          handleDragMove(event)
        }}
        onPointerUp={(event) => {
          gestureHandlers.onPointerUp(event)
          handleDragEnd()
        }}
        onPointerCancel={(event) => {
          gestureHandlers.onPointerCancel(event)
          handleDragEnd()
        }}
        onPointerDown={(event) => {
          if (!isMarkUiTarget(event.target)) {
            gestureHandlers.onPointerDown(event)
          }
        }}
        role="button"
        aria-label={strings.ballotEditor.imageTapAria}
      >
        {layout.displayWidth > 0 && (
          <div
            className="absolute cursor-crosshair"
            style={{
              left: layout.offsetX,
              top: layout.offsetY,
              width: layout.displayWidth,
              height: layout.displayHeight,
              transform: `translate(${transform.translateX}px, ${transform.translateY}px) scale(${transform.scale})`,
              transformOrigin: '0 0',
            }}
          >
            <div className="relative h-full w-full">
              <img
                src={image.previewUrl}
                alt={strings.ballotEditor.ballotPhotoAlt}
                className="pointer-events-none relative z-0 h-full w-full select-none"
                draggable={false}
              />

              <canvas
                ref={overlayCanvasRef}
                className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
                aria-hidden="true"
              />

              <div className="pointer-events-none absolute inset-0 z-[2]">
                {checkboxes.map((checkbox) => {
                  if (!(checkbox.index in marks)) {
                    return null
                  }

                  return (
                    <MarkOverlay
                      key={checkbox.index}
                      checkbox={checkbox}
                      layout={layout}
                      zoomScale={transform.scale}
                      onRemove={() => onRemoveMark(checkbox.index)}
                      onResize={(direction) =>
                        onResizeMark(checkbox.index, direction)
                      }
                      onDragStart={handleDragStart}
                      onControlAction={handleControlAction}
                    />
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {!marked && (
          <FlowHint overlay>
            {strings.ballotEditor.hintPlaceMark}
          </FlowHint>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-3 p-4">
        {marked && (
          <FlowHint>
            {strings.ballotEditor.hintDownloadShare}
          </FlowHint>
        )}

        {!marked && (
          <p className="text-center text-xs text-text-muted">
            {strings.ballotEditor.tapHint}
          </p>
        )}

        {(downloadError ?? shareError) && (
          <p className="rounded-lg bg-red-500/15 px-4 py-2 text-center text-sm text-red-300">
            {downloadError ?? shareError}
          </p>
        )}

        <div className="mx-auto flex w-full max-w-sm flex-col gap-4">
          <button
            type="button"
            onClick={() => void handleDownload()}
            disabled={!marked || isDownloading || isSharing}
            aria-busy={isDownloading}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-accent px-6 py-4 text-lg font-medium text-surface transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-raised disabled:text-text-disabled disabled:hover:bg-surface-raised"
          >
            {isDownloading ? <ButtonSpinner /> : <DownloadIcon />}
            {isDownloading ? strings.ballotEditor.saving : strings.ballotEditor.downloadResult}
          </button>

          <button
            type="button"
            onClick={() => void handleShare()}
            disabled={!marked || isDownloading || isSharing}
            aria-busy={isSharing}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-accent px-6 py-4 text-lg font-medium text-surface transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-raised disabled:text-text-disabled disabled:hover:bg-surface-raised"
          >
            {isSharing ? <ButtonSpinner /> : <SendIcon />}
            {isSharing ? strings.ballotEditor.preparing : strings.ballotEditor.shareResult}
          </button>

          <button
            type="button"
            onClick={onRetake}
            className="w-full rounded-xl border border-surface-raised bg-surface-raised px-6 py-4 text-lg font-medium text-text transition-colors hover:border-accent/50"
          >
            {strings.app.startOver}
          </button>
        </div>

        <p className="text-center text-sm text-text-muted">
          {marked ? strings.ballotEditor.marksCount(Object.keys(marks).length) : '\u00A0'}
        </p>
      </div>
    </div>
  )
}
