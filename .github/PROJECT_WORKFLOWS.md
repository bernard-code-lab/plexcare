# Project Workflows — PlexCare (Project #3)

> **Importante:** A API do GitHub não expõe mutations para **configurar** workflows (só `delete`). Toda configuração detalhada precisa ser feita pela UI em <https://github.com/users/bernard-code-lab/projects/3/workflows>.
>
> Este doc é a fonte da verdade — se mudar a config no GitHub, atualize aqui também.

## Estado atual (verificado via GraphQL)

Todos os 7 workflows built-in estão **enabled**, mas a maioria pode estar com a config padrão (não otimizada para o nosso fluxo).

| # | Workflow | Enabled | Config recomendada |
|---|---|---|---|
| 12 | Item added to project | ✅ | Status → **Backlog** |
| 13 | Auto-add to project | ✅ | Repo: `plexcare`, filter: `is:issue is:open` |
| 10 | Auto-add sub-issues | ✅ | manter como está |
| 11 | Pull request linked to issue | ✅ | quando PR linka → Status do issue → **In progress** |
| 7 | Item closed | ✅ | Status → **Done** |
| 8 | Pull request merged | ✅ | Status do issue linkado → **Done** |
| 9 | Auto-close issue | ✅ | Quando Status = **Done** → fechar issue |

---

## Configuração detalhada (passo-a-passo)

Em <https://github.com/users/bernard-code-lab/projects/3/workflows> clique em cada workflow e configure assim:

### 1. **Item added to project** (#12)
Dispara: quando qualquer item entra no project (manual ou via auto-add).
**Config:**
- Set value: **Status** = **Backlog**
- Why: garante que nenhum item entra "sem status". Você promove para `Ready` quando tiver dependências resolvidas.

> ⚠️ Esse workflow vai sobrescrever Status manual no momento da adição. As 3 issues que setamos para `Ready` (#2, #3, #4) já estavam adicionadas — ficarão como estão.

### 2. **Auto-add to project** (#13)
Dispara: quando uma issue/PR é criada num repo conectado.
**Config:**
- Repository: `bernard-code-lab/plexcare`
- Filter: `is:issue is:open`
- (opcional) também adicionar PRs: `is:pull-request is:open`
- Why: já temos isso ativo — explica por que algumas issues foram auto-adicionadas durante o script de seed.

### 3. **Auto-add sub-issues to project** (#10)
Dispara: quando uma sub-issue é criada num issue já no project.
**Config:** manter o default. Útil quando dividimos #17 (Auth service L) em sub-issues menores.

### 4. **Pull request linked to issue** (#11)
Dispara: quando um PR menciona `Closes #N` ou é linkado manualmente.
**Config:**
- Item type: **Issue**
- Set value: **Status** = **In progress**
- Why: a sinalização correta de que alguém começou a trabalhar na issue é o PR aparecer — não precisa mover manualmente.

### 5. **Item closed** (#7)
Dispara: quando uma issue/PR é fechada.
**Config:**
- Set value: **Status** = **Done**
- Why: fechar issue = trabalho terminado. Status sincronizado.

### 6. **Pull request merged** (#8)
Dispara: quando um PR é merged.
**Config:**
- Item type: **Issue** (do issue linkado pelo PR via `Closes #N`)
- Set value: **Status** = **Done**
- Why: o GitHub fecha o issue automaticamente quando PR com `Closes #N` é merged — esse workflow garante que o Status também atualiza (caso o workflow #7 esteja desativado por algum motivo, isso é redundância saudável).

### 7. **Auto-close issue** (#9)
Dispara: quando Status muda para um valor configurado.
**Config:**
- When **Status** is set to **Done**, close the issue.
- Why: permite arrastar item para "Done" no board e a issue fecha sozinha. Útil para issues sem PR (docs, ADRs, scaffolds).

---

## Workflows que **NÃO** estão habilitados (e devem ser ligados manualmente se quisermos)

Esses dois aparecem na UI mas precisam ser habilitados explicitamente:

### 8. **Code review approved**
Dispara: quando um review é "Approved".
**Config sugerida:**
- Set value: **Status** = **In review** → **Ready to merge** (se tivermos esse status, ou mantém `In review`)
- Útil para sinalizar que o PR só falta merge.

### 9. **Code changes requested**
Dispara: quando review pede mudanças.
**Config sugerida:**
- Set value: **Status** = **In progress**
- Útil para devolver o item para "trabalhar" quando review pede ajuste.

### 10. **Auto-archive items**
Dispara: itens com critério (ex: `is:closed updated:<@today-2w`).
**Config sugerida:**
- Filter: `is:closed updated:<@today-30d`
- Why: mantém o board limpo. Itens fechados há +30 dias somem da view padrão (mas continuam no project).

---

## Recomendação: ordem de configuração

1. Confirmar **#12 (Item added)** → Status = Backlog
2. Confirmar **#13 (Auto-add)** → Repo plexcare, filtro is:issue is:open
3. Confirmar **#7 (Item closed)** → Status = Done
4. Confirmar **#11 (PR linked to issue)** → Status = In progress
5. Configurar **#9 (Auto-close)** → Status Done fecha issue
6. Habilitar **Auto-archive** com filtro `is:closed updated:<@today-30d`
7. (Opcional) habilitar **Code review approved** e **Code changes requested**

## Como verificar via API se algo mudou

```bash
gh api graphql -f query='
query($owner: String!, $number: Int!) {
  user(login: $owner) {
    projectV2(number: $number) {
      workflows(first: 20) {
        nodes { number name enabled }
      }
    }
  }
}' -F owner=bernard-code-lab -F number=3 | jq '.data.user.projectV2.workflows.nodes'
```

A API mostra apenas `enabled: true/false` — não mostra as regras configuradas. A única fonte da verdade dessas é a UI.
