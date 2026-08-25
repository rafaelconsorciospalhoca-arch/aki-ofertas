import { Resend } from 'resend'

export async function sendOtpEmail(email: string, code: string): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY)
  await resend.emails.send({
    from: 'Aki Ofertas <login@akiofertas.com.br>',
    to: email,
    subject: 'Seu código de acesso',
    html: `<p>Seu código de acesso ao Aki Ofertas é:</p><h1 style="letter-spacing:4px">${code}</h1><p>Válido por 5 minutos.</p>`,
  })
}
