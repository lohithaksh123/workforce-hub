'use client'

import { useState, useContext, useEffect } from 'react'
import { Plus, Wallet, CreditCard, Download, Loader2, Landmark, History, ArrowDownLeft, ArrowUpRight, MinusCircle, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { useQuery, useMutation } from "convex/react"
import { cn, normalizeWalletUserId } from '@/lib/utils'
import { api } from "@/convex/_generated/api"
import { UserContext } from '@/components/dashboard/UserContext'

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

export default function WalletPage() {
  const { user } = useContext(UserContext)
  
  const hasPermission = (name: string) => {
    if (user?.role === 'Owner') return true
    if (!user || !Array.isArray(user.permissions)) return false
    return user.permissions.find((p: any) => p.key === name || p.name === name)?.allowed || false
  }

  const isOwner = user?.role === 'Owner'
  const canManageWallet = hasPermission('manage_company_wallet')
  const financialSummary = useQuery(api.central_wallet.getFinancialSummary, canManageWallet ? {} : { userId: user?.name })
  const rawTransactions = useQuery(api.requests.getTransactions)
  const normUserName = normalizeWalletUserId(user?.name || '')
  const myPersonalWallet = useQuery(api.wallets.getMyWallet, user?.name ? { userId: user.name } : "skip")
  const createWallet = useMutation(api.wallets.createUserWallet)

  useEffect(() => {
    if (user?.name && myPersonalWallet === null) {
      createWallet({ userId: user.name })
    }
  }, [user?.name, myPersonalWallet, createWallet])

  useEffect(() => {
    if (user?.role && user.role !== 'Owner') {
      setUseFormData(prev => ({ ...prev, walletType: 'Team', teamMemberId: user.name }));
    }
  }, [user?.role, user?.name])

  const transactions = canManageWallet 
    ? rawTransactions 
    : rawTransactions?.filter(t => normalizeWalletUserId(t.used_by || '') === normUserName)
  const vendors = useQuery(api.users.getVendors)
  const addOwnerMoney = useMutation(api.central_wallet.addOwnerMoney)
  const useMoney = useMutation(api.requests.useMoney)
  const createVendor = useMutation(api.users.createVendor)
  const createRequest = useMutation(api.requests.createRequest)
  const createSite = useMutation(api.sites.createSite)

  const sites = useQuery(api.sites.getSites)

  const [isAddMoneyOpen, setIsAddMoneyOpen] = useState(false)
  const [isUseMoneyOpen, setIsUseMoneyOpen] = useState(false)
  const [addFormData, setAddFormData] = useState({
    amount: '',
    source: 'cash',
    sourceName: '',
    notes: '',
    date: new Date().toISOString().split('T')[0],
  })
  
  const [isNewSite, setIsNewSite] = useState(false)
  const [newSiteData, setNewSiteData] = useState({ name: '', location: '', clientName: '', projectType: 'Others' as any })
  
  const [useFormData, setUseFormData] = useState({
    amount: '',
    vendor: '',
    purpose: '',
    method: 'Cash',
    notes: '',
    newVendorName: '',
    newVendorContact: '',
    newVendorCategory: 'Material',
    siteId: '',
    walletType: 'Company' as 'Company' | 'Site' | 'Team',
    teamMemberId: '',
    date: new Date().toISOString().split('T')[0]
  })

  const selectedSite = useQuery(api.sites.getSiteById, useFormData.siteId ? { id: useFormData.siteId as any } : "skip")

  const [isSaving, setIsSaving] = useState(false)
  const [isNewVendor, setIsNewVendor] = useState(false)
  const [activeFilter, setActiveFilter] = useState<'all' | 'income' | 'expense'>('all')
  const [useMoneyError, setUseMoneyError] = useState<string | null>(null)
  const [addMoneyError, setAddMoneyError] = useState<string | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)

  const balance = financialSummary?.balance ?? 0
  const totalReceived = financialSummary?.totalReceived ?? 0
  const totalSpent = financialSummary?.totalSpent ?? 0
  const companyWalletBalance = financialSummary?.companyWalletBalance ?? 0
  const siteWalletsBalance = financialSummary?.siteWalletsBalance ?? 0
  const totalAvailableBalance = financialSummary?.totalAvailableBalance ?? balance

  const handleAddMoney = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddMoneyError(null)
    const numAmount = parseFloat(addFormData.amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      setAddMoneyError("Please enter a valid amount")
      return
    }

    const today = new Date().toISOString().split('T')[0]
    if (addFormData.date !== today) {
      if (!window.confirm(`Notice: You have selected ${addFormData.date} instead of today's date. Are you sure you want to proceed with this date?`)) {
        return
      }
    }

    setIsSaving(true)
    try {
      let finalSiteId = addFormData.sourceName !== 'INTERNAL_GENERAL' ? addFormData.sourceName : undefined
      let finalSourceName = "General Investment / Internal"

      if (isNewSite) {
          if (!newSiteData.name) {
              setAddMoneyError("Please provide a name for the new site/source")
              setIsSaving(false)
              return
          }
          const siteResult = (await createSite({
              name: newSiteData.name,
              code: newSiteData.name.substring(0,3).toUpperCase() + Math.floor(Math.random()*1000),
              location: newSiteData.location || "TBD",
              status: "Active",
              startDate: new Date().toISOString().split('T')[0],
              managerId: user.name,
              clientName: newSiteData.clientName || newSiteData.name,
              projectType: newSiteData.projectType,
              teamMembers: [user.name],
              notes: "Dynamically added from direct deposit"
          })) as any
  
          if (!siteResult.success) {
              setAddMoneyError(siteResult.error || "Failed to create new site")
              setIsSaving(false)
              return
          }
          finalSiteId = siteResult.siteId
          finalSourceName = newSiteData.name
      } else if (finalSiteId) {
          const selected = sites?.find(s => s._id === finalSiteId)
          if (selected) finalSourceName = selected.name
      }

      const result = (await addOwnerMoney({
        amount: numAmount,
        source: addFormData.source as any,
        source_name: finalSourceName,
        siteId: finalSiteId as any,
        notes: addFormData.notes,
        added_by: user.name,
        date: addFormData.date || new Date().toISOString().split('T')[0]
      })) as any
      
      if (result.success) {
        setIsAddMoneyOpen(false)
        setAddFormData({ amount: '', source: 'cash', sourceName: '', notes: '', date: new Date().toISOString().split('T')[0] })
        setIsNewSite(false)
        setNewSiteData({ name: '', location: '', clientName: '', projectType: 'Others' })
        toast({ title: "Success", description: `₹${numAmount.toLocaleString()} added dynamically from ${finalSourceName}.` })
      } else {
        setAddMoneyError(result.error || "Failed to add money")
      }
    } catch (error) {
      console.error("Add money failed:", error)
      setAddMoneyError("A system error occurred. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleUseMoney = async (e: React.FormEvent) => {
    e.preventDefault()
    setUseMoneyError(null)
    const numAmount = parseFloat(useFormData.amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      setUseMoneyError("Please enter a valid amount")
      return 
    }

    if (isNewVendor && !useFormData.newVendorName) {
      setUseMoneyError("Please provide a name for the new vendor")
      return
    }

    const today = new Date().toISOString().split('T')[0]
    if (useFormData.date !== today) {
      if (!window.confirm(`Notice: You have selected ${useFormData.date} instead of today's date. Are you sure you want to proceed with this date?`)) {
        return
      }
    }

    setIsSaving(true)
    try {
      let finalVendorName = useFormData.vendor

      if (isNewVendor) {
        const vResult = (await createVendor({
          name: useFormData.newVendorName,
          contact: useFormData.newVendorContact,
          category: useFormData.newVendorCategory as any
        })) as any
        if (!vResult.success) {
          setUseMoneyError(vResult.error || "Failed to register new vendor")
          setIsSaving(false)
          return
        }
        finalVendorName = useFormData.newVendorName
      }
      
      let result: any
      const siteId = useFormData.siteId || undefined
      let walletId = undefined
      
      if (useFormData.walletType === 'Site' && selectedSite?.wallet) {
        walletId = selectedSite.wallet._id
      } else if (useFormData.walletType === 'Team') {
        if (useFormData.siteId && useFormData.teamMemberId) {
          const tw = (selectedSite?.teamWallets as any[])?.find(w => w.userId === useFormData.teamMemberId)
          if (tw) walletId = tw._id
        } else if (!useFormData.siteId && myPersonalWallet) {
          walletId = myPersonalWallet._id
        }
      }

      if (user.role === 'Owner') {
        result = await useMoney({
          amount: numAmount,
          vendor: finalVendorName,
          purpose: useFormData.purpose,
          payment_method: useFormData.method,
          notes: useFormData.notes,
          used_by: user.name,
          siteId: siteId as any,
          walletId: walletId as any,
          category: useFormData.newVendorCategory as any,
          date: useFormData.date
        })
      } else {
        result = await createRequest({
          amount: numAmount,
          vendor_name: finalVendorName,
          purpose: useFormData.purpose,
          payment_method: useFormData.method,
          description: useFormData.notes || "Requested from wallet",
          requested_by: user.name,
          siteId: siteId as any,
          walletId: walletId as any,
          category: useFormData.newVendorCategory as any,
          date: useFormData.date
        })
      }

      if (result.success) {
        toast({ 
          title: user.role === 'Owner' ? "Wallet Updated" : "Request Sent", 
          description: user.role === 'Owner' 
            ? `₹${numAmount.toLocaleString()} deducted.`
            : `Approval request for ₹${numAmount.toLocaleString()} sent.`
        })
        setIsUseMoneyOpen(false)
        setUseFormData({ 
          amount: '', vendor: '', purpose: '', method: 'Cash', 
          notes: '', newVendorName: '', newVendorContact: '', newVendorCategory: 'Material',
          siteId: '', walletType: 'Company', teamMemberId: '', date: new Date().toISOString().split('T')[0]
        })
        setIsNewVendor(false)
      } else {
        setUseMoneyError(result.error || "Transaction failed")
      }
    } catch (error: any) {
      console.error("Wallet operation failed:", error)
      setUseMoneyError("A system error occurred. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  const downloadStatement = async () => {
    setIsDownloading(true)
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
      doc.setTextColor(16, 185, 129) // Emerald
      doc.text("COMPANY WALLET LEDGER", pageWidth - 10, 15, { align: 'right' })
      
      if (hasCustomFont) {
        doc.setFont('Roboto', 'normal')
      } else {
        doc.setFont('helvetica', 'normal')
      }
      doc.setFontSize(9)
      doc.setTextColor(71, 85, 105) // Slate
      doc.text("Acme Interiors", pageWidth - 10, 20, { align: 'right' })
      
      doc.setFontSize(8)
      doc.setTextColor(100, 116, 139)
      doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, pageWidth - 10, 25, { align: 'right' })
      doc.text(`Available Balance: ${currencySymbol} ${balance.toLocaleString('en-IN')}`, pageWidth - 10, 29, { align: 'right' })
      
      doc.setDrawColor(226, 232, 240)
      doc.setLineWidth(0.5)
      doc.line(10, 33, pageWidth - 10, 33)
      
      // Table Header
      doc.setFontSize(9)
      doc.setTextColor(0, 0, 0)
      if (hasCustomFont) {
        doc.setFont('Roboto', 'normal')
      } else {
        doc.setFont('helvetica', 'bold')
      }
      doc.text("DATE", 10, 43)
      doc.text("TYPE", 32, 43)
      doc.text("PURPOSE", 55, 43)
      doc.text("SOURCE / VENDOR", 105, 43)
      doc.text("BY", 145, 43)
      doc.text("AMOUNT", 200, 43, { align: 'right' })
      
      // Transactions
      let y = 53
      const txs = transactions || []
      txs.forEach((t: any) => {
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
        doc.text((t.source_or_vendor || "-").substring(0, 18), 105, y)
        doc.text((t.used_by || "-").substring(0, 10), 145, y)
        const isIncome = t.type === 'Money In' || t.type === 'CREDIT'
        const prefix = isIncome ? '+' : '-'
        doc.text(`${prefix}${currencySymbol}${t.amount.toLocaleString('en-IN')}`, 200, y, { align: 'right' })
        y += 8
      })
      
      doc.save("company_wallet_statement.pdf")
      toast({ title: "Statement Downloaded", description: "Your company wallet statement has been generated." })
    } catch (e: any) {
      console.error(e)
      toast({ title: "Download Failed", variant: "destructive", description: "Failed to generate statement." })
    } finally {
      setIsDownloading(false)
    }
  }

  if (!financialSummary) return <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8" /></div>

  if (!canManageWallet) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <AlertCircle className="h-12 w-12 text-rose-500" />
        <h2 className="text-2xl font-black uppercase tracking-tight">Access Denied</h2>
        <p className="text-slate-500 font-bold italic">Only the Owner can access the Company Wallet overview.</p>
        <Button onClick={() => window.location.href = '/dashboard'}>Return to Dashboard</Button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 w-full min-w-0 pr-0 md:pr-10">
        <div className="text-center md:text-left">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white uppercase italic tracking-tighter leading-tight">Company Wallet</h2>
          <p className="text-muted-foreground mt-1 font-medium italic text-xs sm:text-sm md:text-base mx-auto md:mx-0 max-w-lg">Internal shared wallet for Acme Interiors team</p>
        </div>
        <Button variant="outline" onClick={downloadStatement} disabled={isDownloading} className="w-full md:w-auto h-11 rounded-xl font-bold border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800">
          <Download className="mr-2 h-4 w-4" /> Download Statement
        </Button>
      </div>

      <div className={cn(
        "grid gap-6 grid-cols-1 sm:grid-cols-2",
        isOwner ? "lg:grid-cols-5" : "lg:grid-cols-4"
      )}>
        {/* OWNER PERSONAL WALLET */}
        {isOwner && (
          <Card className="relative overflow-hidden border-none shadow-sm bg-gradient-to-br from-violet-950/20 via-slate-900/40 to-slate-900/10 border-l-2 border-violet-500 group h-full flex flex-col">
              <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform duration-700">
                  <CreditCard className="h-20 w-20 text-violet-400" />
              </div>
              <CardHeader className="pb-2 min-h-[56px]">
                  <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-violet-500">
                      Owner Personal Wallet (Spendable)
                  </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-between">
                  <div className="text-4xl font-black tracking-tighter text-violet-500 leading-tight pt-2">
                      ₹{myPersonalWallet?.balance?.toLocaleString() ?? 0}
                  </div>
                  <div>
                    {myPersonalWallet?._id ? (
                      <Link 
                        href={`/dashboard/wallets/${myPersonalWallet._id}`}
                        className="mt-4 text-[10px] font-bold text-violet-400 hover:text-violet-300 uppercase tracking-widest flex items-center gap-1 hover:underline transition-all cursor-pointer"
                      >
                        View Personal History →
                      </Link>
                    ) : (
                      <p className="mt-4 text-[10px] font-bold text-slate-500 dark:text-slate-500/50 uppercase tracking-widest">
                        Personal Spendable Balance
                      </p>
                    )}
                  </div>
              </CardContent>
              <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-violet-500/10" />
          </Card>
        )}

        {/* COMPANY VAULT (OWNER WALLET) */}
        <Card className="relative overflow-hidden border-none shadow-sm bg-gradient-to-br from-indigo-950/20 via-slate-900/40 to-slate-900/10 border-l-2 border-indigo-500 group h-full flex flex-col">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform duration-700">
                <Wallet className="h-20 w-20 text-indigo-400" />
            </div>
            <CardHeader className="pb-2 min-h-[56px]">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-500">
                    Company Vault Balance (Owner)
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between">
                <div className="text-4xl font-black tracking-tighter text-indigo-500 leading-tight pt-2">
                    ₹{(companyWalletBalance + siteWalletsBalance).toLocaleString()}
                </div>
                <p className="mt-4 text-[10px] font-bold text-slate-500 dark:text-slate-500/50 uppercase tracking-widest leading-relaxed">
                    Unallocated: ₹{companyWalletBalance.toLocaleString()} | Sites: ₹{siteWalletsBalance.toLocaleString()}
                </p>
            </CardContent>
            <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-indigo-500/10" />
        </Card>

        {/* TOTAL COMPANY SYSTEM BALANCE */}
        <Card className="relative overflow-hidden border-none shadow-sm bg-white dark:bg-slate-900/40 border-l-2 border-slate-200 dark:border-slate-700 group h-full flex flex-col">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03]">
                <Landmark className="h-20 w-20 text-slate-400" />
            </div>
            <CardHeader className="pb-2 min-h-[56px]">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                    Total System Balance
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between">
                <div className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white leading-tight pt-2">
                    ₹{totalAvailableBalance.toLocaleString()}
                </div>
                <p className="mt-4 text-[10px] font-bold text-slate-500 dark:text-slate-500/50 uppercase tracking-widest">
                    Combined Vault + Sites + Staff
                </p>
            </CardContent>
            <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-slate-500/10" />
        </Card>

        {/* CREDIT */}
        <Card 
            className={cn(
                "relative overflow-hidden border-none shadow-sm transition-all duration-500 group bg-white dark:bg-emerald-500/[0.05] border-l-2 border-emerald-500/30 hover:border-emerald-500/50 h-full flex flex-col",
                activeFilter === 'income' ? 'ring-1 ring-emerald-500/30' : ''
            )}
            onClick={() => setActiveFilter(activeFilter === 'income' ? 'all' : 'income')}
        >
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.07] group-hover:scale-110 transition-all duration-700">
                <ArrowDownLeft className="h-24 w-24 text-emerald-600 dark:text-emerald-500" />
            </div>
            <CardHeader className="pb-2 min-h-[56px]">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-600/70 dark:text-emerald-500/40">
                    Credit
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between">
                <div className="text-4xl font-black tracking-tighter text-emerald-600 dark:text-emerald-500/90 leading-tight pt-2">
                    ₹{totalReceived.toLocaleString()}
                </div>
                <p className="mt-4 text-[10px] font-bold text-slate-500 dark:text-slate-500/50 uppercase tracking-widest">
                    Total External Credit Received
                </p>
            </CardContent>
            <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-emerald-500/10" />
        </Card>

        {/* DEBIT / EXPENSES */}
        <Card 
            className={cn(
                "relative overflow-hidden border-none shadow-sm transition-all duration-500 group bg-white dark:bg-rose-500/[0.05] border-l-2 border-rose-500/30 hover:border-rose-500/50 h-full flex flex-col",
                activeFilter === 'expense' ? 'ring-1 ring-rose-500/30' : ''
            )}
            onClick={() => setActiveFilter(activeFilter === 'expense' ? 'all' : 'expense')}
        >
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.07] group-hover:scale-110 transition-all duration-700">
                <ArrowUpRight className="h-24 w-24 text-rose-600 dark:text-rose-500" />
            </div>
            <CardHeader className="pb-2 min-h-[56px]">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-600/70 dark:text-rose-500/40">
                    Debit / Expenses
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between">
                <div className="text-4xl font-black tracking-tighter text-rose-600 dark:text-rose-500/90 leading-tight pt-2">
                    ₹{totalSpent.toLocaleString()}
                </div>
                <p className="mt-4 text-[10px] font-bold text-slate-500 dark:text-slate-500/50 uppercase tracking-widest">
                    Actual Money Spent Outside
                </p>
            </CardContent>
            <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-rose-500/10" />
        </Card>
      </div>

      {/* COMMAND ACTION PANEL */}
      <div className="flex flex-col md:flex-row items-center gap-4 bg-white dark:bg-slate-900/50 p-4 md:p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="flex-1 text-center md:text-left">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-1">Financial Controls</h3>
            <p className="text-[10px] text-slate-600 font-bold">Execute wallet operations and fund transfers</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            {canManageWallet && (
                <Dialog open={isAddMoneyOpen} onOpenChange={setIsAddMoneyOpen}>
                    <DialogTrigger asChild>
                        <Button className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-[10px] px-6 h-11 shadow-lg shadow-emerald-900/20 transition-all active:scale-95">
                            <Plus className="mr-2 h-4 w-4" /> Add Money
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <form onSubmit={handleAddMoney} className="space-y-4">
                            <DialogHeader><DialogTitle>Add Money</DialogTitle></DialogHeader>
                            <div className="space-y-4 py-4">
                                {addMoneyError && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{addMoneyError}</AlertDescription></Alert>}
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase">Incoming Source (Select Site / Project)</Label>
                                    <Select 
                                        value={isNewSite ? "NEW" : addFormData.sourceName} 
                                        onValueChange={v => { if(v==="NEW") setIsNewSite(true); else {setIsNewSite(false); setAddFormData({...addFormData, sourceName: v})} }}
                                    >
                                        <SelectTrigger><SelectValue placeholder="Select existing site or add new" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="INTERNAL_GENERAL" className="font-bold text-amber-500">General Setup / Self Investment</SelectItem>
                                            {sites?.map((s, i) => <SelectItem key={s._id} value={s._id}>{i + 1}. {s.name} ({s.location})</SelectItem>)}
                                            <SelectItem value="NEW" className="font-bold text-primary">+ Add New Site / Project</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {isNewSite && (
                                    <div className="p-4 bg-muted/50 rounded-xl space-y-3 border border-border/50">
                                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary">New Site Details</Label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <Label className="text-[9px] uppercase font-bold text-slate-500">Site Name</Label>
                                                <Input placeholder="e.g. Apartment 401" value={newSiteData.name} onChange={e => setNewSiteData({...newSiteData, name: e.target.value})} autoFocus />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[9px] uppercase font-bold text-slate-500">Client Name</Label>
                                                <Input placeholder="e.g. Mr. John" value={newSiteData.clientName} onChange={e => setNewSiteData({...newSiteData, clientName: e.target.value})} />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <Label className="text-[9px] uppercase font-bold text-slate-500">Location</Label>
                                                <Input placeholder="e.g. Kondapur" value={newSiteData.location} onChange={e => setNewSiteData({...newSiteData, location: e.target.value})} />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[9px] uppercase font-bold text-slate-500">Project Type</Label>
                                                <Select value={newSiteData.projectType} onValueChange={v => setNewSiteData({...newSiteData, projectType: v})}>
                                                    <SelectTrigger className="h-10 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                                                        <SelectValue placeholder="Project Type" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Commercial">Commercial</SelectItem>
                                                        <SelectItem value="Residential">Residential</SelectItem>
                                                        <SelectItem value="Villa">Villa</SelectItem>
                                                        <SelectItem value="Apartments">Apartments</SelectItem>
                                                        <SelectItem value="Others">Others</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase">Amount (₹)</Label>
                                        <Input type="number" value={addFormData.amount} onChange={e => setAddFormData({...addFormData, amount: e.target.value})} required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase">Payment Method</Label>
                                        <Select value={addFormData.source} onValueChange={v => setAddFormData({...addFormData, source: v as any})}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="cash">Cash</SelectItem>
                                                <SelectItem value="bank transfer">Bank Transfer</SelectItem>
                                                <SelectItem value="online">Online</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase">Date</Label>
                                        <Input 
                                            type="date" 
                                            value={addFormData.date} 
                                            onChange={e => setAddFormData({...addFormData, date: e.target.value})} 
                                            required 
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase">Notes (Optional)</Label>
                                        <Input 
                                            placeholder="Additional details..." 
                                            value={addFormData.notes} 
                                            onChange={e => setAddFormData({...addFormData, notes: e.target.value})} 
                                        />
                                    </div>
                                </div>
                            </div>
                            <Button type="submit" className="w-full" disabled={isSaving}>Deposit</Button>
                        </form>
                    </DialogContent>
                </Dialog>
            )}
            
            <Dialog open={isUseMoneyOpen} onOpenChange={setIsUseMoneyOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" className="w-full sm:w-auto border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-900 dark:text-white font-black uppercase tracking-widest text-[10px] px-6 h-11 shadow-sm transition-all active:scale-95">
                        <Wallet className="mr-2 h-4 w-4 text-slate-500 dark:text-slate-400" /> Spend/Request
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                    <form onSubmit={handleUseMoney} className="space-y-4">
                    <DialogHeader>
                        <DialogTitle>{user.role === 'Owner' ? "Direct Spend" : "Request Funds"}</DialogTitle>
                    </DialogHeader>
                    {useMoneyError && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{useMoneyError}</AlertDescription></Alert>}
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Amount (₹)</Label>
                            <Input type="number" value={useFormData.amount} onChange={e => setUseFormData({...useFormData, amount: e.target.value})} required />
                        </div>
                        <div className="space-y-2">
                            <Label>Method</Label>
                            <Select value={useFormData.method} onValueChange={v => setUseFormData({...useFormData, method: v})}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Cash">Cash</SelectItem>
                                    <SelectItem value="UPI">UPI</SelectItem>
                                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Date</Label>
                        <Input 
                            type="date" 
                            value={useFormData.date} 
                            onChange={e => setUseFormData({...useFormData, date: e.target.value})} 
                            required 
                        />
                    </div>

                    <div className="space-y-4 pt-4 border-t">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase">Project Site (Optional)</Label>
                            <Select 
                                value={useFormData.siteId || "GENERAL"} 
                                onValueChange={v => setUseFormData({...useFormData, siteId: v === "GENERAL" ? "" : v, walletType: v === "GENERAL" ? (user?.role === "Owner" ? "Company" : "Team") : (user?.role === "Owner" ? "Site" : "Team")})}
                            >
                                <SelectTrigger><SelectValue placeholder="General Office" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="GENERAL">General Office</SelectItem>
                                    {sites?.map((s, i) => <SelectItem key={s._id} value={s._id}>{i + 1}. {s.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        {useFormData.siteId ? (
                           <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase">Wallet</Label>
                                <Select value={useFormData.walletType} onValueChange={v => setUseFormData({...useFormData, walletType: v as any})}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Company">Main Company Wallet</SelectItem>
                                        <SelectItem value="Site">Site Main Wallet</SelectItem>
                                        <SelectItem value="Team">Staff Wallet</SelectItem>
                                    </SelectContent>
                                </Select>
                           </div>
                        ) : (
                           <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase">Wallet</Label>
                                <Select 
                                    value={useFormData.walletType === "Team" ? "Team" : "Company"} 
                                    onValueChange={v => setUseFormData({...useFormData, walletType: v as any})}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Company">Main Company Wallet</SelectItem>
                                        {myPersonalWallet && (
                                            <SelectItem value="Team">My Personal Wallet (₹{myPersonalWallet.balance})</SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>
                           </div>
                        )}

                        {useFormData.walletType === 'Team' && (
                             <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase">Select Staff</Label>
                                <Select value={useFormData.teamMemberId} onValueChange={v => setUseFormData({...useFormData, teamMemberId: v})} required>
                                    <SelectTrigger><SelectValue placeholder="Select Staff Member" /></SelectTrigger>
                                    <SelectContent>
                                        {selectedSite?.teamWallets?.map((w: any) => <SelectItem key={w._id} value={w.userId}>{w.userId} (₹{w.balance})</SelectItem>)}
                                    </SelectContent>
                                </Select>
                             </div>
                        )}
                    </div>

                    <div className="space-y-2 pt-4 border-t">
                        <Label>Vendor</Label>
                        <Select 
                            value={isNewVendor ? "NEW" : useFormData.vendor} 
                            onValueChange={v => { if(v==="NEW") setIsNewVendor(true); else {setIsNewVendor(false); setUseFormData({...useFormData, vendor: v})} }}
                        >
                            <SelectTrigger><SelectValue placeholder="Select Vendor" /></SelectTrigger>
                            <SelectContent>
                                {vendors?.map(v => <SelectItem key={v._id} value={v.name}>{v.name}</SelectItem>)}
                                <SelectItem value="NEW">+ New Vendor</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {isNewVendor && (
                        <div className="p-4 bg-muted rounded-lg space-y-3">
                            <Input placeholder="Vendor Name" value={useFormData.newVendorName} onChange={e => setUseFormData({...useFormData, newVendorName: e.target.value})} />
                            <Select value={useFormData.newVendorCategory} onValueChange={v => setUseFormData({...useFormData, newVendorCategory: v})}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Material">Material</SelectItem>
                                    <SelectItem value="Labor">Labor</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label>Purpose</Label>
                        <Input placeholder="What is this for?" value={useFormData.purpose} onChange={e => setUseFormData({...useFormData, purpose: e.target.value})} required />
                    </div>

                    <Button type="submit" className="w-full h-12" disabled={isSaving}>Submit</Button>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
            <div className="flex items-center justify-between">
                <CardTitle>
                    Recent Activity {activeFilter === 'income' ? <span className="text-green-500 text-sm ml-2">(Income Only)</span> : activeFilter === 'expense' ? <span className="text-red-500 text-sm ml-2">(Expenses Only)</span> : ''}
                </CardTitle>
                {activeFilter !== 'all' && (
                    <Button variant="ghost" size="sm" onClick={() => setActiveFilter('all')} className="h-8 text-xs text-muted-foreground hover:text-foreground">
                        Clear Filter
                    </Button>
                )}
            </div>
        </CardHeader>
        <CardContent>
            <ScrollArea className="h-[400px]">
                <div className="space-y-4 pl-4 pr-4 py-2">
                    {transactions?.filter((tx: any) => {
                        const isIncome = tx.type === 'Money In' || tx.type === 'CREDIT';
                        if (activeFilter === 'income') return isIncome;
                        if (activeFilter === 'expense') return !isIncome;
                        return true;
                    }).map((tx: any, index: number) => {
                        const isIncome = tx.type === 'Money In' || tx.type === 'CREDIT';
                        return (
                            <div key={tx._id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white dark:bg-slate-900/20 rounded-xl border border-slate-100 dark:border-white/5 hover:border-slate-200 dark:hover:border-white/10 transition-all relative gap-4">
                                <span className="absolute -left-3 top-4 sm:top-1/2 sm:-translate-y-1/2 h-6 w-6 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-[10px] font-black text-slate-500 z-10 shadow-xl">
                                    {index + 1}
                                </span>
                                <div className="flex items-center gap-4 pl-4">
                                    <div className={cn("p-2 rounded-lg", isIncome ? "bg-emerald-500/5 text-emerald-600/70" : "bg-rose-500/5 text-rose-600/70")}>
                                        {isIncome ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-900 dark:text-slate-200">{tx.source_or_vendor || (isIncome ? 'Internal' : 'General')}</p>
                                        <p className="text-xs text-slate-500">{tx.purpose} • {tx.date}</p>
                                    </div>
                                </div>
                                <div className="text-left sm:text-right flex flex-row sm:flex-col justify-between items-center sm:items-end w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0">
                                    <p className={cn("font-black text-lg sm:text-base", isIncome ? "text-emerald-600/80 dark:text-emerald-500/60" : "text-rose-600/80 dark:text-rose-500/60")}>
                                        {isIncome ? '+' : '-'}₹{tx.amount.toLocaleString()}
                                    </p>
                                    <p className="text-[10px] uppercase font-black text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded sm:bg-transparent sm:px-0">By: {tx.used_by}</p>
                                </div>
                            </div>
                        );
                    })}
                    {transactions?.filter((tx: any) => {
                        const isIncome = tx.type === 'Money In' || tx.type === 'CREDIT';
                        if (activeFilter === 'income') return isIncome;
                        if (activeFilter === 'expense') return !isIncome;
                        return true;
                    }).length === 0 && (
                        <div className="text-center py-10 text-muted-foreground">
                            No {activeFilter === 'income' ? 'income' : activeFilter === 'expense' ? 'expense' : ''} transactions found.
                        </div>
                    )}
                </div>
            </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
