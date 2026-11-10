'use client'

import { useState, useContext, useMemo, useEffect } from 'react'
import { UserContext } from '@/components/dashboard/UserContext'
import { 
  Plus, 
  Search, 
  Wallet, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight, 
  Filter, 
  MoreVertical, 
  Edit2, 
  Snowflake, 
  CheckCircle2, 
  Archive, 
  Eye, 
  Loader2,
  Clock,
  AlertCircle,
  ArrowUpDown,
  Users
} from 'lucide-react'
import { cn, normalizeWalletUserId } from '@/lib/utils'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger, 
  DialogFooter 
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useQuery, useMutation } from "convex/react"
import { DataTable } from '@/components/dashboard/data-table'
import { api } from "@/convex/_generated/api"
import { toast } from '@/hooks/use-toast'

export default function WalletsDashboard() {
  const { user: loggedInUser } = useContext(UserContext)
  const walletsData = useQuery(api.wallets.getWallets)
  const walletStats = useQuery(api.wallets.getWalletStats)
  const companyVaultBalance = useQuery(api.wallets.getCompanyVaultBalance)
  const siteBudgets = useQuery(api.wallets.getSiteBudgets)
  const users = useQuery(api.users.getUsers)
  const sites = useQuery(api.sites.getSites)
  const roles = useQuery(api.roles.getRoles)
  
  const topUpMutation = useMutation(api.wallets.topUpUserWallet)
  const updateStatusMutation = useMutation(api.wallets.updateWalletStatus)
  const reallocateMutation = useMutation(api.wallets.reallocateFunds)
  const returnMutation = useMutation(api.wallets.returnUserFunds)

  const [isRedirecting, setIsRedirecting] = useState(false)

  // Redirect non-owners to their own wallet
  useEffect(() => {
    if (loggedInUser && loggedInUser.role !== 'Owner' && walletsData) {
      const myWallet = walletsData.find(w => normalizeWalletUserId(w.userId) === normalizeWalletUserId(loggedInUser.name))
      if (myWallet) {
        setIsRedirecting(true)
        window.location.href = `/dashboard/wallets/${myWallet._id}`
      }
    }
  }, [loggedInUser, walletsData])

  if (isRedirecting) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="animate-spin h-12 w-12 text-indigo-500" />
        <p className="text-slate-500 font-bold italic">Redirecting to your personal wallet...</p>
      </div>
    )
  }

  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [siteFilter, setSiteFilter] = useState('ALL')
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'balance', direction: 'desc' })
  const [isTopUpOpen, setIsTopUpOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  const [topUpForm, setTopUpForm] = useState({
    userId: '',
    amount: '',
    reason: '',
    siteId: 'COMPANY',
  })

  const [isReturnOpen, setIsReturnOpen] = useState(false)
  const [returnForm, setReturnForm] = useState({
    walletId: '',
    amount: '',
    notes: ''
  })

  const [isReallocateOpen, setIsReallocateOpen] = useState(false)
  const [reallocateForm, setReallocateForm] = useState({
    sourceType: 'Staff Wallet' as 'Staff Wallet' | 'Site Budget' | 'Company Vault',
    sourceId: '',
    destinationType: 'Staff Wallet' as 'Staff Wallet' | 'Site Budget' | 'Company Vault',
    destinationId: '',
    amount: '',
    reason: ''
  })

  // Permission check
  const hasPermission = (name: string) => {
    if (loggedInUser?.role === 'Owner') return true
    return loggedInUser?.permissions?.find((p: any) => p.key === name || p.name === name)?.allowed || false
  }

  // Sorting and Filtering
  const filteredAndSortedWallets = useMemo(() => {
    if (!walletsData) return []
    
    let result = [...walletsData]
    
    // Filters
    if (searchQuery) {
        result = result.filter(w => w.userId.toLowerCase().includes(searchQuery.toLowerCase()))
    }
    if (roleFilter !== 'ALL') {
        result = result.filter(w => w.role === roleFilter)
    }
    if (statusFilter !== 'ALL') {
        result = result.filter(w => w.status === statusFilter)
    }
    if (siteFilter !== 'ALL') {
        result = result.filter(w => w.siteId === siteFilter)
    }

    // Sort
    if (sortConfig) {
        result.sort((a, b) => {
            const aValue = (a as any)[sortConfig.key] ?? 0
            const bValue = (b as any)[sortConfig.key] ?? 0
            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1
            return 0
        })
    }
    
    return result
  }, [walletsData, searchQuery, roleFilter, statusFilter, siteFilter, sortConfig])

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
        direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  const handleTopUp = async () => {
    if (!topUpForm.userId || !topUpForm.amount || !topUpForm.reason || !topUpForm.siteId) {
      toast({ title: "Validation Error", variant: "destructive", description: "All fields are required." })
      return
    }
    const amount = parseFloat(topUpForm.amount)
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Validation Error", variant: "destructive", description: "Please enter a valid positive amount." })
      return
    }

    setIsSaving(true)
    try {
      const result = await topUpMutation({
        userId: topUpForm.userId,
        amount: amount,
        siteId: topUpForm.siteId as any,
        notes: topUpForm.reason,
        approvedBy: loggedInUser?.name || 'System'
      })
      if (result.success) {
        setIsTopUpOpen(false)
        setTopUpForm({ userId: '', amount: '', reason: '', siteId: 'COMPANY' })
        toast({ title: "Success", description: `₹${amount.toLocaleString()} added to ${topUpForm.userId}'s wallet.` })
      } else {
        toast({ title: "Top-up Failed", variant: "destructive", description: result.error })
      }
    } catch (e: any) {
      toast({ title: "Communication Error", variant: "destructive", description: "Could not reach server: " + e.message })
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdateStatus = async (id: any, status: 'Active' | 'Frozen' | 'Archived') => {
    if (id.startsWith('virtual_')) {
        toast({ title: "Note", description: "This user has no wallet record yet. Top up first to create it." })
        return
    }
    try {
      await updateStatusMutation({ id, status })
      toast({ title: "Success", description: `Wallet status updated to ${status}` })
    } catch (e: any) {
      toast({ title: "Error", variant: "destructive", description: "Failed to update status" })
    }
  }

  const handleReturn = async () => {
    if (!returnForm.walletId || !returnForm.amount) return
    setIsSaving(true)
    try {
        const result = await returnMutation({
            walletId: returnForm.walletId as any,
            amount: parseFloat(returnForm.amount),
            notes: returnForm.notes,
            processedBy: loggedInUser?.name || 'Owner'
        })
        if (result.success) {
            setIsReturnOpen(false)
            setReturnForm({ walletId: '', amount: '', notes: '' })
            toast({ title: "Success", description: "Funds returned successfully" })
        } else {
            toast({ title: "Return Failed", variant: "destructive", description: result.error })
        }
    } catch (e: any) {
        toast({ title: "Communication Error", variant: "destructive", description: "Could not reach server: " + e.message })
    } finally {
        setIsSaving(false)
    }
  }

  const handleReallocate = async () => {
    if (!reallocateForm.amount || !reallocateForm.reason) {
      toast({ title: "Validation Error", variant: "destructive", description: "Amount and Reason are required." })
      return
    }

    if (reallocateForm.sourceType !== 'Company Vault' && !reallocateForm.sourceId) {
      toast({ title: "Validation Error", variant: "destructive", description: "Please select a source." })
      return
    }

    if (reallocateForm.destinationType !== 'Company Vault' && !reallocateForm.destinationId) {
      toast({ title: "Validation Error", variant: "destructive", description: "Please select a destination." })
      return
    }

    if (reallocateForm.sourceType === reallocateForm.destinationType && reallocateForm.sourceId === reallocateForm.destinationId) {
      toast({ title: "Validation Error", variant: "destructive", description: "Source and Destination cannot be the same." })
      return
    }

    const amount = parseFloat(reallocateForm.amount)
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Validation Error", variant: "destructive", description: "Please enter a valid positive amount." })
      return
    }

    setIsSaving(true)
    try {
        const result = await reallocateMutation({
            sourceType: reallocateForm.sourceType,
            sourceId: reallocateForm.sourceId,
            destinationType: reallocateForm.destinationType,
            destinationId: reallocateForm.destinationId,
            amount: amount,
            reason: reallocateForm.reason,
            performedBy: loggedInUser?.name || 'System'
        })
        if (result.success) {
            setIsReallocateOpen(false)
            setReallocateForm({ sourceType: 'Staff Wallet', sourceId: '', destinationType: 'Staff Wallet', destinationId: '', amount: '', reason: '' })
            toast({ title: "Success", description: "Funds reallocated successfully" })
        } else {
            toast({ title: "Reallocation Failed", variant: "destructive", description: result.error })
        }
    } catch (e: any) {
        toast({ title: "Communication Error", variant: "destructive", description: "Could not reach server: " + e.message })
    } finally {
        setIsSaving(false)
    }
  }

  return (
    <div className="space-y-8 pb-10">

      {/* Dynamic Summary Cards */}
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {[
            { 
                label: 'Total Company System Balance', 
                value: `₹${walletStats?.totalBalance?.toLocaleString('en-IN') || '0'}`, 
                icon: <Wallet className="h-5 w-5" />, 
                sub: 'Vault + Staff + Sites balance combined', 
                color: 'slate',
                accent: 'bg-slate-500/10 text-slate-500'
            },
            { 
                label: 'Added This Month', 
                value: `₹${walletStats?.addedThisMonth?.toLocaleString('en-IN') || '0'}`, 
                icon: <ArrowUpRight className="h-5 w-5" />, 
                sub: 'Total funds injected since 1st', 
                color: 'emerald',
                accent: 'bg-emerald-500/10 text-emerald-500'
            },
            { 
                label: 'Spent This Month', 
                value: `₹${walletStats?.spentThisMonth?.toLocaleString('en-IN') || '0'}`, 
                icon: <ArrowDownRight className="h-5 w-5" />, 
                sub: 'Org-wide staff expenditures', 
                color: 'rose',
                accent: 'bg-rose-500/10 text-rose-500'
            },
            { 
                label: 'Active Wallets', 
                value: String(walletStats?.activeCount || '0'), 
                icon: <CheckCircle2 className="h-5 w-5" />, 
                sub: 'Staff with active spending enabled', 
                color: 'primary',
                accent: 'bg-primary/10 text-primary'
            }
        ].map((stat, i) => (
            <Card key={i} className="border-none shadow-xl bg-card/50 backdrop-blur-sm group hover:scale-[1.02] transition-transform duration-300">
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-400">{stat.label}</p>
                        <div className={cn("h-10 w-10 rounded-2xl flex items-center justify-center shadow-lg transform group-hover:rotate-12 transition-transform", stat.accent)}>
                            {stat.icon}
                        </div>
                    </div>
                    <h2 className="text-3xl font-black mt-4 tracking-tight leading-none text-slate-900 dark:text-white">{stat.value}</h2>
                    <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mt-3 italic leading-tight">{stat.sub}</p>
                </CardContent>
            </Card>
        ))}
      </div>

      {/* Advanced Command Center Table */}
      <Card className="border-none shadow-3xl bg-card/50 backdrop-blur-md overflow-hidden rounded-3xl">
        <CardHeader className="p-8 border-b border-slate-100 dark:border-white/5 bg-slate-50/30 dark:bg-slate-900/10">
            <div className="flex flex-col gap-6">
                {/* Registry Title & Main Action */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-1 bg-primary rounded-full" />
                            <CardTitle className="text-xl md:text-2xl font-black uppercase tracking-tighter italic text-slate-900 dark:text-white">Staff Wallet Registry</CardTitle>
                        </div>
                        <CardDescription className="text-[10px] md:text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest ml-4">Full visibility into individual liquidity & spending authority</CardDescription>
                    </div>

                    {hasPermission('Top Up Team Wallets') && (
                        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                             <Button 
                                className="w-full sm:w-auto h-11 sm:h-10 bg-primary hover:bg-primary/90 text-white rounded-xl shadow-sm font-black uppercase tracking-[0.15em] text-[10px] px-5 transition-all"
                                onClick={() => {
                                    setReallocateForm({
                                        sourceType: 'Company Vault',
                                        sourceId: '',
                                        destinationType: 'Staff Wallet',
                                        destinationId: '',
                                        amount: '',
                                        reason: ''
                                    });
                                    setIsReallocateOpen(true);
                                }}
                            >
                                Reallocate Funds
                            </Button>

                            <Dialog open={isTopUpOpen} onOpenChange={setIsTopUpOpen}>
                                <DialogTrigger asChild>
                                    <Button className="w-full sm:w-auto h-11 sm:h-10 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 rounded-xl shadow-sm font-black uppercase tracking-[0.15em] text-[10px] px-5 transition-all">
                                        <Plus className="mr-2 h-4 w-4" /> Instant Top Up
                                    </Button>
                                </DialogTrigger>
                              <DialogContent className="sm:max-w-[550px] bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 rounded-xl p-0 max-h-[90vh] overflow-y-auto shadow-3xl">
                                <div className="bg-gradient-to-r from-slate-900 to-slate-800 dark:from-white dark:to-slate-200 p-8 text-white dark:text-slate-900">
                                    <div className="flex items-center justify-between">
                                        <DialogTitle className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-xl bg-white/10 dark:bg-slate-900/10 flex items-center justify-center">
                                                <ArrowUpRight className="h-6 w-6 text-white dark:text-slate-900" />
                                            </div>
                                            Instant Top Up
                                        </DialogTitle>
                                        <div className="text-right">
                                            <p className="text-[10px] font-black uppercase opacity-60">Vault Balance</p>
                                            <p className="font-black italic">₹{((companyVaultBalance ?? 0) + (siteBudgets?.reduce((acc, s) => acc + s.balance, 0) ?? 0)).toLocaleString()}</p>
                                        </div>
                                    </div>
                                    <DialogDescription className="text-white/60 dark:text-slate-600 font-bold mt-2">Quickly add funds from Company Vault or a Site Budget to a staff wallet.</DialogDescription>
                                </div>
                                <div className="p-8 space-y-6">
                                  <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-500">Source of Funds</Label>
                                    <Select value={topUpForm.siteId} onValueChange={v => setTopUpForm({...topUpForm, siteId: v})}>
                                      <SelectTrigger className="h-12 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white font-black italic">
                                        <SelectValue placeholder="Select Source" />
                                      </SelectTrigger>
                                      <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white">
                                        <SelectItem value="COMPANY" className="font-bold text-amber-500">Company Vault (Available: ₹{companyVaultBalance?.toLocaleString()})</SelectItem>
                                        {sites?.map(s => {
                                          const siteWallet = siteBudgets?.find(b => b.siteId === s._id);
                                          return (
                                            <SelectItem key={s._id} value={s._id} className="font-bold">
                                              {s.name} Budget (Available: ₹{siteWallet?.balance?.toLocaleString() ?? 0})
                                            </SelectItem>
                                          );
                                        })}
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-500">Select Staff Member</Label>
                                      <Select value={topUpForm.userId} onValueChange={v => setTopUpForm({...topUpForm, userId: v})}>
                                        <SelectTrigger className="h-12 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white font-black italic"><SelectValue placeholder="Select Staff" /></SelectTrigger>
                                        <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white">
                                          {users?.map(u => <SelectItem key={u._id} value={u.name} className="font-bold">{u.name} — <span className="opacity-50 text-[10px]">{u.role}</span></SelectItem>)}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-2">
                                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-500">Amount (₹)</Label>
                                      <Input 
                                        type="number" 
                                        placeholder="0.00" 
                                        className="h-12 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-xl font-black text-slate-900 dark:text-white text-lg focus:ring-2 focus:ring-indigo-500"
                                        value={topUpForm.amount}
                                        onChange={e => setTopUpForm({...topUpForm, amount: e.target.value})}
                                      />
                                    </div>
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-500">Reason for Top Up</Label>
                                    <Input 
                                      placeholder="e.g. Monthly travel allowance" 
                                      className="h-12 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white font-bold italic"
                                      value={topUpForm.reason}
                                      onChange={e => setTopUpForm({...topUpForm, reason: e.target.value})}
                                    />
                                  </div>
                                </div>
                                <div className="p-8 pt-0">
                                  <Button onClick={handleTopUp} disabled={isSaving} className="w-full h-14 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 rounded-2xl font-black text-lg shadow-xl uppercase tracking-widest transition-all">
                                    {isSaving ? <Loader2 className="animate-spin h-6 w-6 mr-2" /> : "Confirm Top Up"}
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                        </div>
                    )}
                </div>
                
                {/* Filters Row */}
                <div className="flex flex-col md:flex-row md:items-center gap-4 p-4 bg-white/50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm m-4 sm:m-6">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input 
                            placeholder="Filter by staff name..." 
                            className="h-10 pl-11 bg-transparent border-none font-bold italic w-full focus-visible:ring-0 text-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    
                    <div className="grid grid-cols-2 lg:flex items-center gap-2 w-full md:w-auto border-t md:border-t-0 md:border-l border-slate-200 dark:border-white/5 pt-4 md:pt-0 md:pl-4">
                        <Select value={roleFilter} onValueChange={setRoleFilter}>
                            <SelectTrigger className="h-10 flex-1 md:w-36 bg-transparent border-none font-black uppercase text-[10px] tracking-widest px-3 text-slate-800 dark:text-slate-300 focus:ring-0">
                                <div className="flex items-center gap-2">
                                    <Users className="h-3 w-3 opacity-50" />
                                    <SelectValue placeholder="All Roles" />
                                </div>
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white">
                                <SelectItem value="ALL" className="font-bold text-[10px]">ALL ROLES</SelectItem>
                                {roles?.map(r => (
                                    <SelectItem key={r._id} value={r.name} className="font-bold text-[10px]">{r.name.toUpperCase()}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={siteFilter} onValueChange={setSiteFilter}>
                          <SelectTrigger className="h-10 flex-1 md:w-44 bg-transparent border-none font-black uppercase text-[10px] tracking-widest px-3 text-slate-600 dark:text-slate-400 focus:ring-0">
                            <div className="flex items-center gap-2">
                                <Filter className="h-3 w-3 opacity-50" />
                                <SelectValue placeholder="Assigned Site" />
                            </div>
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white">
                            <SelectItem value="ALL" className="font-bold text-[10px]">ALL SITES</SelectItem>
                            {sites?.map(s => <SelectItem key={s._id} value={s._id} className="font-bold text-[10px]">{s.name.toUpperCase()}</SelectItem>)}
                          </SelectContent>
                        </Select>

                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                          <SelectTrigger className="h-10 flex-1 md:w-32 bg-transparent border-none font-black uppercase text-[10px] tracking-widest px-3 text-slate-600 dark:text-slate-400 focus:ring-0">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white">
                            <SelectItem value="ALL" className="font-bold text-[10px]">ALL STATUS</SelectItem>
                            <SelectItem value="Active" className="font-bold text-[10px]">ACTIVE</SelectItem>
                            <SelectItem value="Frozen" className="font-bold text-[10px]">FROZEN</SelectItem>
                            <SelectItem value="Archived" className="font-bold text-[10px]">ARCHIVED</SelectItem>
                          </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>
        </CardHeader>
        <CardContent className="p-0">
            {!walletsData ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
            ) : (
                <DataTable
                    columns={[
                        {
                            key: 'userId',
                            header: 'Identity & Role',
                            cell: (v, row) => (
                                <div className="flex items-center gap-4">
                                    <div className="h-12 w-12 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-white flex items-center justify-center font-black text-lg border border-slate-200 dark:border-white/10">
                                        {String(v).charAt(0)}
                                    </div>
                                    <div className="flex flex-col">
                                        <p className="font-black text-slate-900 dark:text-white leading-tight">{String(v)}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[10px] font-black uppercase tracking-tight text-slate-600 dark:text-slate-400 italic">{row.role}</span>
                                        </div>
                                    </div>
                                </div>
                            )
                        },
                        {
                            key: 'siteId',
                            header: 'Assignment',
                            cell: (v) => (
                                <div className="flex flex-col">
                                    <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight">
                                        {v ? sites?.find(s => s._id === v)?.name || 'Unknown' : 'Global / None'}
                                    </span>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase mt-1 tracking-widest">Location</span>
                                </div>
                            )
                        },
                        {
                            key: 'balance',
                            header: 'Liquidity',
                            cell: (v) => (
                                <div className="flex flex-col items-end">
                                    <p className="text-lg font-black text-slate-900 dark:text-white leading-none tracking-tighter">₹{Number(v).toLocaleString('en-IN')}</p>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase mt-1.5 tracking-widest">Available</span>
                                </div>
                            )
                        },
                        {
                            key: 'total_credited',
                            header: 'Flow Stats',
                            cell: (_, row) => {
                                const totalCr = row.total_credited + (row.totalTransferredIn || 0);
                                const totalDr = row.total_debited + (row.totalTransferredOut || 0);
                                return (
                                    <div className="flex flex-col items-end gap-1">
                                        <div className={cn("flex items-center gap-2", totalCr === 0 && "opacity-20")}>
                                            <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Cr</span>
                                            <span className="text-xs font-black text-slate-700 dark:text-slate-300">₹{totalCr.toLocaleString('en-IN')}</span>
                                        </div>
                                        <div className={cn("flex items-center gap-2", totalDr === 0 && "opacity-20")}>
                                            <span className="text-[9px] font-black text-rose-600 uppercase tracking-widest">Dr</span>
                                            <span className="text-xs font-black text-slate-700 dark:text-slate-300">₹{totalDr.toLocaleString('en-IN')}</span>
                                        </div>
                                    </div>
                                );
                            }
                        },
                        {
                            key: 'pendingRequests',
                            header: 'Activity',
                            cell: (v, row) => (
                                <div className="flex flex-col items-center gap-1">
                                    <Badge className={cn(
                                        "font-black text-[9px] px-2 py-0.5 rounded-full", 
                                        Number(v) > 0 ? "bg-amber-50 text-amber-600 border-amber-200" : "bg-slate-50 text-slate-400"
                                    )}>
                                        {Number(v)} PENDING
                                    </Badge>
                                    <span className="text-[9px] font-bold text-slate-500 uppercase">{row.lastTopUpDate && row.lastTopUpDate !== 'Never' ? row.lastTopUpDate : 'No Activity'}</span>
                                </div>
                            )
                        },
                        {
                            key: 'status',
                            header: 'Status',
                            cell: (v) => (
                                <div className="flex items-center gap-2">
                                    <div className={cn("h-2 w-2 rounded-full", v === 'Active' ? "bg-emerald-500" : "bg-amber-500")}></div>
                                    <span className={cn("text-[10px] font-black uppercase tracking-widest", v === 'Active' ? "text-emerald-600" : "text-amber-600")}>{String(v)}</span>
                                </div>
                            )
                        },
                        {
                            key: '_id',
                            header: 'Actions',
                            cell: (v, row) => (
                                <div className="flex justify-end">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-9 w-9 p-0 rounded-xl hover:bg-slate-100">
                                                <MoreVertical className="h-4 w-4 text-slate-400" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 shadow-3xl">
                                            {hasPermission('Top Up Team Wallets') && (
                                                <>
                                                    <DropdownMenuItem className="rounded-xl font-bold p-3" onClick={() => { setTopUpForm({ userId: row.userId, amount: '', reason: '', siteId: 'COMPANY' }); setIsTopUpOpen(true); }}>
                                                        <Plus className="h-4 w-4 mr-3 text-emerald-600" /> Inject Funds
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="rounded-xl font-bold p-3" onClick={() => { setReallocateForm({...reallocateForm, sourceType: 'Staff Wallet', sourceId: row.userId}); setIsReallocateOpen(true); }}>
                                                        <ArrowUpDown className="h-4 w-4 mr-3 text-indigo-600" /> Reallocate
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="rounded-xl font-bold p-3 text-rose-600" onClick={() => { setReturnForm({...returnForm, walletId: String(v)}); setIsReturnOpen(true); }}>
                                                        <ArrowDownRight className="h-4 w-4 mr-3" /> Return Funds
                                                    </DropdownMenuItem>
                                                </>
                                            )}
                                            <DropdownMenuItem className="rounded-xl font-bold p-3" onClick={() => window.location.href = `/dashboard/wallets/${v}`}>
                                                <Eye className="h-4 w-4 mr-3 text-slate-500" /> View History
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            )
                        }
                    ]}
                    data={filteredAndSortedWallets}
                />
            )}
        </CardContent>
      </Card>

      {/* Return Funds Modal */}
      <Dialog open={isReturnOpen} onOpenChange={setIsReturnOpen}>
        <DialogContent className="sm:max-w-[500px] bg-slate-950 border-white/10 rounded-xl p-0 max-h-[90vh] overflow-y-auto shadow-3xl">
            <div className="bg-slate-900/50 border-b border-white/5 p-8 text-white">
                <DialogTitle className="text-2xl font-black uppercase tracking-tight italic flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
                        <ArrowDownRight className="h-6 w-6 text-rose-500" />
                    </div>
                    Return Funds
                </DialogTitle>
                <DialogDescription className="text-slate-400 font-bold italic mt-2 opacity-80">Recover unused funds back to the company vault.</DialogDescription>
            </div>
            <div className="p-8 space-y-6">
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Amount to Return (₹)</Label>
                    <Input 
                        type="number" 
                        placeholder="0.00" 
                        className="h-12 bg-white/5 border-white/10 rounded-xl font-black text-white text-lg focus:ring-2 focus:ring-rose-500"
                        value={returnForm.amount}
                        onChange={e => setReturnForm({...returnForm, amount: e.target.value})}
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Internal Note / Reason</Label>
                    <Input 
                        placeholder="e.g. Unused travel allowance" 
                        className="h-12 bg-white/5 border-white/10 rounded-xl text-white font-bold italic"
                        value={returnForm.notes}
                        onChange={e => setReturnForm({...returnForm, notes: e.target.value})}
                    />
                </div>
            </div>
            <div className="p-8 pt-0">
                <Button onClick={handleReturn} disabled={isSaving} className="w-full h-14 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-lg shadow-[0_10px_30px_-5px_rgba(225,29,72,0.5)] uppercase tracking-widest border-b-4 border-rose-900 transition-all active:border-b-0 active:translate-y-1">
                    {isSaving ? <Loader2 className="animate-spin h-6 w-6 mr-2" /> : "Process Return"}
                </Button>
            </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isReallocateOpen} onOpenChange={setIsReallocateOpen}>
        <DialogContent className="sm:max-w-[550px] bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 rounded-2xl p-0 max-h-[90vh] overflow-y-auto shadow-3xl">
            <div className="bg-slate-900 dark:bg-white p-8 text-white dark:text-slate-900">
                <div className="flex items-center justify-between">
                    <DialogTitle className="text-2xl font-black uppercase tracking-tight italic flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-white/10 dark:bg-slate-900/10 flex items-center justify-center">
                            <ArrowUpDown className="h-6 w-6 text-white dark:text-slate-900" />
                        </div>
                        Fund Reallocation
                    </DialogTitle>
                </div>
                <DialogDescription className="text-white/60 dark:text-slate-500 font-bold mt-2">Move funds between wallets, sites, and the company vault.</DialogDescription>
            </div>
            <div className="p-8 space-y-6">
                {/* SOURCE SECTION */}
                <div className="space-y-4 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
                    <div className="flex items-center justify-between">
                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Source Asset</Label>
                        {reallocateForm.sourceType === 'Company Vault' && (
                             <Badge className="bg-indigo-500/10 text-indigo-500 border-none font-black text-[9px]">VAULT: ₹{companyVaultBalance?.toLocaleString()}</Badge>
                        )}
                        {reallocateForm.sourceType === 'Site Budget' && reallocateForm.sourceId && (
                             <Badge className="bg-amber-500/10 text-amber-500 border-none font-black text-[9px]">SITE: ₹{siteBudgets?.find(s => s.siteId === reallocateForm.sourceId)?.balance?.toLocaleString()}</Badge>
                        )}
                        {reallocateForm.sourceType === 'Staff Wallet' && reallocateForm.sourceId && (
                             <Badge className="bg-emerald-500/10 text-emerald-500 border-none font-black text-[9px]">USER: ₹{walletsData?.find(w => w.userId === reallocateForm.sourceId)?.balance?.toLocaleString()}</Badge>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Select value={reallocateForm.sourceType} onValueChange={v => setReallocateForm({...reallocateForm, sourceType: v as any, sourceId: ''})}>
                            <SelectTrigger className="h-11 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 rounded-xl font-black text-[11px] uppercase tracking-wider"><SelectValue placeholder="Source Type" /></SelectTrigger>
                            <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
                                <SelectItem value="Staff Wallet" className="font-bold">Staff Wallet</SelectItem>
                                <SelectItem value="Site Budget" className="font-bold">Site Budget</SelectItem>
                                <SelectItem value="Company Vault" className="font-bold">Company Vault</SelectItem>
                            </SelectContent>
                        </Select>
                        {reallocateForm.sourceType === 'Staff Wallet' && (
                            <Select value={reallocateForm.sourceId} onValueChange={v => setReallocateForm({...reallocateForm, sourceId: v})}>
                                <SelectTrigger className="h-11 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 rounded-xl font-bold text-[11px]"><SelectValue placeholder="Select Staff" /></SelectTrigger>
                                <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
                                    {walletsData?.filter(w => w.balance > 0).map(w => <SelectItem key={w._id} value={w.userId} className="font-bold">{w.userId}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        )}
                        {reallocateForm.sourceType === 'Site Budget' && (
                            <Select value={reallocateForm.sourceId} onValueChange={v => setReallocateForm({...reallocateForm, sourceId: v})}>
                                <SelectTrigger className="h-11 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 rounded-xl font-bold text-[11px]"><SelectValue placeholder="Select Site" /></SelectTrigger>
                                <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
                                    {siteBudgets?.filter(s => s.balance > 0).map(s => <SelectItem key={s.siteId} value={s.siteId} className="font-bold">{s.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                </div>

                <div className="flex justify-center -my-3 relative z-10">
                    <div className="h-10 w-10 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center shadow-lg border-4 border-white dark:border-slate-950">
                        <ArrowDownRight className="h-5 w-5" />
                    </div>
                </div>

                {/* DESTINATION SECTION */}
                <div className="space-y-4 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Destination Asset</Label>
                    <div className="grid grid-cols-2 gap-4">
                        <Select value={reallocateForm.destinationType} onValueChange={v => setReallocateForm({...reallocateForm, destinationType: v as any, destinationId: ''})}>
                            <SelectTrigger className="h-11 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 rounded-xl font-black text-[11px] uppercase tracking-wider"><SelectValue placeholder="Dest. Type" /></SelectTrigger>
                            <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
                                <SelectItem value="Staff Wallet" className="font-bold">Staff Wallet</SelectItem>
                                <SelectItem value="Site Budget" className="font-bold">Site Budget</SelectItem>
                                <SelectItem value="Company Vault" className="font-bold">Company Vault</SelectItem>
                            </SelectContent>
                        </Select>
                        {reallocateForm.destinationType === 'Staff Wallet' && (
                            <Select value={reallocateForm.destinationId} onValueChange={v => setReallocateForm({...reallocateForm, destinationId: v})}>
                                <SelectTrigger className="h-11 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 rounded-xl font-bold text-[11px]"><SelectValue placeholder="Select Staff" /></SelectTrigger>
                                <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
                                    {users?.map(u => <SelectItem key={u._id} value={u.name} className="font-bold">{u.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        )}
                        {reallocateForm.destinationType === 'Site Budget' && (
                            <Select value={reallocateForm.destinationId} onValueChange={v => setReallocateForm({...reallocateForm, destinationId: v})}>
                                <SelectTrigger className="h-11 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 rounded-xl font-bold text-[11px]"><SelectValue placeholder="Select Site" /></SelectTrigger>
                                <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
                                    {sites?.map(s => <SelectItem key={s._id} value={s._id} className="font-bold">{s.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Amount (₹)</Label>
                        <Input 
                            type="number" 
                            placeholder="0.00" 
                            className="h-12 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-xl font-black text-slate-900 dark:text-white text-lg"
                            value={reallocateForm.amount}
                            onChange={e => setReallocateForm({...reallocateForm, amount: e.target.value})}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Reason</Label>
                        <Input 
                            placeholder="Reason for transfer" 
                            className="h-12 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white font-bold italic"
                            value={reallocateForm.reason}
                            onChange={e => setReallocateForm({...reallocateForm, reason: e.target.value})}
                        />
                    </div>
                </div>
            </div>
            <div className="p-8 pt-0">
                <Button onClick={handleReallocate} disabled={isSaving} className="w-full h-14 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 rounded-2xl font-black text-lg shadow-xl uppercase tracking-widest transition-all">
                    {isSaving ? <Loader2 className="animate-spin h-6 w-6 mr-2" /> : "Authorize Transfer"}
                </Button>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
