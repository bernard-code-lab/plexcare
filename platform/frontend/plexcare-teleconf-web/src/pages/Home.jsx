import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Plus, History } from 'lucide-react'

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-cream">
        Sala virtual PlexCare
      </h1>
      <p className="mt-2 max-w-xl text-mute">
        Inicie uma nova teleconsulta ou consulte o histórico de atendimentos.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Link to="/rooms/new" data-testid="home-new-room" className="block">
          <Card className="border-border bg-ink-900/60 p-6 transition-colors hover:border-teal-400/40">
            <Plus className="mb-3 h-6 w-6 text-teal-400" />
            <h2 className="font-display text-lg font-semibold text-cream">Nova consulta</h2>
            <p className="mt-1 text-sm text-mute">
              Agende uma teleconsulta e gere o link de acesso para médico e paciente.
            </p>
          </Card>
        </Link>

        <Link to="/dashboard" data-testid="home-dashboard" className="block">
          <Card className="border-border bg-ink-900/60 p-6 transition-colors hover:border-teal-400/40">
            <History className="mb-3 h-6 w-6 text-teal-400" />
            <h2 className="font-display text-lg font-semibold text-cream">Histórico</h2>
            <p className="mt-1 text-sm text-mute">
              Consultas anteriores — duração, participantes e status da gravação.
            </p>
          </Card>
        </Link>
      </div>
    </main>
  )
}
