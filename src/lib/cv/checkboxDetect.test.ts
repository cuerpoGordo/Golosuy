import { describe, expect, it } from 'vitest'
import {
  deduplicateNestedCheckboxCandidates,
  filterCheckboxCandidates,
  sortCheckboxesTopToBottom,
} from '@/lib/cv/checkboxDetect'
import type { CheckboxCandidate } from '@/lib/cv/types'

function candidate(
  x: number,
  y: number,
  size: number,
): CheckboxCandidate {
  return {
    bbox: { x, y, width: size, height: size },
    area: size * size,
    centerX: x + size / 2,
    centerY: y + size / 2,
  }
}

function candidateFromBbox(
  bbox: { x: number; y: number; width: number; height: number },
  area: number,
  center: { x: number; y: number },
): CheckboxCandidate {
  return {
    bbox,
    area,
    centerX: center.x,
    centerY: center.y,
  }
}

describe('deduplicateNestedCheckboxCandidates', () => {
  it('оставляет только внутренний квадрат при вложенных дубликатах', () => {
    const outer = candidate(90, 90, 40)
    const inner = candidate(100, 100, 20)

    const result = deduplicateNestedCheckboxCandidates([outer, inner])
    expect(result).toHaveLength(1)
    expect(result[0]).toBe(inner)
  })

  it('удаляет несколько вложенных контуров, оставляя самый маленький', () => {
    const outer = candidate(80, 80, 60)
    const middle = candidate(95, 95, 30)
    const inner = candidate(100, 100, 20)

    const result = deduplicateNestedCheckboxCandidates([outer, middle, inner])
    expect(result).toHaveLength(1)
    expect(result[0]).toBe(inner)
  })

  it('не удаляет отдельные квадратики в колонке', () => {
    const top = candidate(100, 50, 20)
    const bottom = candidate(102, 150, 21)

    const result = deduplicateNestedCheckboxCandidates([top, bottom])
    expect(result).toHaveLength(2)
  })

  it('не удаляет квадратики с близким X, но без вложенности', () => {
    const left = candidate(100, 100, 20)
    const right = candidate(130, 100, 20)

    const result = deduplicateNestedCheckboxCandidates([left, right])
    expect(result).toHaveLength(2)
  })

  it('удаляет совпадающие контуры с почти одинаковой площадью', () => {
    const first = candidateFromBbox(
      { x: 983, y: 512, width: 52, height: 49 },
      2267,
      { x: 1009, y: 536.5 },
    )
    const second = candidateFromBbox(
      { x: 983, y: 512, width: 52, height: 49 },
      2270,
      { x: 1009, y: 536.5 },
    )

    const result = deduplicateNestedCheckboxCandidates([first, second])
    expect(result).toHaveLength(1)
    expect(result[0]).toBe(first)
  })

  it('схлопывает колонку дубликатов из реального лога', () => {
    const duplicates = [
      candidateFromBbox({ x: 983, y: 512, width: 52, height: 49 }, 2267, { x: 1009, y: 536.5 }),
      candidateFromBbox({ x: 983, y: 512, width: 52, height: 49 }, 2270, { x: 1009, y: 536.5 }),
      candidateFromBbox({ x: 976, y: 664, width: 53, height: 51 }, 2427, { x: 1002.5, y: 689.5 }),
      candidateFromBbox({ x: 976, y: 664, width: 53, height: 51 }, 2430, { x: 1002.5, y: 689.5 }),
      candidateFromBbox({ x: 970, y: 821, width: 53, height: 55 }, 2594.5, { x: 996.5, y: 848.5 }),
      candidateFromBbox({ x: 970, y: 821, width: 53, height: 55 }, 2596.5, { x: 996.5, y: 848.5 }),
      candidateFromBbox({ x: 965, y: 986, width: 53, height: 57 }, 2752.5, { x: 991.5, y: 1014.5 }),
      candidateFromBbox({ x: 965, y: 986, width: 53, height: 57 }, 2755.5, { x: 991.5, y: 1014.5 }),
      candidateFromBbox({ x: 961, y: 1157, width: 54, height: 58 }, 2860.5, { x: 988, y: 1186 }),
      candidateFromBbox({ x: 961, y: 1156, width: 54, height: 59 }, 2864.5, { x: 988, y: 1185.5 }),
    ]

    const result = deduplicateNestedCheckboxCandidates(duplicates)
    expect(result).toHaveLength(5)
  })
})

describe('filterCheckboxCandidates', () => {
  it('оставляет квадратики похожего размера и отсекает шум', () => {
    const column = [
      candidate(100, 50, 20),
      candidate(102, 100, 21),
      candidate(98, 150, 20),
      candidate(101, 200, 19),
    ]
    const noise = [
      candidate(400, 80, 10),
      candidate(420, 300, 12),
    ]

    const result = filterCheckboxCandidates([...column, ...noise])
    expect(result).toHaveLength(4)
    expect(result.every((item) => item.centerX < 150)).toBe(true)
  })

  it('возвращает один кандидат без изменений', () => {
    const single = candidate(10, 10, 15)
    expect(filterCheckboxCandidates([single])).toEqual([single])
  })

  it('оставляет крупные чекбоксы и отсекает буквы независимо от X', () => {
    const letterNoise = [
      candidateFromBbox({ x: 540, y: 1148, width: 16, height: 12 }, 115, { x: 548, y: 1154 }),
      candidateFromBbox({ x: 541, y: 1169, width: 26, height: 23 }, 149, { x: 554, y: 1180.5 }),
      candidateFromBbox({ x: 545, y: 669, width: 19, height: 18 }, 130, { x: 554.5, y: 678 }),
      candidateFromBbox({ x: 546, y: 981, width: 18, height: 16 }, 114, { x: 555, y: 989 }),
      candidateFromBbox({ x: 549, y: 533, width: 13, height: 15 }, 124, { x: 555.5, y: 540.5 }),
    ]
    const realColumn = [
      candidateFromBbox({ x: 983, y: 512, width: 52, height: 49 }, 2267, { x: 1009, y: 536.5 }),
      candidateFromBbox({ x: 976, y: 664, width: 53, height: 51 }, 2427, { x: 1002.5, y: 689.5 }),
      candidateFromBbox({ x: 970, y: 821, width: 53, height: 55 }, 2594.5, { x: 996.5, y: 848.5 }),
      candidateFromBbox({ x: 965, y: 986, width: 53, height: 57 }, 2752.5, { x: 991.5, y: 1014.5 }),
      candidateFromBbox({ x: 961, y: 1157, width: 54, height: 58 }, 2860.5, { x: 988, y: 1186 }),
    ]

    const result = filterCheckboxCandidates([...letterNoise, ...realColumn])
    expect(result).toHaveLength(5)
    expect(result.every((item) => item.centerX > 900)).toBe(true)
  })
})

describe('sortCheckboxesTopToBottom', () => {
  it('сортирует сверху вниз и нумерует с 1', () => {
    const sorted = sortCheckboxesTopToBottom([
      candidate(10, 200, 20),
      candidate(12, 50, 20),
      candidate(11, 120, 20),
    ])

    expect(sorted.map((item) => item.index)).toEqual([1, 2, 3])
    expect(sorted[0].bbox.y).toBeLessThan(sorted[1].bbox.y)
    expect(sorted[1].bbox.y).toBeLessThan(sorted[2].bbox.y)
  })
})
