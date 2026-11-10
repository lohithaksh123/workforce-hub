'use client'

import { useState, useContext } from 'react'
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { UserContext } from '@/components/dashboard/UserContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DataTable } from '@/components/dashboard/data-table'
import { toast } from '@/hooks/use-toast'
import { cn, normalizeWalletUserId } from '@/lib/utils'
import { Search, Filter, Calendar as CalendarIcon, ArrowDownLeft, ArrowUpRight, ArrowUpDown, ArrowRight, Loader2, Download, Users, Receipt, Upload, Eye, Pencil, Trash2, X, MapPin, Coins, ClipboardList, Activity, User, MoreVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { DatePickerWithRange } from '@/components/ui/date-picker-with-range'
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns"
import { DateRange } from "react-day-picker"
import { useSearchParams } from 'next/navigation'
import { useEffect, Suspense } from 'react'

function TransactionsContent() {
  const { user } = useContext(UserContext)
  const isOwner = user?.role === 'Owner'
  const searchParams = useSearchParams()
  const rawTransactions = useQuery(api.central_wallet.getAllTransactions)
  const normUserName = normalizeWalletUserId(user?.name || '')
  const transactions = isOwner 
    ? rawTransactions 
    : rawTransactions?.filter(t => 
        normalizeWalletUserId(t.used_by || '') === normUserName || 
        normalizeWalletUserId(t.approved_by || '') === normUserName ||
        normalizeWalletUserId(t.sourceId || '') === normUserName ||
        normalizeWalletUserId(t.destinationId || '') === normUserName
      )
  const sites = useQuery(api.sites.getSites)
  const generateUploadUrl = useMutation(api.transactions.generateUploadUrl)
  const attachBill = useMutation(api.transactions.attachBill)
  const deleteBill = useMutation(api.transactions.deleteBill)
  const updateTransaction = useMutation(api.transactions.updateTransaction)
  const verifyStatus = useMutation(api.transactions.verifyTransactionStatus)
  
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'CREDIT' | 'DEBIT'>('all')
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [vendorFilter, setVendorFilter] = useState('all')
  const [siteFilter, setSiteFilter] = useState('all')
  const [isUploading, setIsUploading] = useState<string | null>(null)
  const [viewingAuditLogsTransaction, setViewingAuditLogsTransaction] = useState<any>(null)
  
  const [editingTransaction, setEditingTransaction] = useState<any>(null)
  const [isNewTransactionModalOpen, setIsNewTransactionModalOpen] = useState(false)
  const [newTransaction, setNewTransaction] = useState<any>({
    type: 'DEBIT',
    transactionDate: format(new Date(), 'yyyy-MM-dd'),
    time: format(new Date(), 'HH:mm'),
    amount: '',
    siteId: 'all',
    source_or_vendor: '',
    purpose: '',
    payment_method: 'CASH',
    notes: '',
    fromType: 'Company Vault',
    fromId: '',
    toType: 'Staff Wallet',
    toId: '',
    adjustmentType: 'Add Balance'
  })
  const [editReason, setEditReason] = useState('')
  const users = useQuery(api.users.getUsers)
  const companyBalance = useQuery(api.wallets.getCompanyVaultBalance)

  const createManualTransaction = useMutation(api.transactions.createManualTransaction)
  const createStaffWalletTransfer = useMutation(api.transactions.createStaffWalletTransfer)
  const createCompanyVaultAdjustment = useMutation(api.transactions.createCompanyVaultAdjustment)

  // Sync filters with URL params
  useEffect(() => {
    const siteId = searchParams.get('siteId')
    const type = searchParams.get('type')
    
    if (siteId) setSiteFilter(siteId)
    if (type === 'CREDIT' || type === 'DEBIT') setTypeFilter(type)
  }, [searchParams])

  const handleExport = () => {
    if (!filteredTransactions || filteredTransactions.length === 0) return
    
    const headers = ['Date', 'Type', 'Amount', 'Site', 'Vendor', 'Purpose', 'Performed By', 'Status']
    const rows = filteredTransactions.map(tx => [
      tx.date,
      tx.type,
      tx.amount,
      sites?.find(s => s._id === tx.siteId)?.name || 'Central',
      tx.source_or_vendor || 'General',
      tx.purpose,
      tx.used_by,
      tx.status || 'PENDING'
    ])
    
    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(cell => `"${cell}"`).join(','))
    ].join('\n')
    
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `transactions_export_${format(new Date(), 'yyyy-MM-dd')}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    toast({
      title: "Export Successful",
      description: `Downloaded ${filteredTransactions.length} records.`,
    })
  }

  const handleStatusToggle = async (txId: any, currentStatus: string) => {
    const nextStatus = currentStatus === 'PENDING' ? 'APPROVED' : 
                      currentStatus === 'APPROVED' ? 'REJECTED' : 'PENDING'
    
    try {
      await verifyStatus({ id: txId, status: nextStatus as any })
      toast({
        title: "Status Updated",
        description: `Transaction is now ${nextStatus}.`,
      })
    } catch (e) {
      toast({
        title: "Update Failed",
        variant: "destructive",
        description: "Failed to update verification status.",
      })
    }
  }

  const handleBillUpload = async (txId: any, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(txId)
    try {
      const postUrl = await generateUploadUrl()
      const result = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      })
      const { storageId } = await result.json()
      await attachBill({ transactionId: txId, storageId })
      if (editingTransaction && editingTransaction._id === txId) {
        setEditingTransaction({ ...editingTransaction, billStorageId: storageId })
      }
      toast({ title: "Success", description: "Bill copy updated." })
    } catch (error) {
      toast({ title: "Upload Failed", variant: "destructive", description: "Could not upload bill." })
    } finally {
      setIsUploading(null)
    }
  }

  const handleRemoveBill = async (txId: any, storageId: any) => {
    if (!confirm("Are you sure you want to remove this bill copy?")) return
    try {
      await deleteBill({ transactionId: txId, storageId })
      if (editingTransaction && editingTransaction._id === txId) {
        setEditingTransaction({ ...editingTransaction, billStorageId: undefined })
      }
      toast({ title: "Success", description: "Bill copy removed." })
    } catch (error) {
      toast({ title: "Error", variant: "destructive", description: "Failed to remove bill." })
    }
  }

  const uniqueVendors = Array.from(new Set(transactions?.map(t => t.source_or_vendor).filter((v): v is string => !!v && v.trim() !== '') || []))

  const filteredTransactions = transactions?.filter((tx) => {
    const matchesSearch = tx.purpose.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (tx.source_or_vendor?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
                         tx.used_by.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesType = typeFilter === 'all' || tx.type === typeFilter
    const matchesVendor = vendorFilter === 'all' || tx.source_or_vendor === vendorFilter
    const matchesSite = siteFilter === 'all' || tx.siteId === siteFilter

    let matchesDate = true
    if (dateRange?.from && dateRange?.to) {
      const txDate = new Date(tx.transactionDate || tx.date)
      matchesDate = isWithinInterval(txDate, {
        start: startOfDay(dateRange.from),
        end: endOfDay(dateRange.to)
      })
    }

    return matchesSearch && matchesType && matchesVendor && matchesSite && matchesDate
  });

  return (
    <div className="flex flex-col w-full min-w-0 bg-slate-50 dark:bg-slate-950 overflow-hidden space-y-6 pb-20">
      {/* Page Header - Responsive Action Row */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-start xl:gap-8 px-8 py-6 border-b border-slate-200 dark:border-white/5 bg-white/80 dark:bg-slate-900/40 backdrop-blur-md shrink-0 w-full min-w-0">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-4xl font-black tracking-tight uppercase italic text-slate-900 dark:text-white leading-none">
            Transactions
          </h1>
          <p className="text-muted-foreground font-bold italic text-[10px] sm:text-[11px] opacity-60 mt-2 uppercase tracking-[0.2em]">
            Real-time Financial Transaction Ledger
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 xl:justify-end min-w-0">
          {/* Vault Balance Display */}
          {isOwner && (
            <div className="hidden sm:flex flex-col items-end px-5 py-2 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl mr-1 group hover:border-emerald-500/30 transition-all cursor-default">
                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground group-hover:text-emerald-500/70 transition-colors">Company Vault</span>
                <span className="text-sm font-black text-slate-900 dark:text-white group-hover:text-emerald-500 transition-colors">
                  ₹{companyBalance?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
                </span>
            </div>
          )}

          {(isOwner || user?.permissions?.find(p => p.key === 'create_transactions' && p.allowed)) && (
            <Button 
              variant="default" 
              className="shrink-0 whitespace-nowrap bg-emerald-600 hover:bg-emerald-700 h-11 px-6 shadow-xl shadow-emerald-500/20 font-black uppercase tracking-widest text-[10px] rounded-2xl border-b-[3px] border-emerald-800/70 active:border-b-0 active:translate-y-0.5 transition-all flex items-center justify-center gap-2 group text-white"
              onClick={() => setIsNewTransactionModalOpen(true)}
            >
              <ArrowDownLeft className="h-4 w-4 group-hover:scale-110 transition-transform" />
              <span>Record Entry</span>
            </Button>
          )}
          <Button 
            variant="default" 
            className="shrink-0 whitespace-nowrap bg-primary hover:bg-primary/90 h-11 px-6 shadow-xl shadow-primary/20 font-black uppercase tracking-widest text-[10px] rounded-2xl border-b-[3px] border-primary/70 active:border-b-0 active:translate-y-0.5 transition-all flex items-center justify-center gap-2 group text-white"
            onClick={handleExport}
            disabled={!filteredTransactions || filteredTransactions.length === 0}
          >
            <Download className="h-4 w-4 group-hover:scale-110 transition-transform" />
            <span className="hidden sm:inline">Export Ledger</span>
            <span className="sm:hidden text-[9px]">Export</span>
          </Button>
        </div>
      </div>

      {/* Filter Bar - Responsive Grid */}
      <div className="px-8 shrink-0 w-full min-w-0">
        <div className="p-4 bg-white/90 dark:bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-white/5 shadow-2xl">
          <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            <div className="relative w-full min-w-0 group col-span-1 md:col-span-2 xl:col-span-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  placeholder="Search ledger..."
                  className="pl-10 h-11 bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-xl font-bold italic w-full text-xs transition-all focus:bg-white dark:focus:bg-white/10 text-slate-900 dark:text-white"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <div className="w-full min-w-0">
                <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
                  <SelectTrigger className="h-11 bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-xl font-black uppercase text-[10px] tracking-widest w-full hover:bg-slate-200 dark:hover:bg-white/10 text-slate-900 dark:text-white">
                    <div className="flex items-center gap-2">
                      <Filter className="h-3.5 w-3.5 text-primary" />
                      <SelectValue placeholder="All Categories" />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-2xl">
                    <SelectItem value="all" className="font-bold uppercase text-[10px]">All Transactions</SelectItem>
                    <SelectItem value="CREDIT" className="font-bold uppercase text-[10px] text-emerald-600 dark:text-emerald-400">Credits (Income)</SelectItem>
                    <SelectItem value="DEBIT" className="font-bold uppercase text-[10px] text-rose-600 dark:text-rose-400">Debits (Expense)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

               <div className="w-full min-w-0">
                <Select value={vendorFilter} onValueChange={setVendorFilter}>
                  <SelectTrigger className="h-11 bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-xl font-black uppercase text-[10px] tracking-widest w-full hover:bg-slate-200 dark:hover:bg-white/10 text-slate-900 dark:text-white">
                    <div className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5 text-primary" />
                      <SelectValue placeholder="Filter Entity" />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-2xl max-h-[300px]">
                    <SelectItem value="all" className="font-bold uppercase text-[10px]">All Entities</SelectItem>
                    {uniqueVendors.map(v => (
                      <SelectItem key={v} value={v} className="font-bold text-[10px] uppercase">{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full min-w-0">
                <Select value={siteFilter} onValueChange={setSiteFilter}>
                  <SelectTrigger className="h-11 bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-xl font-black uppercase text-[10px] tracking-widest w-full hover:bg-slate-200 dark:hover:bg-white/10 text-slate-900 dark:text-white">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-primary" />
                      <SelectValue placeholder="Filter Site" />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-2xl max-h-[300px]">
                    <SelectItem value="all" className="font-bold uppercase text-[10px]">All Sites</SelectItem>
                    {sites?.map(s => (
                      <SelectItem key={s._id} value={s._id} className="font-bold text-[10px] uppercase">{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full min-w-0">
                <DatePickerWithRange date={dateRange} setDate={setDateRange} />
              </div>
          </div>
        </div>
      </div>

      {/* Transaction Ledger Section - Internal Horizontal Scroll */}
      <div className="px-8 min-w-0 w-full">
        <div className="w-full min-w-0 bg-white/90 dark:bg-slate-900/50 backdrop-blur-xl rounded-[2.5rem] border border-slate-200 dark:border-white/5 shadow-2xl flex flex-col overflow-hidden">
          <div className="border-b border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] px-8 py-6 shrink-0 w-full min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex items-baseline gap-2">
                <h3 className="text-sm md:text-lg font-black tracking-widest uppercase italic text-slate-900 dark:text-white leading-none">
                  Audit Log
                </h3>
                <span className="text-[9px] font-black uppercase text-primary/50 tracking-widest">
                  . {filteredTransactions?.length || 0} Records
                </span>
              </div>
              {(searchTerm || typeFilter !== 'all' || vendorFilter !== 'all' || siteFilter !== 'all' || dateRange) && (
                <Button variant="ghost" size="sm" onClick={() => {
                  setSearchTerm(''); setTypeFilter('all'); setVendorFilter('all'); setSiteFilter('all'); setDateRange(undefined);
                }} className="text-rose-500 hover:text-rose-600 font-bold text-[10px] uppercase tracking-widest h-8 px-4 rounded-xl hover:bg-rose-500/10">
                  Reset Filters
                </Button>
              )}
            </div>
          </div>
          <div className="p-0 flex-1 min-w-0 w-full">
            {!transactions ? (
              <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 opacity-40">
                <Loader2 className="animate-spin h-8 w-8 text-primary" />
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-600 dark:text-white">Syncing Ledger...</p>
              </div>
            ) : filteredTransactions?.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center p-12">
                <div className="h-16 w-16 rounded-3xl bg-slate-100 dark:bg-white/5 flex items-center justify-center border border-slate-200 dark:border-white/10">
                  <ClipboardList className="h-8 w-8 text-muted-foreground/30" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white italic">No Transactions Found</h3>
                  <p className="text-xs text-muted-foreground max-w-xs">Adjust your search or filters to locate specific audit entries.</p>
                </div>
              </div>
            ) : (
              <div className="w-full max-w-full min-w-0 overflow-x-auto scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
                <div className="min-w-[1100px] w-full p-1">
                  <DataTable
                    columns={[
                    { 
                      key: 'date', 
                      header: 'Date',
                      className: 'w-[100px] pl-6',
                      cell: (val: any, row: any) => (
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center border border-slate-200 dark:border-white/10">
                            <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-900 dark:text-white leading-tight">{row.transactionDate || val}</span>
                            <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-tight">{row.time || '--:--'}</span>
                          </div>
                        </div>
                      )
                    },
                    {
                      key: 'type',
                      header: 'Type',
                      className: 'w-[100px]',
                      cell: (val: any, row: any) => {
                        const isInternal = row.isInternalTransfer === true || row.type === 'TRANSFER' || row.type === 'RETURN';
                        let label = 'DEBIT / EXPENSE';
                        let badgeClass = 'bg-rose-500/10 text-rose-500 border-rose-500/20';
                        let Icon = ArrowUpRight;

                        if (isInternal) {
                          label = 'INTERNAL TRANSFER';
                          badgeClass = 'bg-blue-500/10 text-blue-500 border-blue-500/20';
                          Icon = ArrowUpDown;
                        } else if (row.type === 'ADJUSTMENT') {
                          label = 'ADJUSTMENT';
                          badgeClass = 'bg-purple-500/10 text-purple-500 border-purple-500/20';
                          Icon = Activity;
                        } else if (row.type === 'CREDIT') {
                          label = 'CREDIT';
                          badgeClass = 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
                          Icon = ArrowDownLeft;
                        }

                        return (
                          <div className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-[8px] uppercase tracking-widest border",
                            badgeClass
                          )}>
                            <Icon className="h-3 w-3" />
                            {label}
                          </div>
                        );
                      }
                    },
                    {
                      key: 'amount',
                      header: 'Amount',
                      className: 'w-[120px]',
                      cell: (val: any, row: any) => {
                        const isInternal = row.isInternalTransfer === true || row.type === 'TRANSFER' || row.type === 'RETURN';
                        const colorClass = isInternal
                          ? "text-slate-900 dark:text-white"
                          : row.type === 'CREDIT'
                          ? "text-emerald-500"
                          : "text-rose-500";
                        return (
                          <div className="flex flex-col">
                            <span className={cn(
                              "text-xs font-black leading-tight",
                              colorClass
                            )}>
                              ₹{val?.toLocaleString()}
                            </span>
                            <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-tight">
                              {row.payment_method || 'CASH'}
                              {isInternal && ' TRANSFER'}
                            </span>
                          </div>
                        )
                      }
                    },
                    {
                      key: 'siteId',
                      header: 'Site/Context',
                      className: 'w-[140px]',
                      cell: (val: any) => {
                        const site = sites?.find(s => s._id === val)
                        return (
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-lg bg-primary/5 flex items-center justify-center">
                              <MapPin className="h-3 w-3 text-primary/60" />
                            </div>
                            <span className="text-[9px] font-black uppercase tracking-tight text-slate-900 dark:text-white truncate">
                              {site ? site.name : 'Central Vault'}
                            </span>
                          </div>
                        )
                      }
                    },
                    {
                      key: 'source_or_vendor',
                      header: 'Entity',
                      className: 'w-[150px]',
                      cell: (val: any, row: any) => {
                        const isInternal = row.isInternalTransfer === true || row.type === 'TRANSFER' || row.type === 'RETURN';
                        if (isInternal) {
                          let source = row.sourceType || "Company Vault";
                          let dest = row.destinationType || "Staff Wallet";

                          if (source === "Company Vault" || source === "company_vault") source = "Company Wallet";
                          if (source === "Staff Wallet" || source === "staff_wallet") source = "Employee Wallet";
                          if (source === "Site Budget") source = "Site Wallet";

                          if (dest === "Company Vault" || dest === "company_vault") dest = "Company Wallet";
                          if (dest === "Staff Wallet" || dest === "staff_wallet") dest = "Employee Wallet";
                          if (dest === "Site Budget") dest = "Site Wallet";

                          const purposeLower = (row.purpose || "").toLowerCase();
                          if (purposeLower.includes("allocation to site")) {
                            source = "Company Wallet";
                            dest = "Site Wallet";
                          } else if (purposeLower.includes("top-up") || row.transactionType === "top_up" || purposeLower.includes("fund request")) {
                            source = "Company Wallet";
                            dest = "Employee Wallet";
                          } else if (row.type === "RETURN" || purposeLower.includes("return of unused") || purposeLower.includes("wallet return")) {
                            source = "Employee Wallet";
                            dest = "Company Wallet";
                          }

                          return (
                            <div className="flex items-center gap-2">
                              <div className="h-6 w-6 rounded-lg bg-blue-500/5 flex items-center justify-center">
                                <Users className="h-3 w-3 text-blue-500/60" />
                              </div>
                              <span className="text-[9px] font-black uppercase tracking-tight text-slate-900 dark:text-white truncate max-w-[150px]">
                                <span className="flex items-center gap-1">
                                  {source} <ArrowRight className="h-2 w-2 opacity-40" /> {dest}
                                </span>
                              </span>
                            </div>
                          );
                        }

                        return (
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center">
                              <Users className="h-3 w-3 text-muted-foreground" />
                            </div>
                            <span className="text-[9px] font-black uppercase tracking-tight text-slate-900 dark:text-white truncate max-w-[120px]">
                              {val || 'N/A'}
                            </span>
                          </div>
                        );
                      }
                    },
                    {
                      key: 'purpose',
                      header: 'Purpose',
                      className: 'w-[180px]',
                      cell: (val: any) => (
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center">
                            <Receipt className="h-3 w-3 text-muted-foreground" />
                          </div>
                          <span className="text-[9px] font-bold text-muted-foreground italic truncate max-w-[150px]">
                            {val}
                          </span>
                        </div>
                      )
                    },
                    {
                      key: 'used_by',
                      header: 'User',
                      className: 'w-[100px]',
                      cell: (val: any) => (
                        <div className="flex items-center gap-2">
                          <User className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[9px] font-black uppercase tracking-tight text-slate-900 dark:text-white">
                            {val}
                          </span>
                        </div>
                      )
                    },
                    {
                      key: 'billStorageId',
                      header: 'Bill',
                      className: 'w-[100px]',
                      cell: (val: any, row: any) => (
                        <div className="flex items-center gap-2">
                          {val ? (
                            <BillView storageId={val} />
                          ) : (
                            <>
                              <input 
                                type="file" 
                                id={`bill-upload-${row._id}`} 
                                className="hidden" 
                                accept="image/*,application/pdf"
                                onChange={(e) => handleBillUpload(row._id, e)} 
                              />
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 px-3 rounded-lg border border-slate-200 dark:border-white/10 font-black uppercase text-[8px] tracking-widest flex items-center gap-1.5"
                                onClick={() => document.getElementById(`bill-upload-${row._id}`)?.click()}
                                disabled={isUploading === row._id}
                              >
                                <Upload className="h-3 w-3" /> {isUploading === row._id ? 'Uploading...' : 'Capture'}
                              </Button>
                            </>
                          )}
                        </div>
                      )
                    },
                    {
                      key: 'status',
                      header: 'Verification',
                      className: 'w-[120px]',
                      cell: (val: any) => (
                        <div className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-[8px] uppercase tracking-widest border",
                          val === 'APPROVED' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : 
                          val === 'REJECTED' ? "bg-rose-500/10 text-rose-500 border-rose-500/20" : 
                          "bg-amber-500/10 text-amber-500 border-amber-500/20"
                        )}>
                          <Activity className="h-3 w-3" />
                          {val || 'PENDING'}
                        </div>
                      )
                    },
                    {
                      key: '_id',
                      header: 'Audit',
                      className: 'w-[60px] pr-6',
                      cell: (_: any, row: any) => {
                        const canEdit = isOwner || user?.permissions?.find(p => p.key === 'edit_transactions' && p.allowed);
                        return (
                          <div className="flex justify-center shrink-0">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-primary/10 text-primary">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48 rounded-2xl bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 p-1 shadow-2xl z-[100]">
                                <DropdownMenuItem 
                                  className="rounded-xl font-bold p-3 text-[10px] uppercase tracking-widest flex items-center gap-3 cursor-pointer"
                                  onClick={() => setEditingTransaction({
                                    ...row,
                                    transactionDate: row.transactionDate || row.date
                                  })}
                                >
                                  <Eye className="h-4 w-4 text-primary" /> View Details
                                </DropdownMenuItem>
                                {canEdit && (
                                  <DropdownMenuItem 
                                    className="rounded-xl font-bold p-3 text-[10px] uppercase tracking-widest flex items-center gap-3 cursor-pointer"
                                    onClick={() => setEditingTransaction({
                                      ...row,
                                      transactionDate: row.transactionDate || row.date
                                    })}
                                  >
                                    <Pencil className="h-4 w-4 text-emerald-500" /> Edit Transaction
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator className="bg-slate-100 dark:bg-white/5" />
                                <DropdownMenuItem 
                                  className="rounded-xl font-bold p-3 text-[10px] uppercase tracking-widest flex items-center gap-3 text-rose-500 cursor-pointer hover:bg-rose-500/10"
                                  onClick={() => setViewingAuditLogsTransaction(row)}
                                >
                                  <Activity className="h-4 w-4" /> View Audit Logs
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        )
                      }
                    }
                  ].filter(col => isOwner || col.key !== 'used_by')}
                  data={filteredTransactions || []}
                />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>      {/* New Transaction Modal */}
      <Dialog open={isNewTransactionModalOpen} onOpenChange={setIsNewTransactionModalOpen}>
        <DialogContent className="sm:max-w-[650px] bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-[2.5rem] overflow-y-auto max-h-[90vh] shadow-3xl">
          <DialogHeader className="px-2">
            <div className="flex items-center gap-3 mb-1">
                <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                    <Receipt className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                    <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white leading-none">
                        Record Transaction
                    </DialogTitle>
                    <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-70 mt-1">
                        Select entry type to update the financial ledger
                    </DialogDescription>
                </div>
            </div>
          </DialogHeader>
          
          <div className="grid gap-6 py-6 px-2">
            {/* Entry Type Selection */}
            <div className="p-1.5 bg-slate-100 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 flex gap-1">
                {[
                    { id: 'CREDIT', label: 'Income', icon: ArrowDownLeft, color: 'text-emerald-500' },
                    { id: 'DEBIT', label: 'Expense', icon: ArrowUpRight, color: 'text-rose-500' },
                    { id: 'TRANSFER', label: 'Transfer', icon: Coins, color: 'text-amber-500' },
                    { id: 'ADJUSTMENT', label: 'Adjustment', icon: Activity, color: 'text-primary' }
                ].map((type) => (
                    <button
                        key={type.id}
                        onClick={() => setNewTransaction({ ...newTransaction, type: type.id as any })}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all font-black uppercase text-[10px] tracking-widest",
                            newTransaction.type === type.id 
                                ? "bg-white dark:bg-slate-800 shadow-xl text-slate-900 dark:text-white border border-slate-200 dark:border-white/10" 
                                : "text-muted-foreground hover:bg-white/50 dark:hover:bg-white/5"
                        )}
                    >
                        <type.icon className={cn("h-3.5 w-3.5", newTransaction.type === type.id ? type.color : "opacity-40")} />
                        {type.label}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="grid gap-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-primary/70 ml-1">Transaction Date</Label>
                <div className="relative">
                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                        type="date"
                        value={newTransaction.transactionDate}
                        onChange={(e) => setNewTransaction({ ...newTransaction, transactionDate: e.target.value })}
                        max={format(new Date(), 'yyyy-MM-dd')}
                        className="pl-10 h-12 bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/10 rounded-2xl font-bold italic w-full text-xs transition-all focus:ring-2 focus:ring-primary/20"
                    />
                </div>
              </div>
              <div className="grid gap-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-primary/70 ml-1">Amount (₹)</Label>
                <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-primary text-sm">₹</span>
                    <Input
                        type="number"
                        value={newTransaction.amount}
                        onChange={(e) => setNewTransaction({ ...newTransaction, amount: e.target.value })}
                        placeholder="0.00"
                        className="pl-8 h-12 bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/10 rounded-2xl font-black text-lg text-primary w-full transition-all focus:ring-2 focus:ring-primary/20"
                    />
                </div>
              </div>
            </div>

            {/* Dynamic Fields Based on Type */}
            {newTransaction.type === 'TRANSFER' ? (
              <div className="space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary/70 ml-1">From (Source)</Label>
                        <Select 
                            value={newTransaction.fromType} 
                            onValueChange={(v) => setNewTransaction({ ...newTransaction, fromType: v, fromId: v === 'Company Vault' ? undefined : '' })}
                        >
                            <SelectTrigger className="h-12 bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/10 rounded-2xl font-bold uppercase text-[10px] tracking-widest">
                                <SelectValue placeholder="Source Type" />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-white/10">
                                <SelectItem value="Company Vault" className="font-bold uppercase text-[10px]">Company Vault</SelectItem>
                                <SelectItem value="Site Budget" className="font-bold uppercase text-[10px]">Site Budget</SelectItem>
                                <SelectItem value="Staff Wallet" className="font-bold uppercase text-[10px]">Staff Wallet</SelectItem>
                            </SelectContent>
                        </Select>

                        {newTransaction.fromType === 'Site Budget' && (
                            <Select value={newTransaction.fromId} onValueChange={(v) => setNewTransaction({ ...newTransaction, fromId: v })}>
                                <SelectTrigger className="h-12 bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/10 rounded-2xl font-bold italic text-xs">
                                    <SelectValue placeholder="Select Site" />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl border-white/10">
                                    {sites?.map(s => <SelectItem key={s._id} value={s._id} className="font-bold italic text-xs">{s.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        )}

                        {newTransaction.fromType === 'Staff Wallet' && (
                            <Select value={newTransaction.fromId} onValueChange={(v) => setNewTransaction({ ...newTransaction, fromId: v })}>
                                <SelectTrigger className="h-12 bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/10 rounded-2xl font-bold italic text-xs">
                                    <SelectValue placeholder="Select Staff" />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl border-white/10">
                                    {users?.map(u => <SelectItem key={u._id} value={u.name} className="font-bold italic text-xs">{u.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-emerald-500 ml-1">To (Destination)</Label>
                        <Select 
                            value={newTransaction.toType} 
                            onValueChange={(v) => setNewTransaction({ ...newTransaction, toType: v, toId: v === 'Company Vault' ? undefined : '' })}
                        >
                            <SelectTrigger className="h-12 bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/10 rounded-2xl font-bold uppercase text-[10px] tracking-widest">
                                <SelectValue placeholder="Dest Type" />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-white/10">
                                <SelectItem value="Company Vault" className="font-bold uppercase text-[10px]">Company Vault</SelectItem>
                                <SelectItem value="Site Budget" className="font-bold uppercase text-[10px]">Site Budget</SelectItem>
                                <SelectItem value="Staff Wallet" className="font-bold uppercase text-[10px]">Staff Wallet</SelectItem>
                            </SelectContent>
                        </Select>

                        {newTransaction.toType === 'Site Budget' && (
                            <Select value={newTransaction.toId} onValueChange={(v) => setNewTransaction({ ...newTransaction, toId: v })}>
                                <SelectTrigger className="h-12 bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/10 rounded-2xl font-bold italic text-xs">
                                    <SelectValue placeholder="Select Site" />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl border-white/10">
                                    {sites?.map(s => <SelectItem key={s._id} value={s._id} className="font-bold italic text-xs">{s.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        )}

                        {newTransaction.toType === 'Staff Wallet' && (
                            <Select value={newTransaction.toId} onValueChange={(v) => setNewTransaction({ ...newTransaction, toId: v })}>
                                <SelectTrigger className="h-12 bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/10 rounded-2xl font-bold italic text-xs">
                                    <SelectValue placeholder="Select Staff" />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl border-white/10">
                                    {users?.map(u => <SelectItem key={u._id} value={u.name} className="font-bold italic text-xs">{u.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                </div>
              </div>
            ) : newTransaction.type === 'ADJUSTMENT' ? (
              <div className="space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="grid gap-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary/70 ml-1">Adjustment Type</Label>
                    <Select value={newTransaction.adjustmentType} onValueChange={(v: any) => setNewTransaction({ ...newTransaction, adjustmentType: v })}>
                        <SelectTrigger className="h-12 bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/10 rounded-2xl font-black uppercase text-[10px] tracking-widest">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-white/10">
                            <SelectItem value="Add Balance" className="font-bold uppercase text-[10px]">Add Balance (+)</SelectItem>
                            <SelectItem value="Reduce Balance" className="font-bold uppercase text-[10px]">Reduce Balance (-)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
              </div>
            ) : (
              <div className="space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary/70 ml-1">Site / Project Context</Label>
                        <Select value={newTransaction.siteId} onValueChange={(v) => setNewTransaction({ ...newTransaction, siteId: v })}>
                            <SelectTrigger className="h-12 bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/10 rounded-2xl font-bold italic text-xs">
                                <SelectValue placeholder="Select Site" />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-white/10">
                                <SelectItem value="all" className="font-bold italic text-xs">Central Vault (No Site)</SelectItem>
                                {sites?.map(s => <SelectItem key={s._id} value={s._id} className="font-bold italic text-xs">{s.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary/70 ml-1">Payment Method</Label>
                        <Select value={newTransaction.payment_method} onValueChange={(v) => setNewTransaction({ ...newTransaction, payment_method: v })}>
                            <SelectTrigger className="h-12 bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/10 rounded-2xl font-black uppercase text-[10px] tracking-widest">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-white/10">
                                <SelectItem value="CASH" className="font-bold uppercase text-[10px]">Cash</SelectItem>
                                <SelectItem value="UPI" className="font-bold uppercase text-[10px]">UPI</SelectItem>
                                <SelectItem value="BANK TRANSFER" className="font-bold uppercase text-[10px]">Bank Transfer</SelectItem>
                                <SelectItem value="CARD" className="font-bold uppercase text-[10px]">Debit/Credit Card</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="grid gap-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary/70 ml-1">
                        {newTransaction.type === 'CREDIT' ? 'Source / Received From' : 'Payee / Paid To'}
                    </Label>
                    <Input
                        value={newTransaction.source_or_vendor}
                        onChange={(e) => setNewTransaction({ ...newTransaction, source_or_vendor: e.target.value })}
                        placeholder={newTransaction.type === 'CREDIT' ? "Client or Source name" : "Vendor or Payee name"}
                        className="h-12 bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/10 rounded-2xl font-bold italic text-xs"
                    />
                </div>
              </div>
            )}

            <div className="grid gap-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-primary/70 ml-1">Purpose / Description</Label>
              <Input
                value={newTransaction.purpose}
                onChange={(e) => setNewTransaction({ ...newTransaction, purpose: e.target.value })}
                placeholder="What is this transaction for?"
                className="h-12 bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/10 rounded-2xl font-bold italic text-xs"
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-primary/70 ml-1">Internal Notes (Optional)</Label>
              <Input
                value={newTransaction.notes}
                onChange={(e) => setNewTransaction({ ...newTransaction, notes: e.target.value })}
                placeholder="Add any extra internal details..."
                className="h-12 bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/10 rounded-2xl font-bold italic text-xs"
              />
            </div>
          </div>

          <DialogFooter className="px-2 pb-6 gap-3 sm:gap-3 flex-col sm:flex-row">
            <Button 
                variant="ghost" 
                onClick={() => setIsNewTransactionModalOpen(false)} 
                className="flex-1 h-12 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-100 dark:hover:bg-white/5"
            >
                Discard
            </Button>
            <Button 
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 font-black h-12 px-8 rounded-2xl uppercase italic tracking-tighter text-sm text-white shadow-xl shadow-emerald-600/20 active:scale-95 transition-all"
              onClick={async () => {
                try {
                  const amount = parseFloat(newTransaction.amount);
                  if (isNaN(amount) || amount <= 0) throw new Error("Please enter a valid amount greater than 0");

                  if (newTransaction.type === 'TRANSFER') {
                    if (!newTransaction.fromType || !newTransaction.toType) throw new Error("Select source and destination types");
                    if (newTransaction.fromType !== 'Company Vault' && !newTransaction.fromId) throw new Error(`Select a ${newTransaction.fromType}`);
                    if (newTransaction.toType !== 'Company Vault' && !newTransaction.toId) throw new Error(`Select a ${newTransaction.toType}`);
                    
                    await createStaffWalletTransfer({
                        transactionDate: newTransaction.transactionDate,
                        time: format(new Date(), 'HH:mm'),
                        fromType: newTransaction.fromType,
                        fromId: newTransaction.fromId,
                        toType: newTransaction.toType,
                        toId: newTransaction.toId,
                        amount,
                        reason: newTransaction.purpose,
                        notes: newTransaction.notes,
                        performed_by: user.name
                    });
                  } else if (newTransaction.type === 'ADJUSTMENT') {
                    await createCompanyVaultAdjustment({
                        transactionDate: newTransaction.transactionDate,
                        adjustmentType: newTransaction.adjustmentType as any,
                        amount,
                        reason: newTransaction.purpose,
                        notes: newTransaction.notes,
                        performed_by: user.name
                    });
                  } else {
                    await createManualTransaction({
                      type: newTransaction.type as 'CREDIT' | 'DEBIT',
                      transactionDate: newTransaction.transactionDate,
                      time: format(new Date(), 'HH:mm'),
                      amount,
                      siteId: newTransaction.siteId === 'all' ? undefined : newTransaction.siteId,
                      source_or_vendor: newTransaction.source_or_vendor,
                      purpose: newTransaction.purpose,
                      payment_method: newTransaction.payment_method,
                      notes: newTransaction.notes,
                      performed_by: user.name
                    });
                  }

                  toast({ title: "Ledger Updated", description: "Transaction successfully recorded." })
                  setIsNewTransactionModalOpen(false)
                  setNewTransaction({
                    type: 'DEBIT',
                    transactionDate: format(new Date(), 'yyyy-MM-dd'),
                    time: format(new Date(), 'HH:mm'),
                    amount: '',
                    siteId: 'all',
                    source_or_vendor: '',
                    purpose: '',
                    payment_method: 'CASH',
                    notes: '',
                    fromType: 'Company Vault',
                    fromId: '',
                    toType: 'Staff Wallet',
                    toId: '',
                    adjustmentType: 'Add Balance'
                  })
                } catch (e: any) {
                  toast({ title: "Transaction Failed", variant: "destructive", description: e.message })
                }
              }}
            >
              Post to Ledger
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingTransaction} onOpenChange={(open) => {
        if (!open) {
          setEditingTransaction(null)
          setEditReason('')
        }
      }}>
        <DialogContent className="sm:max-w-[650px] bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-[2.5rem] overflow-y-auto max-h-[90vh] shadow-3xl">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
                <div className="h-10 w-10 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                    <Pencil className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                    <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white leading-none">
                        Edit Transaction
                    </DialogTitle>
                    <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-70 mt-1">
                        Update transaction details. Balance adjustments are calculated automatically.
                    </DialogDescription>
                </div>
            </div>
          </DialogHeader>
          
          <div className="grid gap-6 py-6 px-2">
            {/* Warning for balance changes */}
            <div className="p-4 bg-rose-500/5 border border-rose-500/10 rounded-2xl">
              <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-3 leading-relaxed">
                <Activity className="h-4 w-4 shrink-0" />
                Important: Modifications to Amount, Type, or Site will automatically reverse the previous balance effect and apply the new one.
              </p>
            </div>

            {/* Basic Type Selection - Only for CREDIT/DEBIT */}
            {(editingTransaction?.type === 'CREDIT' || editingTransaction?.type === 'DEBIT') && (
              <div className="p-1.5 bg-slate-100 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 flex gap-1">
                  {[
                      { id: 'CREDIT', label: 'Income', icon: ArrowDownLeft, color: 'text-emerald-500' },
                      { id: 'DEBIT', label: 'Expense', icon: ArrowUpRight, color: 'text-rose-500' },
                  ].map((type) => (
                      <button
                          key={type.id}
                          onClick={() => setEditingTransaction({ ...editingTransaction, type: type.id as any })}
                          className={cn(
                              "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all font-black uppercase text-[10px] tracking-widest",
                              editingTransaction.type === type.id 
                                  ? "bg-white dark:bg-slate-800 shadow-xl text-slate-900 dark:text-white border border-slate-200 dark:border-white/10" 
                                  : "text-muted-foreground hover:bg-white/50 dark:hover:bg-white/5"
                          )}
                      >
                          <type.icon className={cn("h-3.5 w-3.5", editingTransaction.type === type.id ? type.color : "opacity-40")} />
                          {type.label}
                      </button>
                  ))}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="grid gap-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-primary/70 ml-1">Transaction Date</Label>
                <div className="relative">
                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                        type="date"
                        value={editingTransaction?.transactionDate || editingTransaction?.date || ''}
                        onChange={(e) => setEditingTransaction({ ...editingTransaction, transactionDate: e.target.value })}
                        max={format(new Date(), 'yyyy-MM-dd')}
                        className="pl-10 h-12 bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/10 rounded-2xl font-bold italic w-full text-xs transition-all focus:ring-2 focus:ring-primary/20"
                    />
                </div>
              </div>
              <div className="grid gap-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-primary/70 ml-1">Amount (₹)</Label>
                <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-primary text-sm">₹</span>
                    <Input
                        type="number"
                        value={editingTransaction?.amount || ''}
                        onChange={(e) => setEditingTransaction({ ...editingTransaction, amount: parseFloat(e.target.value) })}
                        placeholder="0.00"
                        className="pl-8 h-12 bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/10 rounded-2xl font-black text-lg text-primary w-full transition-all focus:ring-2 focus:ring-primary/20"
                    />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="grid gap-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-primary/70 ml-1">Site / Project Context</Label>
                  <Select 
                    value={editingTransaction?.siteId || 'all'} 
                    onValueChange={(v) => setEditingTransaction({ ...editingTransaction, siteId: v })}
                    disabled={editingTransaction?.type === 'TRANSFER' || editingTransaction?.type === 'ADJUSTMENT'}
                  >
                      <SelectTrigger className="h-12 bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/10 rounded-2xl font-bold italic text-xs">
                          <SelectValue placeholder="Select Site" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-white/10">
                          <SelectItem value="all" className="font-bold italic text-xs">Central Vault (No Site)</SelectItem>
                          {sites?.map(s => <SelectItem key={s._id} value={s._id} className="font-bold italic text-xs">{s.name}</SelectItem>)}
                      </SelectContent>
                  </Select>
              </div>
              <div className="grid gap-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-primary/70 ml-1">Payment Method</Label>
                  <Select value={editingTransaction?.payment_method || 'CASH'} onValueChange={(v) => setEditingTransaction({ ...editingTransaction, payment_method: v })}>
                      <SelectTrigger className="h-12 bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/10 rounded-2xl font-black uppercase text-[10px] tracking-widest">
                          <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-white/10">
                          <SelectItem value="CASH" className="font-bold uppercase text-[10px]">Cash</SelectItem>
                          <SelectItem value="UPI" className="font-bold uppercase text-[10px]">UPI</SelectItem>
                          <SelectItem value="BANK TRANSFER" className="font-bold uppercase text-[10px]">Bank Transfer</SelectItem>
                          <SelectItem value="CARD" className="font-bold uppercase text-[10px]">Debit/Credit Card</SelectItem>
                      </SelectContent>
                  </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-primary/70 ml-1">Entity / Vendor / Payee</Label>
              <Input
                  value={editingTransaction?.source_or_vendor || ''}
                  onChange={(e) => setEditingTransaction({ ...editingTransaction, source_or_vendor: e.target.value })}
                  placeholder="Company or Person name"
                  className="h-12 bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/10 rounded-2xl font-bold italic w-full text-xs transition-all focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-primary/70 ml-1">Purpose / Context</Label>
              <Input
                  value={editingTransaction?.purpose || ''}
                  onChange={(e) => setEditingTransaction({ ...editingTransaction, purpose: e.target.value })}
                  placeholder="What was this transaction for?"
                  className="h-12 bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/10 rounded-2xl font-bold italic w-full text-xs transition-all focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="grid gap-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-primary/70 ml-1">Notes (Optional)</Label>
                <Textarea
                    value={editingTransaction?.notes || ''}
                    onChange={(e) => setEditingTransaction({ ...editingTransaction, notes: e.target.value })}
                    placeholder="Any additional details or audit notes..."
                    className="min-h-[80px] bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/10 rounded-2xl font-medium p-4 transition-all focus:ring-2 focus:ring-primary/20"
                />
            </div>

            <div className="grid gap-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-rose-500 ml-1 flex items-center gap-2">
                Reason for Edit <span className="opacity-50 text-[8px]">(Required for Audit)</span>
              </Label>
              <Input
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Explain why this change is necessary..."
                className="h-12 bg-rose-500/[0.03] border-rose-500/20 rounded-2xl font-bold italic w-full text-xs transition-all focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            {editingTransaction?._id && <AuditHistory transactionId={editingTransaction._id} />}
          </div>

          <DialogFooter className="gap-3 mt-4 border-t border-slate-100 dark:border-white/5 pt-6 px-2">
            <Button 
                variant="ghost" 
                onClick={() => setEditingTransaction(null)} 
                className="h-12 rounded-2xl font-black uppercase text-[10px] tracking-widest px-6"
            >
                Cancel
            </Button>
            <Button 
              className="flex-1 bg-primary hover:bg-primary/90 font-black h-12 rounded-2xl uppercase italic tracking-tighter text-sm text-white shadow-xl shadow-primary/20" 
              onClick={async () => {
                if (!editReason || editReason.length < 5) {
                  toast({ title: "Reason Required", variant: "destructive", description: "Please provide a valid reason for this edit." })
                  return
                }
                if (!editingTransaction.purpose || !editingTransaction.amount) {
                  toast({ title: "Validation Error", variant: "destructive", description: "Amount and Purpose are required." })
                  return
                }

                try {
                  const result: any = await updateTransaction({
                    id: editingTransaction._id,
                    type: editingTransaction.type,
                    amount: editingTransaction.amount,
                    transactionDate: editingTransaction.transactionDate || editingTransaction.date,
                    time: editingTransaction.time,
                    siteId: editingTransaction.siteId,
                    source_or_vendor: editingTransaction.source_or_vendor,
                    purpose: editingTransaction.purpose,
                    payment_method: editingTransaction.payment_method,
                    notes: editingTransaction.notes,
                    reasonForEdit: editReason,
                    edited_by: user.name
                  })
                  toast({ 
                    title: "Entry Updated", 
                    description: result?.balanceAdjustmentSummary || "Audit trail record created and balances adjusted." 
                  })
                  setEditingTransaction(null)
                  setEditReason('')
                } catch (e: any) {
                  toast({ title: "Error", variant: "destructive", description: e.message })
                }
              }}
            >
              Confirm Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <AuditLogsDialog 
         transaction={viewingAuditLogsTransaction} 
         onClose={() => setViewingAuditLogsTransaction(null)} 
         sites={sites || []}
       />
    </div>
  )
}

function AuditHistory({ transactionId }: { transactionId: any }) {
  const logs = useQuery(api.transactions.getAuditLogs, { transactionId })
  
  if (!logs || logs.length === 0) return null

  return (
    <div className="mt-6 border-t border-slate-200 dark:border-white/10 pt-4">
      <h4 className="text-[10px] font-black uppercase tracking-widest text-primary/70 mb-3 flex items-center gap-2">
        <Activity className="h-3.5 w-3.5" />
        Edit History
      </h4>
      <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2">
        {logs.map((log: any) => (
          <div key={log._id} className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-black uppercase text-slate-900 dark:text-white">{log.editedBy}</span>
              <span className="text-[8px] text-muted-foreground font-bold">{format(log.editedAt, 'dd MMM yyyy, HH:mm')}</span>
            </div>
            <p className="text-[9px] text-slate-500 italic mb-2">"{log.reasonForEdit}"</p>
            {log.balanceAdjustmentSummary && (
                <div className="mb-2 p-1.5 bg-primary/5 rounded-lg border border-primary/10">
                    <p className="text-[8px] font-black text-primary uppercase tracking-wider leading-relaxed">
                        {log.balanceAdjustmentSummary}
                    </p>
                </div>
            )}
            {log.newValues.amount !== undefined && log.newValues.amount !== log.oldValues.amount && (
               <div className="flex items-center gap-2 text-[8px] font-bold">
                 <span className="text-muted-foreground line-through">₹{log.oldValues.amount}</span>
                 <ArrowUpRight className="h-2 w-2 text-primary" />
                 <span className="text-emerald-500">₹{log.newValues.amount}</span>
               </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function AuditLogsDialog({ 
  transaction, 
  onClose, 
  sites 
}: { 
  transaction: any; 
  onClose: () => void; 
  sites: any[] 
}) {
  const logs = useQuery(api.transactions.getAuditLogs, transaction?._id ? { transactionId: transaction._id } : "skip")
  
  return (
    <Dialog open={!!transaction} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[600px] bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-[2.5rem] overflow-y-auto max-h-[90vh] shadow-3xl">
        <DialogHeader className="px-2">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-2xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
              <Activity className="h-5 w-5 text-rose-500" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white leading-none">
                Audit Trail Logs
              </DialogTitle>
              <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-70 mt-1">
                Historical modification log for transaction
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-4 px-2 space-y-4">
          {/* Transaction Summary Card */}
          {transaction && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Current Details</span>
                <span className={cn(
                  "text-[9px] font-black uppercase px-2 py-0.5 rounded-lg border",
                  transaction.type === "CREDIT" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                )}>
                  {transaction.type}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-1">
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Amount</p>
                  <p className="text-sm font-black text-slate-900 dark:text-white">₹{transaction.amount?.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Site / Context</p>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {sites?.find(s => s._id === transaction.siteId)?.name || 'Central Vault'}
                  </p>
                </div>
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Entity</p>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{transaction.source_or_vendor || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Purpose</p>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{transaction.purpose}</p>
                </div>
              </div>
            </div>
          )}

          {/* Audit Logs List */}
          <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
            {!logs ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary opacity-30" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-12 px-4 rounded-2xl border-2 border-dashed border-slate-100 dark:border-white/[0.02]">
                <Activity className="h-8 w-8 text-slate-300 dark:text-slate-700 mx-auto mb-2 opacity-50" />
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">No Edit Logs Found</p>
                <p className="text-[10px] text-muted-foreground mt-1">This transaction hasn't been edited or modified since its creation.</p>
              </div>
            ) : (
              logs.map((log: any) => {
                // Find changed fields
                const changes: { field: string; oldVal: any; newVal: any }[] = [];
                const checkKeys = ["type", "amount", "date", "siteId", "purpose", "source_or_vendor", "payment_method"];
                checkKeys.forEach(k => {
                  let oldV = log.oldValues?.[k];
                  let newV = log.newValues?.[k];
                  if (k === "date") {
                    oldV = log.oldValues?.date || log.oldValues?.transactionDate;
                    newV = log.newValues?.date || log.newValues?.transactionDate;
                  }
                  if (newV !== undefined && newV !== oldV) {
                    changes.push({ field: k, oldVal: oldV, newVal: newV });
                  }
                });

                return (
                  <div key={log._id} className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-900 dark:text-white bg-slate-200/50 dark:bg-white/10 px-2 py-0.5 rounded-md">
                          {log.editedBy}
                        </span>
                        <span className="text-[8px] text-muted-foreground font-bold">edited this entry</span>
                      </div>
                      <span className="text-[8px] text-muted-foreground font-bold">{format(log.editedAt, 'dd MMM yyyy, HH:mm')}</span>
                    </div>

                    <div className="p-2.5 bg-rose-500/[0.02] border border-rose-500/10 rounded-xl">
                      <p className="text-[9px] font-semibold text-rose-500 italic">
                        "{log.reasonForEdit || 'No reason provided.'}"
                      </p>
                    </div>

                    {log.balanceAdjustmentSummary && (
                      <div className="p-2.5 bg-primary/5 border border-primary/10 rounded-xl">
                        <p className="text-[8px] font-black text-primary uppercase tracking-wide leading-relaxed">
                          {log.balanceAdjustmentSummary}
                        </p>
                      </div>
                    )}

                    {changes.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Changes Details</p>
                        <div className="space-y-1">
                          {changes.map((c: any, i: number) => {
                            let oldLabel = String(c.oldVal ?? 'N/A');
                            let newLabel = String(c.newVal ?? 'N/A');
                            
                            if (c.field === "siteId") {
                              const oldSite = sites?.find(s => s._id === c.oldVal);
                              const newSite = sites?.find(s => s._id === c.newVal);
                              oldLabel = oldSite ? oldSite.name : 'Central Vault';
                              newLabel = newSite ? newSite.name : 'Central Vault';
                            }

                            return (
                              <div key={i} className="flex items-center gap-2 text-[9px] font-bold">
                                <span className="text-slate-400 uppercase w-[90px] shrink-0">{c.field.replace('_', ' ')}:</span>
                                <span className="text-rose-500 line-through truncate max-w-[120px]">{oldLabel}</span>
                                <ArrowRight className="h-2.5 w-2.5 text-slate-400" />
                                <span className="text-emerald-500 truncate max-w-[120px]">{newLabel}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <DialogFooter className="px-2 border-t border-slate-100 dark:border-white/5 pt-4">
          <Button 
            onClick={onClose} 
            className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black h-12 rounded-2xl uppercase text-[10px] tracking-widest"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BillView({ storageId }: { storageId: string }) {
  const url = useQuery(api.transactions.getBillUrl, { storageId: storageId as any })
  
  if (!url) return <div className="h-8 w-8 flex items-center justify-center"><Loader2 className="h-3.5 w-3.5 animate-spin text-primary/40" /></div>
  
  return (
    <Button 
      variant="ghost" 
      size="sm" 
      className="h-9 w-9 p-0 text-primary hover:bg-primary/10 rounded-xl border border-primary/20" 
      onClick={() => window.open(url, '_blank')}
      title="Review Evidence"
    >
      <Eye className="h-4 w-4" />
    </Button>
  )
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-950">
        <Loader2 className="animate-spin h-12 w-12 text-primary" />
      </div>
    }>
      <TransactionsContent />
    </Suspense>
  )
}
