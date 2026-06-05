// Persiste contexto de sala entre rotas (Waiting → Live → PostCall) via
// sessionStorage. Limpa ao fechar a aba — token não pode vazar.

const KEY = 'plexcare:room-session'

export function saveSession(payload) {
  sessionStorage.setItem(KEY, JSON.stringify(payload))
}

export function loadSession() {
  const raw = sessionStorage.getItem(KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function clearSession() {
  sessionStorage.removeItem(KEY)
}
