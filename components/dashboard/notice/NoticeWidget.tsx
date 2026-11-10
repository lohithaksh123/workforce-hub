'use client'

import { useContext } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { UserContext } from '@/components/dashboard/UserContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Megaphone, ArrowRight, Clock, Pin, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

export function NoticeWidget() {
    const { user } = useContext(UserContext)
    const latestNotices = useQuery(api.notices.getLatestVisibleNotices, user?.email ? { requestorEmail: user.email, limit: 3 } : "skip")
    const readStatus = useQuery(api.notices.getNoticeReadStatus, user?.email ? { requestorEmail: user.email } : "skip")

    const priorityColors: any = {
        normal: "text-slate-500 bg-slate-500/10",
        important: "text-amber-500 bg-amber-500/10",
        urgent: "text-rose-500 bg-rose-500/10"
    }

    if (latestNotices === undefined) return (
        <Card className="border-none shadow-sm bg-white dark:bg-slate-900/50 rounded-3xl h-full flex items-center justify-center p-8">
            <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 animate-spin text-primary" />
                <span className="text-[10px] font-black uppercase tracking-widest opacity-50">Syncing...</span>
            </div>
        </Card>
    )

    return (
        <Card className="border-none shadow-sm bg-white dark:bg-slate-900/50 rounded-3xl overflow-hidden h-full">
            <CardHeader className="flex flex-row items-center justify-between p-6 pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 flex items-center gap-2">
                    <Megaphone className="h-4 w-4 text-primary" /> Latest Intelligence
                </CardTitle>
                <Link href="/dashboard/notice">
                    <Button variant="ghost" size="sm" className="h-8 px-3 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 rounded-xl">
                        View Board <ArrowRight className="ml-1.5 h-3 w-3" />
                    </Button>
                </Link>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
                {(latestNotices ?? []).length > 0 ? (
                    (latestNotices ?? []).map((notice: any) => (
                        <Link key={notice._id} href="/dashboard/notice">
                            <div className="group p-4 rounded-2xl bg-slate-50/50 dark:bg-white/5 border border-transparent hover:border-primary/20 transition-all cursor-pointer relative mb-3 last:mb-0">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="space-y-1 flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className={cn("px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest", priorityColors[notice.priority] || priorityColors.normal)}>
                                                {notice.priority}
                                            </span>
                                            {notice.isPinned && <Pin className="h-2.5 w-2.5 text-indigo-500 rotate-45" />}
                                            {!readStatus?.some(r => r.noticeId === notice._id) && (
                                                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                                            )}
                                        </div>
                                        <h4 className="text-xs font-black uppercase italic tracking-tight text-slate-900 dark:text-white truncate group-hover:text-primary transition-colors">
                                            {notice.title}
                                        </h4>
                                        <p className="text-[10px] text-slate-500 font-medium truncate opacity-80">
                                            {notice.message}
                                        </p>
                                    </div>
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter shrink-0 mt-1">
                                        {format(notice.createdAt, 'MMM dd')}
                                    </span>
                                </div>
                            </div>
                        </Link>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center py-10 opacity-40">
                        <Megaphone className="h-8 w-8 mb-2" />
                        <p className="text-[10px] font-black uppercase tracking-widest">No active notices</p>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
