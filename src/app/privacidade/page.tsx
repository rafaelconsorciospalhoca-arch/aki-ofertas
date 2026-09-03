import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Política de Privacidade — Aki Ofertas',
  description: 'Como o Aki Ofertas coleta, usa e protege seus dados.',
}

const SECTIONS = [
  {
    title: '1. Quem somos',
    body: (
      <p>
        O Aki Ofertas é uma plataforma que conecta consumidores a ofertas de comércios locais, disponível pelo site{' '}
        <span className="font-semibold">akiofertas.com.br</span> e pelo aplicativo Aki Ofertas para iOS e Android.
        Esta política explica quais dados coletamos, para que usamos e quais direitos você tem sobre eles, em
        conformidade com a Lei Geral de Proteção de Dados (LGPD).
      </p>
    ),
  },
  {
    title: '2. Dados que coletamos',
    body: (
      <div className="space-y-2">
        <p>
          <span className="font-semibold">Cadastro:</span> nome, e-mail, telefone e cidade/estado, informados por
          você ou obtidos do Google/Apple quando você entra com essas contas.
        </p>
        <p>
          <span className="font-semibold">Localização:</span> sua cidade escolhida manualmente ou, se você
          autorizar, a localização aproximada do seu dispositivo (GPS), usada só para mostrar ofertas e comércios
          perto de você.
        </p>
        <p>
          <span className="font-semibold">Pedidos e entregas:</span> endereço, telefone e forma de pagamento
          informados ao fazer um pedido, compartilhados com o comerciante responsável para que ele consiga
          entregar ou preparar o pedido.
        </p>
        <p>
          <span className="font-semibold">Uso do app:</span> avaliações, favoritos, cupons resgatados e, se você é
          comerciante, os dados do seu negócio e as fotos que você envia (logo, cardápio, ofertas).
        </p>
        <p>
          <span className="font-semibold">Dados técnicos:</span> informações básicas de dispositivo e uso,
          coletadas automaticamente pela infraestrutura que hospeda o app (Vercel), para manter o serviço
          funcionando e identificar problemas.
        </p>
      </div>
    ),
  },
  {
    title: '3. Como usamos seus dados',
    body: (
      <ul className="list-disc space-y-1 pl-5">
        <li>Criar e manter sua conta, e permitir login com e-mail, Google ou Apple.</li>
        <li>Mostrar ofertas e comércios relevantes para a sua região.</li>
        <li>Processar pedidos e conectar você ao comerciante para entrega ou retirada.</li>
        <li>Enviar e-mails operacionais (código de acesso, confirmação de pedido).</li>
        <li>Prevenir fraude e manter a segurança da plataforma.</li>
      </ul>
    ),
  },
  {
    title: '4. Com quem compartilhamos',
    body: (
      <div className="space-y-2">
        <p>Não vendemos seus dados. Compartilhamos apenas o necessário com:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>O comerciante do pedido que você fizer (nome, telefone, endereço de entrega).</li>
          <li>Google e Apple, se você optar por entrar com essas contas (autenticação).</li>
          <li>Asaas, processadora de pagamentos, quando um pagamento online é feito.</li>
          <li>Resend, para envio dos e-mails operacionais da plataforma.</li>
          <li>Vercel, que hospeda o site, o banco de dados e os arquivos (fotos) enviados.</li>
        </ul>
      </div>
    ),
  },
  {
    title: '5. Seus direitos',
    body: (
      <p>
        Você pode pedir acesso, correção ou exclusão dos seus dados a qualquer momento, enviando um e-mail para{' '}
        <a href="mailto:contato@akiofertas.com.br" className="font-semibold text-brand-green underline">
          contato@akiofertas.com.br
        </a>{' '}
        a partir do endereço cadastrado na sua conta. Pedidos de exclusão são confirmados e processados em até 5
        dias úteis. Mais detalhes sobre como excluir a conta estão na nossa{' '}
        <Link href="/suporte" className="font-semibold text-brand-green underline">
          Central de suporte
        </Link>
        .
      </p>
    ),
  },
  {
    title: '6. Retenção de dados',
    body: (
      <p>
        Mantemos seus dados enquanto sua conta estiver ativa ou pelo tempo necessário para cumprir obrigações
        legais (por exemplo, registros fiscais de pedidos). Ao pedir exclusão da conta, removemos seus dados
        pessoais, exceto o que formos legalmente obrigados a reter.
      </p>
    ),
  },
  {
    title: '7. Crianças e adolescentes',
    body: <p>O Aki Ofertas não é direcionado a menores de 18 anos e não coleta intencionalmente dados de crianças.</p>,
  },
  {
    title: '8. Alterações nesta política',
    body: (
      <p>
        Podemos atualizar esta política de tempos em tempos. Mudanças relevantes serão comunicadas por e-mail ou
        aviso no app antes de entrarem em vigor.
      </p>
    ),
  },
  {
    title: '9. Contato',
    body: (
      <p>
        Dúvidas sobre privacidade? Fale com a gente em{' '}
        <a href="mailto:contato@akiofertas.com.br" className="font-semibold text-brand-green underline">
          contato@akiofertas.com.br
        </a>
        .
      </p>
    ),
  },
]

export default function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="bg-brand-navy px-4 py-8 text-white">
        <div className="mx-auto max-w-2xl">
          <Link href="/" className="text-sm font-bold text-brand-green-light">
            Aki Ofertas
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Política de Privacidade</h1>
          <p className="mt-1 text-sm text-neutral-300">Última atualização: setembro de 2026</p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="flex flex-col gap-6 text-sm leading-relaxed text-neutral-700">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h2 className="mb-2 text-base font-bold text-neutral-900">{section.title}</h2>
              {section.body}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
