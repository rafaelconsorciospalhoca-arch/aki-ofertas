import { Resend } from 'resend'

export async function sendSignupConfirmationEmail(email: string, name: string): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: 'Aki Ofertas <login@akiofertas.com.br>',
    to: email,
    subject: 'Cadastro confirmado!',
    html: `<p>Olá, ${name}!</p><p>Seu cadastro no Aki Ofertas foi concluído com sucesso. Agora você já pode ver e resgatar as melhores ofertas perto de você.</p>`,
  })

  // The Resend SDK does not throw on an API-level failure (e.g. an unverified
  // sending domain) — it resolves with { data: null, error }. Without this
  // check, a failed send is indistinguishable from a successful one.
  if (error) {
    throw new Error(error.message)
  }
}
