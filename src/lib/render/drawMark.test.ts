import { describe, expect, it } from 'vitest'
import {
  createMarkRenderParams,
  createMarkSession,
  createSessionInkColor,
  createSessionMarkType,
  getMarkLineWidth,
} from '@/lib/render/drawMark'

function createSeededRandom(values: number[]): () => number {
  let index = 0
  return () => {
    const value = values[index] ?? values[values.length - 1] ?? 0
    index += 1
    return value
  }
}

describe('createSessionMarkType', () => {
  it('выбирает галочку при random < 0.5', () => {
    expect(createSessionMarkType(createSeededRandom([0.1]))).toBe('check')
  })

  it('выбирает крестик при random >= 0.5', () => {
    expect(createSessionMarkType(createSeededRandom([0.9]))).toBe('cross')
  })
})

describe('createSessionInkColor', () => {
  it('задаёт синие оттенки без фиолетового', () => {
    const ink = createSessionInkColor(createSeededRandom([0.5, 0.5, 0.5]))

    expect(ink.hue).toBeGreaterThanOrEqual(210)
    expect(ink.hue).toBeLessThanOrEqual(245)
    expect(ink.saturation).toBeGreaterThanOrEqual(50)
    expect(ink.lightness).toBeGreaterThanOrEqual(24)
  })
})

describe('createMarkSession', () => {
  it('создаёт тип и цвет для одной сессии', () => {
    const session = createMarkSession(createSeededRandom([0.1, 0.2, 0.3, 0.4]))

    expect(session.markType).toBe('check')
    expect(session.ink.hue).toBeCloseTo(217)
  })
})

describe('createMarkRenderParams', () => {
  it('ограничивает размер отметки 72–92%', () => {
    const params = createMarkRenderParams(createSeededRandom([0, 0.5, 0.5, 0.5, 0.5, 0.5]))
    expect(params.sizeRatio).toBe(0.72)

    const maxParams = createMarkRenderParams(createSeededRandom([1, 0.5, 0.5, 0.5, 0.5, 0.5]))
    expect(maxParams.sizeRatio).toBeCloseTo(0.92)
  })

  it('ограничивает наклон ±5°', () => {
    const minTilt = createMarkRenderParams(createSeededRandom([0.5, 0, 0.5, 0.5, 0.5, 0.5]))
    const maxTilt = createMarkRenderParams(createSeededRandom([0.5, 1, 0.5, 0.5, 0.5, 0.5]))

    expect(minTilt.tiltRadians).toBeCloseTo((-5 * Math.PI) / 180)
    expect(maxTilt.tiltRadians).toBeCloseTo((5 * Math.PI) / 180)
  })

  it('создаёт разные параметры для разных вызовов', () => {
    const first = createMarkRenderParams(createSeededRandom([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]))
    const second = createMarkRenderParams(createSeededRandom([0.9, 0.8, 0.7, 0.6, 0.5, 0.4]))

    expect(first).not.toEqual(second)
  })
})

describe('getMarkLineWidth', () => {
  it('масштабирует толщину линии пропорционально стороне отметки', () => {
    expect(getMarkLineWidth(100, 0.8)).toBeCloseTo(7.04)
    expect(getMarkLineWidth(4, 0.7)).toBeCloseTo(0.2464)
    expect(getMarkLineWidth(4, 0.7)).toBeLessThan(getMarkLineWidth(100, 0.8))
  })
})
