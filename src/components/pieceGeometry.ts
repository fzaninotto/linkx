type Point = { x: number; y: number }

type Vector = { dx: number; dy: number }

type Edge = { from: Point; to: Point; dir: Vector }

export const OUTLINE_INSET = 0.055

const key = (x: number, y: number) => `${x},${y}`

// Repère SVG, y vers le bas : la rotation horaire d'une direction donne la
// normale qui pointe vers la matière. Les contours sont donc parcourus dans le
// sens horaire, les trous éventuels dans le sens inverse.
const clockwise = ({ dx, dy }: Vector): Vector => ({ dx: -dy, dy: dx })

function boundaryEdges(cells: readonly Point[]): Map<string, Edge[]> {
  const occupied = new Set(cells.map(({ x, y }) => key(x, y)))
  const has = (x: number, y: number) => occupied.has(key(x, y))
  const edges = new Map<string, Edge[]>()

  const add = (from: Point, to: Point) => {
    const edge: Edge = {
      from,
      to,
      dir: { dx: to.x - from.x, dy: to.y - from.y },
    }
    const at = key(from.x, from.y)
    const existing = edges.get(at)
    if (existing) existing.push(edge)
    else edges.set(at, [edge])
  }

  for (const { x, y } of cells) {
    if (!has(x, y - 1)) add({ x, y }, { x: x + 1, y })
    if (!has(x + 1, y)) add({ x: x + 1, y }, { x: x + 1, y: y + 1 })
    if (!has(x, y + 1)) add({ x: x + 1, y: y + 1 }, { x, y: y + 1 })
    if (!has(x - 1, y)) add({ x, y: y + 1 }, { x, y })
  }

  return edges
}

function takeEdge(
  edges: Map<string, Edge[]>,
  at: Point,
  incoming?: Vector,
): Edge | undefined {
  const candidates = edges.get(key(at.x, at.y))
  if (!candidates || candidates.length === 0) return undefined

  let index = 0
  if (incoming && candidates.length > 1) {
    // Deux cases qui ne se touchent que par un coin partagent ce sommet. Tourner
    // toujours vers la matière y ferme deux contours distincts au lieu d'un
    // huit, et chacun reçoit son propre retrait.
    const turn = clockwise(incoming)
    const preferred = candidates.findIndex(
      ({ dir }) => dir.dx === turn.dx && dir.dy === turn.dy,
    )
    if (preferred >= 0) index = preferred
  }

  const [edge] = candidates.splice(index, 1)
  if (candidates.length === 0) edges.delete(key(at.x, at.y))
  return edge
}

// Les arêtes colinéaires successives fusionnent : un sommet traversé tout droit
// fausserait le retrait, qui suppose deux directions perpendiculaires.
function mergeCollinear(loop: readonly Edge[]): Edge[] {
  const merged: Edge[] = []
  for (const edge of loop) {
    const last = merged[merged.length - 1]
    if (last && last.dir.dx === edge.dir.dx && last.dir.dy === edge.dir.dy) {
      last.to = edge.to
    } else {
      merged.push({ ...edge })
    }
  }
  const first = merged[0]
  const last = merged[merged.length - 1]
  if (merged.length > 1 && last.dir.dx === first.dir.dx && last.dir.dy === first.dir.dy) {
    first.from = last.from
    merged.pop()
  }
  return merged
}

function outlineLoops(cells: readonly Point[]): Edge[][] {
  const edges = boundaryEdges(cells)
  const loops: Edge[][] = []

  while (edges.size > 0) {
    const [x, y] = edges.keys().next().value!.split(',').map(Number)
    const loop: Edge[] = []
    let current = takeEdge(edges, { x, y })
    while (current) {
      loop.push(current)
      current = takeEdge(edges, current.to, current.dir)
    }
    loops.push(mergeCollinear(loop))
  }

  return loops
}

// Chaque arête recule de `inset` le long de sa normale intérieure. Les deux
// arêtes d'un sommet étant perpendiculaires, leur intersection vaut la somme des
// deux décalages : les angles saillants rentrent, les angles rentrants sortent,
// et les creux des L, T et S se referment exactement.
function insetLoop(loop: readonly Edge[], inset: number): Point[] {
  return loop.map((edge, index) => {
    const previous = loop[(index - 1 + loop.length) % loop.length]
    const inward = clockwise(edge.dir)
    const inwardBefore = clockwise(previous.dir)
    return {
      x: edge.from.x + inset * (inward.dx + inwardBefore.dx),
      y: edge.from.y + inset * (inward.dy + inwardBefore.dy),
    }
  })
}

const round = (value: number) => Number(value.toFixed(4))

/**
 * Contour de l'union des cases, retrait compris : une seule silhouette continue
 * par pièce, sans arête interne ni téton dans les angles rentrants.
 */
export function getCellsOutlinePath(
  cells: readonly Point[],
  inset = OUTLINE_INSET,
): string {
  return outlineLoops(cells)
    .map((loop) => {
      const points = insetLoop(loop, inset)
      const [first, ...rest] = points
      return [
        `M ${round(first.x)} ${round(first.y)}`,
        ...rest.map(({ x, y }) => `L ${round(x)} ${round(y)}`),
        'Z',
      ].join(' ')
    })
    .join(' ')
}
