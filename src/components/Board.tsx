import { BOARD_SIZE } from '../game/types'
import type { Board as BoardType, DropResult, PlayerId, Point } from '../game/types'

type BoardProps = {
  board: BoardType
  ghost: DropResult | null
  ghostPlayer: PlayerId
  winningPath?: Point[]
}

export function Board({ board, ghost, ghostPlayer, winningPath = [] }: BoardProps) {
  const ghostCells = new Set(
    (ghost
      ? ghost.valid
        ? ghost.cells
        : ghost.previewCells
      : []
    ).map(({ x, y }) => `${x},${y}`),
  )
  const winningCells = new Set(winningPath.map(({ x, y }) => `${x},${y}`))

  return (
    <div className="board-frame">
      <div
        className="board"
        role="grid"
        aria-label="Plateau Linkx de 9 lignes par 9 colonnes"
        style={{ '--board-size': BOARD_SIZE } as React.CSSProperties}
      >
        {board.flatMap((row, y) =>
          row.map((cell, x) => {
            const isGhost = ghostCells.has(`${x},${y}`)
            const samePiece = (otherX: number, otherY: number) =>
              Boolean(
                cell &&
                  otherX >= 0 &&
                  otherX < BOARD_SIZE &&
                  otherY >= 0 &&
                  otherY < BOARD_SIZE &&
                  board[otherY][otherX]?.pieceId === cell.pieceId,
              )
            const joins = (otherX: number, otherY: number) =>
              samePiece(otherX, otherY) ||
              (isGhost && ghostCells.has(`${otherX},${otherY}`))
            const classNames = [
              'board-cell',
              cell ? `board-cell--${cell.player}` : '',
              joins(x - 1, y) ? 'board-cell--join-left' : '',
              joins(x + 1, y) ? 'board-cell--join-right' : '',
              joins(x, y - 1) ? 'board-cell--join-up' : '',
              joins(x, y + 1) ? 'board-cell--join-down' : '',
              winningCells.has(`${x},${y}`) ? 'board-cell--winning' : '',
              isGhost ? `board-cell--ghost-${ghostPlayer}` : '',
              isGhost && ghost && !ghost.valid ? 'board-cell--ghost-invalid' : '',
            ]
              .filter(Boolean)
              .join(' ')
            return (
              <div
                className={classNames}
                role="gridcell"
                aria-label={`Ligne ${y + 1}, colonne ${x + 1}${cell ? `, ${cell.player === 'blue' ? 'bleu' : 'blanc'}` : ', vide'}${isGhost ? ', aperçu' : ''}`}
                key={`${x}-${y}`}
              />
            )
          }),
        )}
      </div>
    </div>
  )
}
