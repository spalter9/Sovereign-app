import type { ReactNode } from 'react'

interface SectionCardProps {
  title: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  glow?: boolean
}

export function SectionCard({
  title,
  subtitle,
  action,
  children,
  className = '',
  glow = false,
}: SectionCardProps) {
  return (
    <section
      className={[
        'glass-panel rounded-2xl p-5 sm:p-6',
        glow ? 'glow-ring' : '',
        className,
      ].join(' ')}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold tracking-tight text-text-primary sm:text-lg">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-1 text-sm text-text-muted">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}
