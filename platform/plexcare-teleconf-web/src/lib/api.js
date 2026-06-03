// Cliente HTTP para o plexcare-teleconf-service.
// Em prod, X-Tenant-Id virá do token de auth — por enquanto lê de env (dev).

const baseUrl = import.meta.env.VITE_TELECONF_SERVICE_URL ?? 'http://localhost:8080'
const devTenantId =
  import.meta.env.VITE_DEV_TENANT_ID ?? '00000000-0000-4000-8000-000000000001'

export class ApiError extends Error {
  constructor(status, body) {
    super(`API ${status}: ${body}`)
    this.status = status
    this.body = body
  }
}

async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Id': devTenantId,
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new ApiError(res.status, text)
  }
  return res.json()
}

export const api = {
  createRoom(input) {
    return request('/api/v1/rooms', { method: 'POST', body: input })
  },
  listRooms({ limit, cursor } = {}) {
    const params = new URLSearchParams()
    if (limit) params.set('limit', String(limit))
    if (cursor) params.set('cursor', cursor)
    const qs = params.toString()
    return request(`/api/v1/rooms${qs ? `?${qs}` : ''}`)
  },
  // TODO: postFeedback (depende de POST /rooms/{id}/feedback)
}
