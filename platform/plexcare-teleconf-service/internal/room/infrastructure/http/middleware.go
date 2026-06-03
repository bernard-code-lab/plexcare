// Package http contém handlers HTTP e middlewares do room-service.
package http

import (
	"net/http"

	"plexcare/platform/plexcare-teleconf-service/pkg/tenant"
)

// HeaderTenantID é o header que carrega o tenant em dev/staging.
// Em produção, virá do token JWT do Auth Service (a ser implementado).
const HeaderTenantID = "X-Tenant-Id"

// TenantResolver decide configuração (plano, limites, features) a partir do ID.
// Em dev usamos uma implementação fixa; em prod virá do TenantConfigService.
type TenantResolver interface {
	Resolve(tenantID string) (tenant.Context, error)
}

// TenantMiddleware extrai X-Tenant-Id do header, resolve o tenant e injeta no context.
// Sem o header → 401. Tenant não encontrado → 403.
func TenantMiddleware(resolver TenantResolver) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			id := r.Header.Get(HeaderTenantID)
			if id == "" {
				writeError(w, http.StatusUnauthorized, "missing_tenant", "header "+HeaderTenantID+" required")
				return
			}
			tc, err := resolver.Resolve(id)
			if err != nil {
				writeError(w, http.StatusForbidden, "tenant_not_found", err.Error())
				return
			}
			next.ServeHTTP(w, r.WithContext(tenant.WithContext(r.Context(), tc)))
		})
	}
}
