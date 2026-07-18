import { BOARD_SIZE } from '../game/types'

/**
 * Traitement « plexiglas » partagé par toutes les silhouettes.
 *
 * La géométrie reste produite par `getCellsOutlinePath` ; ce module n'ajoute que
 * la matière : biseau de tranche, reflet, ombre portée. Un seul jeu de `<defs>`
 * vit dans le document et chaque silhouette y fait référence par
 * `filter: url(#…)` ou `fill: url(#…)` depuis le CSS, quel que soit son `<svg>`
 * d'accueil.
 *
 * DEUX ÉCHELLES, JAMAIS CELLE DE LA CASE — contrainte structurante.
 * Une pièce est un polyomino : ses divisions internes tombent exactement sur la
 * grille. Toute couche de matière dont la portée avoisine la case s'aligne donc
 * sur ces divisions et se lit comme un patchwork de carrés de teintes
 * différentes au lieu d'une dalle unie. Le piège est vicieux : un voile obtenu
 * en soustrayant à la silhouette une copie d'elle-même décalée d'une
 * demi-case recouvre *intégralement* un bras d'une case de large, alors qu'il ne
 * fait qu'effleurer le bord d'une zone plus épaisse. Les deux régions
 * s'éclaircissent inégalement, la frontière suit une arête de case, et la pièce
 * se découpe. Les seules échelles autorisées sont donc :
 *
 * - **bien plus petite qu'une case** — les liserés de tranche, ~0,06 case ;
 * - **bien plus grande qu'une case** — le reflet, étalé sur tout le plateau.
 *
 * INVARIANCE DES REFLETS — contrainte structurante elle aussi.
 * L'éclairage ne doit jamais tourner avec la pièce. Deux choix le garantissent :
 *
 * 1. `feOffset` : les décalages des liserés et de l'ombre portée sont des
 *    vecteurs d'espace utilisateur, fixes à l'écran.
 * 2. Le reflet est un dégradé en `gradientUnits="userSpaceOnUse"` ancré sur la
 *    scène, jamais en `objectBoundingBox`. Un dégradé lié à la boîte englobante
 *    s'étirerait avec elle et ferait basculer la lumière d'un `L` couché à un
 *    `L` debout ; ancré sur le repère du plateau, il ignore complètement le
 *    contour qui le découpe.
 *
 * PAS DE FILTRE D'ÉCLAIRAGE — `feSpecularLighting` et `feDiffuseLighting` sont
 * proscrits. Ils dérivent une normale de surface du canal alpha, et le pas de
 * cette dérivation n'est pas portable : Gecko l'échantillonne à l'unité
 * d'espace utilisateur, qui vaut ici une case. Chaque case reçoit alors sa
 * propre valeur de lumière et la dalle se découpe en carrés de teintes
 * différentes — jusqu'à une barre 1×3, pourtant un rectangle sans structure
 * interne, rendue en trois bandes. Blink échantillonne en pixels de sortie et
 * masque le défaut ; c'est Blink l'exception, pas la référence.
 *
 * Corollaire à respecter côté rendu : les orientations sont cuites dans les
 * coordonnées du chemin (`getOrientation`), jamais posées en `transform` SVG. Un
 * `transform="rotate(…)"` sur une silhouette ferait tourner l'espace du filtre
 * et celui du dégradé avec elle, et casserait l'invariance.
 *
 * ÉCHELLE — toutes les longueurs sont en unités de case. Le plateau et la
 * réserve dessinent l'un et l'autre une case par unité utilisateur : le relief
 * garde la même épaisseur relative du grand plateau de bureau à la petite
 * silhouette de réserve, sans valeur en pixels à maintenir en double.
 */

/**
 * Lumière rasante venant du haut à gauche, commune à toute la scène.
 *
 * L'azimut diagonal exact n'est pas un choix esthétique. Une rotation d'un quart
 * de tour transpose la boîte englobante d'une pièce, et `225°` est le seul
 * azimut pour lequel la diagonale d'une boîte `L × H` et celle d'une boîte
 * `H × L` ont la même longueur projetée : la silhouette tournée balaie alors
 * exactement la même portion du dégradé, donc la même lumière.
 */
const LIGHT_AZIMUTH = 225

/** Les longueurs dérivées de l'azimut sont irrationnelles : les arrondir garde
 *  un DOM lisible, à une précision très inférieure au pixel. */
const round = (value: number) => Number(value.toFixed(4))

/** Vecteur unitaire pointant vers la lumière, dans le repère écran (`y` vers le
 *  bas). Il oriente à la fois les liserés du filtre et le dégradé du reflet :
 *  un seul réglage, donc rien à garder en phase à la main. */
const radians = (LIGHT_AZIMUTH * Math.PI) / 180
const TO_LIGHT = { x: Math.cos(radians), y: Math.sin(radians) }

/**
 * Une bande le long des seules arêtes tournées vers `(dx, dy)`.
 *
 * Décaler la silhouette dans la direction opposée puis la soustraire à
 * l'originale ne laisse que le liseré du côté visé. Contrairement à un dégradé,
 * la bande épouse le contour réel — creux rentrants des `L`, `T` et `S`
 * compris — et son orientation est un vecteur d'espace utilisateur : elle ne
 * tourne jamais avec la pièce.
 *
 * À n'employer qu'à l'échelle de la tranche. Passé quelques centièmes de case,
 * le décalage finit par recouvrir un bras entier et quantifie l'éclaircissement
 * sur la grille : voir l'avertissement en tête de fichier.
 */
function EdgeBand({
  source,
  dx,
  dy,
  blur,
  color,
  opacity,
  result,
}: {
  /** Alpha de départ : la face intérieure, pour rester en deçà du liseré. */
  source: string
  dx: number
  dy: number
  blur: number
  color: string
  opacity: number
  result: string
}) {
  return (
    <>
      <feOffset
        in={source}
        dx={round(-dx)}
        dy={round(-dy)}
        result={`${result}Shift`}
      />
      <feGaussianBlur
        in={`${result}Shift`}
        stdDeviation={round(blur)}
        result={`${result}Soft`}
      />
      <feComposite
        in={source}
        in2={`${result}Soft`}
        operator="out"
        result={`${result}Mask`}
      />
      <feFlood floodColor={color} floodOpacity={opacity} result={`${result}Ink`} />
      <feComposite
        in={`${result}Ink`}
        in2={`${result}Mask`}
        operator="in"
        result={result}
      />
    </>
  )
}

type ReliefProps = {
  id: string
  /** Épaisseur de la tranche, en unités de case. */
  bevel: number
  /** Opacité de l'arête éclairée, côté lumière. */
  highlight: number
  /** Opacité de l'arête à l'ombre, côté opposé. */
  shade: number
  /** Densité du liseré : la tranche traverse plus de matière, donc plus foncée. */
  rim: number
  /** Ombre portée, en unités de case. */
  shadow: { dx: number; dy: number; blur: number; opacity: number }
}

/**
 * Une dalle translucide : tranche biseautée, filet spéculaire et ombre portée.
 * Le remplissage et le contour restent à la charge du CSS appelant, ce qui
 * laisse chaque camp choisir sa teinte sans dupliquer le filtre. Le reflet, lui,
 * n'est pas ici : il ne peut pas venir d'un filtre sans dépendre du contour, il
 * est peint par-dessus au dégradé `plexi-sheen`.
 *
 * Le biseau est volontairement étroit. Une tranche large finit par occuper
 * l'essentiel d'une pièce de trois cases : la couleur se délave et la dalle
 * prend l'air d'un cadre de tableau plutôt que d'un morceau de plexiglas.
 */
function ReliefFilter({
  id,
  bevel,
  highlight,
  shade,
  rim,
  shadow,
}: ReliefProps) {
  return (
    <filter
      id={id}
      x="-35%"
      y="-35%"
      width="170%"
      height="170%"
      primitiveUnits="userSpaceOnUse"
      colorInterpolationFilters="sRGB"
    >
      {/* Face intérieure : la silhouette érodée de l'épaisseur du liseré. Les
          tranches s'y appuient, donc elles restent en deçà du contour au lieu de
          l'effacer. Sans cela la tranche éclairée mange le trait qui sépare
          deux pièces voisines de même couleur. */}
      <feMorphology
        in="SourceAlpha"
        operator="erode"
        radius={round(bevel * 0.6)}
        result="face"
      />

      {/* Liseré dense : sur la tranche, la lumière traverse plus de matière et
          la teinte s'y concentre. C'est le liseré, non la saturation, qui
          continue de distinguer les camps en vision daltonienne. */}
      <feComposite
        in="SourceAlpha"
        in2="face"
        operator="out"
        result="rimMask"
      />
      <feFlood floodColor="#0d1a30" floodOpacity={rim} result="rimInk" />
      <feComposite in="rimInk" in2="rimMask" operator="in" result="rimEdge" />

      {/* Tranche à l'ombre, côté opposé à la lumière : c'est elle qui donne son
          épaisseur à la dalle. Le ghost s'en passe, il ne repose sur rien. */}
      {shade > 0 && (
        <EdgeBand
          source="face"
          dx={-TO_LIGHT.x * bevel}
          dy={-TO_LIGHT.y * bevel}
          blur={bevel * 0.55}
          color="#09142a"
          opacity={shade}
          result="shadeEdge"
        />
      )}

      {/* Tranche éclairée, côté lumière. */}
      <EdgeBand
        source="face"
        dx={TO_LIGHT.x * bevel}
        dy={TO_LIGHT.y * bevel}
        blur={bevel * 0.5}
        color="#ffffff"
        opacity={highlight}
        result="litEdge"
      />

      {/* Pas de `feSpecularLighting` ici, et c'est le fond du sujet : voir
          l'avertissement sur les échelles en tête de fichier. Les filtres
          d'éclairage dérivent une normale de surface du canal alpha, et le pas
          de cette dérivation n'est pas portable — Gecko l'échantillonne à
          l'unité d'espace utilisateur, qui vaut ici une case. Chaque case
          recevait donc son propre niveau de lumière : une simple barre 1×3,
          pourtant un rectangle sans aucune structure interne, se rendait en
          trois bandes distinctes sous Firefox. C'est le patchwork de teintes
          signalé, et aucun réglage de `surfaceScale` ne le corrige puisque le
          pas d'échantillonnage, lui, ne se règle pas. La brillance vient
          désormais du dégradé `plexi-sheen`, qui ne dérive rien du contour. */}

      <feMerge result="slab">
        <feMergeNode in="SourceGraphic" />
        <feMergeNode in="rimEdge" />
        {shade > 0 && <feMergeNode in="shadeEdge" />}
        <feMergeNode in="litEdge" />
      </feMerge>

      <feDropShadow
        in="slab"
        dx={shadow.dx}
        dy={shadow.dy}
        stdDeviation={shadow.blur}
        floodColor="#101a2b"
        floodOpacity={shadow.opacity}
      />
    </filter>
  )
}

/**
 * Le reflet : la nappe de lumière que renvoie une surface polie.
 *
 * Le dégradé couvre la diagonale du plateau, du coin éclairé au coin opposé, et
 * chaque silhouette n'en découpe que sa part. Deux propriétés en découlent, et
 * ce sont exactement les deux défauts corrigés :
 *
 * - il ignore le contour, donc il ne peut rien quantifier sur les cases : sa
 *   variation sur la largeur d'une case reste imperceptible ;
 * - il est ancré sur la scène, donc tourner ou retourner une pièce déplace sa
 *   silhouette sous une nappe qui, elle, ne bouge pas.
 *
 * La nappe se termine par un voile sombre : sans lui la dalle s'éclaircirait
 * partout, et c'est le contraste entre le haut lumineux et le bas éteint qui
 * fait lire une épaisseur de matière plutôt qu'un aplat.
 */
function SheenGradient({ id }: { id: string }) {
  // Le vecteur va du coin éclairé au coin opposé. Sa longueur est la projection
  // de la diagonale du plateau sur l'axe de la lumière : à 225° elle retombe
  // exactement sur la diagonale `(0, 0) → (9, 9)`, mais la dériver de l'azimut
  // garde les deux réglages en phase si la lumière bouge un jour.
  const span = BOARD_SIZE * (Math.abs(TO_LIGHT.x) + Math.abs(TO_LIGHT.y))

  return (
    <linearGradient
      id={id}
      gradientUnits="userSpaceOnUse"
      x1="0"
      y1="0"
      x2={round(-TO_LIGHT.x * span)}
      y2={round(-TO_LIGHT.y * span)}
    >
      <stop offset="0" stopColor="#ffffff" stopOpacity="0.26" />
      <stop offset="0.2" stopColor="#ffffff" stopOpacity="0.145" />
      <stop offset="0.46" stopColor="#ffffff" stopOpacity="0.035" />
      <stop offset="0.68" stopColor="#0a1730" stopOpacity="0.02" />
      <stop offset="1" stopColor="#0a1730" stopOpacity="0.065" />
    </linearGradient>
  )
}

/**
 * Les `<defs>` du document. Rendu une seule fois, à côté du plateau : les
 * références `url(#…)` portent sur tout le document, la réserve et l'aperçu
 * central s'en servent depuis leur propre `<svg>`.
 */
export function PlexiDefs() {
  return (
    <svg className="plexi-defs" aria-hidden="true" focusable="false">
      <defs>
        {/* Le reflet est unique : une seule nappe pour toute la scène, sinon
            deux dalles renverraient deux lumières. Les états qui doivent la
            porter plus discrètement — ghost, réserve — baissent son opacité
            depuis le CSS plutôt que de dupliquer le dégradé. */}
        <SheenGradient id="plexi-sheen" />

        {/* Pièce posée et aperçu central : relief franc, la dalle repose. */}
        <ReliefFilter
          id="plexi-relief"
          bevel={0.075}
          highlight={0.5}
          shade={0.32}
          rim={0.2}
          shadow={{ dx: 0.045, dy: 0.07, blur: 0.05, opacity: 0.34 }}
        />

        {/* Réserve : mêmes lumières, relief et ombre atténués. Aux petites
            tailles un biseau appuyé se referme en bouillie et l'ombre déborde
            sur la silhouette voisine. */}
        <ReliefFilter
          id="plexi-relief-soft"
          bevel={0.062}
          highlight={0.42}
          shade={0.24}
          rim={0.16}
          shadow={{ dx: 0.03, dy: 0.045, blur: 0.038, opacity: 0.24 }}
        />

        {/* Mobile : sur une case de trente pixels un biseau appuyé se referme et
            l'ombre bave sur la case voisine. Tranche et ombre rétrécissent donc
            encore. Le reflet, lui, reste identique : un dégradé ne coûte rien à
            rastériser et c'est lui qui porte la matière. */}
        <ReliefFilter
          id="plexi-relief-lite"
          bevel={0.06}
          highlight={0.46}
          shade={0.3}
          rim={0.2}
          shadow={{ dx: 0.04, dy: 0.06, blur: 0.045, opacity: 0.32 }}
        />

        {/* Ghost : la pièce n'est pas posée. Pas de tranche à l'ombre, reflet
            discret, et une ombre lointaine et diffuse qui la fait planer. */}
        <ReliefFilter
          id="plexi-float"
          bevel={0.06}
          highlight={0.3}
          shade={0}
          rim={0.12}
          shadow={{ dx: 0.07, dy: 0.15, blur: 0.13, opacity: 0.2 }}
        />
      </defs>
    </svg>
  )
}
