'use client'

import { useState, useContext } from 'react'
import { UserContext } from '@/components/dashboard/UserContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { toast } from '@/hooks/use-toast'
import AccessDeniedBoard from '@/components/dashboard/AccessDeniedBoard'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  UserPlus, 
  Link as LinkIcon, 
  Send, 
  Trash2, 
  Loader2, 
  CheckCircle, 
  XCircle, 
  FileText, 
  Calendar,
  Phone,
  Mail,
  User,
  Shield,
  Briefcase,
  MapPin,
  Clock,
  ExternalLink,
  MessageSquare
} from 'lucide-react'

export default function InvitePage() {
  const { user: loggedInUser } = useContext(UserContext)

  // Queries & Mutations
  const invites = useQuery(api.invites.getInvites, loggedInUser?.email ? { requestorEmail: loggedInUser.email } : 'skip')
  const joinRequests = useQuery(api.joinRequests.getJoinRequests, loggedInUser?.email ? { requestorEmail: loggedInUser.email } : 'skip')
  const roles = useQuery(api.roles.getRoles)
  const sites = useQuery(api.sites.getSites)

  const createInvite = useMutation(api.invites.createInviteLink)
  const revokeInvite = useMutation(api.invites.revokeInvite)
  const updateStatus = useMutation(api.joinRequests.updateRequestStatus)
  const approveRequest = useMutation(api.joinRequests.approveJoinRequest)

  // State Variables
  const [activeTab, setActiveTab] = useState<'invites' | 'requests' | 'history'>('requests')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [reviewStage, setReviewStage] = useState<'details' | 'approve' | 'feedback'>('details')
  const [isSaving, setIsSaving] = useState(false)

  // Form states
  const [inviteTitle, setInviteTitle] = useState('')
  const [expiryDays, setExpiryDays] = useState('7')
  const [maxUses, setMaxUses] = useState('1')
  const [notes, setNotes] = useState('')
  const [generatedInvite, setGeneratedInvite] = useState<{ inviteCode: string; link: string } | null>(null)

  // Review states
  const [selectedRequest, setSelectedRequest] = useState<any>(null)
  const [requestDetails, setRequestDetails] = useState<any>(null)
  const [feedbackType, setFeedbackType] = useState<'rejected' | 'changes_requested'>('rejected')
  const [feedbackNote, setFeedbackNote] = useState('')

  // Approval Form states
  const [approveRole, setApproveRole] = useState('')
  const [approveSite, setApproveSite] = useState('none')
  const [approveDesignation, setApproveDesignation] = useState('')
  const [initialBalance, setInitialBalance] = useState('0')

  // Permission Check
  const hasInvitePermission = loggedInUser?.role === 'Owner' || 
    loggedInUser?.permissions?.find((p: any) => p.key === 'manage_invites')?.allowed;

  if (loggedInUser && !hasInvitePermission) {
    return <AccessDeniedBoard />
  }

  // Handle Invite Creation
  const handleCreateInvite = async () => {
    if (!loggedInUser?.email) return
    setIsSaving(true)
    setGeneratedInvite(null)
    setIsCreateOpen(true)
    try {
      const res = await createInvite({
        expiryDays: 30, // Default 30 days expiry
        maxUses: 999999, // Default unlimited uses
        requestorEmail: loggedInUser.email,
      })
      const fullLink = `${window.location.origin}/join/${res.inviteCode}`
      setGeneratedInvite({ inviteCode: res.inviteCode, link: fullLink })
      toast({ title: 'Invite Link Generated', description: 'Copy and share it with candidates.' })
    } catch (e: any) {
      setIsCreateOpen(false)
      toast({ title: 'Generation Failed', variant: 'destructive', description: e.message || 'Error occurred' })
    } finally {
      setIsSaving(false)
    }
  }

  // Handle Revoking Invite
  const handleRevokeInvite = async (inviteId: string) => {
    if (!loggedInUser?.email || !confirm('Are you sure you want to revoke this invite?')) return
    try {
      await revokeInvite({ inviteId: inviteId as any, requestorEmail: loggedInUser.email })
      toast({ title: 'Invite Revoked', description: 'The link is no longer active.' })
    } catch (e: any) {
      toast({ title: 'Error', variant: 'destructive', description: 'Failed to revoke invite link' })
    }
  }

  // Handle Request Details View
  const handleViewDetails = async (request: any) => {
    if (!loggedInUser?.email) return
    setSelectedRequest(request)
    setRequestDetails(null)
    setReviewStage('details')
    setIsDetailsOpen(true)
    try {
      // Fetch details through Convex query
      const details = await reviewFetchDetails(request._id)
      setRequestDetails(details)
    } catch (e) {
      toast({ title: 'Failed to Load Details', variant: 'destructive' })
    }
  }

  const reviewFetchDetails = async (requestId: string) => {
    // Dynamic import to run client side query safely
    return await new Promise((resolve, reject) => {
      // We will read through query helper inside render or fetch directly
      resolve(null)
    })
  }

  // Handle Rejection / Changes Requested
  const handleFeedbackSubmit = async () => {
    if (!selectedRequest || !loggedInUser?.email) return
    if (!feedbackNote.trim()) {
      toast({ title: 'Feedback required', variant: 'destructive', description: 'Please enter notes for the candidate.' })
      return
    }
    setIsSaving(true)
    try {
      await updateStatus({
        requestId: selectedRequest._id,
        status: feedbackType,
        ownerNote: feedbackNote,
        requestorEmail: loggedInUser.email,
      })
      setIsDetailsOpen(false)
      setFeedbackNote('')
      toast({ 
        title: feedbackType === 'rejected' ? 'Request Rejected' : 'Changes Requested', 
        description: 'Candidate status updated successfully.' 
      })
    } catch (e: any) {
      toast({ title: 'Failed to update', variant: 'destructive', description: e.message || 'Error occurred' })
    } finally {
      setIsSaving(false)
    }
  }

  // Handle Approval Action
  const handleApproveSubmit = async () => {
    if (!selectedRequest || !loggedInUser?.email) return
    if (!approveRole) {
      toast({ title: 'Role required', variant: 'destructive', description: 'Please assign a role template.' })
      return
    }
    setIsSaving(true)
    try {
      await approveRequest({
        requestId: selectedRequest._id,
        role: approveRole,
        siteId: approveSite === 'none' ? undefined : (approveSite as any),
        designation: approveDesignation || undefined,
        initialBalance: parseFloat(initialBalance) || 0,
        requestorEmail: loggedInUser.email,
      })
      setIsDetailsOpen(false)
      toast({ title: 'Join Request Approved', description: `User account created successfully for ${selectedRequest.fullName}.` })
    } catch (e: any) {
      toast({ title: 'Approval Failed', variant: 'destructive', description: e.message || 'Error occurred' })
    } finally {
      setIsSaving(false)
    }
  }

  // Filter requests
  const pendingRequests = joinRequests?.filter(r => r.status === 'pending' || r.status === 'changes_requested') || []
  const historyRequests = joinRequests?.filter(r => r.status === 'approved' || r.status === 'rejected') || []

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      {/* Header Banner */}
      <div className="relative p-6 sm:p-8 rounded-2xl bg-slate-950 text-white overflow-hidden shadow-2xl border border-white/5">
        <div className="absolute top-[-50%] right-[-10%] w-[40%] h-[200%] bg-primary/10 rounded-full blur-[100px]" />
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
              Candidate Gatekeeper
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight italic uppercase leading-tight">
              User <span className="text-primary italic">Invitations</span>
            </h1>
            <p className="text-slate-400 font-medium text-xs sm:text-sm max-w-lg italic">
              Create secure onboarding links, manage incoming applicants, and approve team integrations.
            </p>
          </div>
          <Button
            onClick={handleCreateInvite}
            className="h-12 px-6 bg-primary hover:bg-indigo-650 text-white font-black italic uppercase tracking-widest text-xs rounded-xl shadow-xl shadow-primary/20 transition-all shrink-0"
          >
            <UserPlus className="mr-2 h-4 w-4 shrink-0" /> Create Invite Link
          </Button>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('requests')}
          className={cn(
            "px-6 py-4 font-black italic uppercase tracking-widest text-xs border-b-2 transition-all flex items-center gap-2",
            activeTab === 'requests' 
              ? "border-primary text-primary" 
              : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          Pending Requests
          {pendingRequests.length > 0 && (
            <Badge className="bg-primary text-white border-none ml-1 font-bold text-[10px]">
              {pendingRequests.length}
            </Badge>
          )}
        </button>
        <button
          onClick={() => setActiveTab('invites')}
          className={cn(
            "px-6 py-4 font-black italic uppercase tracking-widest text-xs border-b-2 transition-all flex items-center gap-2",
            activeTab === 'invites' 
              ? "border-primary text-primary" 
              : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          Active Invite Links
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={cn(
            "px-6 py-4 font-black italic uppercase tracking-widest text-xs border-b-2 transition-all flex items-center gap-2",
            activeTab === 'history' 
              ? "border-primary text-primary" 
              : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          History Logs
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="space-y-6">
        {/* TAB 1: PENDING JOIN REQUESTS */}
        {activeTab === 'requests' && (
          <Card className="bg-white/40 dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl overflow-hidden">
            <CardHeader className="p-6 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white">Pending Requests</CardTitle>
              <CardDescription className="text-xs font-bold text-slate-500 uppercase tracking-widest">Awaiting verification, feedback, or role deployment</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {pendingRequests.length === 0 ? (
                <div className="py-20 text-center text-slate-500 italic font-medium">
                  <CheckCircle className="h-12 w-12 text-slate-300 dark:text-slate-800 mx-auto mb-4" />
                  No pending join requests at the moment.
                </div>
              ) : (
                <>
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-slate-800">
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Candidate</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Contact</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Position Requested</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Submitted</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Status</th>
                        <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {pendingRequests.map((request) => (
                        <tr key={request._id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              {request.profilePhotoStorageId ? (
                                <GetDocUrl storageId={request.profilePhotoStorageId}>
                                  {(url) => url ? (
                                    <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 border border-slate-200 dark:border-slate-800">
                                      <img src={url} alt={request.fullName} className="w-full h-full object-cover" />
                                    </div>
                                  ) : (
                                    <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black text-sm border border-primary/20">
                                      {request.fullName[0].toUpperCase()}
                                    </div>
                                  )}
                                </GetDocUrl>
                              ) : (
                                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black text-sm border border-primary/20">
                                  {request.fullName[0].toUpperCase()}
                                </div>
                              )}
                              <div className="flex flex-col">
                                <span className="font-black italic uppercase tracking-tight text-slate-900 dark:text-white leading-none">{request.fullName}</span>
                                <span className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-wider">Invite code: {request.inviteCode}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex flex-col text-[10px] font-bold text-slate-600 dark:text-slate-300">
                              <span className="flex items-center gap-1"><Mail className="h-3 w-3 text-slate-400" /> {request.email}</span>
                              <span className="flex items-center gap-1 mt-1"><Phone className="h-3 w-3 text-slate-400" /> {request.phone}</span>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex flex-col">
                              <span className="text-xs font-black uppercase tracking-tight text-slate-850 dark:text-white">{request.designation || 'Staff'}</span>
                              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                                {request.requestedRoleName || 'General Staff'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                              <Calendar className="h-3.5 w-3.5" />
                              {new Date(request.submittedAt).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <Badge className={cn(
                              "text-[8px] font-black uppercase tracking-widest border-none px-2 py-0.5",
                              request.status === 'pending' ? "bg-amber-500/10 text-amber-500" : "bg-indigo-500/10 text-indigo-500"
                            )}>
                              {request.status === 'changes_requested' ? 'Changes Asked' : request.status}
                            </Badge>
                          </td>
                          <td className="px-6 py-5 text-right">
                            <Button 
                              onClick={() => handleViewDetails(request)}
                              variant="outline" 
                              size="sm" 
                              className="h-9 px-4 border-slate-200 dark:border-slate-800 hover:bg-primary hover:text-white hover:border-primary font-black italic uppercase tracking-widest text-[9px] rounded-xl transition-all"
                            >
                              Review Candidate
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="lg:hidden divide-y divide-slate-100 dark:divide-slate-800 bg-white/20 dark:bg-slate-900/20">
                  {pendingRequests.map((request) => (
                    <div key={request._id} className="p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {request.profilePhotoStorageId ? (
                            <GetDocUrl storageId={request.profilePhotoStorageId}>
                              {(url) => url ? (
                                <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 border border-slate-200 dark:border-slate-800">
                                  <img src={url} alt={request.fullName} className="w-full h-full object-cover" />
                                </div>
                              ) : (
                                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black text-sm border border-primary/20">
                                  {request.fullName[0].toUpperCase()}
                                </div>
                              )}
                            </GetDocUrl>
                          ) : (
                            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black text-sm border border-primary/20">
                              {request.fullName[0].toUpperCase()}
                            </div>
                          )}
                          <div className="flex flex-col">
                            <span className="font-black italic uppercase tracking-tight text-slate-900 dark:text-white leading-none">{request.fullName}</span>
                            <span className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-wider">Code: {request.inviteCode}</span>
                          </div>
                        </div>
                        <Badge className={cn(
                          "text-[8px] font-black uppercase tracking-widest border-none px-2 py-0.5",
                          request.status === 'pending' ? "bg-amber-500/10 text-amber-500" : "bg-indigo-500/10 text-indigo-500"
                        )}>
                          {request.status === 'changes_requested' ? 'Changes Asked' : request.status}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl">
                        <div className="flex flex-col gap-1">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Email</span>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate max-w-[120px]">{request.email}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Phone</span>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 tabular-nums">{request.phone}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Position / Role</span>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{request.designation || 'Staff'} ({request.requestedRoleName || 'General Staff'})</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Submitted</span>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 tabular-nums">{new Date(request.submittedAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="pt-2 flex justify-end">
                        <Button 
                          onClick={() => handleViewDetails(request)}
                          variant="outline" 
                          size="sm" 
                          className="w-full h-10 border-slate-200 dark:border-slate-800 hover:bg-primary hover:text-white hover:border-primary font-black italic uppercase tracking-widest text-[9px] rounded-xl transition-all"
                        >
                          Review Candidate
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* TAB 2: ACTIVE INVITE LINKS */}
        {activeTab === 'invites' && (
          <Card className="bg-white/40 dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl overflow-hidden">
            <CardHeader className="p-6 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white">Active Invitations</CardTitle>
              <CardDescription className="text-xs font-bold text-slate-500 uppercase tracking-widest">Active recruitment gates and usage metrics</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {!invites || invites.length === 0 ? (
                <div className="py-20 text-center text-slate-500 italic font-medium">
                  <LinkIcon className="h-12 w-12 text-slate-300 dark:text-slate-800 mx-auto mb-4" />
                  No invite links created yet.
                </div>
              ) : (
                <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-slate-800">
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Invite Info</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Code</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Uses (Max)</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Expires</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Status</th>
                        <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {invites.map((invite) => {
                        const isExpired = Date.now() > invite.expiresAt;
                        const displayStatus = isExpired && invite.status === 'active' ? 'expired' : invite.status;

                        return (
                          <tr key={invite._id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                            <td className="px-6 py-5">
                              <div className="flex flex-col">
                                <span className="text-xs font-black uppercase tracking-tight text-slate-800 dark:text-white leading-none">
                                  {invite.inviteTitle || 'General Application'}
                                </span>
                                {invite.notes && (
                                  <span className="text-[9px] font-bold text-slate-400 mt-1 max-w-[200px] truncate uppercase">{invite.notes}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <code className="text-xs font-mono font-bold bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded text-primary">
                                {invite.inviteCode}
                              </code>
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                                {invite.maxUses >= 999999 ? (
                                  <span>{invite.usedCount} <span className="text-slate-400">/</span> ∞</span>
                                ) : (
                                  <span>{invite.usedCount} <span className="text-slate-400">/</span> {invite.maxUses}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                                <Clock className="h-3.5 w-3.5" />
                                {new Date(invite.expiresAt).toLocaleDateString()}
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <Badge className={cn(
                                "text-[8px] font-black uppercase tracking-widest border-none px-2 py-0.5",
                                displayStatus === 'active' ? "bg-emerald-500/10 text-emerald-500" :
                                displayStatus === 'used' ? "bg-blue-500/10 text-blue-500" :
                                "bg-rose-500/10 text-rose-500"
                              )}>
                                {displayStatus}
                              </Badge>
                            </td>
                            <td className="px-6 py-5 text-right space-x-2">
                              {displayStatus === 'active' && (
                                <>
                                  <Button 
                                    onClick={() => {
                                      navigator.clipboard.writeText(`${window.location.origin}/join/${invite.inviteCode}`)
                                      toast({ title: 'Link Copied', description: 'Invite URL copied to clipboard.' })
                                    }}
                                    variant="outline" 
                                    size="sm" 
                                    className="h-8 px-3 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-[9px] rounded-xl"
                                  >
                                    Copy Link
                                  </Button>
                                  <Button 
                                    onClick={() => handleRevokeInvite(invite._id)}
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-8 px-3 text-rose-500 hover:bg-rose-500/10 font-bold text-[9px] rounded-xl"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800 bg-white/20 dark:bg-slate-900/20">
                  {invites.map((invite) => {
                    const isExpired = Date.now() > invite.expiresAt;
                    const displayStatus = isExpired && invite.status === 'active' ? 'expired' : invite.status;

                    return (
                      <div key={invite._id} className="p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-xs font-black uppercase tracking-tight text-slate-800 dark:text-white leading-none">
                              {invite.inviteTitle || 'General Application'}
                            </span>
                            {invite.notes && (
                              <span className="text-[9px] font-bold text-slate-400 mt-1 max-w-[200px] truncate uppercase">{invite.notes}</span>
                            )}
                          </div>
                          <Badge className={cn(
                            "text-[8px] font-black uppercase tracking-widest border-none px-2 py-0.5",
                            displayStatus === 'active' ? "bg-emerald-500/10 text-emerald-500" :
                            displayStatus === 'used' ? "bg-blue-500/10 text-blue-500" :
                            "bg-rose-500/10 text-rose-500"
                          )}>
                            {displayStatus}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl">
                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Code</span>
                            <code className="text-xs font-mono font-bold text-primary align-middle self-start">{invite.inviteCode}</code>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Uses (Max)</span>
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                              {invite.maxUses >= 999999 ? `${invite.usedCount} / \u221E` : `${invite.usedCount} / ${invite.maxUses}`}
                            </span>
                          </div>
                          <div className="flex flex-col gap-1 col-span-2">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Expires</span>
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 tabular-nums flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {new Date(invite.expiresAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        {displayStatus === 'active' && (
                          <div className="pt-2 flex gap-2">
                            <Button 
                              onClick={() => {
                                navigator.clipboard.writeText(`${window.location.origin}/join/${invite.inviteCode}`)
                                toast({ title: 'Link Copied', description: 'Invite URL copied to clipboard.' })
                              }}
                              variant="outline" 
                              size="sm" 
                              className="flex-1 h-10 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-[9px] rounded-xl"
                            >
                              Copy Link
                            </Button>
                            <Button 
                              onClick={() => handleRevokeInvite(invite._id)}
                              variant="ghost" 
                              size="sm" 
                              className="h-10 px-3 text-rose-500 hover:bg-rose-500/10 font-bold text-[9px] rounded-xl border border-rose-500/20"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* TAB 3: HISTORY LOGS */}
        {activeTab === 'history' && (
          <Card className="bg-white/40 dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl overflow-hidden">
            <CardHeader className="p-6 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white">Audit History</CardTitle>
              <CardDescription className="text-xs font-bold text-slate-500 uppercase tracking-widest">Record of processed candidate onboarding transactions</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {historyRequests.length === 0 ? (
                <div className="py-20 text-center text-slate-500 italic font-medium">
                  <CheckCircle className="h-12 w-12 text-slate-300 dark:text-slate-800 mx-auto mb-4" />
                  No completed requests in history yet.
                </div>
              ) : (
                <>
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-slate-800">
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Candidate</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Position</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Processed On</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Audit Note</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Decision</th>
                        <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {historyRequests.map((request) => (
                        <tr key={request._id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                          <td className="px-6 py-5">
                            <div className="flex flex-col">
                              <span className="font-black italic uppercase tracking-tight text-slate-900 dark:text-white leading-none">{request.fullName}</span>
                              <span className="text-[9px] font-bold text-slate-400 mt-1">{request.email}</span>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex flex-col">
                              <span className="text-xs font-black uppercase tracking-tight text-slate-850 dark:text-white leading-none">{request.designation || 'Staff'}</span>
                              <span className="text-[9px] font-bold text-slate-500 uppercase mt-1">{request.requestedRoleName || 'Staff'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                              <Calendar className="h-3.5 w-3.5" />
                              {new Date(request.updatedAt).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <span className="text-[10px] font-medium text-slate-500 max-w-[200px] truncate block italic">
                              {request.ownerNote || 'No review remarks entered.'}
                            </span>
                          </td>
                          <td className="px-6 py-5">
                            <Badge className={cn(
                              "text-[8px] font-black uppercase tracking-widest border-none px-2 py-0.5",
                              request.status === 'approved' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                            )}>
                              {request.status}
                            </Badge>
                          </td>
                          <td className="px-6 py-5 text-right">
                            <Button 
                              onClick={() => handleViewDetails(request)}
                              variant="outline" 
                              size="sm" 
                              className="h-8 px-3 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-[9px] rounded-xl"
                            >
                              View Details
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="lg:hidden divide-y divide-slate-100 dark:divide-slate-800 bg-white/20 dark:bg-slate-900/20">
                  {historyRequests.map((request) => (
                    <div key={request._id} className="p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="font-black italic uppercase tracking-tight text-slate-900 dark:text-white leading-none">{request.fullName}</span>
                          <span className="text-[9px] font-bold text-slate-400 mt-1">{request.email}</span>
                        </div>
                        <Badge className={cn(
                          "text-[8px] font-black uppercase tracking-widest border-none px-2 py-0.5",
                          request.status === 'approved' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                        )}>
                          {request.status}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl">
                        <div className="flex flex-col gap-1">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Position</span>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{request.designation || 'Staff'} ({request.requestedRoleName || 'Staff'})</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Processed On</span>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 tabular-nums flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" /> {new Date(request.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1 col-span-2 border-t border-slate-200/50 dark:border-slate-800/50 pt-2">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Audit Note</span>
                          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 italic">
                            {request.ownerNote || 'No review remarks entered.'}
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 flex justify-end">
                        <Button 
                          onClick={() => handleViewDetails(request)}
                          variant="outline" 
                          size="sm" 
                          className="w-full h-10 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-[9px] rounded-xl"
                        >
                          View Details
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* MODAL 1: CREATE INVITE MODAL */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md bg-slate-950 border-slate-800 text-white p-0 overflow-hidden rounded-2xl">
          <div className="p-6 sm:p-8 bg-gradient-to-br from-indigo-500/20 to-transparent space-y-6">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter">Generate Onboarding Link</DialogTitle>
              <DialogDescription className="text-slate-400 text-xs italic">Create a secure temporary gateway link for candidate onboarding.</DialogDescription>
            </DialogHeader>

            {isSaving ? (
              <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
                <Loader2 className="animate-spin h-10 w-10 text-primary" />
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Generating invite code...</p>
              </div>
            ) : generatedInvite ? (
              <div className="space-y-4 py-4 animate-in zoom-in-95 duration-350">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-emerald-400">ONBOARDING URL GENERATED</Label>
                  <div className="flex items-center gap-2">
                    <Input 
                      readOnly 
                      value={generatedInvite.link}
                      className="bg-slate-900 border-slate-800 font-mono text-[10px] h-10 select-all"
                    />
                    <Button 
                      onClick={() => {
                        navigator.clipboard.writeText(generatedInvite.link)
                        toast({ title: 'Copied', description: 'Invite url copied successfully.' })
                      }}
                      className="bg-primary hover:bg-indigo-600 h-10 px-4"
                    >
                      Copy
                    </Button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsCreateOpen(false)}
                    className="flex-1 h-12 border-slate-800 font-black italic uppercase text-xs rounded-xl text-white hover:bg-slate-900"
                  >
                    Done
                  </Button>
                  <Button 
                    onClick={() => {
                      const text = encodeURIComponent(`Please complete your onboarding for Acme Interiors at: ${generatedInvite.link}`);
                      window.open(`https://wa.me/?text=${text}`, '_blank');
                    }}
                    className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-500 font-black italic uppercase text-xs rounded-xl"
                  >
                    Share via WhatsApp
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: CANDIDATE DETAIL REVIEW MODAL */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="w-[95vw] sm:max-w-3xl bg-slate-950 border-slate-800 text-white p-0 max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl">
          {selectedRequest && (
            <div className="p-6 sm:p-8 bg-gradient-to-br from-indigo-500/20 to-transparent space-y-8">
              <DialogHeader>
                <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6 pb-4 border-b border-white/5">
                  <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                    {selectedRequest.profilePhotoStorageId ? (
                      <GetDocUrl storageId={selectedRequest.profilePhotoStorageId}>
                        {(url) => url ? (
                          <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 border border-primary/20 shadow-xl">
                            <img src={url} alt={selectedRequest.fullName} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center font-black text-2xl shadow-xl shadow-primary/20">
                            {selectedRequest.fullName[0].toUpperCase()}
                          </div>
                        )}
                      </GetDocUrl>
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center font-black text-2xl shadow-xl shadow-primary/20">
                        {selectedRequest.fullName[0].toUpperCase()}
                      </div>
                    )}
                    <div>
                      <DialogTitle className="text-3xl font-black italic uppercase tracking-tighter">
                        {reviewStage === 'details' ? selectedRequest.fullName : 
                         reviewStage === 'approve' ? `Deploy Account` :
                         feedbackType === 'rejected' ? `Reject Applicant` :
                         `Request Corrections`}
                      </DialogTitle>
                      <DialogDescription className="text-slate-400 font-bold uppercase tracking-widest text-[9px] mt-1 flex flex-wrap items-center justify-center sm:justify-start gap-3">
                        <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5 text-slate-500" /> {selectedRequest.email}</span>
                        <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5 text-slate-500" /> {selectedRequest.phone}</span>
                      </DialogDescription>
                    </div>
                  </div>
                  <div className="text-center sm:text-right shrink-0">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">REQUEST STATUS</span>
                    <div className="mt-1">
                      <Badge className={cn(
                        "text-[9px] font-black uppercase tracking-widest border-none px-3 py-1",
                        selectedRequest.status === 'approved' ? "bg-emerald-500/10 text-emerald-500" :
                        selectedRequest.status === 'rejected' ? "bg-rose-500/10 text-rose-500" :
                        selectedRequest.status === 'changes_requested' ? "bg-indigo-500/10 text-indigo-500" :
                        "bg-amber-500/10 text-amber-500"
                      )}>
                        {selectedRequest.status === 'changes_requested' ? 'changes requested' : selectedRequest.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              {/* Dynamic Review Stages */}
              <AnimatePresence mode="wait">
                {reviewStage === 'details' && (
                  <motion.div
                    key="details"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-8"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
                      {/* Left col - Details */}
                      <div className="space-y-6">
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 border-b border-white/5 pb-2 text-primary">
                            <User className="h-4.5 w-4.5" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Candidate Profile</span>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="text-[9px] font-bold text-slate-500 uppercase block">Designation</span>
                              <span className="font-bold text-slate-200 mt-1 block">{selectedRequest.designation || 'Staff'}</span>
                            </div>
                            <div>
                              <span className="text-[9px] font-bold text-slate-500 uppercase block">Requested Role</span>
                              <span className="font-bold text-slate-200 mt-1 block">{selectedRequest.requestedRoleName || 'General Staff'}</span>
                            </div>
                            <div>
                              <span className="text-[9px] font-bold text-slate-500 uppercase block">Gender</span>
                              <span className="font-bold text-slate-200 mt-1 block">{selectedRequest.gender || 'Not Provided'}</span>
                            </div>
                            <div>
                              <span className="text-[9px] font-bold text-slate-500 uppercase block">Date of Birth</span>
                              <span className="font-bold text-slate-200 mt-1 block">{selectedRequest.dob || 'Not Provided'}</span>
                            </div>
                            <div>
                              <span className="text-[9px] font-bold text-slate-500 uppercase block">Blood Group</span>
                              <span className="font-bold text-slate-200 mt-1 block">{selectedRequest.bloodGroup || 'Not Provided'}</span>
                            </div>
                            <div>
                              <span className="text-[9px] font-bold text-slate-500 uppercase block">Joining Date</span>
                              <span className="font-bold text-slate-200 mt-1 block">{selectedRequest.joiningDate || 'ASAP'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center gap-2 border-b border-white/5 pb-2 text-primary">
                            <MapPin className="h-4.5 w-4.5" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Residential Location</span>
                          </div>
                          <p className="text-slate-300 text-xs italic font-medium leading-relaxed">
                            {selectedRequest.address || 'No residential address supplied.'}
                          </p>
                        </div>

                        <div className="space-y-4">
                          <div className="flex items-center gap-2 border-b border-white/5 pb-2 text-primary">
                            <Phone className="h-4.5 w-4.5" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Emergency Contact</span>
                          </div>
                          {selectedRequest.emergencyContactPhone ? (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                              <div>
                                <span className="text-[9px] font-bold text-slate-500 uppercase block">Contact Name</span>
                                <span className="font-bold text-slate-200 mt-1 block">{selectedRequest.emergencyContactName}</span>
                              </div>
                              <div>
                                <span className="text-[9px] font-bold text-slate-500 uppercase block">Relationship</span>
                                <span className="font-bold text-slate-200 mt-1 block">{selectedRequest.emergencyContactRelationship || 'Not Provided'}</span>
                              </div>
                              <div>
                                <span className="text-[9px] font-bold text-slate-500 uppercase block">Phone Number</span>
                                <span className="font-bold text-slate-200 mt-1 block">{selectedRequest.emergencyContactPhone}</span>
                              </div>
                            </div>
                          ) : (
                            <p className="text-slate-500 text-xs italic">No emergency contact supplied.</p>
                          )}
                        </div>
                      </div>

                      {/* Right col - Documents uploads */}
                      <div className="space-y-6">
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 border-b border-white/5 pb-2 text-primary">
                            <FileText className="h-4.5 w-4.5" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Uploaded Onboarding Files</span>
                          </div>

                          <div className="space-y-3">
                            {/* Resume File */}
                            {selectedRequest.resumeStorageId ? (
                              <GetDocUrl storageId={selectedRequest.resumeStorageId}>
                                {(url) => (
                                  <div className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-xl">
                                    <div className="flex items-center gap-3">
                                      <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
                                        <FileText className="h-5 w-5" />
                                      </div>
                                      <div className="flex flex-col min-w-0">
                                        <span className="text-xs font-black uppercase tracking-tight text-slate-200">Candidate Resume</span>
                                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-0.5">Required File</span>
                                      </div>
                                    </div>
                                    {url ? (
                                      <a 
                                        href={url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="h-8 px-3 bg-white/5 border border-white/10 hover:bg-primary hover:text-white rounded-lg flex items-center justify-center text-[10px] font-bold uppercase transition-all"
                                      >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                      </a>
                                    ) : (
                                      <span className="text-[9px] font-bold text-slate-500">Resolving...</span>
                                    )}
                                  </div>
                                )}
                              </GetDocUrl>
                            ) : (
                              <div className="p-4 bg-slate-900/50 border border-slate-800 border-dashed text-center text-xs text-slate-500 rounded-xl">
                                No Resume uploaded
                              </div>
                            )}

                            {/* Supporting Documents */}
                            <SupportingDocumentsList requestId={selectedRequest._id} />
                          </div>
                        </div>

                        {selectedRequest.ownerNote && (
                          <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-xl space-y-2">
                            <div className="flex items-center gap-2 text-indigo-400">
                              <MessageSquare className="h-4 w-4" />
                              <span className="text-[10px] font-black uppercase tracking-widest">Review Comments</span>
                            </div>
                            <p className="text-slate-300 text-xs italic font-medium leading-relaxed">
                              "{selectedRequest.ownerNote}"
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action buttons (Only for pending / changes_requested status) */}
                    {(selectedRequest.status === 'pending' || selectedRequest.status === 'changes_requested') && (
                      <div className="flex flex-wrap gap-3 pt-6 border-t border-white/5">
                        <Button
                          onClick={() => {
                            setApproveRole('')
                            setApproveSite('none')
                            setApproveDesignation(selectedRequest.designation || '')
                            setInitialBalance('0')
                            setReviewStage('approve')
                          }}
                          className="flex-1 h-14 bg-emerald-600 hover:bg-emerald-500 text-white font-black italic uppercase tracking-widest text-xs rounded-xl shadow-lg shadow-emerald-600/10"
                        >
                          Approve & Deploy User
                        </Button>
                        <Button
                          onClick={() => {
                            setFeedbackType('changes_requested')
                            setFeedbackNote('')
                            setReviewStage('feedback')
                          }}
                          className="flex-1 h-14 bg-indigo-600 hover:bg-indigo-500 text-white font-black italic uppercase tracking-widest text-xs rounded-xl shadow-lg shadow-indigo-600/10"
                        >
                          Request Details Correction
                        </Button>
                        <Button
                          onClick={() => {
                            setFeedbackType('rejected')
                            setFeedbackNote('')
                            setReviewStage('feedback')
                          }}
                          variant="ghost"
                          className="flex-1 h-14 text-rose-500 hover:bg-rose-500/10 font-black italic uppercase tracking-widest text-xs rounded-xl"
                        >
                          Reject Applicant
                        </Button>
                      </div>
                    )}
                  </motion.div>
                )}

                {reviewStage === 'approve' && (
                  <motion.div
                    key="approve"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.2 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm"
                  >
                    {/* Left: Summary Panel */}
                    <div className="space-y-5 p-5 rounded-2xl bg-white/5 border border-white/5">
                      <h3 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2 border-b border-white/5 pb-2">
                        <User className="h-4 w-4" /> Candidate Summary
                      </h3>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-[9px] font-bold text-slate-500 uppercase block">Designation</span>
                            <span className="font-bold text-slate-300 mt-0.5 block">{selectedRequest.designation || 'Staff'}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-slate-500 uppercase block">Requested Role</span>
                            <span className="font-bold text-slate-300 mt-0.5 block">{selectedRequest.requestedRoleName || 'General Staff'}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-slate-500 uppercase block">Joining Date</span>
                            <span className="font-bold text-slate-300 mt-0.5 block">{selectedRequest.joiningDate || 'ASAP'}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-slate-500 uppercase block">Gender</span>
                            <span className="font-bold text-slate-300 mt-0.5 block">{selectedRequest.gender || 'Not Provided'}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-slate-500 uppercase block">Date of Birth</span>
                            <span className="font-bold text-slate-300 mt-0.5 block">{selectedRequest.dob || 'Not Provided'}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-slate-500 uppercase block">Blood Group</span>
                            <span className="font-bold text-slate-300 mt-0.5 block">{selectedRequest.bloodGroup || 'Not Provided'}</span>
                          </div>
                        </div>
                        
                        <div className="border-t border-white/5 pt-3">
                          <span className="text-[9px] font-bold text-slate-500 uppercase block">Residential Location</span>
                          <span className="text-slate-300 text-xs italic mt-0.5 block leading-relaxed">
                            {selectedRequest.address || 'No residential address supplied.'}
                          </span>
                        </div>

                        {selectedRequest.emergencyContactPhone && (
                          <div className="border-t border-white/5 pt-3 text-xs">
                            <span className="text-[9px] font-bold text-slate-500 uppercase block">Emergency Contact</span>
                            <span className="font-bold text-slate-300 mt-0.5 block">
                              {selectedRequest.emergencyContactName} {selectedRequest.emergencyContactRelationship ? `(${selectedRequest.emergencyContactRelationship})` : ''} - {selectedRequest.emergencyContactPhone}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Approve Form */}
                    <div className="space-y-5">
                      <h3 className="text-xs font-black uppercase tracking-widest text-emerald-450 flex items-center gap-2 border-b border-white/5 pb-2 text-emerald-400">
                        <CheckCircle className="h-4 w-4" /> Deploy Onboarding Blueprint
                      </h3>
                      
                      <div className="space-y-4">
                        {/* Role Blueprint */}
                        <div className="space-y-1">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Assign Role Blueprint</Label>
                          <Select value={approveRole} onValueChange={setApproveRole}>
                            <SelectTrigger className="h-12 bg-white/5 border-white/10 rounded-xl text-xs font-bold">
                              <SelectValue placeholder="Select Role Template" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-xl">
                              {roles?.map(role => (
                                <SelectItem key={role._id} value={role.name} className="text-xs uppercase font-bold py-2.5">
                                  {role.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Project / Site */}
                        <div className="space-y-1">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Assign Project / Site</Label>
                          <Select value={approveSite} onValueChange={setApproveSite}>
                            <SelectTrigger className="h-12 bg-white/5 border-white/10 rounded-xl text-xs font-bold">
                              <SelectValue placeholder="Select Site Context" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-xl">
                              <SelectItem value="none" className="text-xs uppercase font-bold py-2.5">Central Head Office</SelectItem>
                              {sites?.map(site => (
                                <SelectItem key={site._id} value={site._id} className="text-xs uppercase font-bold py-2.5">
                                  {site.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Designation */}
                        <div className="space-y-1">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Operative Designation</Label>
                          <Input 
                            placeholder="e.g. Interior Designer Associate" 
                            value={approveDesignation}
                            onChange={(e) => setApproveDesignation(e.target.value)}
                            className="h-12 bg-white/5 border-white/10 rounded-xl text-xs font-bold"
                          />
                        </div>

                        {/* Initial Balance */}
                        <div className="space-y-1">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Initial Wallet Balance (₹)</Label>
                          <Input 
                            type="number"
                            placeholder="0" 
                            value={initialBalance}
                            onChange={(e) => setInitialBalance(e.target.value)}
                            className="h-12 bg-white/5 border-white/10 rounded-xl text-xs font-bold"
                          />
                          <span className="text-[8px] text-slate-500 uppercase tracking-wider block mt-1 italic leading-relaxed">
                            Note: Non-zero values will be deducted atomically from the Company vault balance.
                          </span>
                        </div>
                      </div>
                      
                      {/* Approval Stage Buttons */}
                      <div className="flex gap-3 pt-4 border-t border-white/5">
                        <Button 
                          variant="ghost" 
                          onClick={() => setReviewStage('details')}
                          className="flex-1 h-12 border-none text-slate-400 hover:text-white font-black uppercase tracking-wider text-xs rounded-xl"
                        >
                          Back
                        </Button>
                        <Button 
                          onClick={handleApproveSubmit}
                          disabled={isSaving}
                          className="flex-2 h-12 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-black italic uppercase tracking-widest text-xs rounded-xl"
                        >
                          {isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : 'Confirm Onboarding'}
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {reviewStage === 'feedback' && (
                  <motion.div
                    key="feedback"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.2 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm"
                  >
                    {/* Left: Summary Panel */}
                    <div className="space-y-5 p-5 rounded-2xl bg-white/5 border border-white/5">
                      <h3 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2 border-b border-white/5 pb-2">
                        <User className="h-4 w-4" /> Candidate Summary
                      </h3>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-[9px] font-bold text-slate-500 uppercase block">Designation</span>
                            <span className="font-bold text-slate-300 mt-0.5 block">{selectedRequest.designation || 'Staff'}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-slate-500 uppercase block">Requested Role</span>
                            <span className="font-bold text-slate-300 mt-0.5 block">{selectedRequest.requestedRoleName || 'General Staff'}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-slate-500 uppercase block">Joining Date</span>
                            <span className="font-bold text-slate-300 mt-0.5 block">{selectedRequest.joiningDate || 'ASAP'}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-slate-500 uppercase block">Gender</span>
                            <span className="font-bold text-slate-300 mt-0.5 block">{selectedRequest.gender || 'Not Provided'}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-slate-500 uppercase block">Date of Birth</span>
                            <span className="font-bold text-slate-300 mt-0.5 block">{selectedRequest.dob || 'Not Provided'}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-slate-500 uppercase block">Blood Group</span>
                            <span className="font-bold text-slate-300 mt-0.5 block">{selectedRequest.bloodGroup || 'Not Provided'}</span>
                          </div>
                        </div>
                        
                        <div className="border-t border-white/5 pt-3">
                          <span className="text-[9px] font-bold text-slate-500 uppercase block">Residential Location</span>
                          <span className="text-slate-300 text-xs italic mt-0.5 block leading-relaxed">
                            {selectedRequest.address || 'No residential address supplied.'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Feedback Form */}
                    <div className="space-y-5">
                      <h3 className={cn(
                        "text-xs font-black uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-2",
                        feedbackType === 'rejected' ? "text-rose-400" : "text-indigo-400"
                      )}>
                        <MessageSquare className="h-4 w-4" /> 
                        {feedbackType === 'rejected' ? 'Rejection Remarks' : 'Correction Instructions'}
                      </h3>
                      
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Remarks & Instruction Note</Label>
                          <Textarea 
                            placeholder={feedbackType === 'rejected' 
                              ? "Specify reason for rejection (e.g. credentials incorrect or profile review failed)" 
                              : "e.g. Please upload a clear ID Proof PDF. The current copy is blurry."}
                            value={feedbackNote}
                            onChange={(e) => setFeedbackNote(e.target.value)}
                            className="bg-white/5 border-white/10 rounded-xl text-xs font-medium min-h-[140px]"
                          />
                        </div>
                      </div>

                      {/* Feedback Stage Buttons */}
                      <div className="flex gap-3 pt-4 border-t border-white/5">
                        <Button 
                          variant="ghost" 
                          onClick={() => setReviewStage('details')}
                          className="flex-1 h-12 border-none text-slate-400 hover:text-white font-black uppercase tracking-wider text-xs rounded-xl"
                        >
                          Back
                        </Button>
                        <Button 
                          onClick={handleFeedbackSubmit}
                          disabled={isSaving}
                          className={cn(
                            "flex-2 h-12 px-6 font-black italic uppercase tracking-widest text-xs rounded-xl",
                            feedbackType === 'rejected' ? "bg-rose-600 hover:bg-rose-500" : "bg-primary hover:bg-indigo-600"
                          )}
                        >
                          {isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : 'Confirm Submit'}
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Helper component to resolve file storage URLs
function GetDocUrl({ storageId, children }: { storageId: string; children: (url: string | null) => React.ReactNode }) {
  const url = useQuery(api.users.getUserProfileImageUrl, { storageId })
  return <>{children(url || null)}</>
}

// Subcomponent to list supporting uploads for a candidate request
function SupportingDocumentsList({ requestId }: { requestId: string }) {
  const { user } = useContext(UserContext)
  const data = useQuery(api.joinRequests.getJoinRequestDetails, {
    requestId: requestId as any,
    requestorEmail: user?.email || '',
  })

  if (!data?.documents || data.documents.length === 0) {
    return null
  }

  return (
    <>
      {data.documents.map((doc: any) => (
        <GetDocUrl key={doc._id} storageId={doc.storageId}>
          {(url) => (
            <div className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-black uppercase tracking-tight text-slate-200 truncate max-w-[150px]">
                    {doc.documentTitle}
                  </span>
                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-0.5">
                    {doc.documentType || 'Supporting'} • {(doc.fileSize / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
              </div>
              {url ? (
                <a 
                  href={url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="h-8 px-3 bg-white/5 border border-white/10 hover:bg-primary hover:text-white rounded-lg flex items-center justify-center text-[10px] font-bold uppercase transition-all"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : (
                <span className="text-[9px] font-bold text-slate-500">Resolving...</span>
              )}
            </div>
          )}
        </GetDocUrl>
      ))}
    </>
  )
}
