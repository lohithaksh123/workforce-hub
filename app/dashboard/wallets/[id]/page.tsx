'use client'

import { useParams } from 'next/navigation'
import { useQuery, useMutation } from "convex/react"
import { useState, useContext, useEffect } from 'react'
import { UserContext } from '@/components/dashboard/UserContext'
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { 
  ArrowLeft, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight, 
  Clock, 
  MapPin, 
  User, 
  FileText,
  PieChart as PieChartIcon,
  BarChart as BarChartIcon,
  Loader2,
  AlertCircle,
  Plus,
  Snowflake,
  Archive,
  Download
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { toast } from '@/hooks/use-toast'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn, normalizeWalletUserId } from '@/lib/utils'
import Link from 'next/link'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line
} from 'recharts'

const getImageBase64 = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } else {
        reject(new Error('Failed to get canvas context'));
      }
    };
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
  });
};

const fetchAndRegisterFont = async (doc: any) => {
  try {
    const response = await fetch('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf')
    if (!response.ok) throw new Error("Font fetch failed")
    const arrayBuffer = await response.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    let binary = ''
    const len = uint8Array.byteLength
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(uint8Array[i])
    }
    const base64 = window.btoa(binary)
    doc.addFileToVFS('Roboto-Regular.ttf', base64)
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
    doc.setFont('Roboto')
    return true
  } catch (e) {
    console.error("Failed to load custom font, falling back to standard font", e)
    return false
  }
}

export default function WalletDetail() {
  const { id } = useParams() as { id: string }
  const wallet = useQuery(api.wallets.getWalletById, { id: id as string })
  const sites = useQuery(api.sites.getSites)
  const users = useQuery(api.users.getUsers)
  const vendors = useQuery(api.users.getVendors)
  const updateStatusMutation = useMutation(api.wallets.updateWalletStatus)
  const topUpMutation = useMutation(api.wallets.topUpStaffWallet)
  const spendMutation = useMutation(api.requests.useMoney)
  const createVendorMutation = useMutation(api.users.createVendor)
  
  const { user: loggedInUser } = useContext(UserContext)
  
  const [isTopUpOpen, setIsTopUpOpen] = useState(false)
  const [isSpendOpen, setIsSpendOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isNewVendor, setIsNewVendor] = useState(false)
  
  const [topUpForm, setTopUpForm] = useState({
    userId: '',
    amount: '',
    reason: '',
  })

  const [spendForm, setSpendForm] = useState({
    amount: '',
    vendor: '',
    purpose: '',
    payment_method: 'Cash',
    notes: '',
    spendFor: 'Site' as 'Site' | 'Others',
    siteId: '',
    customReason: '',
    category: 'Miscellaneous',
    newVendorName: '',
    newVendorContact: '',
    newVendorCategory: 'Material'
  })

  // Security Check: Non-owners can only view their own wallet
  useEffect(() => {
    if (wallet && loggedInUser && loggedInUser.role !== 'Owner') {
      if (normalizeWalletUserId(wallet.userId) !== normalizeWalletUserId(loggedInUser.name)) {
        window.location.href = '/dashboard/wallets'
        toast({
          title: "Access Restricted",
          variant: "destructive",
          description: "You do not have permission to view this wallet's transaction history."
        })
      }
    }
  }, [wallet, loggedInUser])

  const hasPermission = (name: string) => {
    if (loggedInUser?.role === 'Owner') return true
    return loggedInUser?.permissions?.find((p: any) => p.name === name)?.allowed || false
  }

  const handleTopUp = async () => {
    if (!topUpForm.userId || !topUpForm.amount || !topUpForm.reason) {
      toast({ title: "Error", variant: "destructive", description: "Please fill all required fields" })
      return
    }

    setIsSaving(true)
    try {
      const result = await topUpMutation({
        userId: topUpForm.userId,
        amount: Number(topUpForm.amount),
        reason: topUpForm.reason,
        performedBy: loggedInUser?.name || 'System'
      })
      if (result.success) {
        toast({ title: "Success", description: `Credited ₹${topUpForm.amount} to ${topUpForm.userId}` })
        setIsTopUpOpen(false)
        setTopUpForm({ ...topUpForm, amount: '', reason: '' })
      } else {
        toast({ title: "Error", variant: "destructive", description: result.error || "Top up failed" })
      }
    } catch (e: any) {
      toast({ title: "Error", variant: "destructive", description: e.message || "Top up failed" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleSpendMoney = async () => {
    if (!spendForm.amount || !spendForm.purpose) {
      toast({ title: "Error", variant: "destructive", description: "Please fill all required fields" })
      return
    }

    if (spendForm.spendFor === 'Site' && !spendForm.siteId) {
      toast({ title: "Error", variant: "destructive", description: "Please select a site" })
      return
    }

    const spendAmount = Number(spendForm.amount)
    if (spendAmount > wallet.balance) {
      toast({ 
        title: "Insufficient Funds", 
        variant: "destructive", 
        description: `You are trying to spend ₹${spendAmount.toLocaleString('en-IN')}, but your available balance is only ₹${wallet.balance.toLocaleString('en-IN')}.` 
      })
      return
    }

    setIsSaving(true)
    try {
      let finalVendorName = spendForm.vendor

      if (isNewVendor) {
        if (!spendForm.newVendorName) {
          toast({ title: "Error", variant: "destructive", description: "Please provide a name for the new vendor" })
          setIsSaving(false)
          return
        }
        const vResult = (await createVendorMutation({
          name: spendForm.newVendorName,
          contact: spendForm.newVendorContact || undefined,
          category: spendForm.newVendorCategory
        })) as any
        
        if (!vResult.success) {
          toast({ title: "Error", variant: "destructive", description: vResult.error || "Failed to register new vendor" })
          setIsSaving(false)
          return
        }
        finalVendorName = spendForm.newVendorName
      }

      const result = (await spendMutation({
        amount: Number(spendForm.amount),
        vendor: finalVendorName,
        purpose: spendForm.purpose,
        payment_method: spendForm.payment_method,
        notes: spendForm.spendFor === 'Others' ? spendForm.customReason : spendForm.notes,
        used_by: wallet.userId,
        walletId: wallet._id.toString().startsWith('virtual_') ? undefined : (wallet._id as any),
        siteId: spendForm.spendFor === 'Site' ? (spendForm.siteId as Id<"sites">) : undefined,
        category: spendForm.spendFor === 'Others' ? 'Others' : (isNewVendor ? spendForm.newVendorCategory : spendForm.category)
      })) as any

      if (result.success) {
        toast({ title: "Success", description: `Spent ₹${spendForm.amount}` })
        setIsSpendOpen(false)
        setSpendForm({
          amount: '', vendor: '', purpose: '', payment_method: 'Cash', notes: '', 
          spendFor: 'Site', siteId: '', customReason: '', category: 'Miscellaneous',
          newVendorName: '', newVendorContact: '', newVendorCategory: 'Material'
        })
        setIsNewVendor(false)
      } else {
        toast({ title: "Error", variant: "destructive", description: result.error || "Spend failed" })
      }
    } catch (e: any) {
      toast({ title: "Error", variant: "destructive", description: e.message || "Failed to process spend" })
    } finally {
      setIsSaving(false)
    }
  }

  // Pre-fill userId when wallet loads
  useState(() => {
    if (wallet) {
      setTopUpForm(prev => ({ ...prev, userId: wallet.userId }))
    }
  })

  if (wallet === undefined) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-indigo-500" /></div>
  if (wallet === null) return <div className="text-center py-20"><AlertCircle className="h-12 w-12 text-rose-500 mx-auto mb-4" /><h1 className="text-2xl font-black">Wallet Not Found</h1></div>

  const handleUpdateStatus = async (status: 'Active' | 'Frozen' | 'Archived') => {
    try {
      if (id.toString().startsWith('virtual_')) {
          toast({ title: "Initialization Required", description: "This wallet needs its first transaction before it can be frozen." })
          return
      }
      await updateStatusMutation({ id: id as Id<"user_wallets">, status })
      toast({ 
        title: status === 'Frozen' ? "Wallet Frozen" : "Wallet Activated", 
        description: `This wallet has been set to ${status}.` 
      })
    } catch (e: any) {
      toast({ title: "Error", variant: "destructive", description: "Failed to update status" })
    }
  }

  const exportTransactionLedger = async () => {
    setIsSaving(true)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()
      
      // Load custom font to support Rupee symbol (₹)
      const hasCustomFont = await fetchAndRegisterFont(doc)
      const currencySymbol = hasCustomFont ? '₹' : 'Rs.'
      
      // Logo on top left
      let logoBase64 = ''
      try {
        logoBase64 = await getImageBase64('/logo.png')
      } catch (error) {
        console.error('Failed to load logo', error)
      }
      
      if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', 10, 10, 40, 9.7)
      } else {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(14)
        doc.setTextColor(15, 23, 42)
        doc.text("ACME INTERIORS", 10, 17)
      }
      
      if (hasCustomFont) {
        doc.setFont('Roboto', 'normal')
      }
      
      // Title on top right
      doc.setFontSize(14)
      doc.setTextColor(99, 102, 241) // Indigo
      doc.text("STAFF TRANSACTION LEDGER", pageWidth - 10, 15, { align: 'right' })
      
      if (hasCustomFont) {
        doc.setFont('Roboto', 'normal')
      } else {
        doc.setFont('helvetica', 'normal')
      }
      doc.setFontSize(9)
      doc.setTextColor(71, 85, 105) // Slate
      doc.text(`User: ${wallet.userId}`, pageWidth - 10, 20, { align: 'right' })
      
      doc.setFontSize(8)
      doc.setTextColor(100, 116, 139)
      doc.text(`Wallet ID: ${wallet._id.toString().slice(-12).toUpperCase()}`, pageWidth - 10, 24, { align: 'right' })
      doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, pageWidth - 10, 28, { align: 'right' })
      doc.text(`Available Balance: ${currencySymbol} ${wallet.balance.toLocaleString('en-IN')}`, pageWidth - 10, 32, { align: 'right' })
      
      doc.setDrawColor(226, 232, 240)
      doc.setLineWidth(0.5)
      doc.line(10, 36, pageWidth - 10, 36)
      
      // Table Header
      doc.setFontSize(9)
      doc.setTextColor(0, 0, 0)
      if (hasCustomFont) {
        doc.setFont('Roboto', 'normal')
      } else {
        doc.setFont('helvetica', 'bold')
      }
      doc.text("DATE", 10, 46)
      doc.text("TYPE", 32, 46)
      doc.text("PURPOSE", 55, 46)
      doc.text("SITE", 105, 46)
      doc.text("AMOUNT", 165, 46, { align: 'right' })
      doc.text("BALANCE", 200, 46, { align: 'right' })
      
      // Transactions
      let y = 56
      transactions.forEach((t: any) => {
        if (y > 280) {
            doc.addPage()
            y = 20
        }
        if (hasCustomFont) {
          doc.setFont('Roboto', 'normal')
        } else {
          doc.setFont('helvetica', 'normal')
        }
        doc.setFontSize(8)
        doc.text(t.date || "-", 10, y)
        doc.text(t.type || "-", 32, y)
        doc.text((t.purpose || "-").substring(0, 24), 55, y)
        const siteName = sites?.find(s => s._id === t.siteId)?.name || "-"
        doc.text(siteName.substring(0, 20), 105, y)
        
        const isIncome = t.type === 'CREDIT' || t.type === 'TRANSFER'
        const prefix = isIncome ? '+' : '-'
        doc.text(`${prefix}${currencySymbol}${t.amount.toLocaleString('en-IN')}`, 165, y, { align: 'right' })
        doc.text(`${currencySymbol}${(t.after_balance || 0).toLocaleString('en-IN')}`, 200, y, { align: 'right' })
        y += 8
      })
      
      doc.save(`ledger_${wallet.userId}.pdf`)
      toast({ title: "Export Successful", description: "Transaction ledger PDF has been generated." })
    } catch (e: any) {
      console.error(e)
      toast({ title: "Export Failed", variant: "destructive", description: "Failed to generate PDF ledger." })
    } finally {
      setIsSaving(false)
    }
  }

  // Analytics Processing
  const transactions = wallet.transactions || []
  const spendingBySite = transactions
    .filter((t: any) => t.type === 'DEBIT' && t.siteId)
    .reduce((acc: any, t: any) => {
      const siteName = sites?.find(s => s._id === t.siteId)?.name || 'Unknown Site'
      acc[siteName] = (acc[siteName] || 0) + t.amount
      return acc
    }, {})

  const siteData = Object.keys(spendingBySite).map(name => ({ name, value: spendingBySite[name] }))

  const spendingByCategory = transactions
    .filter((t: any) => t.type === 'DEBIT' && t.category)
    .reduce((acc: any, t: any) => {
      acc[t.category!] = (acc[t.category!] || 0) + t.amount
      return acc
    }, {})

  const categoryData = Object.keys(spendingByCategory).map(name => ({ name, value: spendingByCategory[name] }))

  const COLORS = ['#10b981', '#0ea5e9', '#f59e0b', '#ef4444', '#64748b', '#0d9488']

  return (
    <div className="space-y-8 pb-10">
      {/* Back Button & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/wallets">
              <Button variant="ghost" size="icon" className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-slate-100 dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-all text-slate-900 dark:text-white shrink-0"><ArrowLeft className="h-5 w-5" /></Button>
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase italic truncate max-w-[200px] sm:max-w-none">{wallet.userId}&apos;s Wallet</h1>
                <Badge className={cn(
                  "border-none font-black text-[8px] sm:text-[10px] uppercase px-2 sm:px-3 py-0.5 sm:py-1 shadow-lg shrink-0",
                  wallet.status === 'Active' ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"
                )}>
                  {wallet.status}
                </Badge>
              </div>
              <p className="text-muted-foreground font-bold italic text-[10px] sm:text-sm mt-1 flex items-center gap-2 truncate">
                  <span className="h-1 w-3 sm:w-4 bg-primary rounded-full shrink-0"></span>
                  Wallet ID: <span className="uppercase text-primary font-black truncate">{wallet._id.toString().slice(-12)}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {normalizeWalletUserId(wallet.userId) === normalizeWalletUserId(loggedInUser?.name || '') && (
                <Dialog open={isSpendOpen} onOpenChange={setIsSpendOpen}>
                  <DialogTrigger asChild>
                    <Button 
                        className="h-12 bg-primary hover:bg-primary/90 shadow-sm font-black uppercase tracking-widest text-[10px] rounded-xl px-6 border-b-4 border-primary/70 active:border-b-0 active:translate-y-1 transition-all text-white"
                    >
                      <ArrowDownRight className="mr-2 h-4 w-4" /> Spend Money
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[550px] bg-slate-950 border-white/10 rounded-xl p-0 max-h-[90vh] overflow-y-auto shadow-3xl">
                    <div className="bg-gradient-to-r from-[#06b6d4] to-[#0891b2] p-8 text-white">
                        <DialogTitle className="text-3xl font-black uppercase tracking-tight italic flex items-center gap-3 text-white">
                            <ArrowDownRight className="h-8 w-8 text-white" /> Expense Recording
                        </DialogTitle>
                        <DialogDescription className="text-white/80 font-bold italic mt-1 opacity-80">Record a direct expenditure from your wallet.</DialogDescription>
                    </div>
                    <div className="p-8 space-y-6">
                      <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Spend For</Label>
                        <div className="grid grid-cols-2 gap-4">
                            <Button 
                                variant={spendForm.spendFor === 'Site' ? 'default' : 'outline'}
                                className={cn(
                                    "h-12 font-black uppercase tracking-widest text-[10px] rounded-xl border-white/10",
                                    spendForm.spendFor === 'Site' ? "bg-primary hover:bg-primary/90 text-primary-foreground" : "bg-white/5 text-slate-400"
                                )}
                                onClick={() => setSpendForm({...spendForm, spendFor: 'Site'})}
                            >
                                Project Site
                            </Button>
                            <Button 
                                variant={spendForm.spendFor === 'Others' ? 'default' : 'outline'}
                                className={cn(
                                    "h-12 font-black uppercase tracking-widest text-[10px] rounded-xl border-white/10",
                                    spendForm.spendFor === 'Others' ? "bg-primary hover:bg-primary/90 text-primary-foreground" : "bg-white/5 text-slate-400"
                                )}
                                onClick={() => setSpendForm({...spendForm, spendFor: 'Others'})}
                            >
                                Others
                            </Button>
                        </div>
                      </div>

                      {spendForm.spendFor === 'Site' ? (
                        <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Select Project Site</Label>
                          <Select value={spendForm.siteId} onValueChange={v => setSpendForm({...spendForm, siteId: v})}>
                            <SelectTrigger className="h-12 bg-white/5 border-white/10 rounded-xl text-white font-black italic"><SelectValue placeholder="Select Site" /></SelectTrigger>
                            <SelectContent className="bg-slate-900 border-white/10 text-white">
                              {sites?.map((s, idx) => <SelectItem key={s._id} value={s._id} className="font-bold">{idx + 1}. {s.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Spending Reason / Custom Category</Label>
                          <Input 
                            placeholder="e.g. Office Lunch, Travel Reimbursement" 
                            className="h-12 bg-white/5 border-white/10 rounded-xl text-white font-bold italic"
                            value={spendForm.customReason}
                            onChange={e => setSpendForm({...spendForm, customReason: e.target.value})}
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Amount (₹)</Label>
                          <Input 
                            type="number" 
                            placeholder="0.00" 
                            className="h-12 bg-white/5 border-white/10 rounded-xl font-black text-white text-lg focus:ring-2 focus:ring-indigo-500"
                            value={spendForm.amount}
                            onChange={e => setSpendForm({...spendForm, amount: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Vendor / Payee (Optional)</Label>
                          <Select 
                            value={isNewVendor ? "NEW" : spendForm.vendor} 
                            onValueChange={v => { 
                              if (v === "NEW") {
                                setIsNewVendor(true)
                                setSpendForm({ ...spendForm, vendor: '' })
                              } else {
                                setIsNewVendor(false)
                                setSpendForm({ ...spendForm, vendor: v })
                              }
                            }}
                          >
                            <SelectTrigger className="h-12 bg-white/5 border-white/10 rounded-xl text-white font-bold italic">
                              <SelectValue placeholder="Select Vendor" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-white/10 text-white">
                              {vendors?.map(v => (
                                <SelectItem key={v._id} value={v.name} className="font-bold">
                                  {v.name}
                                </SelectItem>
                              ))}
                              <SelectItem value="NEW" className="font-bold text-indigo-400">
                                + Others (Add New Vendor)
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {isNewVendor && (
                        <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-4 animate-in slide-in-from-top-2 duration-300">
                          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400">New Vendor Details</p>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Vendor Name</Label>
                              <Input 
                                placeholder="e.g. Local Hardware" 
                                className="h-12 bg-white/5 border-white/10 rounded-xl text-white font-bold italic"
                                value={spendForm.newVendorName}
                                onChange={e => setSpendForm({...spendForm, newVendorName: e.target.value})}
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Category</Label>
                              <Select 
                                value={spendForm.newVendorCategory} 
                                onValueChange={v => setSpendForm({...spendForm, newVendorCategory: v})}
                              >
                                <SelectTrigger className="h-12 bg-white/5 border-white/10 rounded-xl text-white font-bold italic">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-white/10 text-white">
                                  <SelectItem value="Material" className="font-bold">Material</SelectItem>
                                  <SelectItem value="Labor" className="font-bold">Labor</SelectItem>
                                  <SelectItem value="Services" className="font-bold">Services</SelectItem>
                                  <SelectItem value="Others" className="font-bold">Others</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Contact Number (Optional)</Label>
                            <Input 
                              placeholder="e.g. +91 9876543210" 
                              className="h-12 bg-white/5 border-white/10 rounded-xl text-white font-bold italic"
                              value={spendForm.newVendorContact}
                              onChange={e => setSpendForm({...spendForm, newVendorContact: e.target.value})}
                            />
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Short Purpose</Label>
                          <Input 
                            placeholder="e.g. Hardware purchase" 
                            className="h-12 bg-white/5 border-white/10 rounded-xl text-white font-bold italic"
                            value={spendForm.purpose}
                            onChange={e => setSpendForm({...spendForm, purpose: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Payment Method</Label>
                          <Select value={spendForm.payment_method} onValueChange={v => setSpendForm({...spendForm, payment_method: v})}>
                            <SelectTrigger className="h-12 bg-white/5 border-white/10 rounded-xl text-white font-black italic"><SelectValue /></SelectTrigger>
                            <SelectContent className="bg-slate-900 border-white/10 text-white">
                              <SelectItem value="Cash" className="font-bold">Cash</SelectItem>
                              <SelectItem value="Bank Transfer" className="font-bold">Bank Transfer</SelectItem>
                              <SelectItem value="Credit Card" className="font-bold">Credit Card</SelectItem>
                              <SelectItem value="UPI" className="font-bold">UPI / GPay</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Additional Notes (Optional)</Label>
                        <Input 
                          placeholder="Any extra context..." 
                          className="h-12 bg-white/5 border-white/10 rounded-xl text-white font-bold italic"
                          value={spendForm.notes}
                          onChange={e => setSpendForm({...spendForm, notes: e.target.value})}
                        />
                      </div>

                      {Number(spendForm.amount) > wallet.balance && (
                        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl flex items-center gap-3 animate-in slide-in-from-bottom-2">
                          <AlertCircle className="h-5 w-5 shrink-0" />
                          <p className="text-xs font-bold leading-tight">
                            Insufficient funds. You are trying to spend ₹{Number(spendForm.amount).toLocaleString('en-IN')}, but your available balance is only ₹{wallet.balance.toLocaleString('en-IN')}.
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="p-8 pt-0">
                      <Button 
                        onClick={handleSpendMoney} 
                        disabled={isSaving || Number(spendForm.amount) > wallet.balance} 
                        className={cn(
                          "w-full h-14 text-white rounded-2xl font-black text-lg uppercase tracking-widest border-b-4 transition-all active:border-b-0 active:translate-y-1",
                          Number(spendForm.amount) > wallet.balance 
                            ? "bg-slate-800 border-slate-900 opacity-50 cursor-not-allowed" 
                            : "bg-primary hover:bg-primary/90 shadow-lg border-primary/70"
                        )}
                      >
                        {isSaving ? <Loader2 className="animate-spin h-6 w-6 mr-2 text-white" /> : "Confirm Expenditure"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
            )}

            {hasPermission('Top Up Team Wallets') && (
                <Dialog open={isTopUpOpen} onOpenChange={setIsTopUpOpen}>
                  <DialogTrigger asChild>
                    <Button 
                        onClick={() => setTopUpForm(prev => ({ ...prev, userId: wallet.userId }))}
                        className="h-12 bg-primary hover:bg-primary/90 shadow-[0_10px_30px_-5px_hsl(var(--primary)/0.5)] font-black uppercase tracking-widest text-[10px] rounded-xl px-6 border-b-4 border-primary/70 active:border-b-0 active:translate-y-1 transition-all"
                    >
                      <Plus className="mr-2 h-4 w-4" /> Instant Top Up
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[550px] bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 rounded-xl p-0 max-h-[90vh] overflow-y-auto shadow-3xl">
                    <div className="bg-gradient-to-r from-slate-900 to-slate-800 dark:from-white dark:to-slate-200 p-8 text-white dark:text-slate-900">
                        <DialogTitle className="text-3xl font-black uppercase tracking-tight italic flex items-center gap-3">
                            <ArrowUpRight className="h-8 w-8" /> Instant Top Up
                        </DialogTitle>
                        <DialogDescription className="text-white/60 dark:text-slate-600 font-bold mt-1">Add funds to {wallet.userId}&apos;s account instantly from Company Vault.</DialogDescription>
                    </div>
                    <div className="p-8 space-y-6">
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Target Staff Member</Label>
                          <Select 
                            value={topUpForm.userId} 
                            onValueChange={v => setTopUpForm({...topUpForm, userId: v})}
                          >
                            <SelectTrigger className="h-12 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white font-black italic">
                                <SelectValue placeholder="Select Staff" />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white">
                              {users?.map(u => (
                                <SelectItem key={u._id} value={u.name} className="font-bold">
                                    {u.name} — <span className="opacity-50">{u.role}</span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Amount (₹)</Label>
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
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Reason for Top Up</Label>
                        <Input 
                          placeholder={`e.g. Weekly allowance for ${wallet.userId}`} 
                          className="h-12 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white font-bold italic"
                          value={topUpForm.reason}
                          onChange={e => setTopUpForm({...topUpForm, reason: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="p-8 pt-0">
                      <Button onClick={handleTopUp} disabled={isSaving} className="w-full h-14 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 rounded-2xl font-black text-lg shadow-xl uppercase tracking-widest transition-all">
                        {isSaving ? <Loader2 className="animate-spin h-6 w-6 mr-2" /> : "Authorize Funding"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
            )}
             {hasPermission('Edit Settings') && id && !id.toString().startsWith('virtual_') && (
                <Button 
                    variant="outline" 
                    className="h-12 border-white/10 bg-white/5 hover:bg-white/10 font-black uppercase tracking-widest text-[10px] rounded-xl px-6 dark:text-white"
                    onClick={() => handleUpdateStatus(wallet.status === 'Frozen' ? 'Active' : 'Frozen')}
                >
                    <Snowflake className={cn("mr-2 h-4 w-4", wallet.status === 'Frozen' ? "text-emerald-500 animate-pulse" : "text-amber-500")} /> 
                    {wallet.status === 'Frozen' ? 'Release Wallet' : 'Hold / Freeze'}
                </Button>
            )}
                    <Button 
                        onClick={exportTransactionLedger}
                        disabled={isSaving}
                        className="h-10 sm:h-12 bg-slate-900/5 dark:bg-white/5 hover:bg-slate-900/10 dark:hover:bg-white/10 border border-slate-900/10 dark:border-white/10 shadow-sm font-black uppercase tracking-widest text-[9px] sm:text-[10px] rounded-xl px-4 sm:px-6 transition-all text-slate-900 dark:text-white flex-1 sm:flex-none"
                    >
                        {isSaving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Download className="mr-2 h-4 w-4" />}
                        Export Ledger
                    </Button>
                </div>
            </div>

      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card className="md:col-span-2 border-none shadow-sm bg-white dark:bg-slate-900/40 border-l-4 border-slate-900 dark:border-slate-700 overflow-hidden relative group rounded-xl">
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] transform scale-150 rotate-12 group-hover:scale-110 transition-transform duration-700"><Wallet className="h-48 w-48 text-slate-400" /></div>
          <CardContent className="pt-10 pb-10 px-8 relative z-10">
            <div className="flex items-center gap-2 mb-2">
                <div className="h-1.5 w-6 bg-primary rounded-full"></div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Balance</p>
            </div>
            <h2 className="text-4xl sm:text-5xl md:text-7xl font-black mt-2 tracking-tighter text-slate-900 dark:text-white leading-tight pt-2 pb-2">₹{wallet.balance.toLocaleString('en-IN')}</h2>
            <div className="mt-6 sm:mt-10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-6 sm:gap-4 border-t border-slate-100 dark:border-white/5 pt-8">
                <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1 mb-1 sm:mb-0">
                        <ArrowUpRight className="h-3 w-3 text-emerald-500" /> Credit
                    </p>
                    <p className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-200">₹{(wallet.total_credited || 0).toLocaleString('en-IN')}</p>
                </div>
                <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1 mb-1 sm:mb-0">
                        <ArrowUpRight className="h-3 w-3 text-emerald-400" /> Trnsf IN
                    </p>
                    <p className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-200">₹{(wallet.totalTransferredIn || 0).toLocaleString('en-IN')}</p>
                </div>
                <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1 mb-1 sm:mb-0">
                        <ArrowDownRight className="h-3 w-3 text-rose-500" /> Expenses
                    </p>
                    <p className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-200">₹{(wallet.total_debited || 0).toLocaleString('en-IN')}</p>
                </div>
                <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1 mb-1 sm:mb-0">
                        <ArrowDownRight className="h-3 w-3 text-rose-400" /> Trnsf OUT
                    </p>
                    <p className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-200">₹{(wallet.totalTransferredOut || 0).toLocaleString('en-IN')}</p>
                </div>
                <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1 mb-1 sm:mb-0">
                        <ArrowDownRight className="h-3 w-3 text-amber-500" /> Returned
                    </p>
                    <p className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-200">₹{(wallet.totalReturned || 0).toLocaleString('en-IN')}</p>
                </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-white dark:bg-slate-900 border-l-4 border-emerald-500">
            <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">Last Activity</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center"><ArrowUpRight className="h-5 w-5" /></div>
                    <div>
                        <p className="text-xs font-black text-slate-500 italic">Last Top-up</p>
                        <p className="text-lg font-black tracking-tight">{wallet.lastTopUpDate ? wallet.lastTopUpDate : 'No activity'}</p>
                    </div>
                </div>
                <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase">
                        <span>Utilization Rate</span>
                        <span>{Math.round(((wallet.total_debited || 0) / (wallet.total_credited || 1)) * 100)}%</span>
                    </div>
                    <Progress value={((wallet.total_debited || 0) / (wallet.total_credited || 1)) * 100} className="h-2" />
                </div>
            </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-white dark:bg-slate-900 border-l-4 border-amber-500">
            <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">Wallet Status</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold italic">Status</span>
                        <Badge className={cn(
                            "border-none font-black text-[9px]",
                            wallet.status === 'Active' ? "bg-emerald-500 text-white dark:bg-emerald-500/20 dark:text-emerald-400" : "bg-amber-500 text-white dark:bg-amber-500/20 dark:text-amber-400"
                        )}>{wallet.status.toUpperCase()}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold italic">Returns</span>
                        <span className="text-sm font-black text-amber-600">₹{(wallet.totalReturned || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold italic">Transactions</span>
                        <span className="text-sm font-black text-indigo-500">{transactions.length}</span>
                    </div>
                </div>
            </CardContent>
        </Card>
      </div>

      {/* Analytics Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-none shadow-xl bg-white dark:bg-slate-900 overflow-hidden">
          <CardHeader className="bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-widest italic">
              <PieChartIcon className="h-4 w-4 text-indigo-500" /> Spending by Site
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[300px] w-full">
              {siteData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={siteData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {siteData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} 
                        itemStyle={{ fontWeight: 'black', textTransform: 'uppercase', fontSize: '10px'}}
                      />
                    </PieChart>
                  </ResponsiveContainer>
              ) : (
                  <div className="flex h-full items-center justify-center bg-slate-50/50 dark:bg-slate-800/30 rounded-3xl border-2 border-dashed border-slate-100 dark:border-slate-800">
                      <p className="text-xs font-black uppercase tracking-widest text-slate-300 italic">No site spending data</p>
                  </div>
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
                {siteData.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                        <span className="text-[10px] font-black uppercase truncate max-w-[120px]">{entry.name}</span>
                        <span className="text-[10px] font-bold text-muted-foreground ml-auto">₹{entry.value.toLocaleString()}</span>
                    </div>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl bg-white dark:bg-slate-900">
          <CardHeader className="bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-widest italic">
              <BarChartIcon className="h-4 w-4 text-emerald-500" /> Category Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[350px] w-full">
                {categoryData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={categoryData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                            <XAxis type="number" hide />
                            <YAxis 
                                dataKey="name" 
                                type="category" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 10, fontWeight: 'black', fill: '#64748b' }}
                                width={100}
                            />
                            <Tooltip 
                                cursor={{ fill: '#f8fafc' }}
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} 
                                itemStyle={{ fontWeight: 'black', textTransform: 'uppercase', fontSize: '10px'}}
                            />
                            <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={20} />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex h-full items-center justify-center bg-slate-50/50 dark:bg-slate-800/30 rounded-3xl border-2 border-dashed border-slate-100 dark:border-slate-800">
                        <p className="text-xs font-black uppercase tracking-widest text-slate-300 italic">No category data</p>
                    </div>
                )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction History with Verified Trail */}
      <Card className="border-none shadow-xl bg-white dark:bg-slate-900 overflow-hidden rounded-3xl">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between p-6">
          <CardTitle className="text-sm font-black uppercase tracking-[0.2em] italic flex items-center gap-2">
            <Clock className="h-4 w-4 text-indigo-500" /> Transaction History
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
            {transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <Clock className="h-10 w-10 text-slate-200 mb-2" />
                    <p className="text-xs font-black uppercase tracking-widest text-slate-300 italic">No transaction history recorded yet</p>
                </div>
            ) : (
                <>
                    {/* Mobile Card View */}
                    <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                        {transactions.map((t: any) => (
                            <div key={t._id} className="p-5 space-y-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{t.date}</p>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter opacity-70">{t.time}</p>
                                    </div>
                                    <Badge className={cn(
                                        "border-none font-black text-[8px] px-2 py-0.5 rounded-full uppercase",
                                        t.type === 'CREDIT' ? "bg-emerald-500/10 text-emerald-600" :
                                        t.type === 'TRANSFER' ? "bg-indigo-500/10 text-indigo-600" :
                                        t.type === 'RETURN' ? "bg-amber-500/10 text-amber-600" :
                                        "bg-rose-500/10 text-rose-600"
                                    )}>
                                        {t.type}
                                    </Badge>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-black text-slate-900 dark:text-white uppercase leading-tight">{t.purpose}</p>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-80">{t.source_or_vendor || (t.type === 'CREDIT' ? 'Top-up' : 'General')}</p>
                                </div>
                                <div className="flex items-center justify-between pt-2">
                                    <div className="flex items-center gap-4">
                                        {t.siteId && (
                                            <div className="flex items-center gap-1.5">
                                                <MapPin className="h-3 w-3 text-indigo-500" />
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-tight truncate max-w-[100px]">
                                                    {sites?.find(s => s._id === t.siteId)?.name || 'Loading...'}
                                                </span>
                                            </div>
                                        )}
                                        <div className="flex flex-col">
                                            <span className="text-[8px] font-black text-slate-400 uppercase leading-none">Performed By</span>
                                            <span className="text-[10px] font-bold text-slate-500 mt-1">{t.performed_by || t.approved_by || '—'}</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={cn(
                                            "text-base font-black leading-none tracking-tighter",
                                            (t.type === 'CREDIT' || t.type === 'TRANSFER') ? "text-emerald-600" : "text-rose-600"
                                        )}>
                                            {(t.type === 'CREDIT' || t.type === 'TRANSFER') ? '+' : '-'} ₹{t.amount.toLocaleString()}
                                        </p>
                                        {t.after_balance !== undefined && (
                                            <p className="text-[9px] font-black text-slate-400 mt-1 uppercase tracking-widest">
                                                Bal: ₹{t.after_balance.toLocaleString()}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800/50 text-left">
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Date & Time</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Type</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Description</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Site</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Performed By</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Amount</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Balance After</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium italic">
                                {transactions.map((t: any) => (
                                    <tr key={t._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                                        <td className="px-6 py-4">
                                            <p className="text-xs font-black text-slate-900 dark:text-white leading-tight">{t.date}</p>
                                            <p className="text-[10px] text-muted-foreground uppercase opacity-70 mt-1">{t.time}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <Badge className={cn(
                                                "border-none font-black text-[9px] px-2 py-0.5 whitespace-nowrap",
                                                t.type === 'CREDIT' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" :
                                                t.type === 'TRANSFER' ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400" :
                                                t.type === 'RETURN' ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400" :
                                                "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400"
                                            )}>
                                                {t.type}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase truncate max-w-[200px]">{t.purpose}</p>
                                            <p className="text-[10px] text-muted-foreground uppercase opacity-70 mt-1">{t.source_or_vendor || (t.type === 'CREDIT' ? 'Top-up' : 'General')}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            {t.siteId ? (
                                                <div className="flex items-center gap-1.5">
                                                    <MapPin className="h-3 w-3 text-indigo-500" />
                                                    <span className="text-xs font-bold uppercase truncate max-w-[120px]">{sites?.find(s => s._id === t.siteId)?.name || 'Loading...'}</span>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] text-slate-300 font-black tracking-widest uppercase">Global</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-xs font-bold text-slate-500">{t.performed_by || t.approved_by || '—'}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={cn(
                                                "text-sm font-black",
                                                (t.type === 'CREDIT' || t.type === 'TRANSFER') ? "text-emerald-600" : "text-rose-600"
                                            )}>
                                                {(t.type === 'CREDIT' || t.type === 'TRANSFER') ? '+' : '-'} ₹{t.amount.toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {t.after_balance !== undefined && t.after_balance !== null ? (
                                                <span className="text-xs font-black text-slate-600 dark:text-slate-300">₹{t.after_balance.toLocaleString('en-IN')}</span>
                                            ) : (
                                                <span className="text-[10px] text-slate-300 italic">—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </CardContent>
      </Card>
    </div>
  )
}
