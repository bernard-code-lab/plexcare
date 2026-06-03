# syntax=docker/dockerfile:1.7
# Keycloak 26 — build de produção em duas fases.
# Fase 1: builder roda `kc.sh build` para pré-otimizar (db=postgres, features, providers).
# Fase 2: runtime mínimo, sem tooling de build.

ARG KEYCLOAK_VERSION=26.0.7

############################
# Fase 1 — builder
############################
FROM quay.io/keycloak/keycloak:${KEYCLOAK_VERSION} AS builder

# Configurações de build (imutáveis em runtime — economizam startup time)
ENV KC_DB=postgres
ENV KC_FEATURES=token-exchange,admin-fine-grained-authz,declarative-user-profile
ENV KC_HEALTH_ENABLED=true
ENV KC_METRICS_ENABLED=true
ENV KC_HTTP_RELATIVE_PATH=/auth
ENV KC_PROXY_HEADERS=xforwarded
ENV KC_CACHE=ispn

# Providers customizados (ex.: WhatsApp OTP Authenticator SPI quando existir)
COPY providers/ /opt/keycloak/providers/

# Executa o build (gera a imagem otimizada)
RUN /opt/keycloak/bin/kc.sh build

############################
# Fase 2 — runtime
############################
FROM quay.io/keycloak/keycloak:${KEYCLOAK_VERSION}

COPY --from=builder /opt/keycloak/ /opt/keycloak/

# Realm pré-configurado (importado no primeiro start)
COPY realm/ /opt/keycloak/data/import/

# Boas práticas de segurança: usuário não-root já é o padrão (1000)
USER 1000

# Porta HTTP de aplicação (8080) e porta management (9000 — health/metrics)
EXPOSE 8080 9000

# Healthcheck via porta management (Keycloak 26+ expõe /health em 9000)
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=5 \
  CMD ["/opt/keycloak/bin/kc.sh", "show-config"]

ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
CMD ["start", "--optimized", "--import-realm"]
