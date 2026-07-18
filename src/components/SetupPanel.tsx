import type { GameMode } from '../game/types'

type SetupPanelProps = {
  onStart: (mode: GameMode) => void
  onShowRules: () => void
}

const MODES: { id: GameMode; label: string; hint: string; icon: string }[] = [
  {
    id: 'human',
    label: 'À deux joueurs',
    hint: 'Chacun son tour sur le même écran.',
    icon: '👥',
  },
  {
    id: 'ai',
    label: 'Contre l’ordinateur',
    hint: 'Vous jouez les bleus, l’ordinateur les blancs.',
    icon: '🤖',
  },
]

export function SetupPanel({ onStart, onShowRules }: SetupPanelProps) {
  return (
    <main className="setup-screen">
      <section className="setup-card">
        <div className="brand-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <p className="overline">Jeu de connexion</p>
        <h1 className="game-title">LINKX</h1>
        <p className="setup-intro">
          Faites tomber vos pièces et reliez deux bords opposés avant votre adversaire.
          Les diagonales comptent.
        </p>

        <div className="mode-choice">
          {MODES.map((mode) => (
            <button
              type="button"
              className={`mode-button mode-button--${mode.id}`}
              onClick={() => onStart(mode.id)}
              key={mode.id}
            >
              <span className="mode-icon" aria-hidden="true">
                {mode.icon}
              </span>
              <span className="mode-text">
                <strong>{mode.label}</strong>
                <small>{mode.hint}</small>
              </span>
              <span className="mode-arrow" aria-hidden="true">
                →
              </span>
            </button>
          ))}
        </div>

        <p className="setup-note">La couleur qui commence est tirée au sort.</p>

        <button type="button" className="text-button" onClick={onShowRules}>
          Lire les règles
        </button>
      </section>
    </main>
  )
}
