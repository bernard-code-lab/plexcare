package livekit

import (
	"context"
	"fmt"
	"time"

	"github.com/livekit/protocol/livekit"
	lksdk "github.com/livekit/server-sdk-go/v2"
)

// Client adapta o LiveKit Server SDK para ports.LiveKitRoomClient.
// A URL deve apontar para o endpoint HTTP do LiveKit (ex: http://livekit:7880).
// Não use ws:// aqui — o SDK faz HTTP twirp por baixo.
type Client struct {
	rooms *lksdk.RoomServiceClient
}

func NewClient(httpURL, apiKey, apiSecret string) *Client {
	return &Client{
		rooms: lksdk.NewRoomServiceClient(httpURL, apiKey, apiSecret),
	}
}

// CreateRoom registra uma sala no LiveKit Server.
// O LiveKit cria salas automaticamente quando alguém entra, mas pré-criar permite
// configurar maxParticipants e emptyTimeout (cleanup se ninguém entrar).
func (c *Client) CreateRoom(ctx context.Context, name string, maxParticipants int, emptyTimeout time.Duration) error {
	req := &livekit.CreateRoomRequest{
		Name:            name,
		EmptyTimeout:    uint32(emptyTimeout.Seconds()),
		MaxParticipants: uint32(maxParticipants),
	}
	if _, err := c.rooms.CreateRoom(ctx, req); err != nil {
		return fmt.Errorf("livekit CreateRoom: %w", err)
	}
	return nil
}

// DeleteRoom força encerramento imediato. Todos os participantes são desconectados.
func (c *Client) DeleteRoom(ctx context.Context, name string) error {
	if _, err := c.rooms.DeleteRoom(ctx, &livekit.DeleteRoomRequest{Room: name}); err != nil {
		return fmt.Errorf("livekit DeleteRoom: %w", err)
	}
	return nil
}
