import React from 'react'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { CheckCircle, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ProjectAlertVariant = 'default' | 'destructive' | 'success'

export default function ProjectAlert({
  variant = 'default',
  title,
  children,
  className,
}: {
  variant?: ProjectAlertVariant
  title: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  const Icon = variant === 'destructive' ? AlertCircle : CheckCircle
  const iconColorClass = variant === 'destructive' ? 'text-destructive' : 'text-green-600'

  return (
    <Alert variant={variant === 'destructive' ? 'destructive' : variant === 'success' ? 'success' : undefined} className={cn('[&>svg]:top-3.5 [&>svg+div]:translate-y-0', className)}>
      <Icon className={cn('h-4 w-4', iconColorClass)} />
      <div>
        <AlertTitle className="m-0">{title}</AlertTitle>
        {children ? <AlertDescription>{children}</AlertDescription> : null}
      </div>
    </Alert>
  )
}
