# Configuração de Build pra Loja Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Identificador do app definido, perfil de build EAS configurado, e `codemagic.yaml` disparando build de produção a cada push na `master`. Ver `docs/superpowers/specs/2026-08-28-app-store-build-setup-design.md` pro raciocínio completo.

**Architecture:** Três arquivos de configuração, sem lógica de aplicação — sem testes automatizados possíveis ou esperados.

**Tech Stack:** Expo/EAS Build, Codemagic CI.

## Global Constraints

- Nenhuma credencial de assinatura em nenhum arquivo do repositório.
- Identificador `com.akiofertas.app`, igual pro iOS e Android.
- `codemagic.yaml` na raiz do monorepo, não dentro de `app-mobile/`.

---

### Task 1: Identificador do app + perfil de build EAS + Codemagic

**Files:**
- Modify: `app-mobile/app.json`
- Create: `app-mobile/eas.json`
- Create: `codemagic.yaml` (raiz do repo)

**Interfaces:** nenhuma — são só arquivos de configuração, sem código chamando código.

- [ ] **Step 1: Adicionar o identificador em `app-mobile/app.json`**

Dentro de `"ios": { "supportsTablet": true }`, adicionar `"bundleIdentifier": "com.akiofertas.app"`. Dentro de `"android": { ... }` (que já tem `adaptiveIcon` e `predictiveBackGestureEnabled`), adicionar `"package": "com.akiofertas.app"` como primeiro campo do objeto. O resto do arquivo não muda.

- [ ] **Step 2: Criar `app-mobile/eas.json`**

```json
{
  "cli": {
    "version": ">= 13.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "production": {
      "autoIncrement": true,
      "ios": {
        "buildConfiguration": "Release"
      },
      "android": {
        "buildType": "app-bundle"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

- [ ] **Step 3: Criar `codemagic.yaml` na raiz do repo**

Verificar primeiro se `codemagic.yaml` já existe na raiz (o projeto já tem um `vercel.json` na raiz de uma feature anterior, mas nenhum `codemagic.yaml` até agora) — se não existir, criar:

```yaml
workflows:
  aki-ofertas-mobile:
    name: Aki Ofertas — Build de produção (iOS + Android)
    max_build_duration: 60
    instance_type: mac_mini_m2
    environment:
      groups:
        - eas_credentials
      vars:
        EXPO_TOKEN: $EXPO_TOKEN
    triggering:
      events:
        - push
      branch_patterns:
        - pattern: master
          include: true
      cancel_previous_builds: true
    scripts:
      - name: Instalar dependências
        script: |
          cd app-mobile
          npm ci
      - name: Build de produção (iOS + Android via EAS)
        script: |
          cd app-mobile
          npx eas-cli build --platform all --profile production --non-interactive
    publishing:
      email:
        recipients:
          - $CODEMAGIC_EMAIL
```

- [ ] **Step 4: Rodar o typecheck do app-mobile**

Run: `cd app-mobile && npx tsc --noEmit`
Expected: sem erros — `app.json`/`eas.json`/`codemagic.yaml` não são arquivos TypeScript, então isso só confirma que nada mais quebrou por engano.

- [ ] **Step 5: Validar o `app.json` como JSON válido**

Run: `node -e "JSON.parse(require('fs').readFileSync('app-mobile/app.json', 'utf8'))" && node -e "JSON.parse(require('fs').readFileSync('app-mobile/eas.json', 'utf8'))"`
Expected: sem erro (confirma que os dois arquivos JSON editados/criados não têm erro de sintaxe).

- [ ] **Step 6: Commit**

```bash
git add app-mobile/app.json app-mobile/eas.json codemagic.yaml
git commit -m "feat: configure app identifiers and EAS/Codemagic build pipeline"
```

---

### Task 2: Nenhuma verificação de deploy nesta task

Diferente dos planos anteriores desta sessão, este plano **não termina em build/deploy** — `codemagic.yaml`/`eas.json` só passam a valer de verdade depois que o usuário completar o checklist manual descrito na spec (login EAS, vincular credenciais de assinatura, configurar `EXPO_TOKEN` no painel do Codemagic). Não há nada pra rodar localmente que prove esse pipeline funcionando — a primeira prova real é o primeiro push depois do checklist estar completo, fora do escopo desta sessão.

- [ ] **Step 1: Confirmar que o resto do projeto (site) continua intacto**

Run: `npx tsc --noEmit && npx vitest run` (na raiz do repo, não em `app-mobile/`)
Expected: sem erros de tipo; todos os testes do site passam — garante que nada nessa mudança (só arquivos novos + duas linhas em `app.json`) afetou o site de alguma forma inesperada.
