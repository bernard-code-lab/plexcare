import { useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const STATUS_LABEL = {
  pending: 'Pendente',
  active: 'Em andamento',
  finished: 'Finalizada',
  expired: 'Expirada',
}

const STATUS_TONE = {
  finished: 'text-teal-400',
  active: 'text-gold-400',
  pending: 'text-mute',
  expired: 'text-red-400',
}

export default function Dashboard() {
  const [cursor, setCursor] = useState(undefined)
  const [history, setHistory] = useState([]) // pilha de cursors para "voltar"

  const { data, isLoading, error } = useQuery({
    queryKey: ['rooms', cursor ?? 'first'],
    queryFn: () => api.listRooms({ limit: 20, cursor }),
    placeholderData: keepPreviousData,
  })

  function next() {
    if (!data?.next_cursor) return
    setHistory((h) => [...h, cursor])
    setCursor(data.next_cursor)
  }

  function prev() {
    setHistory((h) => {
      const prevCursor = h[h.length - 1]
      setCursor(prevCursor)
      return h.slice(0, -1)
    })
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-cream">
        Histórico de consultas
      </h1>
      <p className="mt-1 text-sm text-mute">
        Consultas registradas (mais recentes primeiro).
      </p>

      <Card className="mt-8 border-border bg-ink-900/60 p-0" data-testid="dashboard">
        {isLoading ? (
          <div className="p-6 text-sm text-mute" data-testid="dashboard-loading">Carregando…</div>
        ) : error ? (
          <div className="p-6 text-sm text-red-400" data-testid="dashboard-error">
            {error instanceof ApiError ? 'Não foi possível carregar o histórico.' : 'Erro ao carregar histórico'}
          </div>
        ) : data?.rooms?.length === 0 ? (
          <div className="p-6 text-sm text-mute" data-testid="dashboard-empty">
            Nenhuma consulta registrada ainda.
          </div>
        ) : (
          <table className="w-full text-sm" data-testid="dashboard-table">
            <thead className="border-b border-border text-left text-mute">
              <tr>
                <Th>Consulta</Th>
                <Th>Status</Th>
                <Th>Criada</Th>
                <Th>Duração</Th>
              </tr>
            </thead>
            <tbody>
              {data?.rooms?.map((room) => (
                <tr key={room.id} className="border-b border-border/40 last:border-0">
                  <Td>
                    <span className="text-cream">{room.appointment_id}</span>
                    <div className="text-xs text-mute">Nº {room.id.slice(0, 8)}</div>
                  </Td>
                  <Td>
                    <span className={STATUS_TONE[room.status] ?? 'text-mute'}>
                      {STATUS_LABEL[room.status] ?? room.status}
                    </span>
                  </Td>
                  <Td className="text-mute">{new Date(room.created_at).toLocaleString('pt-BR')}</Td>
                  <Td className="text-mute">{room.max_duration_min} min</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <div className="mt-4 flex justify-between">
        <Button
          variant="ghost"
          onClick={prev}
          disabled={history.length === 0}
          data-testid="dashboard-prev"
        >
          ← Página anterior
        </Button>
        <Button
          variant="ghost"
          onClick={next}
          disabled={!data?.next_cursor}
          data-testid="dashboard-next"
        >
          Próxima página →
        </Button>
      </div>
    </main>
  )
}

function Th({ children }) {
  return <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide">{children}</th>
}

function Td({ children, className = '' }) {
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>
}
