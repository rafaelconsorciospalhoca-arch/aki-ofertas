import { prisma } from '../src/lib/db'
import { hashPassword } from '../src/lib/password'

async function main() {
  await prisma.city.upsert({ where: { name_state: { name: 'Marmeleiro', state: 'PR' } }, update: {}, create: { name: 'Marmeleiro', state: 'PR', active: true } })
  await prisma.city.upsert({ where: { name_state: { name: 'Francisco Beltrão', state: 'PR' } }, update: {}, create: { name: 'Francisco Beltrão', state: 'PR', active: true } })
  await prisma.city.upsert({ where: { name_state: { name: 'Pato Branco', state: 'PR' } }, update: {}, create: { name: 'Pato Branco', state: 'PR', active: true } })
  await prisma.city.upsert({ where: { name_state: { name: 'Curitiba', state: 'PR' } }, update: {}, create: { name: 'Curitiba', state: 'PR', active: false, comingSoon: true } })

  const categoryData = [
    { name: 'Restaurantes e Lanchonetes', icon: 'utensils', order: 1 },
    { name: 'Bares e Cafeterias', icon: 'coffee', order: 2 },
    { name: 'Beleza e Estética', icon: 'scissors', order: 3 },
    { name: 'Saúde e Bem-estar', icon: 'heart', order: 4 },
    { name: 'Lojas e Moda', icon: 'shopping-bag', order: 5 },
    { name: 'Serviços e Manutenção', icon: 'wrench', order: 6 },
    { name: 'Automotivo', icon: 'car', order: 7 },
    { name: 'Casa e Construção', icon: 'home', order: 8 },
  ]
  const categories: Record<string, string> = {}
  for (const c of categoryData) {
    const created = await prisma.category.upsert({
      where: { name: c.name },
      update: {},
      create: c,
    })
    categories[c.name] = created.id
  }

  const planData = [
    { name: 'Grátis', priceCents: 0, maxOffersPerMonth: 3, hasFlashOffers: false, hasFullMetrics: false },
    { name: 'Básico', priceCents: 4990, maxOffersPerMonth: 5, hasFlashOffers: false, hasFullMetrics: false },
    { name: 'Destaque', priceCents: 9990, maxOffersPerMonth: 15, hasFlashOffers: true, hasFullMetrics: false },
    { name: 'Turbo', priceCents: 19990, maxOffersPerMonth: 30, hasFlashOffers: true, hasFullMetrics: true },
  ]
  const plans: Record<string, string> = {}
  for (const p of planData) {
    const created = await prisma.plan.upsert({ where: { name: p.name }, update: {}, create: p })
    plans[p.name] = created.id
  }

  const adminPasswordHash = await hashPassword('admin123')
  await prisma.user.upsert({
    where: { email: 'admin@akiofertas.com.br' },
    update: {},
    create: {
      name: 'Admin',
      email: 'admin@akiofertas.com.br',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
    },
  })

  const merchantPasswordHash = await hashPassword('comerciante123')
  const owner = await prisma.user.upsert({
    where: { email: 'joao@bigburger.com.br' },
    update: {},
    create: {
      name: 'João Silva',
      email: 'joao@bigburger.com.br',
      passwordHash: merchantPasswordHash,
      role: 'MERCHANT',
    },
  })

  const business = await prisma.business.upsert({
    where: { slug: 'big-burger' },
    update: {},
    create: {
      ownerId: owner.id,
      name: 'Big Burger',
      categoryId: categories['Restaurantes e Lanchonetes'],
      whatsapp: '5546999990000',
      address: 'Av. Brasil, 100',
      city: 'Marmeleiro',
      state: 'PR',
      lat: -25.9006,
      lng: -53.0489,
      description: 'Hambúrgueres artesanais no centro de Marmeleiro.',
      status: 'ACTIVE',
      planId: plans['Básico'],
      slug: 'big-burger',
    },
  })

  await prisma.offer.upsert({
    where: { slug: 'combo-burguer-big-burger' },
    update: {},
    create: {
      businessId: business.id,
      title: 'Combo Burguer',
      description: 'Pão artesanal, hambúrguer 150g, queijo, batata rústica e refri 350ml.',
      originalPrice: 4290,
      discountPrice: 2990,
      discountPercent: 30,
      categoryId: categories['Restaurantes e Lanchonetes'],
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'ACTIVE',
      slug: 'combo-burguer-big-burger',
    },
  })

  const consumerPasswordHash = await hashPassword('consumidor123')
  await prisma.user.upsert({
    where: { email: 'rafael@example.com' },
    update: {},
    create: {
      name: 'Rafael',
      email: 'rafael@example.com',
      passwordHash: consumerPasswordHash,
      role: 'CONSUMER',
      city: 'Marmeleiro',
      state: 'PR',
    },
  })

  console.log('Seed complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
