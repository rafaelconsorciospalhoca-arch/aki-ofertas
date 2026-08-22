import { DashboardShell } from '@/components/layout/DashboardShell'

export default function ComercianteLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell area="comerciante">{children}</DashboardShell>
}
