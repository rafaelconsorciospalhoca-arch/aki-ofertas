# Configuração de Build pra Loja (EAS + Codemagic) — Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to turn this into an implementation plan, then superpowers:subagent-driven-development or superpowers:executing-plans to build it.

**Goal:** Deixar o app-mobile pronto pra ser compilado como binário de verdade (não Expo Go) e submetido nas lojas — identificador do app definido, perfil de build EAS configurado, e um `codemagic.yaml` que dispara o build a cada push na `master`. As credenciais de assinatura (chave Apple, keystore Android) nunca passam por este repositório nem por esta sessão — ficam guardadas no EAS, associadas à conta do usuário.

**Architecture:** `app-mobile` usa um módulo nativo (`expo-location`), então não roda dentro do app genérico "Expo Go" — precisa ser compilado (EAS Build é o caminho padrão da própria Expo pra isso, e já lida com assinatura de app de forma gerenciada). O Codemagic só orquestra *quando* o build roda (a cada push na `master`), delegando o build de verdade pro EAS via `eas-cli`.

**Tech Stack:** Expo/EAS Build, Codemagic CI.

## Global Constraints

- Nenhuma credencial de assinatura (certificado Apple, keystore Android, chave de API) é escrita em nenhum arquivo deste repositório — tudo fica nas variáveis de ambiente configuradas direto no painel do Codemagic (criptografadas) e/ou nas credenciais gerenciadas pelo EAS (associadas à conta Expo do usuário).
- O identificador do app é `com.akiofertas.app`, igual pro iOS (`bundleIdentifier`) e Android (`package`).
- O restante do `app-mobile/app.json` (nome, ícone, plugins, permissões) não muda — só ganham os dois campos de identificador.
- O `codemagic.yaml` fica na raiz do monorepo (não dentro de `app-mobile/`), já que é ali que o Codemagic procura por padrão; os passos do workflow entram em `app-mobile` explicitamente antes de rodar qualquer comando do Expo/EAS.

---

## 1. Identificador do app — `app-mobile/app.json`

Adiciona `bundleIdentifier` dentro de `ios` e `package` dentro de `android`:

```json
"ios": {
  "supportsTablet": true,
  "bundleIdentifier": "com.akiofertas.app"
},
"android": {
  "package": "com.akiofertas.app",
  "adaptiveIcon": { ... já existente, sem mudança ... },
  "predictiveBackGestureEnabled": false
}
```

## 2. Perfil de build EAS — `app-mobile/eas.json` (novo arquivo)

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

`autoIncrement: true` deixa o EAS incrementar sozinho o número da versão a cada build (evita rejeição de build duplicado nas lojas). `buildType: "app-bundle"` gera `.aab`, o formato que o Google Play espera hoje (não `.apk`).

## 3. `codemagic.yaml` (novo arquivo, raiz do repo)

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

`EXPO_TOKEN` é a única credencial que este workflow precisa diretamente — é o token da conta Expo (gerado uma vez em expo.dev, colado como variável de ambiente criptografada no grupo `eas_credentials` no painel do Codemagic), e é o que autoriza o `eas-cli` a acionar o build usando as credenciais de assinatura já guardadas na conta EAS. `$CODEMAGIC_EMAIL` também é configurado no painel (e-mail pra onde mandar o aviso de build concluído/falhado) — se não for configurado, a etapa de `publishing` simplesmente não envia nada, sem quebrar o build.

## Checklist de configuração fora do código (não é código, é passo manual do usuário)

Nenhum destes passos acontece nesta sessão — são ações que só o usuário pode fazer, logado com sua própria conta:

1. Rodar `npx eas login` no terminal local, uma vez, com a conta Expo.
2. Rodar `npx eas credentials` dentro de `app-mobile/`, uma vez por plataforma, pra vincular as credenciais de assinatura (Apple Developer / Google Play Console) à conta EAS — o EAS guia o passo a passo interativo.
3. Gerar um Access Token em expo.dev (Configurações da conta → Access Tokens) e colar como variável de ambiente `EXPO_TOKEN` no grupo `eas_credentials` do projeto no painel do Codemagic.
4. (Opcional) Configurar `CODEMAGIC_EMAIL` no painel do Codemagic pra receber aviso de build.

## Testes

Nenhum teste automatizado — são arquivos de configuração de build/CI, não código de aplicação. A verificação real só acontece quando o usuário completa o checklist acima e o primeiro build roda de fato no Codemagic (fora do escopo desta sessão, já que depende das contas dele).

## Erros e casos de borda

- Se `EXPO_TOKEN` não estiver configurado no Codemagic, o `eas-cli build` falha com um erro de autenticação claro (não um erro genérico) — o próprio EAS já trata isso.
- Se as credenciais de assinatura ainda não tiverem sido vinculadas via `eas credentials`, o EAS oferece configurá-las interativamente na primeira vez — mas como o Codemagic roda com `--non-interactive`, esse primeiro vínculo **precisa** ser feito localmente pelo usuário antes do primeiro push que dispara o workflow (por isso o checklist acima lista isso como passo 2, antes do build automático existir de fato).
