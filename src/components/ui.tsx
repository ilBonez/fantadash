import type { ReactNode } from 'react'
import type { Role } from '../types'

export const ROLE_COLOR: Record<Role, string> = {
  P: 'text-role-p border-role-p/40 bg-role-p/10',
  D: 'text-role-d border-role-d/40 bg-role-d/10',
  C: 'text-role-c border-role-c/40 bg-role-c/10',
  A: 'text-role-a border-role-a/40 bg-role-a/10',
}

export const ROLE_BAR: Record<Role, string> = {
  P: 'bg-role-p',
  D: 'bg-role-d',
  C: 'bg-role-c',
  A: 'bg-role-a',
}

export function RoleBadge({ role, text }: { role: Role; text?: string }) {
  return (
    <span
      className={`inline-flex min-w-6 items-center justify-center rounded border px-1 py-px text-[10px] font-bold leading-4 ${ROLE_COLOR[role]}`}
    >
      {text ?? role}
    </span>
  )
}

export function Stat({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  tone?: 'default' | 'good' | 'bad' | 'warn'
}) {
  const toneCls =
    tone === 'good'
      ? 'text-emerald-400'
      : tone === 'bad'
        ? 'text-rose-400'
        : tone === 'warn'
          ? 'text-amber-400'
          : 'text-ink-100'
  return (
    <div className="card px-3 py-2.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-ink-400">{label}</div>
      <div className={`mt-0.5 text-xl font-semibold leading-tight ${toneCls}`}>{value}</div>
      {sub != null && <div className="mt-0.5 text-[11px] text-ink-400">{sub}</div>}
    </div>
  )
}

export function Section({
  title,
  right,
  children,
  className = '',
}: {
  title: string
  right?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`card overflow-hidden ${className}`}>
      <header className="flex items-center justify-between gap-2 border-b border-ink-700/70 px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-300">{title}</h2>
        {right}
      </header>
      {children}
    </section>
  )
}

/** Barra di avanzamento a segmenti, usata per budget e slot. */
export function Bar({ value, max, className = 'bg-sky-500' }: { value: number; max: number; className?: string }) {
  const w = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-800">
      <div className={`h-full rounded-full transition-all ${className}`} style={{ width: `${w}%` }} />
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="px-3 py-6 text-center text-sm text-ink-400">{children}</div>
}
