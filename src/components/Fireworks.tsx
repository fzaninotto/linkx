import { useEffect, useState } from 'react'

/**
 * Les bouquets, en pourcentage du cadre et en millisecondes. Ils sont écartés
 * du centre et étalés dans le temps : à aucun instant la position finale n'est
 * illisible, et la célébration se termine d'elle-même.
 */
const BURSTS = [
  { x: 24, y: 30, delay: 0 },
  { x: 74, y: 22, delay: 360 },
  { x: 46, y: 60, delay: 780 },
  { x: 16, y: 64, delay: 1180 },
  { x: 82, y: 58, delay: 1540 },
]

const SPARKS_PER_BURST = 12

const COLORS = ['#ffd24a', '#ffb01f', '#fff3c4', '#8fc2ff', '#ffffff']

/** Le dernier départ, plus la vie d'une étincelle et sa cascade de retards. */
const SHOW_DURATION = 4200

/**
 * Les étincelles sont réparties en couronne, avec une portée qui varie d'une
 * étincelle à l'autre pour éviter le cercle parfait. Tout est dérivé de l'index
 * : le rendu est déterministe, donc reproductible en test.
 */
function sparksOf(burstIndex: number) {
  return Array.from({ length: SPARKS_PER_BURST }, (_, index) => {
    const angle = (index / SPARKS_PER_BURST) * Math.PI * 2 + burstIndex * 0.4
    const reach = 0.7 + (0.3 * ((index * 5) % 7)) / 6
    return {
      dx: Number((Math.cos(angle) * reach).toFixed(3)),
      dy: Number((Math.sin(angle) * reach).toFixed(3)),
      color: COLORS[(index + burstIndex) % COLORS.length],
      delay: index * 12,
    }
  })
}

/**
 * Feu d'artifice de victoire, superposé au cadre du plateau. Il ne capte aucun
 * pointeur, ne dépasse pas du cadre — donc ne recouvre jamais le panneau de fin
 * — et se démonte une fois joué plutôt que de tourner en boucle. Sous
 * `prefers-reduced-motion`, la feuille de style le retire entièrement.
 */
export function Fireworks() {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), SHOW_DURATION)
    return () => clearTimeout(timer)
  }, [])

  if (!visible) return null

  return (
    <div className="board-fireworks" aria-hidden="true">
      {BURSTS.map((burst, burstIndex) => (
        <div
          className="fireworks-burst"
          key={`burst-${burstIndex}`}
          style={{ left: `${burst.x}%`, top: `${burst.y}%` }}
        >
          <span
            className="fireworks-flash"
            style={{ animationDelay: `${burst.delay}ms` }}
          />
          {sparksOf(burstIndex).map((spark, sparkIndex) => (
            <span
              className="fireworks-spark"
              key={`spark-${sparkIndex}`}
              style={
                {
                  '--spark-dx': spark.dx,
                  '--spark-dy': spark.dy,
                  '--spark-color': spark.color,
                  animationDelay: `${burst.delay + spark.delay}ms`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      ))}
    </div>
  )
}
