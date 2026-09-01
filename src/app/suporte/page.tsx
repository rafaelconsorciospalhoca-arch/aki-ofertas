import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Suporte — Aki Ofertas',
  description: 'Central de ajuda e contato do Aki Ofertas.',
}

const FAQ = [
  {
    question: 'Como eu troco a cidade onde estou vendo as ofertas?',
    answer:
      'No app, toque no nome da cidade no topo da tela inicial e escolha outra cidade disponível na lista.',
  },
  {
    question: 'Como faço um pedido com entrega?',
    answer:
      'Abra a oferta desejada e toque em "Pedir com entrega". Preencha o endereço, a forma de pagamento e confirme — o comerciante recebe o pedido na hora.',
  },
  {
    question: 'O comerciante não aceitou meu pedido, o que fazer?',
    answer:
      'Entre em contato diretamente com o estabelecimento pelo WhatsApp informado no perfil dele, ou fale com a gente pelo canal abaixo.',
  },
  {
    question: 'Sou comerciante, como cadastro meu negócio?',
    answer:
      'Acesse akiofertas.com.br pelo navegador do computador ou celular e toque em "Cadastrar minha empresa" na página inicial.',
  },
  {
    question: 'Como excluo minha conta?',
    answer:
      'Envie um e-mail para contato@akiofertas.com.br a partir do endereço cadastrado, pedindo a exclusão. Confirmamos e removemos seus dados em até 5 dias úteis.',
  },
]

export default function SuportePage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="bg-brand-navy px-4 py-8 text-white">
        <div className="mx-auto max-w-2xl">
          <Link href="/" className="text-sm font-bold text-brand-green-light">
            Aki Ofertas
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Central de suporte</h1>
          <p className="mt-1 text-sm text-neutral-300">Estamos aqui pra te ajudar.</p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-8">
        <section className="rounded-xl border border-neutral-200 p-5">
          <h2 className="text-base font-bold text-neutral-900">Fale com a gente</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Dúvidas, sugestões ou problemas com o app: mande um e-mail e respondemos o mais rápido possível.
          </p>
          <a
            href="mailto:contato@akiofertas.com.br"
            className="mt-3 inline-block rounded-lg bg-brand-green px-4 py-2 text-sm font-bold text-white"
          >
            contato@akiofertas.com.br
          </a>
        </section>

        <section className="mt-8">
          <h2 className="text-base font-bold text-neutral-900">Perguntas frequentes</h2>
          <div className="mt-3 flex flex-col divide-y divide-neutral-200 rounded-xl border border-neutral-200">
            {FAQ.map((item) => (
              <details key={item.question} className="group p-4">
                <summary className="cursor-pointer list-none text-sm font-semibold text-neutral-900 marker:content-none">
                  {item.question}
                </summary>
                <p className="mt-2 text-sm text-neutral-600">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
