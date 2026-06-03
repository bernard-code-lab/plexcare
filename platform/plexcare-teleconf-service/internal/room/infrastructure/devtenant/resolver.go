// Package devtenant fornece um TenantResolver in-memory para dev/local.
// Em produção, substitua por adapter que consulta o TenantConfigService real.
package devtenant

import (
	"errors"

	"plexcare/platform/plexcare-teleconf-service/pkg/tenant"
)

var ErrUnknownTenant = errors.New("unknown tenant (dev resolver)")

// Resolver sempre devolve um tenant Pro com 50 salas simultâneas.
// Em dev, qualquer X-Tenant-Id é aceito.
type Resolver struct{}

func New() *Resolver { return &Resolver{} }

func (r *Resolver) Resolve(tenantID string) (tenant.Context, error) {
	if tenantID == "" {
		return tenant.Context{}, ErrUnknownTenant
	}
	return tenant.NewContext(
		tenantID,
		"pro",
		50,
		map[string]bool{"recording": true, "transcription": false},
	), nil
}
