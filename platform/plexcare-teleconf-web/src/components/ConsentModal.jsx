import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Button } from '@/components/ui/button'

const ITEMS = [
  {
    id: 'identity',
    label:
      'Confirmo ser o paciente identificado na consulta ou estar representado por responsável legal.',
  },
  {
    id: 'audit',
    label:
      'Autorizo o registro de auditoria (entrada/saída, identificadores) conforme exigido pela LGPD.',
  },
  {
    id: 'recording',
    label:
      'Estou ciente de que, se houver gravação, o profissional comunicará e exibirá indicador antes do início.',
  },
]

// Modal bloqueante de consentimento — abre antes de WaitingRoom liberar entrada.
// onAccept dispara a continuação do fluxo; onReject volta para Home.
// TODO: gravar audit beacon (POST /rooms/:name/consent) quando endpoint existir.
export default function ConsentModal({ open, onAccept, onReject }) {
  const [checked, setChecked] = useState({})
  const allChecked = ITEMS.every((it) => checked[it.id])

  return (
    <Dialog.Root open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-950/80 backdrop-blur-sm" />
        <Dialog.Content
          data-testid="consent-modal"
          className="fixed left-1/2 top-1/2 z-50 w-[min(560px,90vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-ink-900 p-6 shadow-glow"
        >
          <Dialog.Title className="font-display text-xl font-semibold text-cream">
            Consentimento de teleconsulta
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-mute">
            Esta consulta será conduzida por videoconferência sob a Resolução CFM 2.314/2022.
            Leia e confirme os itens abaixo para continuar.
          </Dialog.Description>

          <ul className="mt-5 space-y-3">
            {ITEMS.map((it) => (
              <li key={it.id}>
                <label className="flex cursor-pointer items-start gap-3 text-sm text-cream">
                  <input
                    type="checkbox"
                    checked={!!checked[it.id]}
                    onChange={(e) =>
                      setChecked((prev) => ({ ...prev, [it.id]: e.target.checked }))
                    }
                    className="mt-0.5 h-4 w-4 rounded border-border bg-ink-800 text-teal-400 focus:ring-teal-400"
                    data-testid={`consent-${it.id}`}
                  />
                  <span>{it.label}</span>
                </label>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={onReject}
              data-testid="consent-reject"
            >
              Não aceito
            </Button>
            <Button
              disabled={!allChecked}
              onClick={() => onAccept({ acceptedAt: new Date().toISOString() })}
              data-testid="consent-accept"
            >
              Confirmar e continuar
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
