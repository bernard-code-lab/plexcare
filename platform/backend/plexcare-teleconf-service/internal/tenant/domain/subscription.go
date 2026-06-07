// Package domain define o agregado TenantSubscription consumido pelo
// projector. É a representação canônica do estado de subscription de um
// tenant — alimenta o middleware HTTP (via repository) e qualquer
// componente que precise consultar plan/features.
//
// Mantém invariantes: enums fechados, UUID válido, períodos consistentes.
//
// Source-of-truth do estado é o plexcare-idp-api (ADR-0008). Aqui é
// read-model projetado via outbox/Kafka (ADR-0011 §D-2).
package domain

import (
	"errors"
	"time"
)

// ProductSKU é o SKU do produto vendido (rooms / schedule / suite).
type ProductSKU string

const (
	ProductRooms    ProductSKU = "rooms"
	ProductSchedule ProductSKU = "schedule"
	ProductSuite    ProductSKU = "suite"
)

// PlanTier é o tier dentro do produto.
type PlanTier string

const (
	TierTrial      PlanTier = "trial"
	TierSolo       PlanTier = "solo"
	TierClinica    PlanTier = "clinica"
	TierEnterprise PlanTier = "enterprise"
)

// SubscriptionStatus é o lifecycle da subscription.
type SubscriptionStatus string

const (
	StatusTrialing  SubscriptionStatus = "trialing"
	StatusActive    SubscriptionStatus = "active"
	StatusPastDue   SubscriptionStatus = "past_due"
	StatusCancelled SubscriptionStatus = "cancelled"
	StatusChurned   SubscriptionStatus = "churned"
)

// Subscription é o snapshot do estado da subscription após uma mudança.
//
// updated_at vem do `time` do envelope CloudEvents que gerou o snapshot.
// Eventos out-of-order são descartados pelo repository (UPDATE só dispara
// se EXCLUDED.updated_at > stored updated_at).
type Subscription struct {
	TenantID           string
	AccountID          int64
	PlanCode           string
	ProductSKU         ProductSKU
	PlanTier           PlanTier
	Status             SubscriptionStatus
	MaxConcurrentRooms int
	Features           map[string]bool
	TrialEndsAt        *time.Time
	CurrentPeriodEnd   time.Time
	UpdatedAt          time.Time
}

// Erros tipados — caller usa errors.Is.
var (
	ErrInvalidTenantID         = errors.New("tenant: tenant_id is empty or not a UUID")
	ErrInvalidProductSKU       = errors.New("tenant: product_sku out of allowed set")
	ErrInvalidPlanTier         = errors.New("tenant: plan_tier out of allowed set")
	ErrInvalidStatus           = errors.New("tenant: status out of allowed set")
	ErrNegativeMaxRooms        = errors.New("tenant: max_concurrent_rooms must be >= 0")
	ErrMissingCurrentPeriodEnd = errors.New("tenant: current_period_end is required")
	ErrMissingUpdatedAt        = errors.New("tenant: updated_at is required")
	ErrSubscriptionNotFound    = errors.New("tenant: subscription not found")
)

// Validate enforce invariantes da entidade antes da projeção/upsert.
// Erros de validação são fatais para o consumer Kafka (mensagem mal-formada
// vai para DLQ — comportamento atual do consumer só loga e commita; DLQ é TODO).
func (s *Subscription) Validate() error {
	if !isValidUUID(s.TenantID) {
		return ErrInvalidTenantID
	}
	switch s.ProductSKU {
	case ProductRooms, ProductSchedule, ProductSuite:
	default:
		return ErrInvalidProductSKU
	}
	switch s.PlanTier {
	case TierTrial, TierSolo, TierClinica, TierEnterprise:
	default:
		return ErrInvalidPlanTier
	}
	switch s.Status {
	case StatusTrialing, StatusActive, StatusPastDue, StatusCancelled, StatusChurned:
	default:
		return ErrInvalidStatus
	}
	if s.MaxConcurrentRooms < 0 {
		return ErrNegativeMaxRooms
	}
	if s.CurrentPeriodEnd.IsZero() {
		return ErrMissingCurrentPeriodEnd
	}
	if s.UpdatedAt.IsZero() {
		return ErrMissingUpdatedAt
	}
	return nil
}

// isValidUUID é um check leve do shape 8-4-4-4-12 hex (com hífens).
// Não pretende ser um parser completo — só barra strings óbvias erradas
// antes de chegar ao postgres (que tem o type UUID e rejeita por SQLSTATE 22P02
// como defesa em profundidade).
func isValidUUID(s string) bool {
	if len(s) != 36 {
		return false
	}
	for i, r := range s {
		switch i {
		case 8, 13, 18, 23:
			if r != '-' {
				return false
			}
		default:
			isHex := (r >= '0' && r <= '9') ||
				(r >= 'a' && r <= 'f') ||
				(r >= 'A' && r <= 'F')
			if !isHex {
				return false
			}
		}
	}
	return true
}
