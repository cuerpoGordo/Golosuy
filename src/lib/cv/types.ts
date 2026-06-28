/** Ограничивающий прямоугольник в координатах исходного изображения. */
export interface BBox {
  x: number
  y: number
  width: number
  height: number
}

/** Обнаруженный квадратик для отметки. */
export interface Checkbox {
  bbox: BBox
  /** Порядковый номер сверху вниз (1-based для UI). */
  index: number
}

export interface ImageDimensions {
  width: number
  height: number
}

/** Кандидат квадратика для отметки (координаты исходного изображения). */
export interface CheckboxCandidate {
  bbox: BBox
  area: number
  centerX: number
  centerY: number
}
