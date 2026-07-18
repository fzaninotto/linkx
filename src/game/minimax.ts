import { getLargestZone } from './connectivity'
import { getConnectionScore } from './evaluation'
import { enumerateLegalMoves } from './legalMoves'
import type { LegalMove } from './legalMoves'
import { getOtherPlayer, simulateLegalMove } from './simulation'
import type { GamePosition, SimulationTransition } from './simulation'
import { BOARD_SIZE, SHAPE_IDS } from './types'
import type { GameResult, PlayerId } from './types'

const DEFAULT_DEPTH = 2
const TERMINAL_SCORE = 1_000_000
const CONNECTION_WEIGHT = 100
const UNREACHABLE_SCORE = BOARD_SIZE * BOARD_SIZE + 1

export type MinimaxOptions = {
  depth?: number
}

export type MinimaxDecision = {
  move: LegalMove
  score: number
  exploredNodes: number
}

type SearchContext = {
  aiPlayer: PlayerId
  exploredNodes: number
  transpositions: Map<string, TranspositionEntry>
}

type TranspositionEntry = {
  score: number
  bound: 'exact' | 'lower' | 'upper'
}

function finiteConnectionScore(score: number): number {
  return Number.isFinite(score) ? score : UNREACHABLE_SCORE
}

function evaluatePosition(position: GamePosition, aiPlayer: PlayerId): number {
  const opponent = getOtherPlayer(aiPlayer)
  const connectionAdvantage =
    finiteConnectionScore(getConnectionScore(position.board, opponent)) -
    finiteConnectionScore(getConnectionScore(position.board, aiPlayer))
  const zoneAdvantage =
    getLargestZone(position.board, aiPlayer) -
    getLargestZone(position.board, opponent)
  return connectionAdvantage * CONNECTION_WEIGHT + zoneAdvantage
}

function evaluateResult(
  result: GameResult,
  aiPlayer: PlayerId,
  remainingDepth: number,
): number {
  if (result.winner === null) return 0
  return result.winner === aiPlayer
    ? TERMINAL_SCORE + remainingDepth
    : -TERMINAL_SCORE - remainingDepth
}

function positionKey(position: GamePosition, depth: number): string {
  const board = position.board
    .map((row) =>
      row
        .map((cell) => (cell ? (cell.player === 'blue' ? 'B' : 'W') : '.'))
        .join(''),
    )
    .join('')
  const inventories = (['blue', 'white'] as const)
    .flatMap((player) => SHAPE_IDS.map((shapeId) => position.inventories[player][shapeId]))
    .join('')
  return `${depth}:${position.activePlayer}:${inventories}:${board}`
}

function scoreTransition(
  transition: SimulationTransition,
  depth: number,
  alpha: number,
  beta: number,
  context: SearchContext,
): number {
  if (transition.result) {
    return evaluateResult(transition.result, context.aiPlayer, depth)
  }
  return minimax(transition.position, depth, alpha, beta, context)
}

function minimax(
  position: GamePosition,
  depth: number,
  alpha: number,
  beta: number,
  context: SearchContext,
): number {
  context.exploredNodes += 1
  if (depth === 0) return evaluatePosition(position, context.aiPlayer)

  const key = positionKey(position, depth)
  const originalAlpha = alpha
  const originalBeta = beta
  const cached = context.transpositions.get(key)
  if (cached) {
    if (cached.bound === 'exact') return cached.score
    if (cached.bound === 'lower') alpha = Math.max(alpha, cached.score)
    if (cached.bound === 'upper') beta = Math.min(beta, cached.score)
    if (beta <= alpha) return cached.score
  }

  const moves = enumerateLegalMoves(
    position.board,
    position.inventories[position.activePlayer],
  )
  if (moves.length === 0) return evaluatePosition(position, context.aiPlayer)

  const maximizing = position.activePlayer === context.aiPlayer
  let bestScore = maximizing ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY

  for (const move of moves) {
    const transition = simulateLegalMove(position, move)
    const score = scoreTransition(transition, depth - 1, alpha, beta, context)

    if (maximizing) {
      bestScore = Math.max(bestScore, score)
      alpha = Math.max(alpha, bestScore)
    } else {
      bestScore = Math.min(bestScore, score)
      beta = Math.min(beta, bestScore)
    }
    if (beta <= alpha) {
      break
    }
  }

  const bound = bestScore <= originalAlpha
    ? 'upper'
    : bestScore >= originalBeta
      ? 'lower'
      : 'exact'
  context.transpositions.set(key, { score: bestScore, bound })
  return bestScore
}

export function chooseMinimaxMove(
  position: GamePosition,
  options: MinimaxOptions = {},
): MinimaxDecision | null {
  const depth = options.depth ?? DEFAULT_DEPTH
  if (!Number.isInteger(depth) || depth < 1) {
    throw new Error('La profondeur Minimax doit être un entier supérieur ou égal à 1.')
  }

  const moves = enumerateLegalMoves(
    position.board,
    position.inventories[position.activePlayer],
  )
  if (moves.length === 0) return null

  const context: SearchContext = {
    aiPlayer: position.activePlayer,
    exploredNodes: 1,
    transpositions: new Map(),
  }
  let alpha = Number.NEGATIVE_INFINITY
  const beta = Number.POSITIVE_INFINITY
  let bestMove = moves[0]
  let bestScore = Number.NEGATIVE_INFINITY
  const candidates = moves
    .map((move) => {
      const transition = simulateLegalMove(position, move)
      const orderingScore = transition.result
        ? evaluateResult(transition.result, context.aiPlayer, depth - 1)
        : evaluatePosition(transition.position, context.aiPlayer)
      return { move, transition, orderingScore }
    })
    .sort((left, right) => right.orderingScore - left.orderingScore)

  for (const { move, transition, orderingScore } of candidates) {
    if (depth === 1) context.exploredNodes += 1
    const score = depth === 1
      ? orderingScore
      : scoreTransition(transition, depth - 1, alpha, beta, context)
    if (score > bestScore) {
      bestMove = move
      bestScore = score
    }
    alpha = Math.max(alpha, bestScore)
    if (bestScore >= TERMINAL_SCORE) break
  }

  return { move: bestMove, score: bestScore, exploredNodes: context.exploredNodes }
}
