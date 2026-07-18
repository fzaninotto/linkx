import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createEmptyBoard } from '../game/placement'
import { Board } from './Board'

const bottomRowWin = () => {
  const board = createEmptyBoard()
  const path = Array.from({ length: 9 }, (_, x) => ({ x, y: 8 }))
  for (const { x, y } of path) {
    board[y][x] = { player: 'blue', pieceId: `blue-${x}`, shapeId: 'mono' }
  }
  return { board, path }
}

describe('tracé du chemin gagnant', () => {
  it('trace une ligne d’un bord à l’autre sans remplacer le remplissage bleu', () => {
    const { board, path } = bottomRowWin()

    const markup = renderToStaticMarkup(
      <Board board={board} ghost={null} ghostPlayer="blue" winningPath={path} />,
    )

    expect(markup).toContain('board-piece--blue')
    expect(markup).toContain('board-trail--horizontal')
    // L'ancien surlignage pavait les cases du chemin ; il n'en reste rien.
    expect(markup).not.toContain('board-winning-path')
    expect(markup).not.toContain('board-cell--winning')

    // Deux couches superposées sur la même géométrie : un liseré sombre lisible
    // sur les dalles blanches, un cœur doré lisible sur les bleues.
    const trails = [...markup.matchAll(/<path[^>]*board-trail__[^>]*>/g)].map(
      ([tag]) => tag,
    )
    expect(trails).toHaveLength(2)
    const paths = trails.map((tag) => tag.match(/ d="([^"]*)"/)![1])
    expect(paths[0]).toBe(paths[1])

    // Aucun filtre : le tracé peint par-dessus les dalles sans les teinter.
    for (const tag of trails) expect(tag).not.toContain('filter')
  })

  it('ne trace rien quand la partie se termine sans connexion', () => {
    const { board } = bottomRowWin()

    const markup = renderToStaticMarkup(
      <Board board={board} ghost={null} ghostPlayer="blue" />,
    )

    expect(markup).not.toContain('board-trail')
  })

  it('ne célèbre que sur demande', () => {
    const { board, path } = bottomRowWin()

    const quiet = renderToStaticMarkup(
      <Board board={board} ghost={null} ghostPlayer="blue" winningPath={path} />,
    )
    expect(quiet).not.toContain('board-fireworks')

    const festive = renderToStaticMarkup(
      <Board
        board={board}
        ghost={null}
        ghostPlayer="blue"
        winningPath={path}
        celebrate
      />,
    )
    expect(festive).toContain('board-fireworks')
    // La célébration ne doit jamais intercepter le pointeur ni être annoncée.
    expect(festive).toMatch(/<div class="board-fireworks" aria-hidden="true">/)
  })
})
