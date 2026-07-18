import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PieceShape } from './PieceShape'
import { PlexiDefs } from './PlexiDefs'
import type { Rotation } from '../game/types'

const ROTATIONS: readonly Rotation[] = [0, 1, 2, 3]

const defs = renderToStaticMarkup(<PlexiDefs />)

/** Les balises ouvrantes d'un élément, pour inspecter leurs attributs. */
const tags = (markup: string, name: string) =>
  markup.match(new RegExp(`<${name}\\b[^>]*>`, 'g')) ?? []

/** Toutes les valeurs numériques d'un attribut, dans tout le document. */
const numbers = (markup: string, attribute: string) =>
  [...markup.matchAll(new RegExp(`${attribute}="(-?[\\d.]+)"`, 'g'))].map(
    ([, value]) => Number(value),
  )

describe('matière plexiglas partagée', () => {
  it('ancre tous ses dégradés sur la scène, jamais sur la boîte de la pièce', () => {
    // C'est *la* propriété à tenir, et elle n'interdit pas les dégradés : un
    // dégradé en `objectBoundingBox` — la valeur par défaut, d'où l'exigence
    // d'un `gradientUnits` explicite — s'étire avec la boîte englobante et fait
    // basculer la lumière d'un `L` couché à un `L` debout. Ancré sur le repère
    // de la scène, il ignore la silhouette qui le découpe.
    const gradients = [
      ...tags(defs, 'linearGradient'),
      ...tags(defs, 'radialGradient'),
    ]

    // Sans cette garde le reste du test passerait sur zéro dégradé, donc sur une
    // matière sans reflet du tout.
    expect(gradients.length).toBeGreaterThan(0)
    for (const gradient of gradients) {
      expect(gradient).toContain('gradientUnits="userSpaceOnUse"')
    }
    expect(defs).not.toContain('objectBoundingBox')
  })

  it('n’éclaire la scène que depuis un seul côté, le haut à gauche', () => {
    // Le dégradé va du coin éclairé vers le coin opposé : il doit donc descendre
    // vers la droite et vers le bas. Deux dégradés de directions différentes
    // renverraient deux lumières sur un même plateau.
    const gradients = tags(defs, 'linearGradient')
    for (const gradient of gradients) {
      const at = (name: string) =>
        Number(gradient.match(new RegExp(`${name}="(-?[\\d.]+)"`))![1])
      expect(at('x2')).toBeGreaterThan(at('x1'))
      expect(at('y2')).toBeGreaterThan(at('y1'))
    }
  })

  it('n’emploie aucun filtre d’éclairage', () => {
    // `feSpecularLighting` et `feDiffuseLighting` dérivent une normale de surface
    // du canal alpha, avec un pas d'échantillonnage que la spécification ne fixe
    // pas. Gecko le prend à l'unité d'espace utilisateur, qui vaut ici une case :
    // chaque case recevait sa propre valeur de lumière et la dalle se lisait en
    // carrés de teintes différentes. Une barre 1×3, pourtant un simple rectangle,
    // sortait en trois bandes. Blink échantillonne en pixels de sortie et masquait
    // le défaut.
    expect(defs).not.toContain('feSpecularLighting')
    expect(defs).not.toContain('feDiffuseLighting')
  })

  it('garde toutes ses longueurs de filtre loin de l’échelle de la case', () => {
    // La règle qui protège de la rechute. Une pièce est un polyomino : ses
    // divisions internes tombent sur la grille. Tout effet dont la portée
    // avoisine la case s'aligne dessus et découpe la dalle en carrés — un voile
    // décalé d'une demi-case recouvre intégralement un bras d'une case de large
    // tout en effleurant seulement le bord d'une zone plus épaisse. Les longueurs
    // du filtre restent donc des affaires de tranche.
    const lengths = [
      ...numbers(defs, 'dx'),
      ...numbers(defs, 'dy'),
      ...numbers(defs, 'stdDeviation'),
      ...numbers(defs, 'radius'),
    ]

    expect(lengths.length).toBeGreaterThan(0)
    for (const length of lengths) {
      expect(Math.abs(length)).toBeLessThan(0.25)
    }
  })

  it('exprime ses longueurs en unités de case, sans pixel figé', () => {
    // Les unités utilisateur valent une case sur le plateau comme en réserve :
    // le relief garde la même épaisseur relative à toutes les échelles.
    expect(defs).toContain('primitiveUnits="userSpaceOnUse"')
    expect(defs).not.toMatch(/(stdDeviation|dx|dy)="[^"]*px"/)
  })
})

describe('invariance du reflet sur une pièce asymétrique', () => {
  const orientations = ROTATIONS.flatMap((rotation) =>
    [false, true].map((flipped) => ({ rotation, flipped })),
  )

  const render = (rotation: Rotation, flipped: boolean) =>
    renderToStaticMarkup(
      <PieceShape
        shapeId="largeL"
        player="blue"
        rotation={rotation}
        flipped={flipped}
      />,
    )

  /**
   * Le rendu privé de toute géométrie. Trois attributs décrivent la forme et
   * doivent donc varier : le tracé, la boîte de la pièce — un grand `L` occupe
   * `2 × 3` cases ou `3 × 2` selon sa rotation — et la taille qui s'en déduit.
   * Tout le reste porte la lumière.
   */
  const lighting = (markup: string) =>
    markup
      .replace(/ d="[^"]*"/g, '')
      .replace(/ viewBox="[^"]*"/g, '')
      .replace(/ style="[^"]*"/g, '')

  it('ne fait varier que le tracé dans les 4 rotations et les 2 miroirs', () => {
    const rendered = orientations.map(({ rotation, flipped }) =>
      render(rotation, flipped),
    )

    // Tout ce qui porte la lumière — classes, filtres, remplissages, dégradés —
    // doit être identique d'une orientation à l'autre.
    expect(new Set(rendered.map(lighting)).size).toBe(1)

    // La géométrie, elle, doit bien varier : sans quoi le test ci-dessus
    // passerait sur huit rendus identiques.
    const outlines = rendered.map((markup) => markup.match(/ d="[^"]*"/)![0])
    expect(new Set(outlines).size).toBeGreaterThan(1)
  })

  it('nappe la silhouette d’un reflet tracé sur le même contour', () => {
    // Le reflet reprend exactement le chemin de la dalle : les deux couches ne
    // peuvent pas se désaligner, et le dégradé ne déborde jamais de la matière.
    const markup = render(1, false)
    const outlines = [...markup.matchAll(/ d="([^"]*)"/g)].map(([, d]) => d)

    expect(outlines).toHaveLength(2)
    expect(outlines[0]).toBe(outlines[1])
    expect(markup).toContain('piece-shape__sheen')
  })

  it('cuit l’orientation dans les coordonnées, sans transform SVG', () => {
    // Un `transform="rotate(…)"` ferait tourner l'espace du filtre et celui du
    // dégradé avec la pièce : la lumière suivrait la silhouette au lieu de rester
    // en haut à gauche. Les orientations doivent donc rester dans le chemin.
    for (const { rotation, flipped } of orientations) {
      expect(render(rotation, flipped)).not.toContain('transform')
    }
  })
})
