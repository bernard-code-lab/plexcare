# =============================================================================
# Stage: deps — baixa módulos Go em camada separada (cache agressivo)
# =============================================================================
FROM golang:1.26-alpine AS deps

WORKDIR /app

RUN apk add --no-cache git ca-certificates tzdata

COPY go.mod go.sum ./
RUN go mod download && go mod verify

# =============================================================================
# Stage: dev — hot reload com Air (montagem de volume do código-fonte)
# =============================================================================
FROM deps AS dev

RUN go install github.com/air-verse/air@v1.61.7

# Air espera o código via volume mount. Configuração lida do .air.toml.
# O SERVICE arg define qual cmd/ buildar.
ARG SERVICE=room-service
ENV SERVICE=${SERVICE}

EXPOSE 8080
CMD ["air", "-c", ".air.toml"]

# =============================================================================
# Stage: builder — compila binário estático para produção
# =============================================================================
FROM deps AS builder

COPY . .

ARG SERVICE=room-service
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build \
    -ldflags="-s -w -X main.version=$(git describe --tags --always 2>/dev/null || echo dev)" \
    -o /bin/service \
    ./cmd/${SERVICE}

# =============================================================================
# Stage: production — imagem mínima (~5MB), sem shell, sem root
# =============================================================================
FROM scratch AS production

# Certificados TLS e timezone — essenciais para HTTPS e timestamps corretos (BRT)
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /usr/share/zoneinfo /usr/share/zoneinfo

COPY --from=builder /bin/service /service

# Usuário não-root (uid 65532 = nobody em distroless convention)
USER 65532:65532

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD ["/service", "-health-check"]

ENTRYPOINT ["/service"]
