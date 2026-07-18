import { describe, expect, it } from 'vitest'
import { boardFromText } from '../game/boardText'
import { getWinningPath } from '../game/connectivity'
import { getWinningTrail } from './winningTrail'
import { BOARD_SIZE } from '../game/types'
import type { Point } from '../game/types'

/** Tous les couples de coordonnées d'un tracé, dans l'ordre. */
const points = (d: string): Point[] =>
  [...d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map(([, x, y]) => ({
    x: Number(x),
    y: Number(y),
  }))

describe('tracé du chemin gagnant', () => {
  it('touche les deux bords du plateau, pas seulement le centre des cases', () => {
    const path = Array.from({ length: BOARD_SIZE }, (_, x) => ({ x, y: 4 }))
    const trail = getWinningTrail(path)!

    expect(trail.axis).toBe('horizontal')
    const drawn = points(trail.d)
    // Sans ce prolongement, le trait s'arrêterait à 0.5 et à 8.5 et la
    // connexion n'aurait pas l'air d'aboutir.
    expect(drawn[0]).toEqual({ x: 0, y: 4.5 })
    expect(drawn[drawn.length - 1]).toEqual({ x: BOARD_SIZE, y: 4.5 })
  })

  it('déroule une connexion verticale depuis le bord du bas', () => {
    const path = Array.from({ length: BOARD_SIZE }, (_, y) => ({ x: 6, y }))
    const trail = getWinningTrail(path)!

    expect(trail.axis).toBe('vertical')
    const drawn = points(trail.d)
    // `getWinningPath` renvoie le chemin de haut en bas ; le tracé le retourne
    // pour que l'animation le parcoure du bas vers le haut.
    expect(drawn[0]).toEqual({ x: 6.5, y: BOARD_SIZE })
    expect(drawn[drawn.length - 1]).toEqual({ x: 6.5, y: 0 })
  })

  it('suit les pas diagonaux du chemin à huit voisins', () => {
    const board = boardFromText(
      [
        'B........',
        '.B.......',
        '..B......',
        '...B.....',
        '....B....',
        '.....B...',
        '......B..',
        '.......B.',
        '........B',
      ].join('\n'),
    )
    const path = getWinningPath(board, 'blue')
    const trail = getWinningTrail(path)!

    // Une diagonale pleine relie le haut au bas comme la gauche à la droite ;
    // `getWinningPath` cherche l'horizontale d'abord.
    expect(trail.axis).toBe('horizontal')
    // Chaque case du chemin est bien traversée : son centre est le sommet de la
    // quadratique qui adoucit le virage.
    for (const { x, y } of path) {
      expect(trail.d).toContain(`${x + 0.5} ${y + 0.5}`)
    }
  })

  it('ne trace rien sans connexion entre deux bords opposés', () => {
    expect(getWinningTrail([])).toBeNull()
    expect(getWinningTrail([{ x: 0, y: 0 }])).toBeNull()
    // Une zone qui touche un seul bord ne donne pas de tracé.
    expect(
      getWinningTrail([
        { x: 0, y: 3 },
        { x: 1, y: 3 },
        { x: 2, y: 3 },
      ]),
    ).toBeNull()
  })
})
