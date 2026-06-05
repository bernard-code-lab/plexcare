# =============================================================================
# PlexCare — comandos de desenvolvimento (raiz do monorepo)
#
# Uso: `make` ou `make help` para ver todos os comandos.
#      `make menu` para um menu interativo com setas/numero.
# =============================================================================

SHELL := /usr/bin/env bash
.SHELLFLAGS := -Eeuo pipefail -c
.DEFAULT_GOAL := help

# ---------- Caminhos canônicos ----------
TELECONF_DIR  := platform/backend/plexcare-teleconf-service
IDP_DIR       := platform/backend/plexcare-idp-api
WEB_DIR       := platform/plexcare-teleconf-web
SITE_DIR      := site

# ---------- Docker Compose ----------
COMPOSE_PROJECT := plexcare-platform-dev
TELECONF_COMPOSE := docker compose -f $(TELECONF_DIR)/docker-compose.dev.yml -p $(COMPOSE_PROJECT)
IDP_COMPOSE      := docker compose -f $(IDP_DIR)/docker-compose.dev.yml      -p plexcare-idp-dev

# ---------- Cores ANSI ----------
BOLD  := \033[1m
CYAN  := \033[0;36m
GREEN := \033[0;32m
YELL  := \033[0;33m
RED   := \033[0;31m
DIM   := \033[2m
RESET := \033[0m

# =============================================================================
# AJUDA
# =============================================================================

.PHONY: help
help: ## Mostra este menu
	@printf "\n$(BOLD)$(CYAN)PlexCare$(RESET)$(BOLD) — monorepo dev commands$(RESET)\n"
	@printf "$(DIM)Para menu interativo: $(RESET)$(BOLD)make menu$(RESET)\n\n"
	@printf "$(YELL)SETUP$(RESET)\n"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-z][a-zA-Z0-9_-]+:.*?## \[SETUP\]/ {gsub(/\[SETUP\] /, "", $$2); printf "  $(GREEN)%-22s$(RESET) %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@printf "\n$(YELL)STACK (Docker)$(RESET)\n"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-z][a-zA-Z0-9_-]+:.*?## \[STACK\]/ {gsub(/\[STACK\] /, "", $$2); printf "  $(GREEN)%-22s$(RESET) %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@printf "\n$(YELL)DEV (apps em watch)$(RESET)\n"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-z][a-zA-Z0-9_-]+:.*?## \[DEV\]/ {gsub(/\[DEV\] /, "", $$2); printf "  $(GREEN)%-22s$(RESET) %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@printf "\n$(YELL)TESTES$(RESET)\n"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-z][a-zA-Z0-9_-]+:.*?## \[TEST\]/ {gsub(/\[TEST\] /, "", $$2); printf "  $(GREEN)%-22s$(RESET) %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@printf "\n$(YELL)QUALIDADE$(RESET)\n"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-z][a-zA-Z0-9_-]+:.*?## \[QA\]/ {gsub(/\[QA\] /, "", $$2); printf "  $(GREEN)%-22s$(RESET) %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@printf "\n$(YELL)UTIL$(RESET)\n"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-z][a-zA-Z0-9_-]+:.*?## \[UTIL\]/ {gsub(/\[UTIL\] /, "", $$2); printf "  $(GREEN)%-22s$(RESET) %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@printf "\n"

.PHONY: menu
menu: ## [UTIL] Menu interativo (atalho para scripts/plexcare)
	@scripts/plexcare

# =============================================================================
# SETUP
# =============================================================================

.PHONY: setup
setup: ## [SETUP] Instala deps + copia .env de todos os módulos (idempotente)
	@scripts/setup.sh

.PHONY: doctor
doctor: ## [SETUP] Diagnostica ferramentas e portas em uso (docker, node, go, etc)
	@scripts/doctor.sh

.PHONY: env-files
env-files: ## [SETUP] Copia .env.example → .env onde faltar
	@cp -n $(IDP_DIR)/.env.example $(IDP_DIR)/.env 2>/dev/null || true
	@cp -n $(WEB_DIR)/.env.example $(WEB_DIR)/.env 2>/dev/null || true
	@cp -n $(TELECONF_DIR)/.env.example $(TELECONF_DIR)/.env 2>/dev/null || true
	@echo "$(GREEN)✓$(RESET) .env files prontos (copia only-if-missing)"

# =============================================================================
# STACK (Docker)
# =============================================================================

.PHONY: up
up: ## [STACK] Sobe stack completa (teleconf + idp)
	@$(MAKE) -s teleconf-up
	@$(MAKE) -s idp-up
	@$(MAKE) -s status

.PHONY: down
down: ## [STACK] Derruba toda a stack (preserva volumes nomeados)
	@$(MAKE) -s idp-down
	@$(MAKE) -s teleconf-down

.PHONY: restart
restart: down up ## [STACK] Reinicia toda a stack

.PHONY: nuke
nuke: ## [STACK] DESTRUTIVO — derruba + remove volumes (perde dados)
	@printf "$(RED)$(BOLD)Isso vai REMOVER todos os volumes (postgres, mysql, kafka).$(RESET)\n"
	@read -p "Confirma? (yes/N) " confirm && [ "$$confirm" = "yes" ] || { echo "Cancelado."; exit 1; }
	@$(IDP_COMPOSE) down -v 2>/dev/null || true
	@$(TELECONF_COMPOSE) down -v 2>/dev/null || true
	@echo "$(GREEN)✓$(RESET) stack + volumes removidos"

.PHONY: teleconf-up
teleconf-up: ## [STACK] Sobe só a stack do teleconf (postgres+redis+kafka+livekit+room-service)
	@echo "$(CYAN)→$(RESET) subindo stack teleconf..."
	@$(TELECONF_COMPOSE) up -d

.PHONY: teleconf-down
teleconf-down: ## [STACK] Derruba só a stack do teleconf
	@$(TELECONF_COMPOSE) down

.PHONY: idp-up
idp-up: ## [STACK] Sobe só a stack do idp-api (mysql+mailhog)
	@echo "$(CYAN)→$(RESET) subindo stack idp-api..."
	@$(IDP_COMPOSE) up -d

.PHONY: idp-down
idp-down: ## [STACK] Derruba só a stack do idp-api
	@$(IDP_COMPOSE) down

.PHONY: status
status: ## [STACK] Lista containers + portas dos serviços PlexCare
	@printf "\n$(BOLD)Containers PlexCare$(RESET)\n"
	@docker ps --filter "name=plexcare" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "(nenhum container ativo)"
	@printf "\n"

.PHONY: logs
logs: ## [STACK] Tail dos logs da stack teleconf (Ctrl+C para sair)
	@$(TELECONF_COMPOSE) logs -f --tail=100

.PHONY: logs-idp
logs-idp: ## [STACK] Tail dos logs da stack idp-api
	@$(IDP_COMPOSE) logs -f --tail=100

# =============================================================================
# DEV (apps em watch)
# =============================================================================

.PHONY: dev-site
dev-site: ## [DEV] Site institucional em http://localhost:5173
	@cd $(SITE_DIR) && npm run dev

.PHONY: dev-web
dev-web: ## [DEV] App da sala virtual em http://localhost:5174
	@cd $(WEB_DIR) && npm run dev

.PHONY: dev-idp
dev-idp: ## [DEV] idp-api em http://localhost:4000 (Swagger em /docs)
	@cd $(IDP_DIR) && npm run dev

.PHONY: dev-teleconf
dev-teleconf: ## [DEV] room-service com hot-reload via air (precisa stack up)
	@cd $(TELECONF_DIR) && air

# =============================================================================
# TESTES
# =============================================================================

.PHONY: test
test: ## [TEST] Roda TODOS os testes (idp + teleconf + web + site)
	@$(MAKE) -s test-idp
	@$(MAKE) -s test-teleconf

.PHONY: test-idp
test-idp: ## [TEST] Testes do idp-api (unit + integration; precisa Docker p/ Testcontainers)
	@echo "$(CYAN)→$(RESET) testes do idp-api"
	@cd $(IDP_DIR) && npm test

.PHONY: test-idp-unit
test-idp-unit: ## [TEST] Só testes unit do idp-api (sem Docker)
	@cd $(IDP_DIR) && npm test -- --testPathIgnorePatterns="/integration/"

.PHONY: test-teleconf
test-teleconf: ## [TEST] Testes Go do teleconf-service (unit + race detector)
	@echo "$(CYAN)→$(RESET) testes do teleconf-service"
	@cd $(TELECONF_DIR) && go test -race ./...

.PHONY: test-rooms
test-rooms: ## [TEST] Smoke E2E: cria sala virtual via API e imprime URL pronta
	@scripts/test-rooms.sh

.PHONY: test-rooms-flow
test-rooms-flow: ## [TEST] Fluxo completo: cria sala + lista + verifica health (sem UI)
	@scripts/test-rooms.sh --flow

# =============================================================================
# QUALIDADE
# =============================================================================

.PHONY: lint
lint: lint-sh ## [QA] Roda todos os linters

.PHONY: lint-sh
lint-sh: ## [QA] ShellCheck em todos os .sh do repo
	@scripts/lint-shell.sh

.PHONY: typecheck
typecheck: ## [QA] Typecheck (idp-api + teleconf-web)
	@cd $(IDP_DIR) && npm run typecheck
	@cd $(WEB_DIR) && npm run typecheck 2>/dev/null || echo "$(DIM)(web sem typecheck script)$(RESET)"

# =============================================================================
# UTIL
# =============================================================================

.PHONY: open-swagger
open-swagger: ## [UTIL] Abre Swagger UI do idp-api no browser
	@open http://localhost:4000/docs 2>/dev/null || xdg-open http://localhost:4000/docs 2>/dev/null || echo "Abra: http://localhost:4000/docs"

.PHONY: open-mailhog
open-mailhog: ## [UTIL] Abre MailHog UI (emails de dev)
	@open http://localhost:8025 2>/dev/null || xdg-open http://localhost:8025 2>/dev/null || echo "Abra: http://localhost:8025"

.PHONY: open-kafka-ui
open-kafka-ui: ## [UTIL] Abre Kafka UI
	@open http://localhost:8090 2>/dev/null || xdg-open http://localhost:8090 2>/dev/null || echo "Abra: http://localhost:8090"
