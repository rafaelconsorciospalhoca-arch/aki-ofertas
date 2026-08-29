import { Resend } from 'resend'

export async function sendOtpEmail(email: string, code: string): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: 'Aki Ofertas <login@akiofertas.com.br>',
    to: email,
    subject: 'Seu código de acesso',
    html: `<p>Seu código de acesso ao Aki Ofertas é:</p><h1 style="letter-spacing:4px">${code}</h1><p>Válido por 5 minutos.</p>`,
  })

  // The Resend SDK does not throw on an API-level failure (e.g. an unverified
  // sending domain) — it resolves with { data: null, error }. Without this
  // check, a failed send is indistinguishable from a successful one.
  if (error) {
    throw new Error(error.message)
  }
}

const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendente',
  CONFIRMED: 'Confirmado',
  PREPARING: 'Preparando',
  OUT_FOR_DELIVERY: 'Saiu para entrega',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado',
}

export async function sendNewOrderEmail(
  to: string,
  data: { offerTitle: string; quantity: number; customerName: string; phone: string; address: string },
): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: 'Aki Ofertas <pedidos@akiofertas.com.br>',
    to,
    subject: `Novo pedido: ${data.offerTitle}`,
    html: `
      <p>Você recebeu um novo pedido com entrega!</p>
      <p><strong>${data.quantity}x ${data.offerTitle}</strong></p>
      <p>Cliente: ${data.customerName}<br/>Telefone: ${data.phone}<br/>Endereço: ${data.address}</p>
      <p>Acesse o painel para confirmar e acompanhar o pedido.</p>
    `,
  })
  if (error) {
    throw new Error(error.message)
  }
}

export async function sendOrderStatusEmail(
  to: string,
  data: { offerTitle: string; businessName: string; status: string },
): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const label = ORDER_STATUS_LABEL[data.status] ?? data.status
  const { error } = await resend.emails.send({
    from: 'Aki Ofertas <pedidos@akiofertas.com.br>',
    to,
    subject: `Seu pedido em ${data.businessName}: ${label}`,
    html: `
      <p>O status do seu pedido de <strong>${data.offerTitle}</strong> em <strong>${data.businessName}</strong> mudou para:</p>
      <h2>${label}</h2>
    `,
  })
  if (error) {
    throw new Error(error.message)
  }
}

export async function sendDeliveryZoneRequestEmail(
  to: string,
  data: { businessName: string; neighborhood: string },
): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: 'Aki Ofertas <pedidos@akiofertas.com.br>',
    to,
    subject: `Um cliente quer entrega em "${data.neighborhood}"`,
    html: `
      <p>Um cliente tentou pedir entrega para o bairro <strong>${data.neighborhood}</strong>, que ainda
      não está na sua lista de bairros atendidos em ${data.businessName}.</p>
      <p>Se quiser atender essa região, cadastre a taxa de entrega no painel:
      <a href="https://akiofertas.com.br/comerciante/entrega">akiofertas.com.br/comerciante/entrega</a>.</p>
    `,
  })
  if (error) {
    throw new Error(error.message)
  }
}
