import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ReactNode } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  description?: string
  value: string | number
  icon?: ReactNode
  trend?: {
    value: number
    direction: 'up' | 'down'
  }
  href?: string
}

export function StatCard({
  title,
  description,
  value,
  icon,
  trend,
  href,
}: StatCardProps) {
  const content = (
    <Card className={cn(
      "relative overflow-hidden transition-all duration-500 border-none group",
      "bg-white dark:bg-slate-900/40 backdrop-blur-md border border-white/10 dark:border-slate-800/50",
      "shadow-sm dark:shadow-md",
      href && "hover:shadow-xl hover:-translate-y-1 cursor-pointer hover:border-primary/20 dark:hover:border-primary/20"
    )}>
      {/* Subtle Ornaments */}
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-all duration-700" />
      
      <CardHeader className="pb-2 relative z-10 px-5 pt-5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
            {title}
          </CardTitle>
          {icon && (
            <div className="p-2 rounded-xl bg-white/50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 group-hover:bg-primary group-hover:text-white transition-all duration-300">
              {icon}
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="relative z-10 px-5 pb-5">
        <div className="flex flex-col gap-0.5">
          <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {value}
          </div>
          
          <div className="flex items-center gap-2 mt-3">
            {trend && (
              <div className={cn(
                "px-2 py-0.5 rounded-full text-[9px] font-bold flex items-center gap-1 transition-transform duration-300",
                trend.direction === 'up' 
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
              )}>
                {trend.direction === 'up' ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                {Math.abs(trend.value)}%
              </div>
            )}
            {description && (
              <p className="text-[9px] text-slate-500 dark:text-slate-400 font-medium truncate">{description}</p>
            )}
          </div>
        </div>
      </CardContent>

      {/* Interactive Bottom Progress Indicator (Visual only) */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/0 via-primary/20 to-primary/0 scale-x-0 group-hover:scale-x-100 transition-transform duration-700" />
    </Card>
  )

  if (href) {
    return (
      <Link href={href}>
        {content}
      </Link>
    )
  }

  return content
}
