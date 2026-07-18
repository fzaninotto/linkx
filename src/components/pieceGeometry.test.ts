import { describe, expect, it } from 'vitest'
import { getCellsOutlinePath, OUTLINE_INSET } from './pieceGeometry'

function points(path: string): [number, number][] {
  return [...path.matchAll(/[ML] (-?[\d.]+) (-?[\d.]+)/g)].map(
    ([, x, y]) => [Number(x), Number(y)] as [number, number],
  )
}

const cells = (coords: readonly [number, number][]) =>
  coords.map(([x, y]) => ({ x, y }))

describe('silhouettes continues du plateau', () => {
  it('rentre les quatre coins d’une case isolée', () => {
    const path = getCellsOutlinePath(cells([[0, 0]]))

    expect(points(path)).toEqual([
      [OUTLINE_INSET, OUTLINE_INSET],
      [1 - OUTLINE_INSET, OUTLINE_INSET],
      [1 - OUTLINE_INSET, 1 - OUTLINE_INSET],
      [OUTLINE_INSET, 1 - OUTLINE_INSET],
    ])
  })

  it('fusionne deux cases voisines en un seul rectangle sans arête interne', () => {
    const path = getCellsOutlinePath(cells([[0, 0], [1, 0]]))

    expect(path.match(/M /g)).toHaveLength(1)
    expect(points(path)).toHaveLength(4)
    expect(points(path)).toContainEqual([2 - OUTLINE_INSET, OUTLINE_INSET])
  })

  it('referme exactement l’angle rentrant du L sans encoche', () => {
    // (0,0) (1,0) (1,1) : le creux se situe autour du sommet (1,1).
    const path = getCellsOutlinePath(cells([[0, 0], [1, 0], [1, 1]]))
    const corner = points(path).filter(
      ([x, y]) => x > 0.9 && x < 1.2 && y > 0.9 && y < 1.2,
    )

    // Un seul sommet dans le creux : les deux arêtes rentrées s’y rejoignent,
    // au lieu de contourner le téton laissé par la case du coin.
    expect(corner).toEqual([[1 + OUTLINE_INSET, 1 - OUTLINE_INSET]])
  })

  it('donne au S un contour de huit sommets, un par angle', () => {
    const path = getCellsOutlinePath(cells([[1, 0], [0, 1], [1, 1], [0, 2]]))

    expect(path.match(/M /g)).toHaveLength(1)
    expect(points(path)).toHaveLength(8)
  })

  it('sépare deux cases qui ne se touchent que par un coin', () => {
    const path = getCellsOutlinePath(cells([[0, 0], [1, 1]]))

    expect(path.match(/M /g)).toHaveLength(2)
    expect(points(path)).toHaveLength(8)
  })
})
