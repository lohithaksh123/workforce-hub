'use client'

import { Bell, Check, Megaphone } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useState, useContext } from 'react'
import { cn } from '@/lib/utils'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { UserContext } from '@/components/dashboard/UserContext'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'

export function NotificationPopover() {
  const { user } = useContext(UserContext)
  const notifications = useQuery(api.notifications.getNotifications, user?.name ? { userId: user.name } : "skip")
  const visibleNotices = useQuery(api.notices.getVisibleNotices, user?.email ? { requestorEmail: user.email } : "skip")
  const noticeReads = useQuery(api.notices.getNoticeReadStatus, user?.email ? { requestorEmail: user.email } : "skip")
  
  const markAsReadMutation = useMutation(api.notifications.markAsRead)
  const markAllAsReadMutation = useMutation(api.notifications.markAllAsRead)

  const unreadNotificationCount = notifications?.filter((n: any) => !n.read).length ?? 0
  const unreadNoticeCount = visibleNotices?.filter((n: any) => !noticeReads?.some((r: any) => r.noticeId === n._id)).length ?? 0
  const unreadCount = unreadNotificationCount + unreadNoticeCount

  const markAllAsRead = async () => {
    await markAllAsReadMutation({ userId: user.name })
  }

  const markAsRead = async (id: any) => {
    await markAsReadMutation({ id })
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-zinc-600 dark:text-zinc-400 hover:text-primary dark:hover:text-primary transition-colors hover:bg-primary/10">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-[8px] right-[8px] flex h-[9px] w-[9px]">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-[9px] w-[9px] bg-primary border-2 border-white dark:border-zinc-900"></span>
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 border-none shadow-2xl bg-white dark:bg-zinc-900" align="end">
        <div className="flex items-center justify-between p-4 border-b dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm tracking-tight text-zinc-900 dark:text-zinc-100">Notifications</h3>
            <span className="bg-primary text-[8px] text-white px-1 rounded font-black uppercase tracking-tighter">Live</span>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-[10px] h-7 px-2 font-bold uppercase tracking-tighter text-primary hover:text-primary/90 hover:bg-primary/10 dark:hover:bg-primary/20"
              onClick={markAllAsRead}
            >
              Mark all as read
            </Button>
          )}
        </div>
        <ScrollArea className="h-80">
          <div className="divide-y dark:divide-zinc-800">
            {unreadNoticeCount > 0 && visibleNotices && (
                visibleNotices
                  .filter((n: any) => !noticeReads?.some((r: any) => r.noticeId === n._id))
                  .map((notice: any) => (
                    <Link key={notice._id} href="/dashboard/notice">
                        <div className="p-4 transition-all duration-200 cursor-pointer border-l-4 border-indigo-500 bg-indigo-500/5 hover:bg-indigo-500/10">
                            <div className="flex gap-2 justify-between items-start">
                                <div className="flex items-center gap-2">
                                    <Megaphone className="h-3 w-3 text-indigo-500" />
                                    <h4 className="text-sm font-black tracking-tight leading-none text-zinc-900 dark:text-zinc-100 uppercase italic">
                                        Notice: {notice.title}
                                    </h4>
                                </div>
                                <div className="h-2 w-2 rounded-full bg-indigo-500 shrink-0 mt-1 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed line-clamp-1 italic">
                                {notice.message}
                            </p>
                        </div>
                    </Link>
                  ))
            )}
            {notifications && notifications.length > 0 ? (
              notifications.map((notification) => (
                <div
                  key={notification._id}
                  className={cn(
                    'p-4 transition-all duration-200 cursor-pointer border-l-4',
                    notification.read 
                      ? 'border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800/50' 
                      : 'border-primary bg-primary/10 dark:bg-primary/20 hover:bg-primary/20 dark:hover:bg-primary/30'
                  )}
                  onClick={() => !notification.read && markAsRead(notification._id)}
                >
                  <div className="flex gap-2 justify-between items-start">
                    <h4 className={cn(
                      "text-sm tracking-tight leading-none",
                      notification.read ? "font-medium text-zinc-700 dark:text-zinc-300" : "font-black text-zinc-900 dark:text-zinc-100"
                    )}>
                      {notification.title}
                    </h4>
                    {!notification.read && (
                      <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1 shadow-[0_0_8px_rgba(27,59,68,0.5)]" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">
                    {notification.description}
                  </p>
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-2.5 font-bold uppercase tracking-tighter">
                    {formatDistanceToNow(notification.created_at, { addSuffix: true })}
                  </p>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                <div className="h-12 w-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
                  <Bell className="h-6 w-6 text-zinc-400 dark:text-zinc-600" />
                </div>
                <p className="text-sm font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
                  {notifications === undefined ? 'Loading Alerts...' : 'No New Notifications'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  We'll notify you when something important happens.
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
        <div className="p-3 border-t dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
          <Link href="/dashboard/notifications" className="w-full">
            <Button variant="ghost" size="sm" className="w-full text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-zinc-900 dark:hover:text-zinc-100 h-9 transition-colors">
              View All History
            </Button>
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
