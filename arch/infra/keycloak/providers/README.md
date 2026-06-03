# Providers customizados do Keycloak

Diretório copiado para `/opt/keycloak/providers/` durante o build da imagem.

Coloque aqui `.jar` de extensões SPI customizadas. O `kc.sh build` (no Dockerfile) registra automaticamente.

## Extensões previstas para a PlexCare

### `whatsapp-otp.jar` — Authenticator SPI para login passwordless via WhatsApp

> **Status:** a implementar. **Não é login OAuth do WhatsApp** (que não existe publicamente). É um *Authenticator* customizado que envia código OTP via WhatsApp Cloud API e valida no fluxo de autenticação do Keycloak.

**Como vai funcionar (alto nível):**

1. Usuário escolhe "Entrar com WhatsApp" no login screen
2. Informa número de celular
3. Authenticator chama [WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api) — template aprovado (`WHATSAPP_OTP_TEMPLATE_NAME`) com OTP de 6 dígitos
4. Usuário insere o código
5. Authenticator valida e cria/atualiza o user no Keycloak (number como atributo primary)

**Dependências:**
- Java 21 + Maven/Gradle
- `org.keycloak:keycloak-server-spi:26.0.7`
- `org.keycloak:keycloak-server-spi-private:26.0.7`
- Cliente HTTP (Quarkus REST client ou OkHttp)

**Variáveis de ambiente lidas pelo provider** (já declaradas em `.env.example`):
- `WHATSAPP_BUSINESS_PHONE_ID`
- `WHATSAPP_BUSINESS_TOKEN`
- `WHATSAPP_BUSINESS_ACCOUNT_ID`
- `WHATSAPP_OTP_TEMPLATE_NAME`

**Repositório de referência** (terceiros, NÃO oficial — usar como inspiração, não copiar):
- https://github.com/keycloak (busque por "whatsapp authenticator" — projetos community)

Enquanto o `.jar` não existe, login social fica em **Google + Apple + Facebook (Meta)**. Facebook cobre o ecossistema Meta/WhatsApp por OAuth.
