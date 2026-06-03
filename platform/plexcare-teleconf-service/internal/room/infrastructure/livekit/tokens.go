// Package livekit implementa os adapters de room.ports.LiveKitRoomClient
// e room.ports.TokenGenerator usando o LiveKit Server SDK.
package livekit

import (
	"errors"
	"time"

	lkauth "github.com/livekit/protocol/auth"
)

// ErrInvalidCredentials é devolvido quando apiKey/secret estão ausentes ou inválidos.
var ErrInvalidCredentials = errors.New("livekit: invalid api credentials")

// TokenGenerator emite JWTs LiveKit assinados com HMAC-SHA256.
// O secret precisa ter pelo menos 32 bytes (regra do LiveKit).
type TokenGenerator struct {
	apiKey    string
	apiSecret string
}

func NewTokenGenerator(apiKey, apiSecret string) *TokenGenerator {
	return &TokenGenerator{apiKey: apiKey, apiSecret: apiSecret}
}

// ForHost gera token de médico — publica e assina mídia.
func (g *TokenGenerator) ForHost(roomName, identity string, ttl time.Duration) (string, error) {
	return g.build(roomName, identity, ttl, hostGrant(roomName))
}

// ForGuest gera token de paciente — publica e assina mídia.
func (g *TokenGenerator) ForGuest(roomName, identity string, ttl time.Duration) (string, error) {
	return g.build(roomName, identity, ttl, guestGrant(roomName))
}

// ForObserver gera token de auditor — só assina, sem publicar, oculto.
func (g *TokenGenerator) ForObserver(roomName, identity string, ttl time.Duration) (string, error) {
	return g.build(roomName, identity, ttl, observerGrant(roomName))
}

func (g *TokenGenerator) build(roomName, identity string, ttl time.Duration, grant *lkauth.VideoGrant) (string, error) {
	if g.apiKey == "" || g.apiSecret == "" {
		return "", ErrInvalidCredentials
	}
	tok := lkauth.NewAccessToken(g.apiKey, g.apiSecret).
		SetVideoGrant(grant).
		SetIdentity(identity).
		SetValidFor(ttl)
	return tok.ToJWT()
}

func hostGrant(roomName string) *lkauth.VideoGrant {
	t := true
	return &lkauth.VideoGrant{
		RoomJoin:       true,
		Room:           roomName,
		CanPublish:     &t,
		CanPublishData: &t,
		CanSubscribe:   &t,
	}
}

func guestGrant(roomName string) *lkauth.VideoGrant {
	t := true
	return &lkauth.VideoGrant{
		RoomJoin:       true,
		Room:           roomName,
		CanPublish:     &t,
		CanPublishData: &t,
		CanSubscribe:   &t,
	}
}

func observerGrant(roomName string) *lkauth.VideoGrant {
	t := true
	f := false
	return &lkauth.VideoGrant{
		RoomJoin:       true,
		Room:           roomName,
		CanPublish:     &f,
		CanPublishData: &f,
		CanSubscribe:   &t,
		Hidden:         true,
	}
}
