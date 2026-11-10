'use client'

import { useContext } from 'react'
import { Bell, Check, Trash2, Calendar, Clock, AlertCircle, Info, CheckCircle2 } from 'lucide-react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { UserContext } from '@/components/dashboard/UserContext'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'

export default function NotificationsPage() {
  const { user } = useContext(UserContext)
  const notifications = useQuery(api.notifications.getNotifications, user?.name ? { userId: user.name } : "skip")
  const markAsRead = useMutation(api.notifications.markAsRead)
  const markAllAsRead = useMutation(api.notifications.markAllAsRead)
  const deleteNotification = useMutation(api.notifications.deleteNotification)

  const handleMarkAllAsRead = async () => {
    if (user?.name) {
      await markAllAsRead({ userId: user.name })
    }
  }

  const getIcon = (type?: string) => {
    switch (type) {
      case 'task': return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      case 'request': return <AlertCircle className="h-4 w-4 text-amber-500" />
      case 'payment': return <Clock className="h-4 w-4 text-blue-500" />
      default: return <Info className="h-4 w-4 text-slate-400" />
    }
  }

  const groupNotificationsByDate = (notifications: any[]) => {
    const groups: { [key: string]: any[] } = {}
    notifications.forEach(n => {
      const date = format(n.created_at, 'yyyy-MM-dd')
      if (!groups[date]) groups[date] = []
      groups[date].push(n)
    })
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
  }

  const groupedNotifications = notifications ? groupNotificationsByDate(notifications) : []

  return (
    <div className="space-y-8 w-full max-w-[1200px] mx-auto pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-4 md:px-0">
        <div className="text-center md:text-left">
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white uppercase italic tracking-tighter leading-none">
            Intelligence <span className="text-primary">Logs</span>
          </h1>
          <p className="text-muted-foreground mt-3 font-medium italic text-sm md:text-base">Comprehensive audit trail of system alerts and communications</p>
        </div>
        
        <div className="flex items-center justify-center gap-3">
          <Button 
            variant="outline" 
            className="h-12 px-6 rounded-2xl font-black uppercase tracking-widest text-[10px] italic border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"
            onClick={handleMarkAllAsRead}
          >
            <Check className="mr-2 h-4 w-4" />
            Mark all read
          </Button>
        </div>
      </div>

      {/* Notifications List */}
      {!notifications ? (
        <div className="flex flex-col items-center justify-center py-40 gap-4">
          <div className="h-16 w-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground font-black uppercase tracking-widest text-[10px]">Synchronizing Alerts...</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-40 bg-slate-50 dark:bg-slate-900/50 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[40px] gap-6 px-6 text-center">
          <div className="h-20 w-20 bg-white dark:bg-slate-900 rounded-3xl flex items-center justify-center shadow-xl border border-slate-100 dark:border-slate-800">
            <Bell className="h-10 w-10 text-slate-300 dark:text-slate-700" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase italic tracking-tighter">Zero Alerts Logged</h3>
            <p className="text-muted-foreground font-medium text-sm max-w-xs">Your intelligence feed is currently clean. New updates will appear here in real-time.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-12">
          {groupedNotifications.map(([date, items]) => (
            <div key={date} className="space-y-6">
              <div className="flex items-center gap-4 px-4 md:px-0">
                <div className="h-[1px] flex-1 bg-slate-200 dark:bg-slate-800" />
                <Badge variant="outline" className="bg-white dark:bg-slate-950 font-black uppercase tracking-[0.2em] text-[9px] py-1 px-4 border-slate-200 dark:border-slate-800 rounded-full italic">
                  {format(new Date(date), 'EEEE, MMMM dd')}
                </Badge>
                <div className="h-[1px] flex-1 bg-slate-200 dark:bg-slate-800" />
              </div>

              <div className="grid gap-4">
                {items.map((notification) => (
                  <Card 
                    key={notification._id} 
                    className={cn(
                      "group border-none shadow-sm hover:shadow-xl transition-all duration-300 rounded-[32px] overflow-hidden",
                      notification.read ? "bg-white/50 dark:bg-slate-900/30" : "bg-white dark:bg-slate-900 border-l-4 border-l-primary"
                    )}
                  >
                    <CardContent className="p-0">
                      <div className="flex flex-col sm:flex-row sm:items-center p-6 gap-6">
                        {/* Icon & Type */}
                        <div className={cn(
                          "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner",
                          notification.read ? "bg-slate-100 dark:bg-slate-800 text-slate-400" : "bg-primary/10 text-primary"
                        )}>
                          {getIcon(notification.type)}
                        </div>

                        {/* Content */}
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            {!notification.read && <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />}
                            <h4 className={cn(
                              "text-base md:text-lg tracking-tight",
                              notification.read ? "font-bold text-slate-600 dark:text-slate-400" : "font-black text-slate-900 dark:text-white"
                            )}>
                              {notification.title}
                            </h4>
                          </div>
                          <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                            {notification.description}
                          </p>
                        </div>

                        {/* Meta & Actions */}
                        <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-4">
                          <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 italic">
                            <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> {format(notification.created_at, 'hh:mm a')}</span>
                          </div>
                          
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            {!notification.read && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-10 w-10 rounded-xl hover:bg-emerald-500/10 hover:text-emerald-500"
                                onClick={() => markAsRead({ id: notification._id })}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            )}
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-10 w-10 rounded-xl hover:bg-rose-500/10 hover:text-rose-500"
                              onClick={() => deleteNotification({ id: notification._id })}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
