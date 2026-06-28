import type { CapturedImage } from '@/lib/capture/types'
import {
  createManualCheckbox,
  estimateDefaultCheckboxSize,
} from '@/lib/cv/checkboxDetect'
import type { BBox, Checkbox, ImageDimensions } from '@/lib/cv/types'
import {
  createMarkRenderParams,
  createMarkSession,
  type MarkRenderParams,
  type MarkSession,
} from '@/lib/render/drawMark'

const MIN_MARK_SIZE = 8
const MARK_SIZE_RESIZE_FACTOR = 1.15

/** Оркестрация шагов обработки изображения. */
export type PipelineStep = 'capture' | 'detect' | 'select' | 'export'

export type CheckboxMarks = Record<number, MarkRenderParams>

export interface PipelineState {
  step: PipelineStep
  image: CapturedImage | null
  checkboxes: Checkbox[]
  marks: CheckboxMarks
  /** Тип и цвет отметки для текущего фото; выбираются при первой отметке. */
  markSession: MarkSession | null
  imageDimensions: ImageDimensions | null
  detectionError: string | null
}

export function createInitialPipelineState(): PipelineState {
  return {
    step: 'capture',
    image: null,
    checkboxes: [],
    marks: {},
    markSession: null,
    imageDimensions: null,
    detectionError: null,
  }
}

export function startCapture(image: CapturedImage): PipelineState {
  return {
    step: 'detect',
    image,
    checkboxes: [],
    marks: {},
    markSession: null,
    imageDimensions: null,
    detectionError: null,
  }
}

export function completeDetection(
  state: PipelineState,
  checkboxes: Checkbox[],
  imageDimensions: ImageDimensions,
): PipelineState {
  return {
    ...state,
    step: 'select',
    checkboxes,
    imageDimensions,
    detectionError: null,
  }
}

export function prepareForEditing(
  state: PipelineState,
  imageDimensions: ImageDimensions,
): PipelineState {
  return {
    ...state,
    step: 'select',
    checkboxes: [],
    marks: {},
    markSession: null,
    imageDimensions,
    detectionError: null,
  }
}

export function failDetection(
  state: PipelineState,
  error: string,
  imageDimensions: ImageDimensions | null = null,
): PipelineState {
  return {
    ...state,
    step: 'select',
    checkboxes: [],
    imageDimensions: imageDimensions ?? state.imageDimensions,
    detectionError: error,
  }
}

function clampMarkSize(
  size: number,
  imageDimensions: ImageDimensions,
): number {
  const maxSize = Math.min(imageDimensions.width, imageDimensions.height) * 0.15
  return Math.max(MIN_MARK_SIZE, Math.min(maxSize, size))
}

function clampBBoxToImage(
  bbox: BBox,
  imageDimensions: ImageDimensions,
): BBox {
  const size = Math.max(bbox.width, bbox.height)
  const half = size / 2
  let centerX = bbox.x + bbox.width / 2
  let centerY = bbox.y + bbox.height / 2

  centerX = Math.max(half, Math.min(imageDimensions.width - half, centerX))
  centerY = Math.max(half, Math.min(imageDimensions.height - half, centerY))

  return {
    x: Math.round(centerX - half),
    y: Math.round(centerY - half),
    width: Math.round(size),
    height: Math.round(size),
  }
}

/** Ограничивает bbox в пределах изображения, сохраняя верхний край и горизонтальный центр. */
function clampBBoxToImageTopCenter(
  bbox: BBox,
  imageDimensions: ImageDimensions,
): BBox {
  const size = Math.max(bbox.width, bbox.height)
  const half = size / 2
  let centerX = bbox.x + bbox.width / 2
  let topY = bbox.y

  centerX = Math.max(half, Math.min(imageDimensions.width - half, centerX))
  topY = Math.max(0, Math.min(imageDimensions.height - size, topY))

  return {
    x: Math.round(centerX - half),
    y: Math.round(topY),
    width: Math.round(size),
    height: Math.round(size),
  }
}

function reindexCheckboxesAndMarks(
  checkboxes: Checkbox[],
  marks: CheckboxMarks,
): { checkboxes: Checkbox[]; marks: CheckboxMarks } {
  const nextCheckboxes: Checkbox[] = []
  const nextMarks: CheckboxMarks = {}

  checkboxes.forEach((checkbox, index) => {
    const nextIndex = index + 1
    nextCheckboxes.push({ ...checkbox, index: nextIndex })

    const params = marks[checkbox.index]
    if (params) {
      nextMarks[nextIndex] = params
    }
  })

  return { checkboxes: nextCheckboxes, marks: nextMarks }
}

export function addMarkAt(
  state: PipelineState,
  centerX: number,
  centerY: number,
  random: () => number = Math.random,
): PipelineState {
  if (!state.imageDimensions) {
    return state
  }

  const size = estimateDefaultCheckboxSize(state.checkboxes, state.imageDimensions)
  const checkbox = createManualCheckbox(
    centerX,
    centerY,
    size,
    state.checkboxes.length,
  )
  const bbox = clampBBoxToImage(checkbox.bbox, state.imageDimensions)
  const placed: Checkbox = { ...checkbox, bbox }
  const markSession = state.markSession ?? createMarkSession(random)

  return {
    ...state,
    markSession,
    checkboxes: [...state.checkboxes, placed],
    marks: {
      ...state.marks,
      [placed.index]: createMarkRenderParams(random),
    },
  }
}

export function removeMark(
  state: PipelineState,
  index: number,
): PipelineState {
  const remaining = state.checkboxes.filter((checkbox) => checkbox.index !== index)
  const { checkboxes, marks } = reindexCheckboxesAndMarks(remaining, state.marks)

  return {
    ...state,
    checkboxes,
    marks,
    markSession: Object.keys(marks).length > 0 ? state.markSession : null,
  }
}

export function moveMark(
  state: PipelineState,
  index: number,
  centerX: number,
  centerY: number,
): PipelineState {
  if (!state.imageDimensions) {
    return state
  }

  return {
    ...state,
    checkboxes: state.checkboxes.map((checkbox) => {
      if (checkbox.index !== index) {
        return checkbox
      }

      const size = Math.max(checkbox.bbox.width, checkbox.bbox.height)
      const half = size / 2
      const bbox = clampBBoxToImage(
        {
          x: centerX - half,
          y: centerY - half,
          width: size,
          height: size,
        },
        state.imageDimensions!,
      )

      return { ...checkbox, bbox }
    }),
  }
}

export function resizeMark(
  state: PipelineState,
  index: number,
  direction: 'increase' | 'decrease',
): PipelineState {
  if (!state.imageDimensions) {
    return state
  }

  return {
    ...state,
    checkboxes: state.checkboxes.map((checkbox) => {
      if (checkbox.index !== index) {
        return checkbox
      }

      const currentSize = Math.max(checkbox.bbox.width, checkbox.bbox.height)
      const factor =
        direction === 'increase'
          ? MARK_SIZE_RESIZE_FACTOR
          : 1 / MARK_SIZE_RESIZE_FACTOR
      const nextSize = clampMarkSize(currentSize * factor, state.imageDimensions!)
      const centerX = checkbox.bbox.x + checkbox.bbox.width / 2
      const topY = checkbox.bbox.y
      const bbox = clampBBoxToImageTopCenter(
        {
          x: centerX - nextSize / 2,
          y: topY,
          width: nextSize,
          height: nextSize,
        },
        state.imageDimensions!,
      )

      return { ...checkbox, bbox }
    }),
  }
}

export function proceedToExport(state: PipelineState): PipelineState {
  return {
    ...state,
    step: 'export',
  }
}

export function resetPipeline(): PipelineState {
  return createInitialPipelineState()
}

export function hasMarks(marks: CheckboxMarks): boolean {
  return Object.keys(marks).length > 0
}
