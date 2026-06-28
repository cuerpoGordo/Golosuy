import type { BBox } from '@/lib/cv/types'

/** Масштаб и сдвиг слоя с фото внутри контейнера (не pinch-zoom страницы). */
export interface ImageTransform {
  scale: number
  translateX: number
  translateY: number
}

/** Раскладка object-contain: изображение вписано в контейнер с сохранением пропорций. */
export interface ObjectContainLayout {
  offsetX: number
  offsetY: number
  displayWidth: number
  displayHeight: number
  scale: number
}

export function computeObjectContainLayout(
  containerWidth: number,
  containerHeight: number,
  imageWidth: number,
  imageHeight: number,
): ObjectContainLayout {
  if (
    containerWidth <= 0 ||
    containerHeight <= 0 ||
    imageWidth <= 0 ||
    imageHeight <= 0
  ) {
    return {
      offsetX: 0,
      offsetY: 0,
      displayWidth: 0,
      displayHeight: 0,
      scale: 1,
    }
  }

  const scale = Math.min(
    containerWidth / imageWidth,
    containerHeight / imageHeight,
  )
  const displayWidth = imageWidth * scale
  const displayHeight = imageHeight * scale
  const offsetX = (containerWidth - displayWidth) / 2
  const offsetY = (containerHeight - displayHeight) / 2

  return { offsetX, offsetY, displayWidth, displayHeight, scale }
}

const MIN_VISIBLE_PX = 48

/** Ограничивает pan/zoom, чтобы фото не уезжало полностью за край. */
export function clampImageTransform(
  transform: ImageTransform,
  layout: ObjectContainLayout,
  containerWidth: number,
  containerHeight: number,
): ImageTransform {
  if (transform.scale <= 1) {
    return { scale: 1, translateX: 0, translateY: 0 }
  }

  const scaledWidth = layout.displayWidth * transform.scale
  const scaledHeight = layout.displayHeight * transform.scale

  const minTranslateX = MIN_VISIBLE_PX - layout.offsetX - scaledWidth
  const maxTranslateX = containerWidth - MIN_VISIBLE_PX - layout.offsetX
  const minTranslateY = MIN_VISIBLE_PX - layout.offsetY - scaledHeight
  const maxTranslateY = containerHeight - MIN_VISIBLE_PX - layout.offsetY

  return {
    scale: transform.scale,
    translateX: Math.min(
      maxTranslateX,
      Math.max(minTranslateX, transform.translateX),
    ),
    translateY: Math.min(
      maxTranslateY,
      Math.max(minTranslateY, transform.translateY),
    ),
  }
}

/** Координаты bbox внутри слоя с фото (без offset контейнера). */
export function bboxToImageLayerRect(
  bbox: BBox,
  layout: ObjectContainLayout,
): { left: number; top: number; width: number; height: number } {
  return {
    left: bbox.x * layout.scale,
    top: bbox.y * layout.scale,
    width: bbox.width * layout.scale,
    height: bbox.height * layout.scale,
  }
}

/** Координаты bbox в пространстве отображения (px внутри контейнера). */
export function bboxToDisplayRect(
  bbox: BBox,
  layout: ObjectContainLayout,
): { left: number; top: number; width: number; height: number } {
  return {
    left: layout.offsetX + bbox.x * layout.scale,
    top: layout.offsetY + bbox.y * layout.scale,
    width: bbox.width * layout.scale,
    height: bbox.height * layout.scale,
  }
}

/** Точка в контейнере → координаты внутри слоя с фото. */
export function containerPointToImageLayer(
  displayX: number,
  displayY: number,
  layout: ObjectContainLayout,
  transform: ImageTransform,
): { x: number; y: number } | null {
  const layerX =
    (displayX - layout.offsetX - transform.translateX) / transform.scale
  const layerY =
    (displayY - layout.offsetY - transform.translateY) / transform.scale

  if (
    layerX < 0 ||
    layerY < 0 ||
    layerX > layout.displayWidth ||
    layerY > layout.displayHeight
  ) {
    return null
  }

  return { x: layerX, y: layerY }
}

/** Точка внутри слоя с фото → координаты исходного изображения. */
export function imageLayerPointToImage(
  layerX: number,
  layerY: number,
  layout: ObjectContainLayout,
  imageWidth: number,
  imageHeight: number,
): { x: number; y: number } | null {
  const imageX = layerX / layout.scale
  const imageY = layerY / layout.scale

  if (
    imageX < 0 ||
    imageY < 0 ||
    imageX > imageWidth ||
    imageY > imageHeight
  ) {
    return null
  }

  return { x: imageX, y: imageY }
}

/** Точка тапа в контейнере → координаты исходного изображения. */
export function displayPointToImage(
  displayX: number,
  displayY: number,
  layout: ObjectContainLayout,
  imageWidth: number,
  imageHeight: number,
  transform: ImageTransform = { scale: 1, translateX: 0, translateY: 0 },
): { x: number; y: number } | null {
  const layerPoint = containerPointToImageLayer(
    displayX,
    displayY,
    layout,
    transform,
  )
  if (!layerPoint) {
    return null
  }

  return imageLayerPointToImage(
    layerPoint.x,
    layerPoint.y,
    layout,
    imageWidth,
    imageHeight,
  )
}
