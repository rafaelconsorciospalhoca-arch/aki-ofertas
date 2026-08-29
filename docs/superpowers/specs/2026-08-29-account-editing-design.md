# Edição de Cadastro — Comerciante, Cliente e Admin — Design

## Objetivo

Hoje não existe nenhuma forma de um comerciante editar os dados da própria
conta de login (nome, e-mail, senha) — só o perfil da empresa (`/comerciante/empresa`)
é editável. O cliente do app mobile também não consegue editar nada do
próprio perfil (nome/e-mail aparecem só para leitura; telefone só é
coletado em um fluxo pontual, ao gerar um cupom sem telefone cadastrado). O
admin, por sua vez, já edita nome/telefone/cidade/UF de qualquer usuário em
`/admin/usuarios/[id]`, mas não o e-mail.

Este projeto fecha as três lacunas:
1. Comerciante edita nome, e-mail e senha da própria conta.
2. Cliente do app edita nome e telefone do próprio perfil.
3. Admin passa a poder editar o e-mail de qualquer usuário (comerciante ou
   cliente), além dos campos que já edita hoje.

## 1. Comerciante — nova aba "Conta"

Nova rota `/comerciante/conta`, novo item "Conta" no menu lateral
(`DashboardShell`), depois de "Plano" (último item).

A página tem duas seções independentes, mesmo padrão visual de formulário
já usado em `MenuManager`/`DeliveryZoneManager`:

**Dados da conta**: Nome, E-mail. Novo componente
`src/components/merchant/AccountForm.tsx` + server action
`updateMerchantAccount(input: { name: string; email: string })` em novo
arquivo `src/actions/account-actions.ts`.
- `requireMerchantBusiness()` (já existe) resolve o usuário autenticado.
- Trocar e-mail exige checar duplicidade: `prisma.user.findFirst({ where: { email, NOT: { id: userId } } })` —
  se encontrar, retorna `{ ok: false, error: 'Este e-mail já está cadastrado.' }`
  (mesma mensagem já usada em `signUpMerchant`).
- Sem re-verificação por código ao trocar e-mail (o login já é por
  senha, não por OTP — diferente do cliente do app).

**Trocar senha**: Senha atual, Nova senha, Confirmar nova senha. Novo
componente `src/components/merchant/PasswordForm.tsx` + server action
`changeMerchantPassword(input: { currentPassword: string; newPassword: string })`.
- Busca o `passwordHash` atual do usuário, confere com `verifyPassword` —
  se não bater, `{ ok: false, error: 'Senha atual incorreta.' }`.
- Nova senha: mesma regra já usada no cadastro (`min(8, 'A senha precisa
  ter pelo menos 8 caracteres.')`).
- Confirmação (`newPassword === confirmPassword`) validada no componente
  antes de chamar a action (mesmo padrão de validação client-side simples
  já usado em outros formulários do painel — sem necessidade de mandar a
  confirmação pro servidor).
- Sucesso: salva o novo hash via `hashPassword`, mostra mensagem de
  confirmação — **não** desloga o usuário (sessão via NextAuth continua
  válida; próximo login usa a nova senha).

## 2. Cliente (app mobile) — editar perfil

A tela `app-mobile/app/(tabs)/perfil.tsx` (hoje só leitura) ganha um modo de
edição para Nome e Telefone. E-mail continua só leitura — é a identidade de
login (código por e-mail ou Google), trocar isso fica fora de escopo.

Novo `PUT /api/mobile/perfil` (o `route.ts` já existe com `GET`; adiciona
o handler `PUT` no mesmo arquivo):
```ts
{ name: string; phone: string }
```
Validação: `name` não vazio, `phone` mínimo 8 caracteres (mesma regra já
usada em `perfil/telefone/route.ts`). Atualiza `prisma.user.update({ where:
{ id: auth.userId }, data: { name, phone } })`.

A rota já existente `POST /api/mobile/perfil/telefone` **não muda** —
continua sendo usada pelo fluxo de gerar cupom (`GenerateCouponButton`)
quando o cliente ainda não tem telefone cadastrado.

Novo hook `useUpdateProfile()` em `app-mobile/src/api/hooks/useProfile.ts`
(mesmo arquivo do `useProfile()` já existente, cuja `queryKey` é `['perfil']`),
seguindo o padrão de `useMutation` já usado em
`useCreateOrder`/`useDeliveryInterest`, invalidando a query `['perfil']` no
sucesso.

Tela: um botão "Editar" nos campos Nome/Telefone alterna entre exibição e
edição (`TextInput`s), com um botão "Salvar" que chama `useUpdateProfile()`
e volta ao modo leitura no sucesso.

## 3. Admin — liberar edição de e-mail

Em `src/actions/admin-actions.ts`, `userProfileSchema` ganha
`email: z.string().email('E-mail inválido.')`. `updateUser` passa a
verificar duplicidade (mesma checagem `findFirst` com `NOT: { id: userId }`
descrita acima) antes do `prisma.user.update`, incluindo `email:
parsed.data.email` no `data`.

Em `src/components/admin/UserForm.tsx`, o tipo `Values` ganha `email:
string`, com um novo `<input type="email">` no formulário (entre Nome e
Telefone). Em `src/app/admin/usuarios/[id]/page.tsx`, `initialValues` ganha
`email: user.email`.

Essa mudança cobre tanto comerciante quanto cliente, já que
`/admin/usuarios/[id]` é a mesma tela de edição de usuário para qualquer
`role`.

## Erros e casos de borda

- Comerciante troca e-mail para um já usado por outra conta (comerciante,
  cliente ou admin) → erro `'Este e-mail já está cadastrado.'`, formulário
  não salva.
- Comerciante erra a senha atual → `'Senha atual incorreta.'`.
- Admin edita o e-mail de um usuário para um valor já em uso → mesmo erro,
  mesma checagem.
- Cliente do app manda nome vazio ou telefone curto → 400 com mensagem
  clara, mesmo padrão das outras rotas mobile.

## Testes

- `src/actions/__tests__/account-actions.test.ts` (novo): `updateMerchantAccount`
  (sucesso, e-mail duplicado, não autorizado) e `changeMerchantPassword`
  (sucesso, senha atual incorreta, senha nova curta, não autorizado).
- `src/actions/__tests__/admin-actions.test.ts` (já existe): novos casos
  para `updateUser` cobrindo o campo `email` (sucesso, duplicidade).
- `src/app/api/mobile/__tests__/data-endpoints.test.ts` ou um novo arquivo
  dedicado (ler o existente primeiro para decidir): caso para o `PUT
  /api/mobile/perfil` (sucesso, validação de nome/telefone, 401 sem
  sessão).
