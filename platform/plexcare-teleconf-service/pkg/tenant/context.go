// Package tenant propaga o contexto do tenant resolvido pelo Multi-tenant Router
// através de toda a cadeia de chamadas, sem que cada use case precise de um parâmetro extra.
package tenant

import "context"

type contextKey struct{}

// Context carrega o tenant resolvido pelo middleware de auth.
type Context struct {
	ID                 string
	Plan               string
	MaxConcurrentRooms int
	Features           map[string]bool
}

func NewContext(id, plan string, maxRooms int, features map[string]bool) Context {
	return Context{
		ID:                 id,
		Plan:               plan,
		MaxConcurrentRooms: maxRooms,
		Features:           features,
	}
}

func WithContext(ctx context.Context, tc Context) context.Context {
	return context.WithValue(ctx, contextKey{}, tc)
}

func FromContext(ctx context.Context) (Context, bool) {
	tc, ok := ctx.Value(contextKey{}).(Context)
	return tc, ok
}

// HasFeature retorna false se o tenant não tem a feature ou se o contexto está ausente.
func HasFeature(ctx context.Context, feature string) bool {
	tc, ok := FromContext(ctx)
	if !ok {
		return false
	}
	return tc.Features[feature]
}
