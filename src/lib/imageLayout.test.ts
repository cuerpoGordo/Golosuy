import { describe, expect, it } from 'vitest'
import {
  bboxToDisplayRect,
  computeObjectContainLayout,
  displayPointToImage,
} from '@/lib/imageLayout'

describe('computeObjectContainLayout', () => {
  it('центрирует изображение в контейнере', () => {
    const layout = computeObjectContainLayout(400, 300, 800, 600)
    expect(layout.displayWidth).toBe(400)
    expect(layout.displayHeight).toBe(300)
    expect(layout.offsetX).toBe(0)
    expect(layout.offsetY).toBe(0)
    expect(layout.scale).toBe(0.5)
  })
})

describe('bboxToDisplayRect', () => {
  it('масштабирует bbox в координаты отображения', () => {
    const layout = computeObjectContainLayout(200, 200, 100, 100)
    const rect = bboxToDisplayRect(
      { x: 10, y: 20, width: 30, height: 30 },
      layout,
    )

    expect(rect).toEqual({
      left: 20,
      top: 40,
      width: 60,
      height: 60,
    })
  })
})

describe('displayPointToImage', () => {
  it('преобразует тап в координаты исходного изображения', () => {
    const layout = computeObjectContainLayout(200, 200, 100, 100)
    const point = displayPointToImage(60, 80, layout, 100, 100)

    expect(point).toEqual({ x: 30, y: 40 })
  })

  it('учитывает zoom/pan слоя с фото', () => {
    const layout = computeObjectContainLayout(200, 200, 100, 100)
    const point = displayPointToImage(120, 160, layout, 100, 100, {
      scale: 2,
      translateX: 0,
      translateY: 0,
    })

    expect(point).toEqual({ x: 30, y: 40 })
  })

  it('возвращает null за пределами изображения', () => {
    const layout = computeObjectContainLayout(400, 200, 100, 100)
    expect(displayPointToImage(50, 50, layout, 100, 100)).toBeNull()
  })
})
