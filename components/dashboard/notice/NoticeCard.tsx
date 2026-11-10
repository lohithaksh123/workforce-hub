'use client'

import { format } from 'date-fns'
import { 
    Megaphone, 
    Pin, 
    Clock, 
    Calendar, 
    MoreHorizontal, 
    Trash2, 
    X, 
    Power, 
    Eye,
    Shield,
    MapPin,
    Users,
    CheckCircle2,
    XCircle
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export function NoticeCard({ 
    notice, 
    isAdmin, 
    onView,
    onEdit, 
    onDelete, 
    onToggleActive, 
    onTogglePinned,
    onApprove,
    onReject,
    isRead,
    isCreator
}: { 
    notice: any, 
    isAdmin: boolean, 
    onView: () => void,
    onEdit?: () => void, 
    onDelete?: () => void, 
    onToggleActive?: () => void, 
    onTogglePinned?: () => void,
    onApprove?: () => void,
    onReject?: () => void,
    isRead?: boolean,
    isCreator?: boolean
}) {
    const priorityColors = {
        normal: "bg-slate-500/10 text-slate-500 border-slate-500/20",
        important: "bg-amber-500/10 text-amber-500 border-amber-500/20",
        urgent: "bg-rose-500/10 text-rose-500 border-rose-500/20"
    }

    const audienceIcon = {
        all: <Users className="h-3 w-3" />,
        roles: <Shield className="h-3 w-3" />,
        sites: <MapPin className="h-3 w-3" />,
        users: <Users className="h-3 w-3" />
    }

    const isExpired = notice?.expiresAt && notice?.expiresAt < Date.now()

    return (
        <Card className={cn(
            "group relative border-none shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1 rounded-[2rem] overflow-hidden bg-white dark:bg-slate-900",
            !notice?.isActive && "opacity-60 grayscale-[0.5]",
            notice?.isPinned && "ring-2 ring-primary/20"
        )}>
            {/* Unread Indicator */}
            {!isRead && notice?.isActive && !isExpired && (
                <div className="absolute top-6 left-6 h-2 w-2 rounded-full bg-primary animate-pulse shadow-[0_0_10px_hsl(var(--primary))]" />
            )}

            <CardContent className="p-6 md:p-8">
                <div className="flex items-start justify-between mb-6">
                    <div className="flex flex-wrap items-center gap-2">
                        <div className={cn(
                            "px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border",
                            priorityColors[notice?.priority as keyof typeof priorityColors]
                        )}>
                            {notice?.priority}
                        </div>
                        {notice?.isPinned && (
                            <div className="px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5">
                                <Pin className="h-2.5 w-2.5 rotate-45" /> Pinned
                            </div>
                        )}
                        {!notice?.isActive && (
                            <div className="px-3 py-1 rounded-full bg-slate-100 text-slate-500 border border-slate-200 text-[8px] font-black uppercase tracking-widest">
                                Inactive
                            </div>
                        )}
                        {isExpired && (
                            <div className="px-3 py-1 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20 text-[8px] font-black uppercase tracking-widest">
                                Expired
                            </div>
                        )}
                        {notice?.approvalStatus === 'pending' && (
                            <div className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[8px] font-black uppercase tracking-widest animate-pulse">
                                Pending Approval
                            </div>
                        )}
                        {notice?.approvalStatus === 'rejected' && (
                            <div className="px-3 py-1 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20 text-[8px] font-black uppercase tracking-widest">
                                Rejected
                            </div>
                        )}
                    </div>

                    {(isAdmin || isCreator) && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-slate-100 dark:hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 rounded-2xl bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 p-1 shadow-2xl">
                                {isAdmin && notice?.approvalStatus === 'pending' && (
                                    <>
                                        <DropdownMenuItem onClick={onApprove} className="rounded-xl font-bold p-3 text-[10px] uppercase tracking-widest text-emerald-600 flex items-center gap-3">
                                            <CheckCircle2 className="h-4 w-4" /> Approve Notice
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={onReject} className="rounded-xl font-bold p-3 text-[10px] uppercase tracking-widest text-rose-500 flex items-center gap-3">
                                            <XCircle className="h-4 w-4" /> Reject Notice
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator className="bg-slate-100 dark:bg-white/5" />
                                    </>
                                )}
                                <DropdownMenuItem onClick={onEdit} className="rounded-xl font-bold p-3 text-[10px] uppercase tracking-widest flex items-center gap-3">
                                    <X className="h-4 w-4 rotate-45 text-primary" /> Edit Notice
                                </DropdownMenuItem>
                                {isAdmin && (
                                    <>
                                        <DropdownMenuItem onClick={onTogglePinned} className="rounded-xl font-bold p-3 text-[10px] uppercase tracking-widest flex items-center gap-3">
                                            <Pin className="h-4 w-4 text-indigo-500" /> {notice?.isPinned ? 'Unpin Notice' : 'Pin Notice'}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={onToggleActive} className="rounded-xl font-bold p-3 text-[10px] uppercase tracking-widest flex items-center gap-3">
                                            <Power className={cn("h-4 w-4", notice?.isActive ? "text-amber-500" : "text-emerald-500")} /> {notice?.isActive ? 'Deactivate' : 'Activate'}
                                        </DropdownMenuItem>
                                    </>
                                )}
                                <DropdownMenuSeparator className="bg-slate-100 dark:bg-white/5" />
                                <DropdownMenuItem onClick={onDelete} className="rounded-xl font-bold p-3 text-[10px] uppercase tracking-widest text-rose-500 flex items-center gap-3 hover:bg-rose-500/10">
                                    <Trash2 className="h-4 w-4" /> Delete Permanently
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>

                <div className="space-y-4 cursor-pointer" onClick={onView}>
                    <h3 className={cn(
                        "text-xl md:text-2xl font-black italic tracking-tighter uppercase leading-tight group-hover:text-primary transition-colors",
                        notice?.priority === 'urgent' ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-white"
                    )}>
                        {notice?.title}
                    </h3>

                    <p className="text-slate-500 dark:text-slate-400 font-medium text-sm line-clamp-3 leading-relaxed">
                        {notice?.message}
                    </p>

                    <div className="pt-4 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 dark:border-white/5 mt-6">
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-500">
                                {notice?.createdByName?.[0]}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Published By</span>
                                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate max-w-[100px]">{notice?.createdByName}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-6">
                            <div className="flex flex-col items-end">
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Target</span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-primary">{audienceIcon[notice?.audience as keyof typeof audienceIcon]}</span>
                                    <span className="text-[9px] font-black uppercase text-slate-500">{notice?.audience}</span>
                                </div>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Date</span>
                                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 mt-0.5">{notice?.createdAt ? format(notice.createdAt, 'MMM dd') : ''}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* View Details Overlay for non-admins */}
                {!isAdmin && (
                    <div className="absolute inset-0 bg-primary/0 hover:bg-primary/[0.02] flex items-center justify-center opacity-0 hover:opacity-100 transition-all cursor-pointer pointer-events-none" onClick={onView}>
                        <div className="bg-white dark:bg-slate-900 shadow-2xl rounded-full px-6 py-2 flex items-center gap-2 border border-primary/20 pointer-events-auto">
                            <Eye className="h-4 w-4 text-primary" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Read More</span>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
