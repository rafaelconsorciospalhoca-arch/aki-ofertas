# API Mobile — design

## Contexto

Este documento cobre o segundo dos três sub-projetos combinados a caminho do app mobile nativo do Aki Ofertas (depois de Cupons, já entregue): uma API JSON que o futuro app React Native/Expo vai consumir. O terceiro sub-projeto (o app em si) e o quarto (pipeline Codemagic + publicação nas lojas) ficam para depois, cada um com seu próprio design.

O app mobile é **só para o consumidor** — comerciante e admin continuam exclusivamente no site (decisão já tomada). Por isso esta API cobre apenas o que o consumidor já usa no site hoje: ofertas, lojas, cupons, categorias, cidades, mais o login.

Fora de escopo aqui: favoritos (ainda não existe nem no site — vira um sub-projeto futuro no mesmo molde de Cupons), validar cupom (função do comerciante, fica só no painel web), qualquer coisa do painel do comerciante ou admin.

## Decisões de produto

- **Dois jeitos de entrar: "Cadastrar com Google" (destaque) ou "Cadastro normal" — e-mail + código (alternativa).** A tela mostra um botão grande "Cadastrar com Google" primeiro — 1 toque, sem digitar nada, sem esperar e-mail. Abaixo, uma opção menor "Cadastro normal" para quem não tem/não quer usar conta Google. Por trás, os dois botões disparam a mesma ação de sempre (login-ou-cadastro automático): não existe uma tela de "criar conta" separada da de entrar — a primeira vez que a pessoa usa qualquer um dos dois botões já cria a conta; nas vezes seguintes, o mesmo botão simplesmente loga (a sessão de 60 dias normalmente já evita precisar tocar em qualquer botão de novo).
  - **Google**: nome e e-mail vêm prontos do perfil Google — cadastro é zero-digitação.
  - **E-mail + código**: sem senha. Digita o e-mail, recebe um código de 6 dígitos, confirma e entra; só pede o nome digitado na primeira vez (único dado obrigatório desse caminho).
- **Sessão de longa duração**, igual para os dois métodos de login. Depois do primeiro login, o app fica autenticado por 60 dias sem pedir nada de novo — o token fica salvo no aparelho. Se expirar ou for revogado (ex: admin bloqueia o usuário), pede login de novo.
- **Envio de e-mail via Resend** (plano grátis) — ainda não existe nenhum serviço de e-mail configurado no projeto. Só é usado pelo caminho de e-mail+código; login via Google não depende disso.
- **Limite de envio de código**: no máximo 1 pedido a cada 60 segundos e 5 por dia, por e-mail — evita abuso e estoura da cota grátis do Resend.
- **Verificação do login Google feita no servidor**, nunca confiando só no que o app mobile alega: o app manda o `idToken` que o Google devolveu, e o backend valida esse token direto com o Google antes de criar a sessão.
- **Pré-requisito externo**: um projeto no Google Cloud Console com OAuth configurado (client ID gratuito) — precisa ser criado antes de implementar este endpoint, do mesmo jeito que o Resend precisa de uma conta antes do endpoint de e-mail funcionar. Ambos ficam como pendência de configuração para a fase de implementação, não bloqueiam o desenho da API.
- **API dentro do mesmo projeto Next.js**, sem servidor separado — Route Handlers em `src/app/api/mobile/**`, reaproveitando as funções que já existem em `src/lib/*.ts`. Nenhuma lógica de negócio duplicada.
- **`generateCoupon`** (hoje uma Server Action que pega o usuário via `auth()`, cookie do site) precisa ser refatorada: o miolo (transação, checagem de estoque, elegibilidade da oferta) vira uma função interna que recebe `userId` como parâmetro; a Server Action do site e o endpoint mobile passam a chamar essa mesma função, cada um resolvendo o `userId` do seu próprio jeito (cookie vs. Bearer token).
- **`User.passwordHash` precisa virar opcional.** Hoje é obrigatório no schema — mas contas criadas via Google ou e-mail+código não têm senha nenhuma. Muda pra `passwordHash String?` no schema, e o login por e-mail/senha do site (`authorize()` em `src/lib/auth.ts`) passa a rejeitar login se `passwordHash` for nulo (conta existe mas foi criada só pelo mobile, sem senha) — mensagem igual à de senha errada, pra não revelar que a conta existe mas não tem senha.

## Modelo de dados novo

Dois modelos novos no `schema.prisma`:

```prisma
model EmailOtp {
  id        String   @id @default(cuid())
  email     String
  codeHash  String
  attempts  Int      @default(0)
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())

  @@index([email])
  @@map("email_otps")
}

model MobileSession {
  id         String    @id @default(cuid())
  userId     String
  user       User      @relation(fields: [userId], references: [id])
  tokenHash  String    @unique
  createdAt  DateTime  @default(now())
  expiresAt  DateTime
  revokedAt  DateTime?

  @@index([userId])
  @@map("mobile_sessions")
}
```

O código nunca é guardado em texto puro (`codeHash`), nem o token (`tokenHash`) — mesmo padrão de segurança já usado para senha (`bcrypt`) no resto do projeto.

## Fluxo de autenticação

1. **`POST /api/mobile/auth/solicitar-codigo`** — body `{ email }`.
   - Confirma que não existe um `EmailOtp` criado nos últimos 60s para esse e-mail (`createdAt > now - 60s`, rate limit) → senão `429`, `{ok:false, error:'Aguarde antes de pedir um novo código.'}`.
   - Confirma que não passou de 5 pedidos nas últimas 24h para esse e-mail → senão `429`, `{ok:false, error:'Muitas tentativas. Tente novamente mais tarde.'}`.
   - Gera um código de 6 dígitos, salva `codeHash` (bcrypt) com `expiresAt = now + 5min`, envia por e-mail via Resend.
   - Sempre responde `{ok:true}` (200) mesmo se o e-mail não existir como usuário ainda — não revela se um e-mail já está cadastrado.

2. **`POST /api/mobile/auth/confirmar-codigo`** — body `{ email, code, name? }`.
   - Busca o `EmailOtp` mais recente e não-usado para o e-mail; `expiresAt < now` → `{ok:false, error:'Código expirado.'}`; código errado → incrementa `attempts`, `attempts >= 5` invalida o código → `{ok:false, error:'Código inválido.'}`.
   - Código certo: marca `usedAt`. Se não existe `User` com esse e-mail, cria um novo (`role: CONSUMER`, `name` do body — obrigatório só nesse caso, valida com a mesma regra de nome já usada em `signUpConsumer`). Se existe mas está `blocked` → `{ok:false, error:'Conta bloqueada.'}`.
   - Cria uma `MobileSession` (`tokenHash` de um token aleatório gerado no servidor, `expiresAt = now + 60 dias`), devolve `{ok:true, token, user:{id,name,email}}`.

3. **`POST /api/mobile/auth/google`** — body `{ idToken }` (o token que o app recebe do SDK de login do Google, ex: `expo-auth-session`/`@react-native-google-signin/google-signin`).
   - Valida `idToken` direto com o Google (biblioteca `google-auth-library`, já usada por muitos projetos Next.js — verifica assinatura e público-alvo do token; nunca confia em dados que o app mande sem essa validação).
   - Google confirma e-mail e nome. Se não existe `User` com esse e-mail, cria um novo (`role: CONSUMER`, `passwordHash: null`, nome/e-mail do Google). Se existe mas está `blocked` → `{ok:false, error:'Conta bloqueada.'}`.
   - Cria uma `MobileSession` igual ao passo 2, devolve `{ok:true, token, user:{id,name,email}}`.

4. **Toda outra rota protegida** lê `Authorization: Bearer <token>`, busca a `MobileSession` pelo hash do token: não existe, expirou, ou `revokedAt` preenchido → `401`, `{ok:false, error:'Sessão expirada.'}`. Também confirma `user.blocked === false` no mesmo request (mesma checagem "ao vivo" que já existe nas Server Actions do site) → `blocked` → `401` e marca a sessão como revogada nesse momento.

## Endpoints de dados

Todos devolvem `{ok:true, data:...}` ou `{ok:false, error}`, com status HTTP condizente (200/400/401/404).

| Método + rota | Requer token | Reaproveita |
|---|---|---|
| `GET /api/mobile/ofertas/destaque` | não | `getFeaturedOffers` |
| `GET /api/mobile/ofertas?categoria=&cidade=&raio=` | não | `getOffersList` |
| `GET /api/mobile/ofertas/[slug]` | não | `getOfferBySlug` |
| `GET /api/mobile/lojas/[slug]` | não | `getBusinessBySlug` (`src/lib/businesses.ts`) |
| `GET /api/mobile/categorias` | não | `getActiveCategories` |
| `GET /api/mobile/cidades` | não | `getActiveCities` |
| `POST /api/mobile/cupons/gerar` `{offerId}` | sim | núcleo refatorado de `generateCoupon` |
| `GET /api/mobile/cupons` | sim | `getCouponsForUser` |
| `GET /api/mobile/perfil` | sim | dados básicos do usuário logado (nome, e-mail, cidade) |

Localização do usuário (para ordenar por distância) vem do próprio app via query string (`lat`/`lng`), igual ao que o site já faz no client — a API não muda a fórmula de distância existente em `src/lib/geo.ts`.

## Erros e segurança

- Todo endpoint protegido segue a mesma checagem "ao vivo" de `blocked` que já existe no site (não confia só no token).
- `codeHash`/`tokenHash` nunca são expostos em nenhuma resposta.
- Rate limit de OTP é por e-mail, no banco (`EmailOtp`), sem depender de infraestrutura nova (sem Redis) — consistente com a escala atual do projeto.
- CORS: a API só precisa responder ao app mobile (não a um navegador de terceiros), então não habilita CORS aberto — o app RN faz as chamadas via fetch nativo, que não é sujeito à mesma política de CORS de um navegador.

## Testes

- `src/lib/mobile-auth.ts` (nova lib): funções puras de geração/verificação de código e token, testadas isoladamente (hash bate, expiração, contagem de tentativas).
- Teste do endpoint `/api/mobile/auth/google` com a verificação do `idToken` mockada (nunca chama o Google de verdade em teste) — cobre: token inválido, e-mail novo (cria conta), e-mail existente (loga), conta bloqueada.
- Cada Route Handler ganha um teste de integração leve (request → resposta), reaproveitando o padrão de mocks já usado nas Server Actions do projeto.
- Teste específico confirmando que o núcleo refatorado de `generateCoupon` produz o mesmo comportamento de antes quando chamado pela Server Action do site (nenhuma regressão no fluxo web).

## Interfaces que o próximo sub-projeto (app React Native) vai consumir

Os 9 endpoints de dados acima, mais os três de autenticação (`solicitar-codigo`, `confirmar-codigo`, `google`). O app guarda o `token` (ex: `expo-secure-store`) e manda em todo request subsequente.
