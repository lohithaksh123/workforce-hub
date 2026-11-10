'use client'

import { useState } from 'react'
import { Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/dashboard/data-table'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { toast } from '@/hooks/use-toast'

const categories = ['Material', 'Labor', 'Design', 'Other']

export default function VendorsPage() {
  const vendors = useQuery(api.users.getVendors)
  const createVendor = useMutation(api.users.createVendor)
  const updateVendor = useMutation(api.users.updateVendor)
  const removeVendor = useMutation(api.users.removeVendor)

  const [newVendor, setNewVendor] = useState({ name: '', contact: '', category: 'Material', customCategory: '' })
  const [editingVendor, setEditingVendor] = useState<any>(null)
  const [viewingHistory, setViewingHistory] = useState<any | null>(null)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const handleAddVendor = async () => {
    if (!newVendor.name) return
    setIsSaving(true)
    try {
      const finalCategory = newVendor.category === 'Other' ? (newVendor.customCategory || 'Other') : newVendor.category
      await createVendor({
        name: newVendor.name,
        contact: newVendor.contact,
        category: finalCategory
      })
      setIsAddOpen(false)
      setNewVendor({ name: '', contact: '', category: 'Material', customCategory: '' })
      toast({ title: "Success", description: "Vendor added successfully" })
    } catch (e) {
      toast({ title: "Error", variant: "destructive", description: "Failed to add vendor" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleEditVendor = (vendor: any) => {
    const isStandardCategory = categories.slice(0, 3).includes(vendor.category)
    setEditingVendor({
      ...vendor,
      category: isStandardCategory ? vendor.category : 'Other',
      customCategory: isStandardCategory ? '' : vendor.category
    })
    setIsEditOpen(true)
  }

  const handleUpdateVendor = async () => {
    if (!editingVendor || !editingVendor.name) return
    setIsSaving(true)
    try {
      const finalCategory = editingVendor.category === 'Other' ? (editingVendor.customCategory || 'Other') : editingVendor.category
      await updateVendor({
        vendorId: editingVendor._id,
        name: editingVendor.name,
        contact: editingVendor.contact,
        category: finalCategory,
        status: editingVendor.status
      })
      setIsEditOpen(false)
      setEditingVendor(null)
      toast({ title: "Success", description: "Vendor updated successfully" })
    } catch (e) {
      toast({ title: "Error", variant: "destructive", description: "Failed to update vendor" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteVendor = async () => {
    if (!editingVendor) return
    if (!confirm(`Are you sure you want to remove ${editingVendor.name}? This cannot be undone.`)) return
    
    setIsSaving(true)
    try {
      await removeVendor({ vendorId: editingVendor._id })
      setIsEditOpen(false)
      setEditingVendor(null)
      toast({ title: "Removed", description: "Vendor has been deleted from directory" })
    } catch (e) {
      toast({ title: "Error", variant: "destructive", description: "Failed to delete vendor" })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-8 w-full max-w-full min-w-0 overflow-hidden mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 sm:gap-8 w-full min-w-0 pr-0 md:pr-10">
        <div className="text-center md:text-left w-full sm:w-auto">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white uppercase italic tracking-tighter leading-tight">Vendors</h1>
          <p className="text-muted-foreground mt-1 font-medium italic text-xs sm:text-sm md:text-base mx-auto md:mx-0 max-w-md">Manage supplier directory and track spending history</p>
        </div>
        
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto h-12 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black rounded-xl shadow-xl transition-all active:scale-95 px-6 italic uppercase tracking-widest text-xs">
              <Plus className="mr-2 h-5 w-5" />
              ADD VENDOR
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] sm:max-w-md bg-white dark:bg-slate-900 rounded-3xl border-none shadow-2xl overflow-y-auto max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter">Add New Vendor</DialogTitle>
              <DialogDescription className="font-medium italic">Register a new supplier in the directory</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Vendor Name</Label>
                <Input placeholder="e.g. Modern Hardware" className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-bold italic" value={newVendor.name} onChange={e => setNewVendor({...newVendor, name: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Contact Number (Optional)</Label>
                <Input placeholder="e.g. +91 98765 43210" className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-bold italic" value={newVendor.contact} onChange={e => setNewVendor({...newVendor, contact: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Category</Label>
                <Select value={newVendor.category} onValueChange={v => setNewVendor({...newVendor, category: v})}>
                  <SelectTrigger className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-bold italic">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-2xl">
                    <SelectItem value="Material">Material</SelectItem>
                    <SelectItem value="Labor">Labor</SelectItem>
                    <SelectItem value="Design">Design</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {newVendor.category === 'Other' && (
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Specify Category</Label>
                  <Input 
                    placeholder="Enter custom category" 
                    className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-bold italic"
                    value={newVendor.customCategory} 
                    onChange={e => setNewVendor({...newVendor, customCategory: e.target.value})} 
                    autoFocus
                  />
                </div>
              )}
            </div>
            <DialogFooter className="pt-6 border-t border-slate-100 dark:border-slate-800">
              <Button onClick={handleAddVendor} className="w-full h-12 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black rounded-xl shadow-xl transition-all active:scale-95 italic uppercase tracking-widest text-xs" disabled={isSaving}>
                {isSaving ? <Loader2 className="animate-spin h-5 w-5 mr-1" /> : "Confirm Registration"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
        <Card className="bg-primary/10 border-primary/20 shadow-sm rounded-2xl">
          <CardHeader className="pb-2 p-4 sm:p-6">
            <CardTitle className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-primary">Registered Vendors</CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
            <div className="text-xl sm:text-2xl font-black">{vendors?.length || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-rose-50 border-rose-100 shadow-sm rounded-2xl">
          <CardHeader className="pb-2 p-4 sm:p-6">
            <CardTitle className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-rose-600">Total Outflow</CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
            <div className="text-xl sm:text-2xl font-black text-rose-700">₹{vendors?.reduce((acc, v) => acc + (v.totalPaid || 0), 0).toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-100 shadow-sm rounded-2xl">
          <CardHeader className="pb-2 p-4 sm:p-6">
            <CardTitle className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-amber-600">Transaction Count</CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
            <div className="text-xl sm:text-2xl font-black text-amber-700">{vendors?.reduce((acc, v) => acc + (v.paymentCount || 0), 0)}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-2xl">
        <CardHeader>
          <CardTitle>Vendor Directory</CardTitle>
          <CardDescription>Verified suppliers and their financial summaries</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!vendors ? (
            <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
          ) : (
            <DataTable
              columns={[
                { 
                  key: 'name', 
                  header: 'Vendor Name',
                  cell: (v, row) => (
                    <div 
                      className="flex flex-col cursor-pointer hover:opacity-70 transition-opacity"
                      onClick={() => setViewingHistory(row)}
                    >
                      <span className="font-bold text-sm text-primary underline underline-offset-4 decoration-primary/30">{String(v)}</span>
                      <span className="text-[11px] text-muted-foreground">{row.contact || 'No contact'}</span>
                    </div>
                  )
                },
                { 
                  key: 'category', 
                  header: 'Category',
                  cell: (v) => <Badge variant="secondary" className="bg-primary/10 text-primary border-none capitalize text-[10px]">{String(v)}</Badge>
                },
                { 
                  key: 'totalPaid', 
                  header: 'Total Paid',
                  cell: (v) => <span className="font-black text-rose-600">₹{(v as number || 0).toLocaleString()}</span>
                },
                { 
                  key: 'paymentCount', 
                  header: 'Trans.',
                  cell: (v) => <Badge variant="outline" className="font-bold">{v as number || 0}</Badge>
                },
                { 
                  key: 'lastPaymentDate', 
                  header: 'Last Paid',
                  cell: (v) => <span className="text-xs text-muted-foreground font-medium">{v as string || 'N/A'}</span>
                },
                {
                  key: 'status',
                  header: 'Status',
                  cell: (v) => (
                    <Badge className={v === 'active' ? "bg-green-100 text-green-700 border-none capitalize text-[10px] px-3" : "bg-gray-100 text-gray-700 border-none capitalize text-[10px] px-3"}>
                      {String(v)}
                    </Badge>
                  )
                },
                {
                  key: '_id',
                  header: 'Actions',
                  cell: (_, row) => (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-primary font-bold text-xs hover:bg-primary/10"
                      onClick={() => handleEditVendor(row)}
                    >
                      Edit
                    </Button>
                  )
                }
              ]}
              data={vendors}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md bg-white dark:bg-slate-900 rounded-3xl border-none shadow-2xl overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter">Edit Vendor Details</DialogTitle>
            <DialogDescription className="font-medium italic">Update supplier information and status</DialogDescription>
          </DialogHeader>
          {editingVendor && (
            <div className="space-y-4 py-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Vendor Name</Label>
                <Input
                  className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-bold italic"
                  value={editingVendor.name}
                  onChange={(e) => setEditingVendor({ ...editingVendor, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Contact Number (Optional)</Label>
                <Input
                  className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-bold italic"
                  value={editingVendor.contact}
                  onChange={(e) => setEditingVendor({ ...editingVendor, contact: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Category</Label>
                <Select value={editingVendor.category} onValueChange={(v) => setEditingVendor({ ...editingVendor, category: v })}>
                  <SelectTrigger className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-bold italic">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-2xl">
                    <SelectItem value="Material">Material</SelectItem>
                    <SelectItem value="Labor">Labor</SelectItem>
                    <SelectItem value="Design">Design</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editingVendor.category === 'Other' && (
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Custom Category Name</Label>
                  <Input
                    className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-bold italic"
                    value={editingVendor.customCategory}
                    onChange={(e) => setEditingVendor({ ...editingVendor, customCategory: e.target.value })}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Status Protocol</Label>
                <Select value={editingVendor.status} onValueChange={(v) => setEditingVendor({ ...editingVendor, status: v })}>
                  <SelectTrigger className="h-12 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-bold italic">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-2xl">
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" onClick={handleDeleteVendor} className="h-12 rounded-xl text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-black uppercase tracking-widest text-xs" disabled={isSaving}>
              Delete Vendor
            </Button>
            <Button onClick={handleUpdateVendor} className="flex-1 h-12 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black rounded-xl shadow-xl transition-all active:scale-95 italic uppercase tracking-widest text-xs" disabled={isSaving}>
              {isSaving ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : "Update Vendor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingHistory} onOpenChange={(open) => !open && setViewingHistory(null)}>
        <DialogContent className="w-[95vw] sm:max-w-4xl bg-white dark:bg-slate-900 rounded-3xl border-none shadow-2xl overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <div className="flex items-center justify-between mb-2">
              <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white">
                {viewingHistory?.name}
              </DialogTitle>
              <Badge variant="secondary" className="bg-primary/10 text-primary border-none capitalize text-xs px-3">{viewingHistory?.category}</Badge>
            </div>
            <DialogDescription className="font-medium italic text-sm flex gap-4 text-slate-500">
              <span><strong className="text-slate-700 dark:text-slate-300">Contact:</strong> {viewingHistory?.contact || 'N/A'}</span>
              <span><strong className="text-slate-700 dark:text-slate-300">Total Paid:</strong> ₹{(viewingHistory?.totalPaid || 0).toLocaleString()}</span>
              <span><strong className="text-slate-700 dark:text-slate-300">Transactions:</strong> {viewingHistory?.paymentCount || 0}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 mt-4 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 ml-1">Transaction History</h3>
            {viewingHistory && <VendorHistoryContent vendorName={viewingHistory.name} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function VendorHistoryContent({ vendorName }: { vendorName: string }) {
  const transactions = useQuery(api.transactions.getTransactionsByVendor, { vendorName })

  if (transactions === undefined) {
    return <div className="flex justify-center py-10"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
  }

  if (transactions.length === 0) {
    return <div className="text-center py-10 text-muted-foreground font-medium italic">No transactions found for {vendorName}</div>
  }

  return (
    <DataTable
      columns={[
        { key: 'date', header: 'Date', cell: (v, r) => (
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-900 dark:text-white">{String(r.transactionDate || r.date)}</span>
            <span className="text-[10px] text-muted-foreground font-medium">{r.time || ''}</span>
          </div>
        )},
        { key: 'purpose', header: 'Purpose', cell: (v) => <span className="font-bold text-sm text-slate-700 dark:text-slate-300">{String(v)}</span> },
        { key: 'used_by', header: 'Done By', cell: (v, r) => (
          <div className="flex flex-col">
            <span className="font-bold text-xs text-primary">{String(r.performed_by || r.used_by || 'System')}</span>
            <span className="text-[10px] text-muted-foreground font-medium">{String(r.payment_method || 'Wallet Transfer')}</span>
          </div>
        )},
        { key: 'amount', header: 'Amount', cell: (v, r) => <span className={`font-black text-sm ${r.type === 'CREDIT' ? 'text-green-600' : 'text-rose-600'}`}>₹{(v as number || 0).toLocaleString()}</span> },
        { key: 'status', header: 'Status', cell: (v) => <Badge className="bg-primary/10 text-primary border-none uppercase font-black tracking-wider text-[9px] px-2 py-1">{String(v)}</Badge> },
      ]}
      data={transactions}
    />
  )
}
