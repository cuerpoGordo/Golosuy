import type {
  BBox,
  Checkbox,
  CheckboxCandidate,
} from '@/lib/cv/types'
import {
  checkboxDetectDebugLog,
  isCheckboxDetectDebugEnabled,
} from '@/lib/cv/checkboxDetectDebug'

const MIN_CHECKBOX_COUNT = 2
const MAX_CHECKBOXES = 30

/**
 * Удаляет вложенные дубликаты одного квадрата (контуры рамки и заливки):
 * при близком центре оставляет самый внутренний — с наименьшей площадью.
 */
export function deduplicateNestedCheckboxCandidates(
  candidates: CheckboxCandidate[],
): CheckboxCandidate[] {
  if (candidates.length <= 1) {
    return candidates
  }

  const debug = isCheckboxDetectDebugEnabled()
  const toRemove = new Set<CheckboxCandidate>()
  const pairAnalyses: NestedDuplicateAnalysis[] = []

  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const analysis = analyzeNestedDuplicatePair(candidates[i], candidates[j], i, j)
      if (debug && analysis.interesting) {
        pairAnalyses.push(analysis)
      }
      if (analysis.isNested && analysis.outer) {
        toRemove.add(analysis.outer)
      }
    }
  }

  const kept = candidates.filter((candidate) => !toRemove.has(candidate))

  if (debug) {
    checkboxDetectDebugLog('дедупликация вложенных', {
      inputCount: candidates.length,
      removedCount: toRemove.size,
      keptCount: kept.length,
      candidates: candidates.map(serializeCandidate),
      removed: [...toRemove].map(serializeCandidate),
      kept: kept.map(serializeCandidate),
      pairAnalyses,
    })
  }

  return kept
}

/**
 * Отсекает шум (буквы, мелкие прямоугольники): оставляет кандидатов
 * с размером, близким к эталону крупнейших найденных квадратиков.
 * Не зависит от ориентации кадра.
 */
export function filterCheckboxCandidates(
  candidates: CheckboxCandidate[],
): CheckboxCandidate[] {
  if (candidates.length === 0) {
    return []
  }

  if (candidates.length === 1) {
    return candidates
  }

  const referenceSize = getReferenceCheckboxSize(candidates)
  const sizeTolerance = Math.max(referenceSize * 0.35, 6)
  const bySize = candidates.filter((candidate) => {
    const size = candidateSize(candidate)
    return Math.abs(size - referenceSize) <= sizeTolerance
  })

  const medianArea = median(bySize.map((c) => c.area))
  const byArea = bySize.filter(
    (c) => Math.abs(c.area - medianArea) / medianArea <= 0.55,
  )

  const filtered =
    byArea.length >= MIN_CHECKBOX_COUNT ? byArea : bySize

  if (isCheckboxDetectDebugEnabled()) {
    checkboxDetectDebugLog('фильтрация по размеру', {
      referenceSize: roundDebug(referenceSize),
      sizeTolerance: roundDebug(sizeTolerance),
      before: candidates.length,
      afterSizeFilter: bySize.length,
      afterAreaFilter: byArea.length,
      kept: filtered.length,
    })
  }

  if (filtered.length >= MIN_CHECKBOX_COUNT) {
    return filtered
  }

  return candidates.length <= MAX_CHECKBOXES ? candidates : filtered
}

/** Сортировка сверху вниз и присвоение index (1-based). */
export function sortCheckboxesTopToBottom(
  candidates: CheckboxCandidate[],
): Checkbox[] {
  return [...candidates]
    .sort((a, b) => a.centerY - b.centerY)
    .map((candidate, index) => ({
      bbox: roundBBox(candidate.bbox),
      index: index + 1,
    }))
}

/** Создать квадратик вручную (fallback при тапе по превью). */
export function createManualCheckbox(
  centerX: number,
  centerY: number,
  size: number,
  existingCount: number,
): Checkbox {
  const half = size / 2
  return {
    bbox: roundBBox({
      x: centerX - half,
      y: centerY - half,
      width: size,
      height: size,
    }),
    index: existingCount + 1,
  }
}

/** Размер квадратика по умолчанию — медиана найденных или 7% от меньшей стороны кадра. */
export function estimateDefaultCheckboxSize(
  checkboxes: Checkbox[],
  imageDimensions: { width: number; height: number },
): number {
  if (checkboxes.length > 0) {
    const sizes = checkboxes.map((c) =>
      Math.max(c.bbox.width, c.bbox.height),
    )
    return median(sizes)
  }

  return Math.max(16, Math.round(Math.min(imageDimensions.width, imageDimensions.height) * 0.07))
}

interface NestedDuplicateMetrics {
  centerDistance: number
  centerDistanceThreshold: number
  centersClose: boolean
  areaRatio: number
  minAreaRatio: number
  areaDifferentEnough: boolean
  tolerance: number
  bboxContains: boolean
  centerInsideOuter: boolean
  overlapRatio: number
  sizesSimilar: boolean
}

interface NestedDuplicateAnalysis {
  pair: [number, number]
  a: ReturnType<typeof serializeCandidate>
  b: ReturnType<typeof serializeCandidate>
  interesting: boolean
  isNested: boolean
  reason: string
  outer: CheckboxCandidate | null
  inner: CheckboxCandidate | null
  metrics: NestedDuplicateMetrics
}

const MIN_NESTED_AREA_RATIO = 1.15
const CENTER_DISTANCE_FACTOR = 0.4
const MAX_SIMILAR_SIZE_RATIO = 1.2
const MIN_OVERLAP_RATIO = 0.55

function analyzeNestedDuplicatePair(
  a: CheckboxCandidate,
  b: CheckboxCandidate,
  indexA: number,
  indexB: number,
): NestedDuplicateAnalysis {
  const metrics = measureNestedDuplicateMetrics(a, b)
  const serializedA = serializeCandidate(a, indexA)
  const serializedB = serializeCandidate(b, indexB)
  const [larger, smaller] = a.area >= b.area ? [a, b] : [b, a]
  const base = {
    pair: [indexA, indexB] as [number, number],
    a: serializedA,
    b: serializedB,
    metrics,
    outer: larger,
    inner: smaller,
  }

  if (!metrics.centersClose) {
    return {
      ...base,
      outer: null,
      inner: null,
      interesting: metrics.overlapRatio >= MIN_OVERLAP_RATIO,
      isNested: false,
      reason: 'центры далеко',
    }
  }

  const nestedByContainment =
    metrics.bboxContains || metrics.centerInsideOuter
  const coincidentDuplicate =
    metrics.sizesSimilar && metrics.overlapRatio >= MIN_OVERLAP_RATIO

  if (metrics.areaDifferentEnough && nestedByContainment) {
    return {
      ...base,
      interesting: true,
      isNested: true,
      reason: metrics.bboxContains
        ? 'внешний bbox содержит внутренний'
        : 'центр внутреннего внутри внешнего bbox',
    }
  }

  if (coincidentDuplicate) {
    return {
      ...base,
      interesting: true,
      isNested: true,
      reason: 'совпадающие контуры одного квадрата',
    }
  }

  return {
    ...base,
    interesting: true,
    isNested: false,
    reason: nestedByContainment
      ? 'площади слишком похожи'
      : 'центры близко, но нет перекрытия',
  }
}

function measureNestedDuplicateMetrics(
  a: CheckboxCandidate,
  b: CheckboxCandidate,
): NestedDuplicateMetrics {
  const smallerSize = Math.min(
    Math.min(a.bbox.width, a.bbox.height),
    Math.min(b.bbox.width, b.bbox.height),
  )
  const centerDistance = Math.hypot(a.centerX - b.centerX, a.centerY - b.centerY)
  const centerDistanceThreshold = smallerSize * CENTER_DISTANCE_FACTOR
  const centersClose = centerDistance <= centerDistanceThreshold

  const [outer, inner] = a.area >= b.area ? [a, b] : [b, a]
  const areaRatio = inner.area > 0 ? outer.area / inner.area : Number.POSITIVE_INFINITY
  const tolerance = Math.max(2, Math.min(inner.bbox.width, inner.bbox.height) * 0.15)
  const contains = bboxContains(outer.bbox, inner.bbox, tolerance)
  const centerInside = pointInBBox(
    outer.bbox,
    inner.centerX,
    inner.centerY,
    tolerance,
  )

  return {
    centerDistance: roundDebug(centerDistance),
    centerDistanceThreshold: roundDebug(centerDistanceThreshold),
    centersClose,
    areaRatio: roundDebug(areaRatio),
    minAreaRatio: MIN_NESTED_AREA_RATIO,
    areaDifferentEnough: outer.area >= inner.area * MIN_NESTED_AREA_RATIO,
    tolerance: roundDebug(tolerance),
    bboxContains: contains,
    centerInsideOuter: centerInside,
    overlapRatio: roundDebug(bboxOverlapRatio(a.bbox, b.bbox)),
    sizesSimilar: sizesAreSimilar(a.bbox, b.bbox),
  }
}

function sizesAreSimilar(a: BBox, b: BBox): boolean {
  const widthRatio =
    Math.max(a.width, b.width) / Math.max(1, Math.min(a.width, b.width))
  const heightRatio =
    Math.max(a.height, b.height) / Math.max(1, Math.min(a.height, b.height))
  return widthRatio <= MAX_SIMILAR_SIZE_RATIO && heightRatio <= MAX_SIMILAR_SIZE_RATIO
}

function bboxOverlapRatio(a: BBox, b: BBox): number {
  const intersectionX1 = Math.max(a.x, b.x)
  const intersectionY1 = Math.max(a.y, b.y)
  const intersectionX2 = Math.min(a.x + a.width, b.x + b.width)
  const intersectionY2 = Math.min(a.y + a.height, b.y + b.height)

  if (intersectionX2 <= intersectionX1 || intersectionY2 <= intersectionY1) {
    return 0
  }

  const intersectionArea =
    (intersectionX2 - intersectionX1) * (intersectionY2 - intersectionY1)
  const minArea = Math.min(a.width * a.height, b.width * b.height)
  if (minArea <= 0) {
    return 0
  }

  return intersectionArea / minArea
}

function serializeCandidate(candidate: CheckboxCandidate, index?: number) {
  return {
    index,
    bbox: roundBBox(candidate.bbox),
    center: {
      x: roundDebug(candidate.centerX),
      y: roundDebug(candidate.centerY),
    },
    area: roundDebug(candidate.area),
    size: roundDebug(Math.max(candidate.bbox.width, candidate.bbox.height)),
  }
}

function roundDebug(value: number): number {
  return Math.round(value * 100) / 100
}

function bboxContains(outer: BBox, inner: BBox, tolerance: number): boolean {
  return (
    inner.x >= outer.x - tolerance &&
    inner.y >= outer.y - tolerance &&
    inner.x + inner.width <= outer.x + outer.width + tolerance &&
    inner.y + inner.height <= outer.y + outer.height + tolerance
  )
}

function pointInBBox(
  bbox: BBox,
  x: number,
  y: number,
  tolerance: number,
): boolean {
  return (
    x >= bbox.x - tolerance &&
    y >= bbox.y - tolerance &&
    x <= bbox.x + bbox.width + tolerance &&
    y <= bbox.y + bbox.height + tolerance
  )
}

function candidateSize(candidate: CheckboxCandidate): number {
  return Math.max(candidate.bbox.width, candidate.bbox.height)
}

function getReferenceCheckboxSize(candidates: CheckboxCandidate[]): number {
  const topByArea = [...candidates]
    .sort((a, b) => b.area - a.area)
    .slice(0, Math.max(4, Math.ceil(candidates.length * 0.12)))
  return median(topByArea.map(candidateSize))
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0
  }

  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2
  }

  return sorted[mid]
}

function roundBBox(bbox: BBox): BBox {
  return {
    x: Math.round(bbox.x),
    y: Math.round(bbox.y),
    width: Math.round(bbox.width),
    height: Math.round(bbox.height),
  }
}
