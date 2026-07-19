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

describe('chute de la pièce posée', () => {
  /** Deux pièces d'une case, l'une au fond du plateau, l'autre tout en haut. */
  const twoHeights = () => {
    const board = createEmptyBoard()
    board[8][0] = { player: 'blue', pieceId: 'blue-bas', shapeId: 'mono' }
    board[0][3] = { player: 'white', pieceId: 'white-haut', shapeId: 'mono' }
    return board
  }

  const fallOf = (markup: string, pieceClass: string) => {
    const tag = markup.match(
      new RegExp(`<path[^>]*${pieceClass}[^>]*board-piece--falling[^>]*>`),
    )
    if (!tag) return null
    const read = (name: string) =>
      Number(tag[0].match(new RegExp(`${name}:\\s*(-?[\\d.]+)`))![1])
    return { from: read('--fall-from'), duration: read('--fall-duration') }
  }

  it('ne fait tomber que la pièce désignée', () => {
    const board = twoHeights()

    const markup = renderToStaticMarkup(
      <Board
        board={board}
        ghost={null}
        ghostPlayer="blue"
        fallingPieceId="blue-bas"
      />,
    )

    // Une seule dalle et son seul reflet : les pièces déjà en place ne
    // retombent pas quand une nouvelle est jouée.
    expect(markup.match(/board-piece--falling/g)).toHaveLength(1)
    expect(markup.match(/board-piece-sheen--falling/g)).toHaveLength(1)
  })

  it('ne fait rien tomber sans pièce désignée', () => {
    const markup = renderToStaticMarkup(
      <Board board={twoHeights()} ghost={null} ghostPlayer="blue" />,
    )

    expect(markup).not.toContain('--falling')
  })

  it('part toujours d’au-dessus du plateau, quelle que soit la ligne d’arrivée', () => {
    const board = twoHeights()

    for (const [id, bottom] of [
      ['blue-bas', 9],
      ['white-haut', 1],
    ] as const) {
      const fall = fallOf(
        renderToStaticMarkup(
          <Board
            board={board}
            ghost={null}
            ghostPlayer="blue"
            fallingPieceId={id}
          />,
        ),
        'board-piece--',
      )!
      // Le bas de la pièce démarre hors du plateau : sans cette marge elle
      // apparaîtrait déjà entamée au bord haut du cadre.
      expect(fall.from).toBeLessThan(-bottom)
    }
  })

  it('donne la même accélération à toutes les pièces', () => {
    const board = twoHeights()

    const falls = (['blue-bas', 'white-haut'] as const).map(
      (id) =>
        fallOf(
          renderToStaticMarkup(
            <Board
              board={board}
              ghost={null}
              ghostPlayer="blue"
              fallingPieceId={id}
            />,
          ),
          'board-piece--',
        )!,
    )

    const [loin, court] = falls
    expect(Math.abs(loin.from)).toBeGreaterThan(Math.abs(court.from))
    // `h = ½gt²` : la durée suit la racine de la hauteur, et rien d'autre. Un
    // terme constant — durée plancher, temps de départ — ferait flotter les
    // pièces qui s'arrêtent haut, et c'est exactement ce que ce test interdit.
    const g = (f: (typeof falls)[number]) =>
      Math.abs(f.from) / f.duration ** 2
    expect(g(loin)).toBeCloseTo(g(court), 5)
  })
})
