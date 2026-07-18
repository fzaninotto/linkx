import { describe, expect, it } from 'vitest'
import { enumerateLegalMoves } from './legalMoves'
import { chooseMinimaxMove } from './minimax'
import { createGamePosition, simulateLegalMove } from './simulation'
import type { GamePosition } from './simulation'
import { SHAPE_IDS } from './types'
import type { GameResult, PlayerId, Rotation, ShapeId } from './types'

const STATISTICAL_GAME_COUNT = 20
const MINIMUM_WIN_RATE = 0.8

function randomForSeed(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return state / 4_294_967_296
  }
}

function playAgainstRandom(seed: number, aiPlayer: PlayerId): GameResult {
  const random = randomForSeed(seed)
  let position = createGamePosition('blue')

  for (let turn = 0; turn < 40; turn += 1) {
    const move = position.activePlayer === aiPlayer
      ? chooseMinimaxMove(position, { depth: 2 })?.move
      : (() => {
          const moves = enumerateLegalMoves(
            position.board,
            position.inventories[position.activePlayer],
          )
          return moves[Math.floor(random() * moves.length)]
        })()
    if (!move) throw new Error('Le joueur actif devrait disposer d’un coup légal.')

    const transition = simulateLegalMove(position, move)
    if (transition.result) return transition.result
    position = transition.position
  }

  throw new Error('La partie simulée dépasse le nombre maximal de pièces.')
}

function playMove(
  position: GamePosition,
  shapeId: ShapeId,
  rotation: Rotation,
  column: number,
): GamePosition {
  const move = enumerateLegalMoves(
    position.board,
    position.inventories[position.activePlayer],
  ).find(
    (candidate) =>
      candidate.shapeId === shapeId &&
      candidate.orientation.rotation === rotation &&
      !candidate.orientation.flipped &&
      candidate.column === column,
  )
  if (!move) throw new Error('Le coup de préparation devrait être légal.')
  const transition = simulateLegalMove(position, move)
  if (transition.result) throw new Error('La préparation ne doit pas terminer la partie.')
  return transition.position
}

describe('Minimax', () => {
  it('refuse une profondeur invalide', () => {
    expect(() => chooseMinimaxMove(createGamePosition(), { depth: 0 })).toThrow(
      /profondeur Minimax/,
    )
  })

  it('joue immédiatement un coup gagnant', () => {
    let position = createGamePosition('blue')
    position = playMove(position, 'bar3', 0, 0)
    position = playMove(position, 'domino', 1, 0)
    position = playMove(position, 'bar3', 0, 3)
    position = playMove(position, 'domino', 1, 1)
    position = playMove(position, 'domino', 0, 6)
    position = playMove(position, 'mono', 0, 2)

    const decision = chooseMinimaxMove(position, { depth: 2 })
    expect(decision).not.toBeNull()
    if (!decision) return

    expect(simulateLegalMove(position, decision.move).result).toEqual({
      winner: 'blue',
      reason: 'connection',
    })
  })

  it('simule une passe forcée et un blocage total', () => {
    const forcedPass = createGamePosition('blue')
    for (const shapeId of SHAPE_IDS) forcedPass.inventories.white[shapeId] = 0
    const firstMove = enumerateLegalMoves(
      forcedPass.board,
      forcedPass.inventories.blue,
    )[0]
    const passed = simulateLegalMove(forcedPass, firstMove)
    expect(passed.result).toBeNull()
    expect(passed.position.activePlayer).toBe('blue')

    const stalemate = createGamePosition('blue')
    for (const player of ['blue', 'white'] as const) {
      for (const shapeId of SHAPE_IDS) stalemate.inventories[player][shapeId] = 0
    }
    stalemate.inventories.blue.mono = 1
    const lastMove = enumerateLegalMoves(
      stalemate.board,
      stalemate.inventories.blue,
    )[0]

    expect(simulateLegalMove(stalemate, lastMove).result).toEqual({
      winner: 'blue',
      reason: 'stalemate',
      largestZones: { blue: 1, white: 0 },
    })
  })

  it(
    'gagne statistiquement contre un joueur aléatoire en jouant premier ou second',
    () => {
      let wins = 0
      let losses = 0

      for (let game = 0; game < STATISTICAL_GAME_COUNT; game += 1) {
        const aiPlayer = game % 2 === 0 ? 'blue' : 'white'
        const result = playAgainstRandom(10_000 + game, aiPlayer)
        if (result.winner === aiPlayer) wins += 1
        else if (result.winner !== null) losses += 1
      }

      expect(wins / STATISTICAL_GAME_COUNT).toBeGreaterThanOrEqual(MINIMUM_WIN_RATE)
      expect(wins).toBeGreaterThan(losses)
    },
    30_000,
  )
})
