'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogFooter,
    DialogDescription
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { Loader2, Megaphone, Calendar, Users, MapPin, Shield, Pin, Trash2, X, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

export function CreateNoticeModal({ 
    isOpen, 
    onClose, 
    noticeToEdit,
    requestorEmail,
    isAdmin
}: { 
    isOpen: boolean, 
    onClose: () => void, 
    noticeToEdit?: any,
    requestorEmail: string,
    isAdmin: boolean
}) {
    const createNotice = useMutation(api.notices.createNotice)
    const updateNotice = useMutation(api.notices.updateNotice)
    const roles = useQuery(api.roles.getRoles)
    const sites = useQuery(api.sites.getSites)
    const users = useQuery(api.users.getUsers)

    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState<any>({
        title: '',
        message: '',
        priority: 'normal',
        audience: 'all',
        roleIds: [],
        siteIds: [],
        userIds: [],
        isPinned: false,
        isActive: true,
        expiresAt: undefined
    })

    useEffect(() => {
        if (noticeToEdit) {
            setFormData({
                title: noticeToEdit.title,
                message: noticeToEdit.message,
                priority: noticeToEdit.priority,
                audience: noticeToEdit.audience,
                roleIds: noticeToEdit.roleIds || [],
                siteIds: noticeToEdit.siteIds || [],
                userIds: noticeToEdit.userIds || [],
                isPinned: noticeToEdit.isPinned,
                isActive: noticeToEdit.isActive,
                expiresAt: noticeToEdit.expiresAt
            })
        } else {
            setFormData({
                title: '',
                message: '',
                priority: 'normal',
                audience: 'all',
                roleIds: [],
                siteIds: [],
                userIds: [],
                isPinned: false,
                isActive: true,
                expiresAt: undefined
            })
        }
    }, [noticeToEdit, isOpen])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.title || !formData.message) {
            toast.error('Please fill in required fields')
            return
        }

        if (formData.audience === 'roles' && formData.roleIds.length === 0) {
            toast.error('Please select at least one role')
            return
        }
        if (formData.audience === 'sites' && formData.siteIds.length === 0) {
            toast.error('Please select at least one site')
            return
        }
        if (formData.audience === 'users' && formData.userIds.length === 0) {
            toast.error('Please select at least one user')
            return
        }

        setLoading(true)
        try {
            if (noticeToEdit) {
                await updateNotice({
                    id: noticeToEdit._id,
                    ...formData,
                    requestorEmail
                })
                toast.success('Notice updated successfully')
            } else {
                await createNotice({
                    ...formData,
                    requestorEmail
                })
                toast.success('Notice published successfully')
            }
            onClose()
        } catch (error: any) {
            toast.error(error.message || 'Failed to save notice')
        } finally {
            setLoading(false)
        }
    }

    const toggleSelection = (listName: string, value: string) => {
        setFormData((prev: any) => {
            const current = prev[listName]
            if (current.includes(value)) {
                return { ...prev, [listName]: current.filter((v: string) => v !== value) }
            } else {
                return { ...prev, [listName]: [...current, value] }
            }
        })
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto rounded-[2rem] bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 shadow-3xl">
                <DialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                            <Megaphone className="h-5 w-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-black uppercase italic tracking-tight text-slate-900 dark:text-white">
                                {noticeToEdit ? 'Edit Notice' : 'Publish New Notice'}
                            </DialogTitle>
                            <DialogDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                                Send announcements to specific teams or everyone
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6 py-4">
                    <div className="space-y-4">
                        <div className="grid gap-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-primary/70 ml-1">Notice Title</Label>
                            <Input 
                                value={formData.title}
                                onChange={(e) => setFormData({...formData, title: e.target.value})}
                                placeholder="E.g., Site Safety Protocol Update"
                                className="h-12 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-2xl font-bold italic transition-all focus:ring-2 focus:ring-primary/20"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-primary/70 ml-1">Message Content</Label>
                            <Textarea 
                                value={formData.message}
                                onChange={(e) => setFormData({...formData, message: e.target.value})}
                                placeholder="Type your detailed announcement here..."
                                className="min-h-[120px] bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-2xl font-medium transition-all focus:ring-2 focus:ring-primary/20 p-4"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-primary/70 ml-1">Priority Level</Label>
                                <Select value={formData.priority} onValueChange={(v: any) => setFormData({...formData, priority: v})}>
                                    <SelectTrigger className="h-12 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-2xl font-black uppercase text-[10px] tracking-widest">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl border-white/10">
                                        <SelectItem value="normal" className="font-bold uppercase text-[10px]">Normal</SelectItem>
                                        <SelectItem value="important" className="font-bold uppercase text-[10px] text-amber-500">Important</SelectItem>
                                        <SelectItem value="urgent" className="font-bold uppercase text-[10px] text-rose-500">Urgent</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-primary/70 ml-1">Audience</Label>
                                <Select value={formData.audience} onValueChange={(v: any) => setFormData({...formData, audience: v})}>
                                    <SelectTrigger className="h-12 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-2xl font-black uppercase text-[10px] tracking-widest">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-2xl border-white/10">
                                        <SelectItem value="all" className="font-bold uppercase text-[10px]">Everyone</SelectItem>
                                        <SelectItem value="roles" className="font-bold uppercase text-[10px]">Specific Roles</SelectItem>
                                        <SelectItem value="sites" className="font-bold uppercase text-[10px]">Specific Sites</SelectItem>
                                        <SelectItem value="users" className="font-bold uppercase text-[10px]">Specific Users</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Audience Multi-Selects */}
                        {formData.audience === 'roles' && (
                            <div className="space-y-2 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 animate-in fade-in slide-in-from-top-1">
                                <Label className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-2 block">Select Roles</Label>
                                <div className="flex flex-wrap gap-2">
                                    {roles?.map(role => (
                                        <button
                                            key={role._id}
                                            type="button"
                                            onClick={() => toggleSelection('roleIds', role.name)}
                                            className={cn(
                                                "px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all flex items-center gap-2",
                                                formData.roleIds.includes(role.name)
                                                    ? "bg-primary text-white shadow-lg shadow-primary/20"
                                                    : "bg-white dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-white/10 hover:border-primary/50"
                                            )}
                                        >
                                            <Shield className="h-3 w-3" />
                                            {role.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {formData.audience === 'sites' && (
                            <div className="space-y-2 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 animate-in fade-in slide-in-from-top-1">
                                <Label className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-2 block">Select Sites</Label>
                                <div className="flex flex-wrap gap-2">
                                    {sites?.map(site => (
                                        <button
                                            key={site._id}
                                            type="button"
                                            onClick={() => toggleSelection('siteIds', site._id)}
                                            className={cn(
                                                "px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all flex items-center gap-2",
                                                formData.siteIds.includes(site._id)
                                                    ? "bg-primary text-white shadow-lg shadow-primary/20"
                                                    : "bg-white dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-white/10 hover:border-primary/50"
                                            )}
                                        >
                                            <MapPin className="h-3 w-3" />
                                            {site.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {formData.audience === 'users' && (
                            <div className="space-y-2 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 animate-in fade-in slide-in-from-top-1">
                                <Label className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-2 block">Select Users</Label>
                                <div className="flex flex-wrap gap-2 max-h-[150px] overflow-y-auto p-1">
                                    {users?.map(user => (
                                        <button
                                            key={user._id}
                                            type="button"
                                            onClick={() => toggleSelection('userIds', user.name)}
                                            className={cn(
                                                "px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all flex items-center gap-2",
                                                formData.userIds.includes(user.name)
                                                    ? "bg-primary text-white shadow-lg shadow-primary/20"
                                                    : "bg-white dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-white/10 hover:border-primary/50"
                                            )}
                                        >
                                            <Users className="h-3 w-3" />
                                            {user.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className={cn("grid gap-4", isAdmin ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1")}>
                            <div className="grid gap-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-primary/70 ml-1">Expiry Date (Optional)</Label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                    <Input 
                                        type="date"
                                        value={formData.expiresAt ? format(new Date(formData.expiresAt), 'yyyy-MM-dd') : ''}
                                        onChange={(e) => setFormData({...formData, expiresAt: e.target.value ? new Date(e.target.value).getTime() : undefined})}
                                        className="pl-10 h-12 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-2xl font-bold italic w-full text-xs transition-all"
                                    />
                                </div>
                            </div>
                            {isAdmin && (
                                <div className="flex flex-col gap-3 justify-center pl-2">
                                    <div className="flex items-center space-x-3">
                                        <Checkbox 
                                            id="isPinned" 
                                            checked={formData.isPinned} 
                                            onCheckedChange={(v) => setFormData({...formData, isPinned: !!v})}
                                            className="rounded-md h-5 w-5 border-2 border-primary/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                        />
                                        <label htmlFor="isPinned" className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 cursor-pointer flex items-center gap-1.5">
                                            <Pin className="h-3 w-3 text-primary rotate-45" /> Pin to Top
                                        </label>
                                    </div>
                                    <div className="flex items-center space-x-3">
                                        <Checkbox 
                                            id="isActive" 
                                            checked={formData.isActive} 
                                            onCheckedChange={(v) => setFormData({...formData, isActive: !!v})}
                                            className="rounded-md h-5 w-5 border-2 border-primary/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                        />
                                        <label htmlFor="isActive" className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 cursor-pointer flex items-center gap-1.5">
                                            Active / Visible
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="gap-3 pt-4">
                        <Button 
                            type="button" 
                            variant="ghost" 
                            onClick={onClose}
                            className="h-12 px-6 font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-slate-100 dark:hover:bg-white/5"
                        >
                            Cancel
                        </Button>
                        <Button 
                            type="submit" 
                            disabled={loading}
                            className="h-12 px-8 bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-[0.2em] text-[10px] rounded-2xl shadow-xl shadow-primary/20 border-b-4 border-primary/70 transition-all active:translate-y-0.5 active:border-b-0"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : noticeToEdit ? 'Update Notice' : 'Publish Notice'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

export function NoticeDetailModal({
    isOpen,
    onClose,
    notice,
    isAdmin,
    onEdit,
    onDelete,
    onApprove,
    onReject
}: {
    isOpen: boolean,
    onClose: () => void,
    notice: any,
    isAdmin: boolean,
    onEdit?: () => void,
    onDelete?: () => void,
    onApprove?: () => void,
    onReject?: () => void
}) {
    if (!notice) return null

    const priorityColors = {
        normal: "bg-slate-500/10 text-slate-500 border-slate-500/20",
        important: "bg-amber-500/10 text-amber-500 border-amber-500/20",
        urgent: "bg-rose-500/10 text-rose-500 border-rose-500/20"
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[700px] rounded-[2.5rem] bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 p-0 max-h-[90vh] overflow-y-auto shadow-3xl">

                <div className={cn(
                    "p-8 pt-12 pb-12 relative overflow-hidden",
                    notice.priority === 'urgent' ? "bg-rose-500/5" : notice.priority === 'important' ? "bg-amber-500/5" : "bg-slate-50/50 dark:bg-white/5"
                )}>
                    
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-6">
                            <div className={cn("h-10 w-10 rounded-2xl flex items-center justify-center border", priorityColors[notice.priority as keyof typeof priorityColors])}>
                                <Megaphone className="h-5 w-5" />
                            </div>
                            <div className={cn(
                                "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                                priorityColors[notice.priority as keyof typeof priorityColors]
                            )}>
                                {notice.priority}
                            </div>
                            {notice.isPinned && (
                                <div className="px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5">
                                    <Pin className="h-3 w-3 rotate-45" /> Pinned
                                </div>
                            )}
                        </div>

                        <DialogHeader>
                            <DialogTitle asChild>
                                <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white leading-tight uppercase italic tracking-tighter mb-4">
                                    {notice.title}
                                </h2>
                            </DialogTitle>
                            <DialogDescription className="sr-only">
                                Full announcement details and context for {notice.title}.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 text-muted-foreground mt-4">
                            <div className="flex flex-wrap items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="h-6 w-6 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold uppercase">
                                        {notice.createdByName?.[0]}
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-widest">{notice.createdByName}</span>
                                </div>
                                <div className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
                                    <Calendar className="h-3 w-3" />
                                    {format(notice.createdAt, 'MMM dd, yyyy • hh:mm a')}
                                </div>
                                {notice.expiresAt && (
                                    <>
                                        <div className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-rose-500">
                                            <Clock className="h-3 w-3" />
                                            Expires: {format(notice.expiresAt, 'MMM dd, yyyy')}
                                        </div>
                                    </>
                                )}
                            </div>
                            <div className="shrink-0 opacity-20 dark:opacity-30 brightness-0 dark:brightness-0 dark:invert hidden sm:block">
                                <img src="/logo.png" alt="Logo" className="h-9 w-auto" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-8 md:p-12 space-y-10">
                    <div className="prose dark:prose-invert max-w-none">
                        <p className="text-slate-600 dark:text-slate-300 leading-relaxed font-medium text-lg whitespace-pre-wrap">
                            {notice.message}
                        </p>
                    </div>

                    <div className="flex items-center justify-between pt-6 border-t border-slate-100 dark:border-white/5">
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Audience:</span>
                            <div className="flex items-center gap-2">
                                <div className="bg-slate-100 dark:bg-white/5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">
                                    {notice.audience === 'all' ? 'Everyone' : 
                                     notice.audience === 'roles' ? `Selected Roles (${notice.roleIds?.length})` : 
                                     notice.audience === 'sites' ? `Selected Sites (${notice.siteIds?.length})` : 
                                     `Selected Users (${notice.userIds?.length})`}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {isAdmin && notice.approvalStatus === 'pending' && (
                                <>
                                    <Button 
                                        onClick={onApprove}
                                        className="h-10 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase text-[10px] tracking-widest rounded-xl"
                                    >
                                        Approve
                                    </Button>
                                    <Button 
                                        onClick={onReject}
                                        className="h-10 px-6 bg-rose-600 hover:bg-rose-700 text-white font-bold uppercase text-[10px] tracking-widest rounded-xl"
                                    >
                                        Reject
                                    </Button>
                                </>
                            )}
                            {isAdmin && (
                                <>
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={onEdit}
                                        className="h-10 px-4 gap-2 text-primary font-bold uppercase text-[10px] tracking-widest rounded-xl hover:bg-primary/5"
                                    >
                                        <X className="h-3.5 w-3.5 rotate-45" /> Edit Notice
                                    </Button>
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={onDelete}
                                        className="h-10 px-4 gap-2 text-rose-500 font-bold uppercase text-[10px] tracking-widest rounded-xl hover:bg-rose-500/5"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" /> Delete
                                    </Button>
                                </>
                            )}
                            <Button 
                                onClick={onClose}
                                className="h-10 px-8 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black uppercase tracking-[0.2em] text-[10px] rounded-xl transition-all"
                            >
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
