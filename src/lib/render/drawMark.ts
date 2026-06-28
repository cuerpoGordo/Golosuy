import type { BBox, Checkbox } from '@/lib/cv/types'
import { strings } from '@/ui/strings'

export type MarkType = 'check' | 'cross'

/** Цвет чернил для всех отметок на одном фото. */
export interface MarkInkColor {
  hue: number
  saturation: number
  lightness: number
}

/** Параметры отметки, общие для одного фото. */
export interface MarkSession {
  markType: MarkType
  ink: MarkInkColor
}

export interface MarkRenderParams {
  /** Доля меньшей стороны квадратика (0.72–0.92). */
  sizeRatio: number
  /** Наклон отметки в радианах (±5°). */
  tiltRadians: number
  /** Смещение центра относительно квадратика (доля стороны). */
  offsetXRatio: number
  offsetYRatio: number
  /** Амплитуда «дрожания» линии (доля размера отметки). */
  wobbleRatio: number
  /** Множитель толщины линии (0.88–1.12). */
  lineWidthMultiplier: number
  /** Семя вариации формы (0–1). */
  shapeVariant: number
}

const MIN_SIZE_RATIO = 0.72
const MAX_SIZE_RATIO = 0.92
const MAX_TILT_DEGREES = 5
/** Толщина штриха относительно стороны отметки. */
const LINE_WIDTH_RATIO = 0.088
/** Нижняя граница толщины — доля стороны отметки, не фиксированные пиксели. */
const MIN_LINE_WIDTH_RATIO = 0.045
/** Диапазон оттенка чернил: синий, без ухода в фиолетовый. */
const INK_HUE_MIN = 210
const INK_HUE_MAX = 245

interface Point2D {
  x: number
  y: number
}

export function createSessionMarkType(
  random: () => number = Math.random,
): MarkType {
  return random() < 0.5 ? 'check' : 'cross'
}

export function createSessionInkColor(
  random: () => number = Math.random,
): MarkInkColor {
  return {
    hue: INK_HUE_MIN + random() * (INK_HUE_MAX - INK_HUE_MIN),
    saturation: 50 + random() * 40,
    lightness: 24 + random() * 22,
  }
}

export function createMarkSession(
  random: () => number = Math.random,
): MarkSession {
  return {
    markType: createSessionMarkType(random),
    ink: createSessionInkColor(random),
  }
}

export function createMarkRenderParams(
  random: () => number = Math.random,
): MarkRenderParams {
  const sizeRatio =
    MIN_SIZE_RATIO + random() * (MAX_SIZE_RATIO - MIN_SIZE_RATIO)
  const tiltDegrees = random() * 2 * MAX_TILT_DEGREES - MAX_TILT_DEGREES

  return {
    sizeRatio,
    tiltRadians: (tiltDegrees * Math.PI) / 180,
    offsetXRatio: (random() - 0.5) * 0.1,
    offsetYRatio: (random() - 0.5) * 0.1,
    wobbleRatio: 0.035 + random() * 0.07,
    lineWidthMultiplier: 0.88 + random() * 0.24,
    shapeVariant: random(),
  }
}

export function getMarkLineWidth(checkboxSide: number, sizeRatio: number): number {
  const markSide = checkboxSide * sizeRatio
  const proportional = markSide * LINE_WIDTH_RATIO
  const minWidth = markSide * MIN_LINE_WIDTH_RATIO
  return Math.max(minWidth, proportional)
}

function pseudoRandom(seed: number, index: number): number {
  const value = Math.sin(seed * 12.9898 + index * 78.233) * 43758.5453
  return value - Math.floor(value)
}

function hslColor(hue: number, saturation: number, lightness: number): string {
  return `hsl(${hue.toFixed(1)}, ${saturation.toFixed(1)}%, ${lightness.toFixed(1)}%)`
}

function jitterPoint(
  point: Point2D,
  amount: number,
  seed: number,
  index: number,
): Point2D {
  return {
    x: point.x + (pseudoRandom(seed, index) - 0.5) * 2 * amount,
    y: point.y + (pseudoRandom(seed, index + 17) - 0.5) * 2 * amount,
  }
}

interface InkTaperConfig {
  atStart: boolean
  /** Доля длины штриха с эффектом (0.15–0.3). */
  fraction: number
  /** Короткий хвостик на кончике (0 или 1). */
  frayCount: number
}

/** ~40% штрихов получают лёгкое сужение на одном конце (шариковая ручка). */
function resolveInkTaper(seed: number, strokeIndex: number): InkTaperConfig | null {
  const chance = pseudoRandom(seed, strokeIndex * 31 + 501)
  if (chance > 0.4) {
    return null
  }

  return {
    atStart: pseudoRandom(seed, strokeIndex * 31 + 502) < 0.5,
    fraction: 0.14 + pseudoRandom(seed, strokeIndex * 31 + 503) * 0.1,
    frayCount: pseudoRandom(seed, strokeIndex * 31 + 504) < 0.35 ? 1 : 0,
  }
}

function sampleQuadratic(
  from: Point2D,
  control: Point2D,
  to: Point2D,
  steps: number,
): Point2D[] {
  const samples: Point2D[] = []
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps
    const inverse = 1 - t
    samples.push({
      x: inverse * inverse * from.x + 2 * inverse * t * control.x + t * t * to.x,
      y: inverse * inverse * from.y + 2 * inverse * t * control.y + t * t * to.y,
    })
  }
  return samples
}

function sampleStrokePath(
  points: Point2D[],
  wobbleAmount: number,
  seed: number,
  stepsPerSegment = 8,
): Point2D[] {
  if (points.length < 2) {
    return []
  }

  const samples: Point2D[] = []
  const start = jitterPoint(points[0], wobbleAmount * 0.35, seed, 0)
  samples.push(start)

  for (let i = 1; i < points.length; i += 1) {
    const previous = points[i - 1]
    const current = points[i]
    const control = jitterPoint(
      { x: (previous.x + current.x) / 2, y: (previous.y + current.y) / 2 },
      wobbleAmount,
      seed,
      i * 2,
    )
    const end = jitterPoint(current, wobbleAmount * 0.25, seed, i * 2 + 1)
    const from = i === 1 ? start : samples[samples.length - 1]
    samples.push(...sampleQuadratic(from, control, end, stepsPerSegment))
  }

  return samples
}

function drawInkTaperZone(
  ctx: CanvasRenderingContext2D,
  samples: Point2D[],
  baseLineWidth: number,
  inkTaper: InkTaperConfig,
): void {
  const taperCount = Math.max(4, Math.floor(samples.length * inkTaper.fraction))
  const zone =
    inkTaper.atStart
      ? samples.slice(0, taperCount + 1)
      : samples.slice(samples.length - taperCount - 1)
  const bandCount = 4

  for (let band = 0; band < bandCount; band += 1) {
    const bandStart = Math.floor((band / bandCount) * (zone.length - 1))
    const bandEnd = Math.floor(((band + 1) / bandCount) * (zone.length - 1))
    if (bandEnd <= bandStart) {
      continue
    }

    const progress = inkTaper.atStart
      ? band / (bandCount - 1)
      : 1 - band / (bandCount - 1)
    const widthFactor = 0.5 + 0.5 * progress

    ctx.lineWidth = baseLineWidth * widthFactor
    ctx.beginPath()
    ctx.moveTo(zone[bandStart].x, zone[bandStart].y)
    for (let i = bandStart + 1; i <= bandEnd; i += 1) {
      ctx.lineTo(zone[i].x, zone[i].y)
    }
    ctx.stroke()
  }
}

/** Короткий хвостик чернил на кончике — слегка ломаный, но плавный. */
function drawInkFray(
  ctx: CanvasRenderingContext2D,
  tip: Point2D,
  direction: Point2D,
  baseLineWidth: number,
  wobbleAmount: number,
  seed: number,
  frayCount: number,
): void {
  if (frayCount === 0) {
    return
  }

  const dirLength = Math.hypot(direction.x, direction.y) || 1
  const dirX = direction.x / dirLength
  const dirY = direction.y / dirLength
  const perpX = -dirY
  const perpY = dirX
  const savedAlpha = ctx.globalAlpha
  const length = wobbleAmount * (0.18 + pseudoRandom(seed, 1200) * 0.15)

  const midT = 0.42 + pseudoRandom(seed, 1210) * 0.18
  const midJitter = wobbleAmount * (0.05 + pseudoRandom(seed, 1220) * 0.04)
  const midX =
    tip.x -
    dirX * length * midT +
    perpX * (pseudoRandom(seed, 1230) - 0.5) * 2 * midJitter
  const midY =
    tip.y -
    dirY * length * midT +
    perpY * (pseudoRandom(seed, 1231) - 0.5) * 2 * midJitter

  const endJitter = wobbleAmount * 0.035
  const endX =
    tip.x -
    dirX * length +
    perpX * (pseudoRandom(seed, 1240) - 0.5) * 2 * endJitter
  const endY =
    tip.y -
    dirY * length +
    perpY * (pseudoRandom(seed, 1241) - 0.5) * 2 * endJitter

  ctx.lineWidth = baseLineWidth * 0.5
  ctx.globalAlpha = savedAlpha * 0.35
  ctx.beginPath()
  ctx.moveTo(tip.x, tip.y)
  ctx.lineTo(midX, midY)
  ctx.lineTo(endX, endY)
  ctx.stroke()

  ctx.globalAlpha = savedAlpha
}

function drawPenStroke(
  ctx: CanvasRenderingContext2D,
  points: Point2D[],
  wobbleAmount: number,
  seed: number,
  inkTaper: InkTaperConfig | null = null,
): void {
  if (points.length < 2) {
    return
  }

  const baseLineWidth = ctx.lineWidth

  if (!inkTaper) {
    const start = jitterPoint(points[0], wobbleAmount * 0.35, seed, 0)
    ctx.beginPath()
    ctx.moveTo(start.x, start.y)

    for (let i = 1; i < points.length; i += 1) {
      const previous = points[i - 1]
      const current = points[i]
      const midX = (previous.x + current.x) / 2
      const midY = (previous.y + current.y) / 2
      const control = jitterPoint({ x: midX, y: midY }, wobbleAmount, seed, i * 2)
      const end = jitterPoint(current, wobbleAmount * 0.25, seed, i * 2 + 1)
      ctx.quadraticCurveTo(control.x, control.y, end.x, end.y)
    }

    ctx.stroke()
    return
  }

  const samples = sampleStrokePath(points, wobbleAmount, seed)
  if (samples.length < 5) {
    return
  }

  const taperCount = Math.max(4, Math.floor(samples.length * inkTaper.fraction))
  const mainSamples = inkTaper.atStart
    ? samples.slice(taperCount)
    : samples.slice(0, samples.length - taperCount)

  if (mainSamples.length >= 2) {
    ctx.lineWidth = baseLineWidth
    ctx.beginPath()
    ctx.moveTo(mainSamples[0].x, mainSamples[0].y)
    for (let i = 1; i < mainSamples.length; i += 1) {
      ctx.lineTo(mainSamples[i].x, mainSamples[i].y)
    }
    ctx.stroke()
  }

  const savedAlpha = ctx.globalAlpha
  drawInkTaperZone(ctx, samples, baseLineWidth, inkTaper)

  const tip = inkTaper.atStart ? samples[0] : samples[samples.length - 1]
  const neighbor = inkTaper.atStart ? samples[1] : samples[samples.length - 2]
  const direction = { x: tip.x - neighbor.x, y: tip.y - neighbor.y }
  drawInkFray(
    ctx,
    tip,
    direction,
    baseLineWidth,
    wobbleAmount,
    seed,
    inkTaper.frayCount,
  )
  ctx.globalAlpha = savedAlpha
  ctx.lineWidth = baseLineWidth
}

function interpolatePoint(start: Point2D, end: Point2D, t: number): Point2D {
  return {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t,
  }
}

/** Лёгкий шум чернил вдоль штриха. */
function drawPenNoise(
  ctx: CanvasRenderingContext2D,
  points: Point2D[],
  lineWidth: number,
  seed: number,
  hue: number,
  saturation: number,
  lightness: number,
): void {
  if (points.length < 2) {
    return
  }

  const dotCount = Math.round(12 + lineWidth * 11)
  const radiusScale = Math.max(0.22, lineWidth * 0.13)

  for (let i = 0; i < dotCount; i += 1) {
    const segmentIndex = Math.min(
      points.length - 2,
      Math.floor(pseudoRandom(seed, i) * (points.length - 1)),
    )
    const t = pseudoRandom(seed, i + 40)
    const base = interpolatePoint(points[segmentIndex], points[segmentIndex + 1], t)
    const spread = lineWidth * (0.45 + pseudoRandom(seed, i + 80) * 0.7)
    const angle = pseudoRandom(seed, i + 120) * Math.PI * 2
    const x = base.x + Math.cos(angle) * spread
    const y = base.y + Math.sin(angle) * spread
    const radius =
      (0.18 + pseudoRandom(seed, i + 160) * 0.62) * radiusScale
    const alpha = 0.06 + pseudoRandom(seed, i + 200) * 0.18
    const lightnessVar =
      lightness + (pseudoRandom(seed, i + 240) - 0.5) * 4
    const saturationVar = saturation * (0.92 + pseudoRandom(seed, i + 280) * 0.08)

    ctx.globalAlpha = alpha
    ctx.fillStyle = hslColor(hue, saturationVar, lightnessVar)
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
  }
}

function buildCheckPoints(half: number, variant: number): Point2D[] {
  const shortLeg = 0.48 + variant * 0.06
  const longLeg = 0.52 + variant * 0.08
  const dip = 0.08 + variant * 0.05
  const rise = 0.48 + variant * 0.06

  return [
    { x: -half * shortLeg, y: half * dip },
    { x: -half * 0.08, y: half * rise },
    { x: half * longLeg, y: -half * (0.42 + variant * 0.08) },
  ]
}

function buildCrossSegments(half: number, variant: number): Point2D[][] {
  const arm = half * (0.55 + variant * 0.1)
  const skew = half * (variant - 0.5) * 0.08

  return [
    [
      { x: -arm + skew, y: -arm - skew * 0.5 },
      { x: arm - skew * 0.5, y: arm + skew },
    ],
    [
      { x: arm - skew, y: -arm + skew * 0.5 },
      { x: -arm + skew * 0.5, y: arm - skew },
    ],
  ]
}

/** Рисует отметку в координатах исходного изображения. */
export function drawMark(
  ctx: CanvasRenderingContext2D,
  bbox: BBox,
  session: MarkSession,
  params: MarkRenderParams,
): void {
  const checkboxSide = Math.min(bbox.width, bbox.height)
  const markSide = checkboxSide * params.sizeRatio
  const half = markSide / 2
  const centerX =
    bbox.x + bbox.width / 2 + checkboxSide * params.offsetXRatio
  const centerY =
    bbox.y + bbox.height / 2 + checkboxSide * params.offsetYRatio
  const lineWidth =
    getMarkLineWidth(checkboxSide, params.sizeRatio) *
    params.lineWidthMultiplier
  const wobbleAmount = markSide * params.wobbleRatio
  const { ink } = session
  const seed = params.shapeVariant * 997 + ink.hue

  const mainColor = hslColor(ink.hue, ink.saturation, ink.lightness)
  const shadowColor = hslColor(
    ink.hue + 8,
    ink.saturation * 0.85,
    Math.max(12, ink.lightness - 8),
  )
  const highlightColor = hslColor(
    ink.hue - 6,
    ink.saturation * 0.7,
    Math.min(55, ink.lightness + 14),
  )

  ctx.save()
  ctx.translate(centerX, centerY)
  ctx.rotate(params.tiltRadians)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const drawStrokes = (points: Point2D[], strokeIndex: number): void => {
    const inkTaper = resolveInkTaper(seed, strokeIndex)

    ctx.globalAlpha = 0.28
    ctx.lineWidth = lineWidth * 1.08
    ctx.strokeStyle = shadowColor
    drawPenStroke(ctx, points, wobbleAmount * 1.1, seed + 0.31, inkTaper)

    ctx.globalAlpha = 0.9
    ctx.lineWidth = lineWidth
    ctx.strokeStyle = mainColor
    drawPenStroke(ctx, points, wobbleAmount, seed, inkTaper)

    ctx.globalAlpha = 0.35
    ctx.lineWidth = lineWidth * 0.45
    ctx.strokeStyle = highlightColor
    drawPenStroke(
      ctx,
      points.map((point) => ({
        x: point.x + wobbleAmount * 0.08,
        y: point.y - wobbleAmount * 0.06,
      })),
      wobbleAmount * 0.65,
      seed + 0.67,
      inkTaper,
    )

    drawPenNoise(
      ctx,
      points,
      lineWidth,
      seed + 1.13,
      ink.hue,
      ink.saturation,
      ink.lightness,
    )
  }

  if (session.markType === 'check') {
    drawStrokes(buildCheckPoints(half, params.shapeVariant), 0)
  } else {
    buildCrossSegments(half, params.shapeVariant).forEach((segment, index) => {
      drawStrokes(segment, index)
    })
  }

  ctx.restore()
}

export function loadImageFromSource(
  source: Blob | File | string,
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const url =
      typeof source === 'string' ? source : URL.createObjectURL(source)

    image.onload = () => {
      if (typeof source !== 'string') {
        URL.revokeObjectURL(url)
      }
      resolve(image)
    }

    image.onerror = () => {
      if (typeof source !== 'string') {
        URL.revokeObjectURL(url)
      }
      reject(new Error(strings.errors.markImageLoadFailed))
    }

    image.src = url
  })
}

export interface RenderMarkedCanvasResult {
  canvas: HTMLCanvasElement
}

export type CheckboxMarks = Record<number, MarkRenderParams>

/** Рисует исходное фото на canvas и накладывает отметки на квадратики. */
export function renderMarkedCanvas(
  image: HTMLImageElement,
  checkboxes: Checkbox[],
  marks: CheckboxMarks,
  session: MarkSession,
): RenderMarkedCanvasResult {
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error(strings.errors.markCanvasFailed)
  }

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image, 0, 0)

  for (const checkbox of checkboxes) {
    const params = marks[checkbox.index]
    if (params) {
      drawMark(ctx, checkbox.bbox, session, params)
    }
  }

  return { canvas }
}

export async function renderMarkedImage(
  source: Blob | File | string,
  checkboxes: Checkbox[],
  marks: CheckboxMarks,
  session: MarkSession,
): Promise<RenderMarkedCanvasResult> {
  const image = await loadImageFromSource(source)
  return renderMarkedCanvas(image, checkboxes, marks, session)
}
