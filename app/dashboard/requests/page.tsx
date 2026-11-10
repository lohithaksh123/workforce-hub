'use client'

import { useState, useContext, useEffect } from 'react'
import { UserContext } from '@/components/dashboard/UserContext'
import { AlertCircle, CheckCircle, XCircle, Clock, Plus, Loader2 } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { cn, normalizeWalletUserId } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"

export default function TransactionRequestsPage() {
  const requests = useQuery(api.requests.getRequests)
  const createRequest = useMutation(api.requests.createRequest)
  const updateStatus = useMutation(api.requests.updateRequestStatus)
  const { user } = useContext(UserContext)
  
  const hasPermission = (name: string) => {
    if (user?.role === 'Owner') return true;
    if (!user || !Array.isArray(user.permissions)) return false
    return user.permissions.find((p: any) => p.key === name || p.name === name)?.allowed || false
  }

  const sites = useQuery(api.sites.getSites)
  const wallets = useQuery(api.wallets.getWallets)
  
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED'>('ALL')
  const [requestTypeFilter, setRequestTypeFilter] = useState<'all' | 'expense_request' | 'wallet_fund_request'>('all')
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    purpose: '',
    vendor: '',
    amount: '',
    method: 'Cash',
    description: '',
    requestedBy: user?.name || 'Team Member',
    requesterUserId: (user as any)?._id || '',
    requestType: 'expense_request' as 'expense_request' | 'wallet_fund_request',
    siteId: '',
    walletType: 'Company' as 'Company' | 'Site' | 'Team',
    teamMemberId: '',
    category: 'Material'
  })

  // Sync user name when context loads
  useEffect(() => {
    if (user?.name) {
      setFormData(prev => ({
        ...prev,
        requestedBy: user.name,
        requesterUserId: (user as any)?._id
      }))
    }
  }, [user])

  // Watch for site selection to reset wallet type
  const selectedSite = useQuery(api.sites.getSiteById, formData.siteId ? { id: formData.siteId as Id<"sites"> } : "skip")

  const canApprove = hasPermission('approve_transactions')

  const visibleRequests = requests?.filter((req) => {
    const normUserName = normalizeWalletUserId(user?.name || '')
    const isOwnRequest = 
      ((user as any)?._id && req.requesterUserId === (user as any)._id) || 
      (user?.name && normalizeWalletUserId(req.requested_by || '') === normUserName) || 
      (user?.name && normalizeWalletUserId(req.requesterName || '') === normUserName);

    return canApprove || isOwnRequest;
  })

  const filteredRequests = visibleRequests?.filter((req) => {
    const matchesStatus = filter === 'ALL' || req.status === filter;
    const matchesType = requestTypeFilter === 'all' || (req.requestType || 'expense_request') === requestTypeFilter;
    return matchesStatus && matchesType;
  })

  const handleCreate = async () => {
    if (!formData.purpose || !formData.amount) return
    setRequestError(null)
    setIsSaving(true)
    try {
      let walletId = undefined
      if (formData.walletType === 'Site' && selectedSite?.wallet) {
        walletId = selectedSite.wallet._id
      } else if (formData.walletType === 'Team' && formData.teamMemberId) {
        const tw = selectedSite?.teamWallets?.find((w: any) => w.userId === formData.teamMemberId)
        if (tw) walletId = (tw as any)._id
      }

      // For Fund Requests, find the requester's wallet ID
      let targetWalletId = undefined
      if (formData.requestType === 'wallet_fund_request') {
        const myWallet = wallets?.find(w => normalizeWalletUserId(w.userId) === normalizeWalletUserId(user?.name || ''))
        if (myWallet && !String(myWallet._id).startsWith('virtual_')) {
          targetWalletId = myWallet._id
        }
      }

      const result = await createRequest({
        purpose: formData.purpose,
        vendor_name: formData.requestType === 'expense_request' ? formData.vendor : 'Company Vault',
        amount: parseFloat(formData.amount),
        payment_method: formData.requestType === 'expense_request' ? formData.method : 'Internal Transfer',
        description: formData.description,
        requested_by: formData.requestedBy,
        requesterUserId: (user as any)?._id,
        requesterName: user?.name,
        requestType: formData.requestType,
        siteId: formData.siteId ? (formData.siteId as Id<"sites">) : undefined,
        siteName: sites?.find(s => s._id === formData.siteId)?.name,
        walletId: walletId as any,
        targetWalletId: targetWalletId,
        category: formData.category
      })

      if (result.success) {
        setIsAddOpen(false)
        setFormData({ 
          purpose: '', vendor: '', amount: '', method: 'Cash', description: '', 
          requestedBy: user?.name || 'Team Member', requesterUserId: (user as any)?._id || '',
          requestType: 'expense_request', siteId: '', walletType: 'Company', 
          teamMemberId: '', category: 'Material' 
        })
        toast({ title: "Success", description: "Request submitted for approval" })
      } else {
        setRequestError(result.error || "Failed to submit request")
      }
    } catch (e) {
      console.error("Request creation error:", e)
      setRequestError("A system error occurred. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdateStatus = async (id: Id<"transaction_requests">, status: 'APPROVED' | 'REJECTED' | 'COMPLETED', requestInfo?: any) => {
    if (status === 'APPROVED' && requestInfo?.requestType === 'wallet_fund_request') {
      if (!confirm(`Are you about to credit ₹${requestInfo.amount.toLocaleString()} to ${requestInfo.requested_by}'s wallet from Company Vault?`)) {
        return;
      }
    }

    try {
      const result = await updateStatus({ id, status, approved_by: user.name })
      if (result.success) {
        const msg = status === 'COMPLETED' ? "Request finalized and recorded" : 
                    (requestInfo?.requestType === 'wallet_fund_request' && status === 'APPROVED') ? "Funds credited to wallet" : `Request ${status.toLowerCase()}`;
        toast({ title: "Success", description: msg })
      } else {
        toast({ title: "Update Failed", variant: "destructive", description: result.error || "Could not update request status" })
      }
    } catch (e) {
      toast({ title: "Error", variant: "destructive", description: "A system error occurred" })
    }
  }

  const stats = {
    pending: visibleRequests?.filter(r => r.status === 'PENDING').length ?? 0,
    approved: visibleRequests?.filter(r => r.status === 'APPROVED').length ?? 0,
    rejected: visibleRequests?.filter(r => r.status === 'REJECTED').length ?? 0,
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 w-full min-w-0 pr-0 md:pr-10">
        <div className="text-center md:text-left">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white uppercase italic tracking-tighter leading-tight">Transaction Requests</h1>
          <p className="text-muted-foreground mt-1 font-medium italic text-xs sm:text-sm md:text-base mx-auto md:mx-0 max-w-lg">Team spending and fund requests awaiting approval</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={(v) => { setIsAddOpen(v); if(!v) setRequestError(null) }}>
          <DialogTrigger asChild>
            <Button className="w-full md:w-auto h-12 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black rounded-xl shadow-xl transition-all active:scale-95 px-6 italic uppercase tracking-widest text-xs">
              <Plus className="mr-2 h-5 w-5" />
              NEW REQUEST
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] sm:max-w-[550px] rounded-3xl border-none shadow-2xl p-0 max-h-[90vh] overflow-y-auto bg-slate-950 text-white">
            <ScrollArea className="max-h-[90vh]">
              <div className="p-6 sm:p-8">
                <DialogHeader className="mb-6">
                  <DialogTitle className="text-2xl font-black uppercase italic italic tracking-tighter">New Intelligence Unit Request</DialogTitle>
                  <DialogDescription className="text-slate-400 font-medium italic">Submit a request for owner approval.</DialogDescription>
                </DialogHeader>

                {requestError && (
                  <Alert variant="destructive" className="mt-4 bg-rose-500/10 border-rose-500/50 text-rose-500 rounded-2xl">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle className="font-black uppercase text-[10px] tracking-widest">Protocol Breach</AlertTitle>
                    <AlertDescription className="text-xs font-bold leading-relaxed">
                      {requestError}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-5 py-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Request Type</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => setFormData({...formData, requestType: 'expense_request'})}
                        className={cn(
                          "flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2",
                          formData.requestType === 'expense_request' 
                            ? "bg-primary/10 border-primary text-white" 
                            : "bg-white/5 border-white/5 text-slate-500 hover:bg-white/10"
                        )}
                      >
                        <div className={cn("w-2 h-2 rounded-full", formData.requestType === 'expense_request' ? "bg-primary" : "bg-slate-700")} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Expense Request</span>
                      </button>
                      <button 
                        onClick={() => setFormData({...formData, requestType: 'wallet_fund_request'})}
                        className={cn(
                          "flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all gap-2",
                          formData.requestType === 'wallet_fund_request' 
                            ? "bg-amber-500/10 border-amber-500 text-white" 
                            : "bg-white/5 border-white/5 text-slate-500 hover:bg-white/10"
                        )}
                      >
                        <div className={cn("w-2 h-2 rounded-full", formData.requestType === 'wallet_fund_request' ? "bg-amber-500" : "bg-slate-700")} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Wallet Fund Request</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Purpose / Reason</Label>
                      <Input 
                        placeholder={formData.requestType === 'expense_request' ? "e.g. Office Supplies" : "e.g. Site Travel Funds"} 
                        className="h-14 bg-white/5 border-white/10 rounded-2xl font-bold" 
                        value={formData.purpose} 
                        onChange={e => setFormData({...formData, purpose: e.target.value})} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Amount (₹)</Label>
                      <Input 
                        type="number" 
                        placeholder="0.00" 
                        className="h-14 bg-white/5 border-white/10 rounded-2xl font-bold" 
                        value={formData.amount} 
                        onChange={e => setFormData({...formData, amount: e.target.value})} 
                      />
                    </div>
                  </div>

                  {formData.requestType === 'expense_request' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Vendor Name</Label>
                        <Input 
                          placeholder="e.g. Amazon" 
                          className="h-14 bg-white/5 border-white/10 rounded-2xl font-bold" 
                          value={formData.vendor} 
                          onChange={e => setFormData({...formData, vendor: e.target.value})} 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Payment Method</Label>
                        <Select value={formData.method} onValueChange={v => setFormData({...formData, method: v})}>
                          <SelectTrigger className="h-14 bg-white/5 border-white/10 rounded-2xl font-bold"><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-2xl">
                            <SelectItem value="Cash">Cash</SelectItem>
                            <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                            <SelectItem value="Cheque">Cheque</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4 pt-2 border-t border-white/5">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Project Site (Optional)</Label>
                        <Select 
                            value={formData.siteId || "GENERAL"} 
                            onValueChange={v => setFormData({...formData, siteId: v === "GENERAL" ? "" : v, walletType: v === "GENERAL" ? "Company" : "Site"})}
                        >
                            <SelectTrigger className="h-14 bg-white/5 border-white/10 rounded-2xl font-bold"><SelectValue placeholder="General Office / Non-Project" /></SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-2xl">
                                <SelectItem value="GENERAL">General Office / Non-Project</SelectItem>
                                {sites?.map(s => <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    {formData.siteId && formData.requestType === 'expense_request' && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Wallet Context</Label>
                                <Select 
                                    value={formData.walletType} 
                                    onValueChange={v => setFormData({...formData, walletType: v as any})}
                                >
                                    <SelectTrigger className="h-14 bg-white/5 border-white/10 rounded-2xl font-bold"><SelectValue /></SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-2xl">
                                        <SelectItem value="Site">Site Wallet</SelectItem>
                                        <SelectItem value="Team">Staff Wallet</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Category</Label>
                                <Select value={formData.category} onValueChange={v => setFormData({...formData, category: v})}>
                                    <SelectTrigger className="h-14 bg-white/5 border-white/10 rounded-2xl font-bold"><SelectValue /></SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-2xl">
                                        <SelectItem value="Material">Material</SelectItem>
                                        <SelectItem value="Labor">Labor</SelectItem>
                                        <SelectItem value="Design">Design</SelectItem>
                                        <SelectItem value="Other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}

                    {formData.walletType === 'Team' && formData.requestType === 'expense_request' && (
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Select Staff</Label>
                            <Select 
                                value={formData.teamMemberId} 
                                onValueChange={v => setFormData({...formData, teamMemberId: v})}
                                required
                            >
                                <SelectTrigger className="h-14 bg-white/5 border-white/10 rounded-2xl font-bold">
                                    <SelectValue placeholder="Which staff member's wallet?" />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-2xl">
                                    {selectedSite?.teamWallets?.map((w: any) => (
                                        <SelectItem key={w._id || w.userId} value={w.userId}>
                                            {w.userId} (₹{w.balance.toLocaleString()})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Description / Notes</Label>
                    <Textarea 
                      placeholder="Detailed justification for this request..." 
                      className="bg-white/5 border-white/10 rounded-2xl font-bold min-h-[100px]" 
                      value={formData.description} 
                      onChange={e => setFormData({...formData, description: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Requested By</Label>
                    <Input className="h-14 bg-white/5 border-white/10 rounded-2xl font-bold" value={formData.requestedBy} readOnly />
                  </div>
                </div>
                <DialogFooter className="pt-6 border-t border-white/5">
                  <Button onClick={handleCreate} className="w-full h-16 bg-primary hover:bg-primary/90 text-white font-black rounded-2xl shadow-xl transition-all active:scale-95 italic uppercase tracking-widest text-sm" disabled={isSaving}>
                    {isSaving ? <Loader2 className="animate-spin h-6 w-6 mr-2" /> : "Transmit Request"}
                  </Button>
                </DialogFooter>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card className="border-none shadow-md bg-white dark:bg-zinc-900 border-l-4 border-amber-500">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Pending</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-black">{stats.pending}</div></CardContent>
        </Card>
        <Card className="border-none shadow-md bg-white dark:bg-zinc-900 border-l-4 border-primary">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Approved</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-black text-primary">{stats.approved}</div></CardContent>
        </Card>
        <Card className="border-none shadow-md bg-white dark:bg-zinc-900 border-l-4 border-rose-500">
          <CardHeader className="pb-3"><CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Rejected</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-black text-rose-600">{stats.rejected}</div></CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex flex-wrap gap-2">
          {(['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'COMPLETED'] as const).map((s) => (
            <Button 
              key={s} 
              variant={filter === s ? 'default' : 'outline'} 
              size="sm" 
              onClick={() => setFilter(s)} 
              className={cn("capitalize font-bold px-6 rounded-xl transition-all", filter === s && "bg-primary text-white shadow-lg shadow-primary/20")}
            >
              {s.toLowerCase()}
            </Button>
          ))}
        </div>

        <Select value={requestTypeFilter} onValueChange={(v: any) => setRequestTypeFilter(v)}>
          <SelectTrigger className="w-[200px] h-10 rounded-xl font-bold bg-white dark:bg-zinc-900 border-none shadow-sm">
            <SelectValue placeholder="All Request Types" />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-2xl">
            <SelectItem value="all">All Request Types</SelectItem>
            <SelectItem value="expense_request">Expense Requests</SelectItem>
            <SelectItem value="wallet_fund_request">Fund Requests</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {!requests ? (
          <div className="text-center py-20"><Loader2 className="animate-spin h-10 w-10 mx-auto text-primary" /></div>
        ) : filteredRequests?.length === 0 ? (
          <Card className="border-none shadow-sm bg-white dark:bg-zinc-900/50"><CardContent className="py-20 text-center text-muted-foreground font-medium uppercase tracking-widest text-xs italic">No operational requests found</CardContent></Card>
        ) : (
          filteredRequests?.map((req) => (
            <Card key={req._id} className={cn("overflow-hidden hover:shadow-lg transition-all border-none shadow-sm dark:bg-zinc-900 group", req.status === 'PENDING' ? "border-l-4 border-amber-500" : req.status === 'APPROVED' ? "border-l-4 border-primary" : req.status === 'COMPLETED' ? "border-l-4 border-emerald-500" : "border-l-4 border-rose-500")}>
              <CardContent className="p-5 sm:p-6">
                <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-black text-2xl tracking-tighter italic italic group-hover:text-primary transition-colors">₹{req.amount.toLocaleString()}</span>
                      <div className="flex gap-2">
                        <Badge variant="outline" className={cn(
                          "font-black uppercase text-[9px] tracking-widest px-2 py-0.5 rounded-lg border",
                          req.requestType === 'wallet_fund_request' ? "border-amber-500/30 bg-amber-500/5 text-amber-500" : "border-primary/30 bg-primary/5 text-primary"
                        )}>
                          {req.requestType === 'wallet_fund_request' ? "Fund Request" : "Expense Request"}
                        </Badge>
                        <Badge className={cn(
                          "capitalize font-black text-[9px] tracking-widest px-2 py-0.5 rounded-lg border-none", 
                          req.status === 'APPROVED' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 
                          req.status === 'COMPLETED' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' :
                          req.status === 'REJECTED' ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 
                          'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-500'
                        )}>
                          {req.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="font-black text-slate-900 dark:text-slate-100 uppercase italic tracking-tight flex items-center gap-2">
                        {req.purpose}
                        {req.requestType === 'expense_request' && <span className="text-slate-400 dark:text-slate-500 font-medium not-italic text-sm">/ {req.vendor_name} ({req.payment_method})</span>}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-400 font-medium italic leading-relaxed">{req.description}</p>
                    </div>
                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-[10px] text-slate-500 dark:text-slate-500 uppercase tracking-widest font-black mt-4">
                      <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-slate-400" /> By: {req.requested_by}</span>
                      <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Date: {new Date(req.created_at).toLocaleDateString()}</span>
                      {req.siteId && (
                        <span className="text-primary font-black sm:border-l sm:pl-6 border-slate-200 dark:border-white/5 whitespace-nowrap flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary" /> SITE: {sites?.find(s => s._id === req.siteId)?.name || req.siteName || 'Loading...'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto mt-4 md:mt-0 pt-6 md:pt-0 border-t md:border-t-0 border-white/5">
                    {req.status === 'PENDING' && hasPermission('approve_transactions') && (
                      <>
                        <Button 
                          onClick={() => handleUpdateStatus(req._id, 'APPROVED', req)} 
                          className="h-12 bg-primary hover:bg-indigo-600 text-white font-black italic uppercase tracking-widest text-[10px] rounded-xl shadow-lg shadow-primary/20 px-8 transition-all active:scale-95"
                        >
                          Approve {req.requestType === 'wallet_fund_request' ? '& Credit' : ''}
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => handleUpdateStatus(req._id, 'REJECTED')} 
                          className="h-12 text-rose-500 border-rose-500/30 bg-rose-500/5 hover:bg-rose-500 hover:text-white font-black italic uppercase tracking-widest text-[10px] rounded-xl transition-all active:scale-95 px-8"
                        >
                          Reject
                        </Button>
                      </>
                    )}
                    {req.status === 'APPROVED' && hasPermission('approve_transactions') && req.requestType !== 'wallet_fund_request' && (
                      <Button 
                        onClick={() => handleUpdateStatus(req._id, 'COMPLETED')} 
                        className="h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-black italic uppercase tracking-widest text-[10px] rounded-xl shadow-lg shadow-emerald-500/20 px-8 transition-all active:scale-95"
                      >
                        Mark Completed & Deduct
                      </Button>
                    )}
                    {req.status === 'COMPLETED' && (
                       <Badge className="h-12 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-black italic uppercase tracking-widest text-[10px] rounded-xl px-8 flex items-center justify-center">
                          <CheckCircle className="h-4 w-4 mr-2" /> Protocol Finalized
                       </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
