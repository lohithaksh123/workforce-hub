'use client'

import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle,
    DialogFooter,
    DialogDescription
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { 
    Plus, Search, Filter, Calendar as CalendarIcon, CheckCircle2, XCircle, Eye, 
    Paperclip, Trash2, Clock, User, Building2, EyeOff, Loader2, ArrowRight, X, FileText, Check, Download
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface LeaveRequestsSectionProps {
    isAdmin: boolean
    currentUserId: string
    requestorEmail: string
    dbUser: any
}

const LEAVE_TYPES = [
    "Casual Leave",
    "Sick Leave",
    "Paid Leave",
    "Unpaid Leave",
    "Special Leave"
]

export function LeaveRequestsSection({ 
    isAdmin, 
    currentUserId, 
    requestorEmail,
    dbUser
}: LeaveRequestsSectionProps) {
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState('ALL')
    const [typeFilter, setTypeFilter] = useState('ALL')
    const [siteFilter, setSiteFilter] = useState('ALL')
    
    const [isApplyModalOpen, setIsApplyModalOpen] = useState(false)
    const [isApplyMode, setIsApplyMode] = useState(false)
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
    const [selectedRequest, setSelectedRequest] = useState<any>(null)
    
    // Approval/Rejection Notes state
    const [noteText, setNoteText] = useState('')
    const [actionLoading, setActionLoading] = useState(false)

    // Queries
    const managerRequests = useQuery(
        api.leaves.getAllLeaveRequestsForManager, 
        isAdmin ? { requestorEmail } : "skip"
    )
    const staffRequests = useQuery(
        api.leaves.getMyLeaveRequests, 
        !isAdmin ? { requestorEmail } : "skip"
    )
    const sites = useQuery(api.sites.getSites)
    const users = useQuery(api.users.getUsers)

    // Mutations
    const applyLeave = useMutation(api.leaves.createLeaveRequest)
    const approveLeave = useMutation(api.leaves.approveLeaveRequest)
    const rejectLeave = useMutation(api.leaves.rejectLeaveRequest)
    const cancelLeave = useMutation(api.leaves.cancelLeaveRequest)
    const generateUploadUrl = useMutation(api.users.generateUploadUrl)

    // Form State for applying leave
    const [formEmployeeId, setFormEmployeeId] = useState<string>(currentUserId)
    const [formLeaveType, setFormLeaveType] = useState<string>(LEAVE_TYPES[0])
    const [formFromDate, setFormFromDate] = useState<string>('')
    const [formToDate, setFormToDate] = useState<string>('')
    const [formIsHalfDay, setFormIsHalfDay] = useState<boolean>(false)
    const [formHalfDaySession, setFormHalfDaySession] = useState<"first_half" | "second_half">('first_half')
    const [formReason, setFormReason] = useState<string>('')
    const [formAttachmentStorageId, setFormAttachmentStorageId] = useState<string | null>(null)
    const [formAttachmentName, setFormAttachmentName] = useState<string>('')
    const [uploadingFile, setUploadingFile] = useState(false)
    const [applyLoading, setApplyLoading] = useState(false)

    const rawRequests = isAdmin ? managerRequests : staffRequests
    const activeUsers = users?.filter(u => u.status === 'active') || []

    const filteredRequests = rawRequests?.filter(req => {
        const matchesSearch = 
            req.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            req.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
            req.leaveType.toLowerCase().includes(searchTerm.toLowerCase())
        
        const matchesStatus = statusFilter === 'ALL' || req.status === statusFilter
        const matchesType = typeFilter === 'ALL' || req.leaveType === typeFilter
        const matchesSite = siteFilter === 'ALL' || req.siteId === siteFilter

        return matchesSearch && matchesStatus && matchesType && matchesSite
    })

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        try {
            setUploadingFile(true)
            const postUrl = await generateUploadUrl()
            const result = await fetch(postUrl, {
                method: "POST",
                headers: { "Content-Type": file.type },
                body: file,
            })
            if (!result.ok) throw new Error("Upload failed")
            const { storageId } = await result.json()
            setFormAttachmentStorageId(storageId)
            setFormAttachmentName(file.name)
            toast.success('Attachment uploaded successfully')
        } catch (error: any) {
            toast.error(error.message || 'Failed to upload attachment')
        } finally {
            setUploadingFile(false)
        }
    }

    const resetApplyForm = () => {
        setFormEmployeeId(currentUserId)
        setFormLeaveType(LEAVE_TYPES[0])
        setFormFromDate('')
        setFormToDate('')
        setFormIsHalfDay(false)
        setFormHalfDaySession('first_half')
        setFormReason('')
        setFormAttachmentStorageId(null)
        setFormAttachmentName('')
    }

    const handleApplySubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formFromDate) {
            toast.error("Please select a start date.")
            return
        }
        
        const toDate = formIsHalfDay ? formFromDate : formToDate
        if (!toDate) {
            toast.error("Please select an end date.")
            return
        }

        if (toDate < formFromDate) {
            toast.error("End date cannot be before start date.")
            return
        }

        try {
            setApplyLoading(true)
            await applyLeave({
                employeeId: isApplyMode ? currentUserId : (formEmployeeId as any),
                leaveType: formLeaveType,
                fromDate: formFromDate,
                toDate: toDate,
                isHalfDay: formIsHalfDay,
                halfDaySession: formIsHalfDay ? formHalfDaySession : undefined,
                reason: formReason,
                attachmentStorageId: formAttachmentStorageId ? (formAttachmentStorageId as any) : undefined,
                requestorEmail,
                status: isApplyMode ? "pending" : "approved"
            })
            toast.success(isApplyMode ? 'Leave request submitted successfully' : 'Leave granted successfully')
            setIsApplyModalOpen(false)
            resetApplyForm()
        } catch (error: any) {
            toast.error(error.message || 'Failed to submit leave request')
        } finally {
            setApplyLoading(false)
        }
    }

    const handleApprove = async () => {
        if (!selectedRequest) return
        try {
            setActionLoading(true)
            await approveLeave({
                id: selectedRequest._id,
                approvalNote: noteText || undefined,
                requestorEmail
            })
            toast.success('Leave request approved successfully')
            setIsDetailsModalOpen(false)
            setNoteText('')
        } catch (error: any) {
            toast.error(error.message || 'Failed to approve leave request')
        } finally {
            setActionLoading(false)
        }
    }

    const handleReject = async () => {
        if (!selectedRequest) return
        try {
            setActionLoading(true)
            await rejectLeave({
                id: selectedRequest._id,
                approvalNote: noteText || undefined,
                requestorEmail
            })
            toast.success('Leave request rejected')
            setIsDetailsModalOpen(false)
            setNoteText('')
        } catch (error: any) {
            toast.error(error.message || 'Failed to reject leave request')
        } finally {
            setActionLoading(false)
        }
    }

    const handleCancel = async (id: string) => {
        try {
            setActionLoading(true)
            await cancelLeave({
                id: id as any,
                requestorEmail
            })
            toast.success('Leave request cancelled successfully')
            setIsDetailsModalOpen(false)
        } catch (error: any) {
            toast.error(error.message || 'Failed to cancel leave request')
        } finally {
            setActionLoading(false)
        }
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'approved':
                return <Badge className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 font-bold text-[10px] uppercase">Approved</Badge>
            case 'pending':
                return <Badge className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 font-bold text-[10px] uppercase animate-pulse">Pending</Badge>
            case 'rejected':
                return <Badge className="bg-rose-500/10 text-rose-500 border border-rose-500/20 px-2 py-0.5 font-bold text-[10px] uppercase">Rejected</Badge>
            case 'cancelled':
                return <Badge className="bg-slate-500/10 text-slate-500 border border-slate-500/20 px-2 py-0.5 font-bold text-[10px] uppercase">Cancelled</Badge>
            default:
                return <Badge variant="outline">{status}</Badge>
        }
    }

    if (rawRequests === undefined) {
        return (
            <div className="flex h-48 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Filters and Apply Button */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 w-full pr-0 md:pr-10">
                <div className="flex flex-col sm:flex-row flex-1 items-center gap-3 w-full">
                    <div className="relative flex-1 w-full max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search employee, leave type or reason..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 h-12 bg-slate-50 dark:bg-slate-800 border-none font-medium w-full"
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[140px] h-12 bg-slate-50 dark:bg-slate-800 border-none font-bold">
                                <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Statuses</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="approved">Approved</SelectItem>
                                <SelectItem value="rejected">Rejected</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger className="w-[150px] h-12 bg-slate-50 dark:bg-slate-800 border-none font-bold">
                                <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                                <SelectValue placeholder="Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Leave Types</SelectItem>
                                {LEAVE_TYPES.map(t => (
                                    <SelectItem key={t} value={t}>{t}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {isAdmin && (
                            <Select value={siteFilter} onValueChange={setSiteFilter}>
                                <SelectTrigger className="w-[160px] h-12 bg-slate-50 dark:bg-slate-800 border-none font-bold">
                                    <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
                                    <SelectValue placeholder="Site" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">All Sites</SelectItem>
                                    {sites?.map(s => (
                                        <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                </div>
                
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                    {isAdmin && (
                        <Button 
                            type="button"
                            variant="outline" 
                            onClick={() => { 
                                resetApplyForm(); 
                                setIsApplyMode(true);
                                setIsApplyModalOpen(true); 
                            }}
                            className="h-12 px-6 font-bold gap-2 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 w-full sm:w-auto shadow-sm"
                        >
                            <CalendarIcon className="h-4 w-4" />
                            Apply for Leave
                        </Button>
                    )}
                    <Button 
                        type="button"
                        variant="default" 
                        onClick={() => { 
                            resetApplyForm(); 
                            setIsApplyMode(!isAdmin);
                            setIsApplyModalOpen(true); 
                        }}
                        className="h-12 px-6 font-bold gap-2 bg-primary hover:bg-primary/90 text-white w-full sm:w-auto shadow-sm"
                    >
                        <Plus className="h-4 w-4" />
                        {isAdmin ? "Grant Leave" : "Apply Leave"}
                    </Button>
                </div>
            </div>

            {/* List Section */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                {/* Desktop View */}
                <div className="hidden md:block">
                    <Table>
                        <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50">
                            <TableRow>
                                <TableHead className="font-black text-[10px] uppercase tracking-widest px-6 h-12">Employee</TableHead>
                                <TableHead className="font-black text-[10px] uppercase tracking-widest h-12">Leave Type</TableHead>
                                <TableHead className="font-black text-[10px] uppercase tracking-widest h-12">Duration</TableHead>
                                <TableHead className="font-black text-[10px] uppercase tracking-widest h-12 text-center">Total Days</TableHead>
                                <TableHead className="font-black text-[10px] uppercase tracking-widest h-12">Reason</TableHead>
                                <TableHead className="font-black text-[10px] uppercase tracking-widest h-12">Status</TableHead>
                                <TableHead className="font-black text-[10px] uppercase tracking-widest h-12 text-right px-6">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredRequests?.map((req) => (
                                <TableRow key={req._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors border-slate-100 dark:border-slate-800">
                                    <TableCell className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-900 dark:text-slate-100">{req.userName}</span>
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase">{req.userRole || 'Staff'}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-700 dark:text-slate-300">{req.leaveType}</span>
                                            {req.isHalfDay && (
                                                <span className="text-[9px] font-semibold text-amber-600 dark:text-amber-500 uppercase tracking-wider">
                                                    Half Day ({req.halfDaySession === 'first_half' ? 'First Half' : 'Second Half'})
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-medium text-slate-600 dark:text-slate-400 tabular-nums">
                                        {req.fromDate === req.toDate ? (
                                            req.fromDate
                                        ) : (
                                            <span className="flex items-center gap-1.5">
                                                {req.fromDate} <ArrowRight className="h-3 w-3 text-slate-400" /> {req.toDate}
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-center font-black text-slate-800 dark:text-slate-200 tabular-nums">
                                        {req.totalDays}
                                    </TableCell>
                                    <TableCell className="max-w-[200px] truncate font-medium text-slate-500 dark:text-slate-400">
                                        {req.reason}
                                    </TableCell>
                                    <TableCell>
                                        {getStatusBadge(req.status)}
                                    </TableCell>
                                    <TableCell className="text-right px-6">
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-8 gap-2 font-bold text-[10px] uppercase tracking-widest rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                                            onClick={() => { setSelectedRequest(req); setIsDetailsModalOpen(true); }}
                                        >
                                            <Eye className="h-3.5 w-3.5" />
                                            Details
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {filteredRequests?.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-48 text-center py-10">
                                        <div className="flex flex-col items-center justify-center space-y-3 opacity-40">
                                            <CalendarIcon className="h-10 w-10 text-muted-foreground" />
                                            <p className="text-muted-foreground font-medium italic">
                                                No leave requests found.
                                            </p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Mobile View */}
                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredRequests?.map((req) => (
                        <div key={req._id} className="p-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex flex-col">
                                    <span className="font-bold text-slate-900 dark:text-slate-100">{req.userName}</span>
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase">{req.userRole || 'Staff'}</span>
                                </div>
                                {getStatusBadge(req.status)}
                            </div>

                            <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Type</span>
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{req.leaveType}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Days</span>
                                    <span className="text-xs font-black text-primary">{req.totalDays}</span>
                                </div>
                                <div className="flex flex-col col-span-2">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Dates</span>
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                        {req.fromDate === req.toDate ? req.fromDate : `${req.fromDate} to ${req.toDate}`}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-2">
                                <span className="text-[10px] font-bold text-slate-400 italic max-w-[60%] truncate">
                                    📝 {req.reason}
                                </span>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-8 gap-2 font-bold text-[10px] uppercase tracking-widest rounded-lg"
                                    onClick={() => { setSelectedRequest(req); setIsDetailsModalOpen(true); }}
                                >
                                    <Eye className="h-3 w-3" />
                                    View
                                </Button>
                            </div>
                        </div>
                    ))}
                    {filteredRequests?.length === 0 && (
                        <div className="flex flex-col items-center justify-center space-y-3 opacity-40 p-8 h-48">
                            <CalendarIcon className="h-10 w-10 text-muted-foreground" />
                            <p className="text-muted-foreground font-medium italic">
                                No leave requests found.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Apply Leave Modal */}
            <Dialog open={isApplyModalOpen} onOpenChange={setIsApplyModalOpen}>
                <DialogContent className="max-w-xl bg-white dark:bg-slate-900 border-none shadow-2xl rounded-3xl p-0 max-h-[90vh] overflow-y-auto">
                    <DialogHeader className="p-6 pb-0">
                        <DialogTitle className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                                <CalendarIcon className="h-5 w-5" />
                            </div>
                            {isApplyMode ? "Apply for Leave" : "Grant Staff Leave"}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground mt-1 font-medium italic">
                            {isApplyMode 
                                ? "Submit a leave request for manager approval. Approved leaves reflect in logs."
                                : "Record an approved or planned leave directly for any staff member."
                            }
                        </DialogDescription>
                    </DialogHeader>
 
                    <form onSubmit={handleApplySubmit} className="p-6 space-y-6">
                        {/* Employee Selector (Admins only, when granting leave) */}
                        {isAdmin && !isApplyMode ? (
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                    <User className="h-3 w-3" /> Select Employee
                                </Label>
                                <Select value={formEmployeeId} onValueChange={setFormEmployeeId}>
                                    <SelectTrigger className="w-full h-12 bg-slate-50 dark:bg-slate-800 border-none font-bold">
                                        <SelectValue placeholder="Select Staff" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {activeUsers.map(u => (
                                            <SelectItem key={u._id} value={u._id}>{u.name} ({u.role})</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        ) : null}

                        {/* Leave Type and Half-Day Toggle */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                    Leave Type
                                </Label>
                                <Select value={formLeaveType} onValueChange={setFormLeaveType}>
                                    <SelectTrigger className="w-full h-12 bg-slate-50 dark:bg-slate-800 border-none font-bold">
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {LEAVE_TYPES.map(t => (
                                            <SelectItem key={t} value={t}>{t}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2 flex flex-col justify-end pb-1">
                                <div className="flex items-center gap-3 h-12 bg-slate-50 dark:bg-slate-800 px-4 rounded-xl">
                                    <input 
                                        type="checkbox" 
                                        id="halfDay"
                                        checked={formIsHalfDay} 
                                        onChange={(e) => {
                                            setFormIsHalfDay(e.target.checked)
                                            if (e.target.checked && formFromDate) {
                                                setFormToDate(formFromDate)
                                            }
                                        }}
                                        className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                                    />
                                    <Label htmlFor="halfDay" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                                        Half-day Leave
                                    </Label>
                                </div>
                            </div>
                        </div>

                        {/* Dates Selection */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                    From Date
                                </Label>
                                <Input 
                                    type="date"
                                    required
                                    value={formFromDate}
                                    onChange={(e) => {
                                        setFormFromDate(e.target.value)
                                        if (formIsHalfDay) {
                                            setFormToDate(e.target.value)
                                        }
                                    }}
                                    className="h-12 bg-slate-50 dark:bg-slate-800 border-none font-medium"
                                />
                            </div>

                            {!formIsHalfDay ? (
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                        To Date
                                    </Label>
                                    <Input 
                                        type="date"
                                        required
                                        value={formToDate}
                                        min={formFromDate}
                                        onChange={(e) => setFormToDate(e.target.value)}
                                        className="h-12 bg-slate-50 dark:bg-slate-800 border-none font-medium"
                                    />
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                        Session
                                    </Label>
                                    <Select 
                                        value={formHalfDaySession} 
                                        onValueChange={(val: any) => setFormHalfDaySession(val)}
                                    >
                                        <SelectTrigger className="w-full h-12 bg-slate-50 dark:bg-slate-800 border-none font-bold">
                                            <SelectValue placeholder="Select Session" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="first_half">First Half (9:30 AM - 1:30 PM)</SelectItem>
                                            <SelectItem value="second_half">Second Half (1:30 PM - 5:30 PM)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>

                        {!formIsHalfDay && (
                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 italic">
                                * Weekly off days and custom holidays are automatically excluded from the leave duration count.
                            </p>
                        )}

                        {/* Reason / Notes */}
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                Reason for Leave
                            </Label>
                            <Textarea 
                                required
                                value={formReason}
                                onChange={(e) => setFormReason(e.target.value)}
                                placeholder="Explain details of the leave request..."
                                className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl min-h-[80px]"
                            />
                        </div>

                        {/* File Attachment Upload */}
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                <Paperclip className="h-3 w-3" /> Attachment (Optional)
                            </Label>
                            <div className="flex items-center gap-3">
                                <Button 
                                    type="button" 
                                    variant="outline"
                                    className="h-12 gap-2 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 relative cursor-pointer font-bold overflow-hidden"
                                    disabled={uploadingFile}
                                >
                                    {uploadingFile ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Uploading...
                                        </>
                                    ) : (
                                        <>
                                            <Paperclip className="h-4 w-4 text-slate-400" />
                                            {formAttachmentName ? "Change File" : "Choose File"}
                                        </>
                                    )}
                                    <input 
                                        type="file" 
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                        onChange={handleFileUpload}
                                        disabled={uploadingFile}
                                    />
                                </Button>
                                {formAttachmentName && (
                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400 max-w-[200px] truncate bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl">
                                        📎 {formAttachmentName}
                                    </span>
                                )}
                            </div>
                        </div>

                        <DialogFooter className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 justify-end">
                            <Button 
                                type="button" 
                                variant="ghost" 
                                onClick={() => setIsApplyModalOpen(false)}
                                className="h-12 px-6 font-bold"
                            >
                                Cancel
                            </Button>
                            <Button 
                                type="submit" 
                                disabled={applyLoading || uploadingFile}
                                className="h-12 px-6 bg-primary hover:bg-primary/95 text-white font-bold gap-2 shadow-md"
                            >
                                {applyLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                                Submit Request
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Leave Details Modal (View, Approve, Reject, Cancel) */}
            <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
                <DialogContent className="max-w-xl bg-white dark:bg-slate-900 border-none shadow-2xl rounded-3xl p-0 max-h-[90vh] overflow-y-auto">
                    <DialogHeader className="p-6 pb-0">
                        <DialogTitle className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                                <Clock className="h-5 w-5" />
                            </div>
                            Leave Request Details
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground mt-1 font-medium italic">
                            Full audit log, attachment verification, and approval actions.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedRequest && (
                        <div className="p-6 space-y-6">
                            {/* Request overview */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Employee</span>
                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{selectedRequest.userName}</p>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</span>
                                    <div>{getStatusBadge(selectedRequest.status)}</div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Leave Type</span>
                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{selectedRequest.leaveType}</p>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Duration</span>
                                    <p className="text-sm font-black text-primary">{selectedRequest.totalDays} {selectedRequest.totalDays === 1 ? 'Day' : 'Days'}</p>
                                </div>
                                <div className="space-y-1 col-span-2">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Dates</span>
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                        {selectedRequest.fromDate === selectedRequest.toDate 
                                            ? selectedRequest.fromDate 
                                            : `${selectedRequest.fromDate} to ${selectedRequest.toDate}`
                                        }
                                        {selectedRequest.isHalfDay && (
                                            <span className="ml-2 text-xs font-semibold text-amber-600 dark:text-amber-500">
                                                (Half Day - {selectedRequest.halfDaySession === 'first_half' ? 'First Half' : 'Second Half'})
                                            </span>
                                        )}
                                    </p>
                                </div>
                                {selectedRequest.siteName && (
                                    <div className="space-y-1 col-span-2">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Site</span>
                                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">📍 {selectedRequest.siteName}</p>
                                    </div>
                                )}
                            </div>

                            {/* Reason */}
                            <div className="space-y-1 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Reason</span>
                                <p className="text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                                    {selectedRequest.reason}
                                </p>
                            </div>

                            {/* Attachment */}
                            {selectedRequest.attachmentUrl && (
                                <div className="space-y-2">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Attachment</span>
                                    <a 
                                        href={selectedRequest.attachmentUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold text-primary transition-all"
                                    >
                                        <Download className="h-4 w-4" />
                                        Download / View Attachment
                                    </a>
                                </div>
                            )}

                            {/* Approval/Rejection details */}
                            {selectedRequest.status !== 'pending' && selectedRequest.approvedByName && (
                                <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Approval Information</span>
                                    <div className="grid grid-cols-2 gap-4 text-xs">
                                        <div>
                                            <span className="text-slate-400 font-medium">Approved By:</span>
                                            <p className="font-bold text-slate-700 dark:text-slate-300">{selectedRequest.approvedByName}</p>
                                        </div>
                                        {selectedRequest.approvedAt && (
                                            <div>
                                                <span className="text-slate-400 font-medium">Approved On:</span>
                                                <p className="font-bold text-slate-700 dark:text-slate-300">{new Date(selectedRequest.approvedAt).toLocaleString('en-GB')}</p>
                                            </div>
                                        )}
                                    </div>
                                    {selectedRequest.approvalNote && (
                                        <div className="bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-lg text-xs mt-2">
                                            <span className="font-bold text-emerald-600 uppercase text-[9px] tracking-wider block">Manager Note:</span>
                                            <p className="text-slate-600 dark:text-slate-400 mt-1 font-medium">{selectedRequest.approvalNote}</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {selectedRequest.status === 'rejected' && selectedRequest.rejectedByName && (
                                <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Rejection Information</span>
                                    <div className="grid grid-cols-2 gap-4 text-xs">
                                        <div>
                                            <span className="text-slate-400 font-medium">Rejected By:</span>
                                            <p className="font-bold text-slate-700 dark:text-slate-300">{selectedRequest.rejectedByName}</p>
                                        </div>
                                        {selectedRequest.rejectedAt && (
                                            <div>
                                                <span className="text-slate-400 font-medium">Rejected On:</span>
                                                <p className="font-bold text-slate-700 dark:text-slate-300">{new Date(selectedRequest.rejectedAt).toLocaleString('en-GB')}</p>
                                            </div>
                                        )}
                                    </div>
                                    {selectedRequest.approvalNote && (
                                        <div className="bg-rose-500/5 border border-rose-500/10 p-3 rounded-lg text-xs mt-2">
                                            <span className="font-bold text-rose-600 uppercase text-[9px] tracking-wider block">Rejection Note:</span>
                                            <p className="text-slate-600 dark:text-slate-400 mt-1 font-medium">{selectedRequest.approvalNote}</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Manager Actions (only if status is pending and not own request) */}
                            {isAdmin && selectedRequest.status === 'pending' && selectedRequest.userId !== currentUserId && (
                                <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        Decision Note (Optional)
                                    </Label>
                                    <Textarea 
                                        value={noteText}
                                        onChange={(e) => setNoteText(e.target.value)}
                                        placeholder="Add approval or rejection remarks..."
                                        className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl min-h-[60px]"
                                    />
                                    <div className="flex items-center gap-3 pt-2">
                                        <Button 
                                            onClick={handleReject}
                                            disabled={actionLoading}
                                            variant="outline"
                                            className="flex-1 h-12 border-rose-200 bg-rose-50 hover:bg-rose-100 hover:text-rose-700 text-rose-600 dark:bg-rose-950/20 dark:border-rose-900/30 gap-2 font-bold"
                                        >
                                            <XCircle className="h-4 w-4" />
                                            Reject Request
                                        </Button>
                                        <Button 
                                            onClick={handleApprove}
                                            disabled={actionLoading}
                                            className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-bold shadow-md"
                                        >
                                            <CheckCircle2 className="h-4 w-4" />
                                            Approve Request
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Manager Actions self-request alert */}
                            {isAdmin && selectedRequest.status === 'pending' && selectedRequest.userId === currentUserId && (
                                <div className="p-3 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-xl text-xs font-bold text-center italic">
                                    Awaiting review from another Owner or Administrator.
                                </div>
                            )}

                            {/* Cancel Request (for staff if pending, or managers for approved/pending) */}
                            {((!isAdmin && selectedRequest.status === 'pending' && selectedRequest.userId === currentUserId) || 
                              (isAdmin && selectedRequest.status !== 'cancelled')) && (
                                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                                    <Button 
                                        variant="ghost" 
                                        onClick={() => handleCancel(selectedRequest._id)}
                                        disabled={actionLoading}
                                        className="h-10 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 font-bold gap-2 hover:text-rose-600"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        Cancel Request
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
