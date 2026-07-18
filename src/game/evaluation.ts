import { CONNECTION_NEIGHBORS } from './connectivity'
import { BOARD_SIZE } from './types'
import type { Board, PlayerId, Point } from './types'

type ConnectionAxis = 'horizontal' | 'vertical'

function pointIndex({ x, y }: Point): number {
  return y * BOARD_SIZE + x
}

function getCellCost(board: Board, player: PlayerId, { x, y }: Point): number {
  const occupant = board[y][x]?.player
  if (occupant === player) return 0
  if (occupant === undefined) return 1
  return Number.POSITIVE_INFINITY
}

function getAxisScore(
  board: Board,
  player: PlayerId,
  axis: ConnectionAxis,
): number {
  const cellCount = BOARD_SIZE * BOARD_SIZE
  const distances = Array<number>(cellCount).fill(Number.POSITIVE_INFINITY)
  const settled = Array<boolean>(cellCount).fill(false)
  let front: number[] = []
  let back: number[] = []

  const pushFront = (index: number) => front.push(index)
  const pushBack = (index: number) => back.push(index)
  const popFront = (): number | undefined => {
    if (front.length === 0) {
      const previousBack = back
      back = []
      front = previousBack.reverse()
    }
    return front.pop()
  }

  for (let offset = 0; offset < BOARD_SIZE; offset += 1) {
    const start = axis === 'horizontal' ? { x: 0, y: offset } : { x: offset, y: 0 }
    const index = pointIndex(start)
    const cost = getCellCost(board, player, start)
    distances[index] = cost
    if (cost === 0) pushFront(index)
    if (cost === 1) pushBack(index)
  }

  while (front.length > 0 || back.length > 0) {
    const currentIndex = popFront()
    if (currentIndex === undefined || settled[currentIndex]) continue
    settled[currentIndex] = true
    const currentDistance = distances[currentIndex]

    const current = {
      x: currentIndex % BOARD_SIZE,
      y: Math.floor(currentIndex / BOARD_SIZE),
    }
    const hasReachedTarget =
      axis === 'horizontal'
        ? current.x === BOARD_SIZE - 1
        : current.y === BOARD_SIZE - 1
    if (hasReachedTarget) return currentDistance

    for (const offset of CONNECTION_NEIGHBORS) {
      const next = { x: current.x + offset.x, y: current.y + offset.y }
      if (
        next.x < 0 ||
        next.x >= BOARD_SIZE ||
        next.y < 0 ||
        next.y >= BOARD_SIZE
      ) {
        continue
      }

      const nextIndex = pointIndex(next)
      const cost = getCellCost(board, player, next)
      const candidateDistance = currentDistance + cost
      if (!settled[nextIndex] && candidateDistance < distances[nextIndex]) {
        distances[nextIndex] = candidateDistance
        if (cost === 0) pushFront(nextIndex)
        if (cost === 1) pushBack(nextIndex)
      }
    }
  }

  return Number.POSITIVE_INFINITY
}

/**
 * Estimates the number of empty cells still needed for a player to connect
 * either pair of opposite edges. Player cells cost 0, empty cells cost 1 and
 * opponent cells cannot be crossed. A lower score is better.
 */
export function getConnectionScore(board: Board, player: PlayerId): number {
  return Math.min(
    getAxisScore(board, player, 'horizontal'),
    getAxisScore(board, player, 'vertical'),
  )
}
