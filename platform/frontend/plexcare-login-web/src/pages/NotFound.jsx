import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import AuthShell from '@/components/AuthShell'

export default function NotFound() {
  return (
    <AuthShell
      eyebrow="404"
      title="Página não encontrada"
      subtitle="O link que você acessou não existe ou foi movido."
      footer={
        <Link to="/login" className="inline-flex items-center gap-1.5 text-teal-300 hover:text-teal-200">
          <ArrowLeft className="h-4 w-4" /> Ir para o login
        </Link>
      }
    >
      <div className="text-center text-sm text-mute">
        Se você chegou aqui por um link recebido, peça à pessoa que reenviou para verificar a URL.
      </div>
    </AuthShell>
  )
}
