# Email template — Confirmação de demonstração

Template transacional enviado ao lead após agendar uma demo no site.

```
demo-confirmation.html   → versão HTML (table-based, CSS inline, à prova de clientes)
demo-confirmation.txt    → versão texto-plano (multipart/alternative — exigida p/ entregabilidade)
```

Envie **sempre as duas partes** no mesmo email (`text/plain` + `text/html`).

## Assunto e preheader

```
Subject:   Demonstração confirmada — {{dateLong}} às {{time}}
Preheader: Sua demonstração da PlexCare está confirmada. O link da sala está aqui dentro.
```

(O preheader já está embutido no HTML; o subject é responsabilidade do backend.)

## Placeholders (sintaxe `{{var}}`, estilo Mustache/Handlebars)

| Variável         | Exemplo                                   | Origem |
|------------------|-------------------------------------------|--------|
| `{{firstName}}`  | `Renata`                                  | 1º nome de `name` |
| `{{dateLong}}`   | `segunda-feira, 1 de junho de 2026`       | `date` formatada (locale pt-BR) |
| `{{time}}`       | `14:30`                                   | `time` |
| `{{email}}`      | `renata@aurora.com.br`                    | `email` |
| `{{phone}}`      | `(11) 98765-4321`                         | `phone` |
| `{{meetingUrl}}` | `https://meet.plexcare.com.br/r/abc123`   | gerado ao criar a sala (LiveKit) |
| `{{rescheduleUrl}}` | `https://plexcare.com.br/agendar/abc123` | gerado pelo backend |
| `{{logoUrl}}`    | `https://plexcare.com.br/icon-192.png`    | PNG hospedado (clientes de email bloqueiam SVG) |
| `{{supportEmail}}` | `contato@plexcare.com.br`               | constante |
| `{{year}}`       | `2026`                                    | ano atual |

> A sintaxe é agnóstica — troque por sua engine (Handlebars, Mustache, Liquid, EJS, Thymeleaf, Go `text/template` com `{{.Var}}`, etc.).

## Contrato de dados (frontend → backend)

O frontend (`CalendarScheduler` / `DemoScheduler`) entrega no `onConfirm`:

```jsonc
// POST /api/demos
{
  "name":  "Renata Couto",
  "email": "renata@aurora.com.br",
  "phone": "(11) 98765-4321",   // já mascarado; normalize p/ E.164 no backend: +5511987654321
  "date":  "2026-06-01",          // ISO date (gere a partir do Date selecionado)
  "time":  "14:30"                // horário de Brasília (America/Sao_Paulo)
}
```

Mapeamento sugerido no backend:

```
firstName  = name.split(' ')[0]            // ignore títulos (Dr./Dra.) se quiser
dateLong   = format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })
meetingUrl, rescheduleUrl = gerados ao persistir o agendamento
```

## Renderização (exemplo Node + Handlebars)

```js
import fs from 'node:fs'
import Handlebars from 'handlebars'

const html = Handlebars.compile(fs.readFileSync('./demo-confirmation.html', 'utf8'))
const text = Handlebars.compile(fs.readFileSync('./demo-confirmation.txt', 'utf8'))

const vars = {
  firstName: 'Renata',
  dateLong: 'segunda-feira, 1 de junho de 2026',
  time: '14:30',
  email: 'renata@aurora.com.br',
  phone: '(11) 98765-4321',
  meetingUrl: 'https://meet.plexcare.com.br/r/abc123',
  rescheduleUrl: 'https://plexcare.com.br/agendar/abc123',
  logoUrl: 'https://plexcare.com.br/icon-192.png',
  supportEmail: 'contato@plexcare.com.br',
  year: 2026,
}

await mailer.send({
  to: vars.email,
  subject: `Demonstração confirmada — ${vars.dateLong} às ${vars.time}`,
  html: html(vars),
  text: text(vars),
})
```

## Notas de implementação

- **Hospede o logo** (`logoUrl`): use um PNG (o site já gera `public/icon-192.png`). SVG é bloqueado na maioria dos clientes.
- **Fontes:** Cabinet Grotesk/Switzer não funcionam em email — o template usa Arial/Helvetica de propósito.
- **Tema claro** intencional (dark-mode de email renderiza de forma inconsistente em Outlook/Gmail). Os `<meta color-scheme>` travam o modo claro.
- **Não** inclua tracking pixels obrigatórios nem CSS externo. Mantenha tudo inline.
- Teste em Litmus/Email on Acid (Outlook desktop é o cliente mais sensível — por isso o botão tem fallback VML).
- Para o **lembrete** (anti-no-show via WhatsApp/IA), reaproveite as mesmas variáveis num template separado.
