'use client'

import { useState, useContext } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { UserContext } from '@/components/dashboard/UserContext'
import { 
    Megaphone, 
    Plus, 
    Search, 
    Filter, 
    Loader2, 
    AlertCircle, 
    Inbox,
    ArrowUpDown,
    Calendar,
    Pin,
    CheckCircle2,
    XCircle,
    Clock
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select'
import { NoticeCard } from '@/components/dashboard/notice/NoticeCard'
import { CreateNoticeModal, NoticeDetailModal } from '@/components/dashboard/notice/NoticeModals'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export default function NoticePage() {
    const { user } = useContext(UserContext)
    const notices = useQuery(api.notices.getVisibleNotices, user?.email ? { requestorEmail: user.email } : "skip")
    const readStatus = useQuery(api.notices.getNoticeReadStatus, user?.email ? { requestorEmail: user.email } : "skip")
    
    const deleteMutation = useMutation(api.notices.deleteNotice)
    const toggleActiveMutation = useMutation(api.notices.toggleNoticeActive)
    const togglePinnedMutation = useMutation(api.notices.toggleNoticePinned)
    const markReadMutation = useMutation(api.notices.markAsRead)
    const approveMutation = useMutation(api.notices.approveNotice)
    const rejectMutation = useMutation(api.notices.rejectNotice)

    const [searchQuery, setSearchQuery] = useState('')
    const [priorityFilter, setPriorityFilter] = useState('all')
    const [statusFilter, setStatusFilter] = useState('all')
    const [sortBy, setSortBy] = useState('newest')
    
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [isDetailOpen, setIsDetailOpen] = useState(false)
    const [selectedNotice, setSelectedNotice] = useState<any>(null)
    const [noticeToEdit, setNoticeToEdit] = useState<any>(null)

    const isAdmin = user?.role === 'Owner' || user?.permissions?.some((p: any) => p.key === 'manage_notices' && p.allowed)

    const handleViewNotice = async (notice: any) => {
        setSelectedNotice(notice)
        setIsDetailOpen(true)
        if (user?.email) {
            await markReadMutation({ noticeId: notice._id, requestorEmail: user.email })
        }
    }

    const handleEditNotice = (notice: any) => {
        setNoticeToEdit(notice)
        setIsCreateOpen(true)
    }

    const handleDeleteNotice = async (id: any) => {
        if (!user?.email || !confirm('Are you sure you want to permanently delete this notice?')) return
        try {
            await deleteMutation({ id, requestorEmail: user.email })
            toast.success('Notice deleted')
        } catch (error: any) {
            toast.error(error.message)
        }
    }

    const handleToggleActive = async (id: any, currentStatus: boolean) => {
        if (!user?.email) return
        try {
            await toggleActiveMutation({ id, isActive: !currentStatus, requestorEmail: user.email })
            toast.success(currentStatus ? 'Notice deactivated' : 'Notice activated')
        } catch (error: any) {
            toast.error(error.message)
        }
    }

    const handleTogglePinned = async (id: any, currentStatus: boolean) => {
        if (!user?.email) return
        try {
            await togglePinnedMutation({ id, isPinned: !currentStatus, requestorEmail: user.email })
            toast.success(currentStatus ? 'Notice unpinned' : 'Notice pinned to top')
        } catch (error: any) {
            toast.error(error.message)
        }
    }

    const handleApproveNotice = async (id: any) => {
        if (!user?.email) return
        try {
            await approveMutation({ id, requestorEmail: user.email })
            toast.success('Notice approved and published')
            setIsDetailOpen(false)
        } catch (error: any) {
            toast.error(error.message)
        }
    }

    const handleRejectNotice = async (id: any) => {
        if (!user?.email) return
        try {
            await rejectMutation({ id, requestorEmail: user.email })
            toast.success('Notice request rejected')
            setIsDetailOpen(false)
        } catch (error: any) {
            toast.error(error.message)
        }
    }

    const visibleNotices = notices ?? []
    const filteredNotices = visibleNotices.filter((notice: any) => {
        const matchesSearch = (notice?.title ?? '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                             (notice?.message ?? '').toLowerCase().includes(searchQuery.toLowerCase())
        const matchesPriority = priorityFilter === 'all' || notice?.priority === priorityFilter
        
        let matchesStatus = true
        const isExpired = notice?.expiresAt && notice?.expiresAt < Date.now()
        
        if (statusFilter === 'active') matchesStatus = notice?.isActive && !isExpired
        if (statusFilter === 'inactive') matchesStatus = !notice?.isActive
        if (statusFilter === 'expired') matchesStatus = !!isExpired

        return matchesSearch && matchesPriority && matchesStatus
    }).sort((a: any, b: any) => {
        const aTime = a?.createdAt ?? 0
        const bTime = b?.createdAt ?? 0
        if (sortBy === 'newest') return bTime - aTime
        if (sortBy === 'oldest') return aTime - bTime
        if (sortBy === 'priority') {
            const pMap: any = { urgent: 3, important: 2, normal: 1 }
            const aPriority = a?.priority ?? 'normal'
            const bPriority = b?.priority ?? 'normal'
            return (pMap[bPriority] ?? 1) - (pMap[aPriority] ?? 1)
        }
        return 0
    })

    if (notices === undefined) return (
        <div className="flex h-[70vh] items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-[10px] font-black uppercase tracking-widest opacity-50">Syncing Intelligence...</p>
            </div>
        </div>
    )

    return (
        <div className="space-y-8 pb-20">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-[1.25rem] bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-lg shadow-primary/10">
                            <Megaphone className="h-6 w-6" />
                        </div>
                        <h1 className="text-3xl md:text-4xl font-black italic tracking-tighter uppercase text-slate-900 dark:text-white">
                            Notice Board
                        </h1>
                    </div>
                    <p className="text-muted-foreground font-bold italic text-[11px] uppercase tracking-[0.2em] opacity-60 ml-1">
                        Company-wide announcements and critical updates
                    </p>
                </div>

                {user && (
                    <Button 
                        onClick={() => { setNoticeToEdit(null); setIsCreateOpen(true); }}
                        className="h-14 px-8 bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-[0.2em] text-[11px] rounded-2xl shadow-xl shadow-primary/20 border-b-4 border-primary/70 transition-all active:translate-y-1 active:border-b-0"
                    >
                        <Plus className="mr-2 h-5 w-5" /> Create New Notice
                    </Button>
                )}
            </div>

            {/* Filters Bar */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 p-4 bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-white/5 backdrop-blur-xl shadow-sm">
                <div className="relative xl:col-span-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search announcements..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-12 pl-12 bg-slate-50 dark:bg-white/5 border-none rounded-2xl font-bold italic text-xs transition-all focus:ring-2 focus:ring-primary/20"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-3 xl:col-span-3">
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-white/5 rounded-2xl p-1">
                        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                            <SelectTrigger className="h-10 w-[140px] border-none bg-transparent font-black uppercase text-[9px] tracking-widest focus:ring-0">
                                <Filter className="mr-2 h-3 w-3 text-primary" />
                                <SelectValue placeholder="Priority" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-white/10">
                                <SelectItem value="all" className="font-bold uppercase text-[9px]">All Priorities</SelectItem>
                                <SelectItem value="normal" className="font-bold uppercase text-[9px]">Normal</SelectItem>
                                <SelectItem value="important" className="font-bold uppercase text-[9px] text-amber-500">Important</SelectItem>
                                <SelectItem value="urgent" className="font-bold uppercase text-[9px] text-rose-500">Urgent</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {isAdmin && (
                        <div className="flex items-center gap-2 bg-slate-100 dark:bg-white/5 rounded-2xl p-1">
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="h-10 w-[140px] border-none bg-transparent font-black uppercase text-[9px] tracking-widest focus:ring-0">
                                    <CheckCircle2 className="mr-2 h-3 w-3 text-emerald-500" />
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-white/10">
                                    <SelectItem value="all" className="font-bold uppercase text-[9px]">All Status</SelectItem>
                                    <SelectItem value="active" className="font-bold uppercase text-[9px]">Active Only</SelectItem>
                                    <SelectItem value="inactive" className="font-bold uppercase text-[9px]">Inactive Only</SelectItem>
                                    <SelectItem value="expired" className="font-bold uppercase text-[9px]">Expired Only</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-white/5 rounded-2xl p-1">
                        <Select value={sortBy} onValueChange={setSortBy}>
                            <SelectTrigger className="h-10 w-[140px] border-none bg-transparent font-black uppercase text-[9px] tracking-widest focus:ring-0">
                                <ArrowUpDown className="mr-2 h-3 w-3 text-indigo-500" />
                                <SelectValue placeholder="Sort By" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-white/10">
                                <SelectItem value="newest" className="font-bold uppercase text-[9px]">Newest First</SelectItem>
                                <SelectItem value="oldest" className="font-bold uppercase text-[9px]">Oldest First</SelectItem>
                                <SelectItem value="priority" className="font-bold uppercase text-[9px]">By Priority</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="h-10 w-[1px] bg-slate-200 dark:bg-slate-800 mx-2" />
                    
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 italic">
                        {filteredNotices?.length} Notices Found
                    </p>
                </div>
            </div>

            {/* Grid View */}
            {filteredNotices && filteredNotices.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredNotices.map((notice: any) => (
                        <NoticeCard 
                            key={notice._id}
                            notice={notice}
                            isAdmin={isAdmin}
                            onView={() => handleViewNotice(notice)}
                            onEdit={() => handleEditNotice(notice)}
                            onDelete={() => handleDeleteNotice(notice._id)}
                            onToggleActive={() => handleToggleActive(notice._id, notice.isActive)}
                            onTogglePinned={() => handleTogglePinned(notice._id, notice.isPinned)}
                            onApprove={() => handleApproveNotice(notice._id)}
                            onReject={() => handleRejectNotice(notice._id)}
                            isRead={readStatus?.some(r => r.noticeId === notice._id)}
                            isCreator={notice.createdBy === user?.name}
                        />
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900/30 rounded-[3rem] border-2 border-dashed border-slate-100 dark:border-white/5">
                    <div className="h-24 w-24 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-6">
                        <Inbox className="h-10 w-10 text-slate-300" />
                    </div>
                    <h3 className="text-xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white mb-2">
                        No notices available.
                    </h3>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 max-w-[300px] text-center leading-relaxed">
                        {searchQuery || priorityFilter !== 'all' || statusFilter !== 'all' 
                            ? "No notices match your current intelligence filters."
                            : isAdmin ? "You haven't published any notices yet. Start by creating your first announcement." : "No announcements have been published for your profile yet."}
                    </p>
                    {user && (
                        <Button 
                            variant="link" 
                            className="mt-4 text-primary font-black uppercase tracking-widest text-[10px]"
                            onClick={() => setIsCreateOpen(true)}
                        >
                            <Plus className="mr-1 h-3 w-3" /> Create First Notice
                        </Button>
                    )}
                </div>
            )}

            {/* Modals */}
            <CreateNoticeModal 
                isOpen={isCreateOpen} 
                onClose={() => { setIsCreateOpen(false); setNoticeToEdit(null); }}
                noticeToEdit={noticeToEdit}
                requestorEmail={user?.email || ''}
                isAdmin={isAdmin}
            />
            
            <NoticeDetailModal 
                isOpen={isDetailOpen}
                onClose={() => setIsDetailOpen(false)}
                notice={selectedNotice}
                isAdmin={isAdmin}
                onEdit={() => { setIsDetailOpen(false); handleEditNotice(selectedNotice); }}
                onDelete={() => { setIsDetailOpen(false); handleDeleteNotice(selectedNotice?._id); }}
                onApprove={() => handleApproveNotice(selectedNotice?._id)}
                onReject={() => handleRejectNotice(selectedNotice?._id)}
            />
        </div>
    )
}
