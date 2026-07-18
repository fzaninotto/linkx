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
  const visited = Array<boolean>(cellCount).fill(false)

  for (let offset = 0; offset < BOARD_SIZE; offset += 1) {
    const start = axis === 'horizontal' ? { x: 0, y: offset } : { x: offset, y: 0 }
    distances[pointIndex(start)] = getCellCost(board, player, start)
  }

  while (true) {
    let currentIndex = -1
    let currentDistance = Number.POSITIVE_INFINITY

    for (let index = 0; index < cellCount; index += 1) {
      if (!visited[index] && distances[index] < currentDistance) {
        currentIndex = index
        currentDistance = distances[index]
      }
    }

    if (currentIndex === -1) return Number.POSITIVE_INFINITY

    const current = {
      x: currentIndex % BOARD_SIZE,
      y: Math.floor(currentIndex / BOARD_SIZE),
    }
    const hasReachedTarget =
      axis === 'horizontal'
        ? current.x === BOARD_SIZE - 1
        : current.y === BOARD_SIZE - 1
    if (hasReachedTarget) return currentDistance

    visited[currentIndex] = true

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
      const candidateDistance = currentDistance + getCellCost(board, player, next)
      if (!visited[nextIndex] && candidateDistance < distances[nextIndex]) {
        distances[nextIndex] = candidateDistance
      }
    }
  }
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
