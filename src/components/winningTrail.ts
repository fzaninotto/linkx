import { BOARD_SIZE } from '../game/types'
import type { Point } from '../game/types'

export type TrailAxis = 'horizontal' | 'vertical'

export type WinningTrail = {
  /** Tracé SVG en unités de case, d'un bord du plateau au bord opposé. */
  d: string
  /** Axe de la connexion, qui fixe le sens dans lequel le tracé se dessine. */
  axis: TrailAxis
}

/**
 * Rayon des virages, en fraction de case. Il reste sous la demi-case pour que
 * l'arrondi ne déborde jamais de la case qu'il traverse, y compris sur les pas
 * diagonaux où deux virages se suivent à une distance de `√2 / 2`.
 */
const CORNER_RADIUS = 0.3

const round = (value: number) => Number(value.toFixed(4))

/** Le point situé à `distance` de `from` en allant vers `to`. */
function along(from: Point, to: Point, distance: number): Point {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy) || 1
  const ratio = distance / length
  return { x: from.x + dx * ratio, y: from.y + dy * ratio }
}

/**
 * Une ligne brisée dont chaque sommet est adouci par une quadratique. Les
 * sommets alignés produisent une quadratique posée sur la droite : inutile de
 * les distinguer, le tracé reste droit.
 */
function roundedPolyline(points: readonly Point[]): string {
  const at = ({ x, y }: Point) => `${round(x)} ${round(y)}`
  const parts = [`M ${at(points[0])}`]

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1]
    const corner = points[index]
    const next = points[index + 1]
    const radius = Math.min(
      CORNER_RADIUS,
      Math.hypot(corner.x - previous.x, corner.y - previous.y) / 2,
      Math.hypot(next.x - corner.x, next.y - corner.y) / 2,
    )
    parts.push(`L ${at(along(corner, previous, radius))}`)
    parts.push(`Q ${at(corner)} ${at(along(corner, next, radius))}`)
  }

  parts.push(`L ${at(points[points.length - 1])}`)
  return parts.join(' ')
}

/**
 * Le trait qui matérialise la connexion gagnante : il passe par le centre de
 * chaque case du chemin — pas diagonaux compris, puisque la connectivité est à
 * huit voisins — et se prolonge jusqu'aux deux bords du plateau. Sans ce
 * prolongement, la ligne s'arrêterait au centre de la première et de la
 * dernière case et ne montrerait pas que les deux bords sont bien reliés.
 *
 * Le tracé part toujours du bord d'où l'animation doit le dérouler : la gauche
 * pour une connexion horizontale, le bas pour une verticale. `getWinningPath`
 * renvoie le chemin vertical de haut en bas, il est donc retourné ici.
 */
export function getWinningTrail(path: readonly Point[]): WinningTrail | null {
  if (path.length < 2) return null

  const first = path[0]
  const last = path[path.length - 1]
  const centers = path.map(({ x, y }) => ({ x: x + 0.5, y: y + 0.5 }))
  const firstCenter = centers[0]
  const lastCenter = centers[centers.length - 1]

  if (first.x === 0 && last.x === BOARD_SIZE - 1) {
    return {
      d: roundedPolyline([
        { x: 0, y: firstCenter.y },
        ...centers,
        { x: BOARD_SIZE, y: lastCenter.y },
      ]),
      axis: 'horizontal',
    }
  }

  if (first.y === 0 && last.y === BOARD_SIZE - 1) {
    const points = [
      { x: firstCenter.x, y: 0 },
      ...centers,
      { x: lastCenter.x, y: BOARD_SIZE },
    ]
    return { d: roundedPolyline(points.reverse()), axis: 'vertical' }
  }

  return null
}
