'use client'

import { useState, useContext } from 'react'
import { UserContext } from '@/components/dashboard/UserContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Check, X, MessageCircle, AlertCircle, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { toast } from '@/hooks/use-toast'

export default function ApprovalsPage() {
  const requests = useQuery(api.requests.getRequests)
  const updateStatus = useMutation(api.requests.updateRequestStatus)
  const [isSaving, setIsSaving] = useState(false)
  const { user } = useContext(UserContext)

  const hasPermission = (name: string) => {
    if (user?.role === 'Owner') return true;
    if (!user || !Array.isArray(user.permissions)) return false
    return user.permissions.find((p: any) => p.key === name || p.name === name)?.allowed || false
  }

  const pendingRequests = requests?.filter(r => r.status === 'PENDING') || []

  const handleUpdate = async (id: any, status: 'APPROVED' | 'REJECTED') => {
    setIsSaving(true)
    try {
      await updateStatus({ id, status, approved_by: 'Owner' })
      toast({ title: "Success", description: `Request ${status}` })
    } catch (e) {
      toast({ title: "Error", variant: "destructive", description: "Failed to update status" })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 w-full min-w-0 pr-0 md:pr-10">
        <div className="text-center md:text-left">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white uppercase italic tracking-tighter leading-tight">Approvals Queue</h1>
          <p className="text-muted-foreground mt-1 font-medium italic text-xs sm:text-sm md:text-base mx-auto md:mx-0 max-w-lg">Owner review for office spending requests</p>
        </div>
      </div>

      {!requests ? (
        <div className="flex justify-center py-10 text-muted-foreground"><Loader2 className="animate-spin h-8 w-8 mr-2" /> Loading queue...</div>
      ) : pendingRequests.length === 0 ? (
        <Card className="rounded-3xl border-none shadow-sm bg-white dark:bg-slate-900">
          <CardContent className="py-16 text-center text-muted-foreground">
            <Check className="h-12 w-12 mx-auto mb-4 text-emerald-500" />
            <p className="text-lg font-black uppercase tracking-widest text-slate-400">All caught up!</p>
            <p className="text-sm font-medium italic mt-2">No pending spending requests in the queue.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          <Card className="bg-amber-500/5 border-amber-500/10 rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest text-amber-600">Attention Required</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black text-amber-600 tabular-nums">
                ₹{pendingRequests.reduce((sum, r) => sum + r.amount, 0).toLocaleString()}
              </div>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1">{pendingRequests.length} requests pending</p>
            </CardContent>
          </Card>

          {pendingRequests.map((req) => (
            <Card key={req._id} className="rounded-2xl border-none shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
              <CardHeader className="p-6 pb-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-amber-500/10 p-3 rounded-2xl shrink-0"><AlertCircle className="h-6 w-6 text-amber-500" /></div>
                    <div>
                      <CardTitle className="text-xl font-black text-slate-900 dark:text-white leading-tight">{req.purpose}</CardTitle>
                      <CardDescription className="font-bold text-xs italic">Requested by {req.requested_by}</CardDescription>
                    </div>
                  </div>
                  <div className="text-left sm:text-right bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl sm:bg-transparent sm:p-0">
                    <div className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">₹{req.amount.toLocaleString()}</div>
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">{new Date(req.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-6">
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl text-sm text-slate-600 dark:text-slate-400 italic font-medium">
                    "{req.description}"
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-[10px] font-black uppercase tracking-widest">
                    <div><span className="text-slate-400">Vendor:</span> <span className="text-primary">{req.vendor_name}</span></div>
                    <div><span className="text-slate-400">Payment:</span> <span className="text-slate-900 dark:text-white">{req.payment_method}</span></div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-slate-100 dark:border-slate-800">
                    {hasPermission('approve_transactions') ? (
                      <>
                        <Button onClick={() => handleUpdate(req._id, 'APPROVED')} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-black h-12 rounded-xl text-xs" disabled={isSaving}>
                          <Check className="h-4 w-4 mr-2" /> APPROVE
                        </Button>
                        <Dialog >
                          <DialogTrigger asChild>
                            <Button variant="outline" className="flex-1 border-rose-500/20 text-rose-500 hover:bg-rose-500/10 font-black h-12 rounded-xl text-xs">
                              <X className="h-4 w-4 mr-2" /> REJECT
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle className="font-black uppercase italic tracking-tighter">Reject Request</DialogTitle>
                              <DialogDescription className="font-medium italic">Reason for rejecting {req.purpose} (₹{req.amount})</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <Textarea placeholder="e.g., Budget exceeded, or need more details" className="rounded-xl border-none bg-slate-50 dark:bg-slate-800 font-medium italic" />
                            </div>
                            <DialogFooter>
                              <Button onClick={() => handleUpdate(req._id, 'REJECTED')} variant="destructive" className="w-full h-12 rounded-xl font-black uppercase tracking-widest text-xs" disabled={isSaving}>Confirm Rejection</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </>
                    ) : (
                      <div className="flex-1 text-center py-3 text-[10px] font-black text-rose-500 bg-rose-500/10 rounded-xl uppercase tracking-widest border border-rose-500/20">
                         <AlertCircle className="h-4 w-4 inline mr-1" />
                         Approval Access Restricted
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
