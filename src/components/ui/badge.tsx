import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'ui-badge inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'ui-badge--primary border-transparent bg-primary/15 text-primary',
        secondary: 'ui-badge--secondary border-transparent bg-secondary text-secondary-foreground',
        outline: 'ui-badge--outline border-border text-foreground',
        muted: 'ui-badge--muted border-transparent bg-muted text-muted-foreground',
        good: 'border-transparent bg-emerald-500/15 text-emerald-400',
        warn: 'border-transparent bg-amber-500/15 text-amber-400',
        bad: 'border-transparent bg-rose-500/15 text-rose-400',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
