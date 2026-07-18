import { useEffect, useState } from 'react'

const HOVER_QUERY = '(hover: hover) and (pointer: fine)'

/**
 * Vrai quand le pointeur sait survoler. La grille prend alors la visée en
 * charge ; sinon, la rangée de flèches reste le seul moyen de désigner une
 * colonne au doigt.
 */
export function usePointerHasHover(): boolean {
  const [hasHover, setHasHover] = useState(
    () =>
      typeof window !== 'undefined' && window.matchMedia(HOVER_QUERY).matches,
  )

  useEffect(() => {
    const query = window.matchMedia(HOVER_QUERY)
    const update = () => setHasHover(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  return hasHover
}
