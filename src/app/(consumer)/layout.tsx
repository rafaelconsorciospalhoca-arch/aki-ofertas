import { ConsumerShell } from '@/components/layout/ConsumerShell'

export default function ConsumerLayout({ children }: { children: React.ReactNode }) {
  return <ConsumerShell>{children}</ConsumerShell>
}
