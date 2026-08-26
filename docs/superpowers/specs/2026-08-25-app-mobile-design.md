# App Mobile (React Native) — design

## Contexto

Terceiro dos quatro sub-projetos a caminho do app mobile do Aki Ofertas (depois de Cupons e API Mobile, ambos já entregues): o app React Native em si, que consome os 12 endpoints já construídos em `src/app/api/mobile/**`. O quarto sub-projeto (pipeline Codemagic + publicação nas lojas) fica para depois.

O app é **só para o consumidor** — comerciante e admin continuam exclusivamente no site (decisão já tomada nos sub-projetos anteriores).

Fora de escopo aqui: favoritos (endpoint ainda não existe), edição de perfil (endpoint ainda não existe, só leitura), qualquer coisa do comerciante/admin, publicação nas lojas (Codemagic).

## Decisões de produto

- **Navegar sem login.** Localização/cidade primeiro, ofertas depois — login (Google ou e-mail+código) só é pedido na hora de gerar um cupom, mesma lógica do site.
- **Localização real via GPS**, com permissão do celular (`expo-location`), e fallback pra escolha manual de cidade se a pessoa recusar — espelha exatamente o comportamento do site (Geolocation API do navegador + cookie de cidade).
- **3 abas na barra inferior**: Início, Cupons, Perfil. Sem aba de Favoritos (endpoint não existe ainda — entra num sub-projeto futuro, quando o favoritos for construído no site+API+app juntos, no mesmo molde do Cupons).
- **Perfil é só leitura** nesta primeira versão — mostra nome/e-mail/cidade, sem tela de editar (não existe endpoint de update ainda).
- **Mesma identidade visual do site**: cores `brand-navy` (`#0A1830`/`#0B1B33`, conforme usado no site), `brand-green`, `brand-green-light`, e o logo já existente.

## Arquitetura

- **Expo** (managed workflow) — integra bem com o Codemagic (próximo sub-projeto) e evita configuração nativa manual de Xcode/Android Studio nesta fase.
- **Expo Router** para navegação — arquivos em `app/` definem as rotas/telas, com um grupo `(tabs)` para as 3 abas e telas fora do grupo para fluxos como login e detalhe de oferta/loja (mesma convenção de "route group" que o próprio site já usa no Next.js, então o padrão mental é familiar).
- **TanStack Query** para buscar e cachear os dados da API — cada tela declara o que precisa (`useQuery`) sem reimplementar loading/erro/refetch manualmente.
- **`expo-secure-store`** para guardar o token da sessão (criptografado no dispositivo).
- **`expo-location`** para pedir permissão de GPS e ler coordenadas.
- Um cliente HTTP fino (`src/api/client.ts`) que centraliza a base URL da API, injeta o header `Authorization: Bearer <token>` quando existe token salvo, e trata uma resposta `401` global (limpa o token salvo e redireciona pra tela de entrar).

## Estrutura de telas

| Rota | Descrição | Endpoint(s) consumidos |
|---|---|---|
| `/onboarding` | Pede permissão de GPS; se negar, lista de cidades pra escolher manualmente | `GET /cidades` |
| `/(tabs)/inicio` | Ofertas em destaque + categorias | `GET /ofertas/destaque`, `GET /categorias` |
| `/(tabs)/inicio/ofertas` | Lista com filtro categoria/raio | `GET /ofertas` |
| `/oferta/[slug]` | Detalhe da oferta + botão gerar cupom | `GET /ofertas/[slug]`, `POST /cupons/gerar` |
| `/loja/[slug]` | Detalhe da loja + ofertas dela | `GET /lojas/[slug]` |
| `/entrar` | Google (destaque) + Cadastro normal (e-mail+código) | `POST /auth/google`, `POST /auth/solicitar-codigo`, `POST /auth/confirmar-codigo` |
| `/(tabs)/cupons` | Lista dos cupons do usuário | `GET /cupons` |
| `/(tabs)/perfil` | Nome/e-mail/cidade (só leitura) | `GET /perfil` |

`/entrar` é aberta como modal sempre que uma ação protegida (gerar cupom, abrir Cupons/Perfil sem sessão) é tentada sem token válido — não é uma aba, é um fluxo interrompido que volta pra onde a pessoa estava depois de logar.

## Fluxo de autenticação no app

1. Onboarding não exige login — só localização.
2. Ao tocar "Gerar cupom" (ou abrir a aba Cupons/Perfil) sem token salvo → abre `/entrar`.
3. Em `/entrar`: botão "Cadastrar com Google" (usa `expo-auth-session`/`@react-native-google-signin/google-signin` pra obter o `idToken`, manda pra `POST /auth/google`) ou "Cadastro normal" (formulário de e-mail → `POST /auth/solicitar-codigo` → tela de confirmar código → `POST /auth/confirmar-codigo`, pedindo nome só se for conta nova, igual ao comportamento já implementado na API).
4. Sucesso: token salvo no `expo-secure-store`, `/entrar` fecha e volta pra ação que a pessoa estava tentando.
5. Toda chamada autenticada usa o token salvo. Uma resposta `401` de qualquer endpoint limpa o token e reabre `/entrar`.

## Testes

- Testes de unidade (Jest, já vem com o template padrão do Expo) para funções puras: o cliente HTTP (injeção do header, tratamento de 401), qualquer lógica de formatação reaproveitada (distância, preço) — os mesmos cálculos que já existem no site (`src/lib/geo.ts`, `src/lib/money.ts`) são portados/reescritos no app já que é um projeto separado sem acesso direto ao código do site.
- Sem testes end-to-end automatizados nesta primeira versão (Detox/Maestro ficam fora de escopo) — verificação é manual, no simulador/emulador, cobrindo o fluxo principal: onboarding → ver oferta → tentar gerar cupom → login → cupom gerado → aba Cupons mostra o cupom.

## Organização de pastas

O projeto Expo mora dentro do mesmo repositório do site, numa pasta própria na raiz: `app-mobile/`. É um projeto Node/Expo independente (seu próprio `package.json`, `node_modules`, testes) — não compartilha dependências nem build com o Next.js do site, só vive lado a lado no mesmo repositório git por conveniência de gestão. O `.gitignore` da raiz usa `/node_modules` (ancorado só na raiz do site) — não cobre `app-mobile/node_modules/` automaticamente, então o plano de implementação precisa adicionar essa entrada (e as pastas de build do Expo, `app-mobile/.expo/`, `app-mobile/dist/`) ao `.gitignore`.

## Interfaces que o próximo sub-projeto (Codemagic) vai precisar

- O projeto Expo em `app-mobile/`, com `app.json`/`eas.json` configurados o suficiente para o Codemagic rodar `eas build` (ou o workflow nativo equivalente) apontando pra essa subpasta.
- Variáveis de ambiente do app (base URL da API de produção, client ID do Google) documentadas para configuração no Codemagic.
