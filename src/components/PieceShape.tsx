import { getOrientation } from '../game/transforms'
import type { Orientation, PlayerId, Rotation, ShapeId } from '../game/types'
import { getCellsOutlinePath } from './pieceGeometry'

type PieceShapeProps = {
  shapeId?: ShapeId
  player: PlayerId
  orientation?: Orientation
  rotation?: Rotation
  flipped?: boolean
  compact?: boolean
  unavailable?: boolean
}

export function PieceShape({
  shapeId,
  player,
  orientation,
  rotation = 0,
  flipped = false,
  compact = false,
  unavailable = false,
}: PieceShapeProps) {
  const shown = orientation ?? getOrientation(shapeId!, rotation, flipped)

  return (
    <svg
      className={`piece-shape piece-shape--${player}${compact ? ' piece-shape--compact' : ''}`}
      viewBox={`0 0 ${shown.width} ${shown.height}`}
      style={{
        width: `calc(${shown.width} * var(--piece-cell))`,
        height: `calc(${shown.height} * var(--piece-cell))`,
      }}
      aria-hidden="true"
    >
      <path
        className={`piece-shape__silhouette${unavailable ? ' piece-shape__silhouette--unavailable' : ''}`}
        d={getCellsOutlinePath(shown.cells)}
      />
    </svg>
  )
}
