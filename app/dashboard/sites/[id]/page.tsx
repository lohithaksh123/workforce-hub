'use client'

import { useState, useContext, useMemo, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { UserContext } from '@/components/dashboard/UserContext'
import { 
  ArrowLeft,
  Plus,
  Wallet,
  TrendingUp,
  AlertCircle,
  Users as UsersIcon,
  Calendar,
  MapPin,
  User,
  MoreVertical,
  PlusCircle,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  Edit2,
  Archive, 
  Trash2, 
  Eye, 
  ChevronRight,
  Loader2,
  CheckCircle2,
  RefreshCcw,
  Package,
  Truck,
  Users2,
  Zap,
  Droplets,
  MoreHorizontal,
  Wrench,
  Download,
  Building2,
  Image as ImageIcon,
  Ruler,
  PenTool,
  Upload,
  X,
  File as FileIcon,
  Camera
} from 'lucide-react'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { api } from "@/convex/_generated/api"
import { toast } from '@/hooks/use-toast'
import { cn, normalizeWalletUserId } from '@/lib/utils'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { DataTable } from '@/components/dashboard/data-table'

export default function SiteDetailPage() {
  const params = useParams()
  const router = useRouter()
  const siteId = params.id as any
  const { user: loggedInUser } = useContext(UserContext)
  
  const siteData = useQuery(api.sites.getSiteById, { id: siteId })
  const transactions = useQuery(api.transactions.getTransactionsBySite, { siteId })
  const users = useQuery(api.users.getUsers)

  const siteBudgets = useQuery(api.estimation.getEstimateVsActual, loggedInUser?.email ? { requestorEmail: loggedInUser.email, siteId: siteId } : "skip")
  const siteFinanceDetail = siteBudgets?.[0]
  const hasConvertedBudget = siteFinanceDetail && siteFinanceDetail.estimatedAmount > 0
  const siteEstimates = useQuery(api.estimation.getEstimatesBySite, loggedInUser?.email ? { siteId, requestorEmail: loggedInUser.email } : "skip")
  
  const allocateFunds = useMutation(api.wallets.allocateSiteFunds)
  const reallocateMutation = useMutation(api.wallets.reallocateFunds)
  const updateSite = useMutation(api.sites.updateSite)
  const addTeamMember = useMutation(api.sites.addTeamMember)
  const removeTeamMember = useMutation(api.sites.removeTeamMember)

  const [topUpOpen, setTopUpOpen] = useState(false)
  const [allocateOpen, setAllocateOpen] = useState(false)
  const [addMemberOpen, setAddMemberOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [topUpData, setTopUpData] = useState({ userId: '', amount: '', reason: '' })
  const [allocateData, setAllocateData] = useState({ amount: 0, notes: '' })
  const [selectedNewMember, setSelectedNewMember] = useState('')
  
  // Asset Management State
  const [isAssetUploadOpen, setIsAssetUploadOpen] = useState(false)
  const [assetFile, setAssetFile] = useState<File | null>(null)
  const [assetData, setAssetData] = useState({ title: '', type: 'Photo' as 'Photo' | 'Drawing' | 'Measurement' | 'Other' })
  const [isUploadingAsset, setIsUploadingAsset] = useState(false)
  
  const siteAssets = useQuery(api.site_assets.getAssetsBySite, { siteId })
  const generateUploadUrl = useMutation(api.site_assets.generateUploadUrl)
  const saveAsset = useMutation(api.site_assets.saveAsset)
  const deleteAsset = useMutation(api.site_assets.deleteAsset)

  const site = siteData
  const wallet = site?.wallet
  const teamWallets = (site?.teamWallets || []) as any[]

  const isOwner = loggedInUser?.role === 'Owner' || loggedInUser?.role === 'Admin'
  const isStaff = !isOwner

  const createRequestMutation = useMutation(api.requests.createRequest)
  const [requestOpen, setRequestOpen] = useState(false)
  const [requestLoading, setRequestLoading] = useState(false)
  const [requestData, setRequestData] = useState({ amount: 0, reason: '' })
  
  const [editOpen, setEditOpen] = useState(false)
  const [editData, setEditData] = useState({
    name: '',
    code: '',
    location: '',
    clientName: '',
    managerId: '',
    status: 'Active' as any,
    projectType: 'Others' as any,
    notes: '',
    requiresAttendancePhoto: false
  })

  useEffect(() => {
    if (site && editOpen) {
      setEditData({
        name: site.name,
        code: site.code,
        location: site.location,
        clientName: site.clientName,
        managerId: site.managerId,
        status: site.status,
        projectType: site.projectType || 'Others',
        notes: site.notes || '',
        requiresAttendancePhoto: site.requiresAttendancePhoto || false
      })
    }
  }, [site, editOpen])

  const handleUpdateSite = async () => {
    setIsSaving(true)
    try {
      const result = await updateSite({
        id: siteId,
        ...editData,
        startDate: site?.startDate || new Date().toISOString().split('T')[0],
        teamMembers: site?.teamMembers || []
      })
      if (result.success) {
        setEditOpen(false)
        toast({ title: "Site Updated", description: "Changes have been saved successfully." })
      } else {
        toast({ title: "Update Failed", variant: "destructive", description: result.error })
      }
    } catch (e: any) {
      toast({ title: "Error", variant: "destructive", description: e.message })
    } finally {
      setIsSaving(false)
    }
  }

  const hasPermission = (name: string) => {
    if (loggedInUser?.role === 'Owner') return true
    if (!loggedInUser || !Array.isArray(loggedInUser.permissions)) return false
    return loggedInUser.permissions.find((p: any) => p.name === name)?.allowed || false
  }

  // Analytics logic
  const categoryData = useMemo(() => {
    const categories: Record<string, number> = {}
    if (transactions) {
      transactions.filter(t => t.type === 'DEBIT' && !t.isInternalTransfer && t.category).forEach(t => {
        categories[t.category!] = (categories[t.category!] || 0) + t.amount
      })
    }
    return Object.entries(categories).map(([name, value]) => ({ name, value }))
  }, [transactions])

  const spendByMember = useMemo(() => {
    const members: Record<string, number> = {}
    if (transactions) {
      transactions.filter(t => t.type === 'DEBIT' && !t.isInternalTransfer).forEach(t => {
        members[t.used_by] = (members[t.used_by] || 0) + t.amount
      })
    }
    return Object.entries(members).map(([name, value]) => ({ name, value }))
  }, [transactions])

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

  const chartConfig = {
    value: {
      label: "Amount",
      color: "#6366f1",
    }
  }

  const handleAllocate = async () => {
    if (allocateData.amount <= 0) return
    setIsSaving(true)
    try {
      const result = await allocateFunds({
        siteId,
        amount: allocateData.amount,
        notes: allocateData.notes,
        allocatedBy: loggedInUser?.name || 'Unknown'
      })
      if (result.success) {
        setAllocateOpen(false)
        setAllocateData({ amount: 0, notes: '' })
        toast({ title: "Success", description: "Funds allocated to site wallet" })
      } else {
        toast({ title: "Allocation Failed", variant: "destructive", description: result.error })
      }
    } catch (e: any) {
      toast({ title: "Communication Error", variant: "destructive", description: "Could not reach server: " + e.message })
    } finally {
      setIsSaving(false)
    }
  }

  const handleTopUp = async () => {
    if (!topUpData.userId || !topUpData.amount || !topUpData.reason) {
      toast({ title: "Error", variant: "destructive", description: "Please fill all fields" })
      return
    }

    const amount = parseFloat(topUpData.amount as string)
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Error", variant: "destructive", description: "Invalid amount" })
      return
    }

    setIsSaving(true)
    try {
      const result = await reallocateMutation({
        sourceType: 'Site Budget',
        sourceId: siteId,
        destinationType: 'Staff Wallet',
        destinationId: topUpData.userId,
        amount: amount,
        reason: topUpData.reason,
        performedBy: loggedInUser?.name || 'System'
      })
      if (result.success) {
        setTopUpOpen(false)
        setTopUpData({ userId: '', amount: '', reason: '' })
        toast({ title: "Success", description: "Team member wallet topped up from site budget" })
      } else {
        toast({ title: "Top Up Failed", variant: "destructive", description: result.error })
      }
    } catch (e: any) {
      toast({ title: "Communication Error", variant: "destructive", description: "Could not reach server: " + e.message })
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddMember = async () => {
    if (!selectedNewMember) return
    setIsSaving(true)
    try {
        const result = await addTeamMember({ siteId, userId: selectedNewMember })
        if (result.success) {
            setAddMemberOpen(false)
            setSelectedNewMember('')
            toast({ title: "Member Added", description: `${selectedNewMember} has been assigned to this site.` })
        } else {
            toast({ title: "Error", variant: "destructive", description: (result as any).error })
        }
    } catch (e: any) {
        toast({ title: "Error", variant: "destructive", description: e.message })
    } finally {
        setIsSaving(false)
    }
  }

  const handleRemoveMember = async (userId: string) => {
    if (!confirm(`Are you sure you want to remove ${userId} from this site?`)) return
    try {
        await removeTeamMember({ siteId, userId })
        toast({ title: "Member Removed", description: `${userId} is no longer assigned to this site.` })
    } catch (e: any) {
        toast({ title: "Error", variant: "destructive", description: e.message })
    }
  }

  const handleRequestMoney = async () => {
    if (requestData.amount <= 0 || !requestData.reason) return
    setRequestLoading(true)
    try {
        const userWallet = teamWallets.find(w => normalizeWalletUserId(w.userId) === normalizeWalletUserId(loggedInUser?.name || ''))
        const result = await createRequestMutation({
            purpose: "Wallet Top-up: " + requestData.reason,
            vendor_name: "Self / Internal",
            amount: requestData.amount,
            payment_method: "Wallet Transfer",
            description: requestData.reason,
            requested_by: loggedInUser?.name || 'Unknown',
            siteId: siteId,
            walletId: userWallet?._id,
            type: "Top-up"
        })
        if (result.success) {
            setRequestOpen(false)
            setRequestData({ amount: 0, reason: '' })
            toast({ title: "Request Submitted", description: "The owner will review your top-up request." })
        } else {
            toast({ title: "Request Failed", variant: "destructive", description: (result as any).error })
        }
    } catch (e: any) {
        toast({ title: "Communication Error", variant: "destructive", description: "Could not reach server: " + e.message })
    } finally {
        setRequestLoading(false)
    }
  }

  const handleUploadAsset = async () => {
    if (!assetFile || !assetData.title) return
    setIsUploadingAsset(true)
    try {
      const postUrl = await generateUploadUrl()
      const result = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": assetFile.type },
        body: assetFile,
      })
      const { storageId } = await result.json()
      
      await saveAsset({
        siteId,
        title: assetData.title,
        type: assetData.type,
        storageId,
        format: assetFile.type,
        uploadedBy: loggedInUser?.name || 'Unknown'
      })
      
      setIsAssetUploadOpen(false)
      setAssetFile(null)
      setAssetData({ title: '', type: 'Photo' })
      toast({ title: "Asset Uploaded", description: "Your file has been securely saved." })
    } catch (e: any) {
      toast({ title: "Upload Failed", variant: "destructive", description: e.message })
    } finally {
      setIsUploadingAsset(false)
    }
  }

  const handleDeleteAsset = async (id: any) => {
    if (!confirm("Are you sure you want to delete this asset?")) return
    try {
        await deleteAsset({ id })
        toast({ title: "Asset Deleted" })
    } catch (e: any) {
        toast({ title: "Error", variant: "destructive", description: e.message })
    }
  }

  if (!site) {
    return (
        <div className="flex flex-col items-center justify-center py-48 gap-4">
            <Loader2 className="h-12 w-12 text-indigo-500 animate-spin" />
            <p className="text-muted-foreground font-bold">Fetching site intelligence...</p>
        </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-10 w-10 rounded-full bg-white shadow-sm border">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase">{site.name}</h1>
              <Badge variant="outline" className="bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 font-black">
                {site.code}
              </Badge>
            </div>
            <div className="flex items-center gap-4 mt-2 font-bold text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {site.location}</span>
              <span className="flex items-center gap-1.5"><Building2 className="h-4 w-4" /> {site.clientName}</span>
              <span className="flex items-center gap-1.5"><User className="h-4 w-4" /> {site.managerId}</span>
              <span className={cn("px-2 py-0.5 rounded-full text-[10px] uppercase tracking-widest leading-none bg-emerald-100 text-emerald-700 font-black")}>
                {site.status}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {isOwner && (
            <Button onClick={() => setEditOpen(true)} variant="outline" className="border-slate-200 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 h-11 px-6 font-bold text-xs uppercase tracking-wider">
              <Edit2 className="mr-2 h-4 w-4" /> Edit Details
            </Button>
          )}
          {isStaff && (
            <Button onClick={() => setRequestOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 shadow-lg h-11 px-6 font-bold uppercase tracking-wider text-xs">
              <PlusCircle className="mr-2 h-4 w-4" /> Request Funds
            </Button>
          )}
          {hasPermission('Allocate Site Funds') && (
            <Button onClick={() => setAllocateOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 shadow-lg h-11 px-6 font-bold text-xs uppercase tracking-wider">
              <Wallet className="mr-2 h-4 w-4" /> Allocate Funds
            </Button>
          )}
          {hasPermission('Top Up Team Wallets') && (
            <Button onClick={() => setTopUpOpen(true)} variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 h-11 px-6 font-bold text-xs uppercase tracking-wider">
              <PlusCircle className="mr-2 h-4 w-4" /> Top up Staff
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-none shadow-md bg-white dark:bg-slate-900 border-l-4 border-indigo-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Allocated</p>
                <div className="h-8 w-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center"><DownloadIcon /></div>
            </div>
            <h2 className="text-3xl font-black mt-1">₹{(wallet?.calculated_allocated ?? 0).toLocaleString()}</h2>
            <p className="text-xs text-muted-foreground mt-2 font-medium">Funds transferred from company</p>
          </CardContent>
        </Card>

        <Card 
          className="border-none shadow-md bg-white dark:bg-slate-900 border-l-4 border-emerald-500 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
          onClick={() => router.push(`/dashboard/transactions?siteId=${siteId}&type=DEBIT`)}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Spent</p>
                <div className="h-8 w-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center group-hover:bg-emerald-100 transition-colors"><TrendingUp className="h-4 w-4" /></div>
            </div>
            <h2 className="text-3xl font-black mt-1 flex items-center gap-2">
                ₹{(wallet?.calculated_spent ?? 0).toLocaleString()}
                <ArrowUpRight className="h-4 w-4 text-emerald-500 opacity-0 group-hover:opacity-100 transition-all" />
            </h2>
            <p className="text-xs text-muted-foreground mt-2 font-medium">Actual project expenses (Click to view)</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-white dark:bg-slate-900 border-l-4 border-amber-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current Balance</p>
                <div className="h-8 w-8 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center"><Wallet className="h-4 w-4" /></div>
            </div>
            <h2 className="text-3xl font-black mt-1">₹{(wallet?.calculated_balance ?? 0).toLocaleString()}</h2>
            <p className="text-xs text-muted-foreground mt-2 font-medium">Remaining project budget</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-white dark:bg-slate-900 border-l-4 border-rose-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Team Cash-on-Hand</p>
                <div className="h-8 w-8 bg-rose-50 text-rose-600 rounded-lg flex items-center justify-center"><UsersIcon className="h-4 w-4" /></div>
            </div>
            <h2 className="text-3xl font-black mt-1">
                ₹{teamWallets.reduce((acc, w) => acc + (w.balance || 0), 0).toLocaleString()}
            </h2>
            <p className="text-xs text-muted-foreground mt-2 font-medium">Funds held across team wallets</p>
          </CardContent>
        </Card>
      </div>

      {hasConvertedBudget && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-none shadow-md bg-white dark:bg-slate-900 border-l-4 border-indigo-500">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Estimated Budget</p>
                <div className="h-8 w-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center"><FileText className="h-4 w-4" /></div>
              </div>
              <h2 className="text-3xl font-black mt-1">₹{siteFinanceDetail.estimatedAmount.toLocaleString()}</h2>
              <p className="text-xs text-muted-foreground mt-2 font-medium">Planned baseline from estimate {siteFinanceDetail.estimateNumber}</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md bg-white dark:bg-slate-900 border-l-4 border-rose-500">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Actual Spent</p>
                <div className="h-8 w-8 bg-rose-50 text-rose-600 rounded-lg flex items-center justify-center"><TrendingUp className="h-4 w-4" /></div>
              </div>
              <h2 className="text-3xl font-black mt-1">₹{siteFinanceDetail.actualSpent.toLocaleString()}</h2>
              <p className="text-xs text-muted-foreground mt-2 font-medium">Actual project expenses spent outside</p>
            </CardContent>
          </Card>

          <Card className={cn(
            "border-none shadow-md bg-white dark:bg-slate-900 border-l-4",
            siteFinanceDetail.remainingBudget >= 0 ? "border-emerald-500" : "border-rose-600"
          )}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Remaining Budget</p>
                <div className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center",
                  siteFinanceDetail.remainingBudget >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                )}><Wallet className="h-4 w-4" /></div>
              </div>
              <h2 className={cn(
                "text-3xl font-black mt-1",
                siteFinanceDetail.remainingBudget >= 0 ? "text-emerald-600" : "text-rose-600"
              )}>₹{siteFinanceDetail.remainingBudget.toLocaleString()}</h2>
              <p className="text-xs text-muted-foreground mt-2 font-medium">
                {siteFinanceDetail.remainingBudget >= 0 ? "Remaining under approved limit" : "Exceeded approved budget limit!"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Analytics & Team */}
        <div className="lg:col-span-2 space-y-8">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="bg-slate-100 dark:bg-slate-900/50 p-1.5 h-14 rounded-2xl mb-8 border border-slate-200 dark:border-white/5">
              <TabsTrigger value="overview" className="rounded-xl font-bold h-11 px-8 data-[state=active]:bg-white dark:data-[state=active]:bg-indigo-600 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-white data-[state=active]:shadow-md transition-all">Overview</TabsTrigger>
              <TabsTrigger value="team" className="rounded-xl font-bold h-11 px-8 data-[state=active]:bg-white dark:data-[state=active]:bg-indigo-600 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-white data-[state=active]:shadow-md transition-all">Team Wallets</TabsTrigger>
              <TabsTrigger value="assets" className="rounded-xl font-bold h-11 px-8 data-[state=active]:bg-white dark:data-[state=active]:bg-indigo-600 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-white data-[state=active]:shadow-md transition-all">Site Assets</TabsTrigger>
              <TabsTrigger value="history" className="rounded-xl font-bold h-11 px-8 data-[state=active]:bg-white dark:data-[state=active]:bg-indigo-600 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-white data-[state=active]:shadow-md transition-all">Transactions</TabsTrigger>
              <TabsTrigger value="estimates" className="rounded-xl font-bold h-11 px-8 data-[state=active]:bg-white dark:data-[state=active]:bg-indigo-600 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-white data-[state=active]:shadow-md transition-all">Estimates</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="border-none shadow-sm h-[350px] bg-white dark:bg-slate-900/50">
                        <CardHeader>
                            <CardTitle className="text-lg font-black tracking-tight">Spend by Category</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {categoryData.length > 0 ? (
                                <ChartContainer config={chartConfig} className="h-[250px] w-full">
                                    <PieChart>
                                        <Pie
                                            data={categoryData}
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {categoryData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <ChartTooltip content={<ChartTooltipContent />} />
                                    </PieChart>
                                </ChartContainer>
                            ) : (
                                <div className="flex h-[250px] items-center justify-center text-slate-400 dark:text-slate-600 font-bold italic uppercase tracking-widest text-[10px]">No category data yet</div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm h-[350px] bg-white dark:bg-slate-900/50">
                        <CardHeader>
                            <CardTitle className="text-lg font-black tracking-tight">Spend by Member</CardTitle>
                        </CardHeader>
                        <CardContent>
                             {spendByMember.length > 0 ? (
                                <ChartContainer config={chartConfig} className="h-[250px] w-full">
                                    <BarChart data={spendByMember}>
                                        <CartesianGrid vertical={false} />
                                        <XAxis 
                                            dataKey="name" 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }} 
                                        />
                                        <YAxis 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }}
                                            tickFormatter={(value) => `₹${value}`}
                                        />
                                        <ChartTooltip content={<ChartTooltipContent />} />
                                        <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} barSize={30} />
                                    </BarChart>
                                </ChartContainer>
                             ) : (
                                <div className="flex h-[250px] items-center justify-center text-slate-400 dark:text-slate-500 font-bold italic uppercase tracking-widest text-[10px]">No member spending yet</div>
                             )}
                        </CardContent>
                    </Card>
                </div>

                <Card className="border-none shadow-xl">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-xl font-black tracking-tight">Recent Site Activity</CardTitle>
                            <CardDescription className="font-medium">Audit trail for this project</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <DataTable 
                            columns={[
                                { 
                                    key: 'date', 
                                    header: 'Date', 
                                    cell: (v) => <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">{String(v)}</span>
                                },
                                { 
                                    key: 'purpose', 
                                    header: 'Description',
                                    cell: (v, row) => (
                                        <div className="flex flex-col max-w-[200px]">
                                            <span className="font-bold text-xs truncate">{String(v)}</span>
                                            <span className="text-[10px] text-muted-foreground">{row.source_or_vendor}</span>
                                        </div>
                                    )
                                },
                                { 
                                    key: 'used_by', 
                                    header: 'By',
                                    cell: (v) => <span className="text-[11px] font-bold">{String(v)}</span>
                                },
                                {
                                    key: 'amount',
                                    header: 'Amount',
                                    cell: (v, row) => (
                                        <span className={cn(
                                            "font-black text-xs whitespace-nowrap",
                                            row.type === 'CREDIT' ? "text-emerald-500" : "text-rose-500"
                                        )}>
                                            {row.type === 'CREDIT' ? '+' : '-'} ₹{Number(v).toLocaleString()}
                                        </span>
                                    )
                                }
                            ]}
                            data={transactions?.slice(0, 5) || []}
                        />
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="team" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {teamWallets.length === 0 ? (
                         <div className="col-span-2 py-20 text-center bg-slate-50 rounded-3xl border-2 border-dashed">
                            <Users2 className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                            <p className="text-slate-500 font-bold">No active wallets for this site's team</p>
                            <Button variant="outline" className="mt-4" onClick={() => setTopUpOpen(true)}>Initialize Team Wallet</Button>
                         </div>
                    ) : teamWallets.map(w => (
                        <Card key={w._id || w.userId} className="border-none shadow-md overflow-hidden bg-white dark:bg-slate-900 group">
                            <CardContent className="p-5">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">
                                            {w.userId.charAt(0)}
                                        </div>
                                        <div>
                                            <h4 className="font-black text-slate-900 dark:text-white leading-tight">{w.userId}</h4>
                                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Site Wallet</p>
                                        </div>
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => { setTopUpData({ userId: w.userId, amount: '', reason: '' }); setTopUpOpen(true); }}>
                                                Top Up Wallet
                                            </DropdownMenuItem>
                                            <DropdownMenuItem className="text-rose-600">Archive Wallet</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-400 mb-0.5">Balance</p>
                                        <p className="text-lg font-black text-slate-900 dark:text-white">₹{w.balance.toLocaleString()}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black uppercase text-slate-400 mb-0.5">Status</p>
                                        <Badge className={cn(
                                            "font-black text-[9px] uppercase px-2 py-0.5 border-none",
                                            w.status === 'Active' ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"
                                        )}>
                                            {w.status || 'Active'}
                                        </Badge>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                                    <span className="flex items-center gap-1"><RefreshCcw className="h-3 w-3" /> Last: {w.lastTopUpDate || 'Never'}</span>
                                    <Button variant="link" className="h-auto p-0 text-indigo-600 text-[11px] font-black">Details</Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </TabsContent>

            <TabsContent value="assets" className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-black tracking-tight">Project Documentation</h3>
                        <p className="text-xs text-muted-foreground font-bold">Photos, measurements, and drawings</p>
                    </div>
                    <Dialog open={isAssetUploadOpen} onOpenChange={setIsAssetUploadOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-emerald-600 hover:bg-emerald-700 shadow-lg font-black uppercase tracking-widest text-[10px]">
                                <Upload className="mr-2 h-4 w-4" /> Upload Asset
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle className="text-2xl font-black">Upload Site Asset</DialogTitle>
                                <DialogDescription className="font-bold text-slate-500 italic">Add photos, drawings or measurement sheets</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-black uppercase text-slate-500">Asset Title</Label>
                                    <Input 
                                        placeholder="e.g. Living Room Measurement" 
                                        value={assetData.title}
                                        onChange={e => setAssetData({...assetData, title: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-black uppercase text-slate-500">Asset Type</Label>
                                    <Select value={assetData.type} onValueChange={(v: any) => setAssetData({...assetData, type: v})}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Photo">Photo</SelectItem>
                                            <SelectItem value="Drawing">Drawing</SelectItem>
                                            <SelectItem value="Measurement">Measurement</SelectItem>
                                            <SelectItem value="Other">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-black uppercase text-slate-500">File</Label>
                                    <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors cursor-pointer relative">
                                        <input 
                                            type="file" 
                                            className="absolute inset-0 opacity-0 cursor-pointer" 
                                            onChange={e => setAssetFile(e.target.files?.[0] || null)}
                                        />
                                        {assetFile ? (
                                            <div className="flex flex-col items-center">
                                                <FileIcon className="h-8 w-8 text-indigo-600 mb-2" />
                                                <p className="text-sm font-bold text-slate-900">{assetFile.name}</p>
                                                <p className="text-[10px] text-slate-500 uppercase font-black">{(assetFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center">
                                                <Upload className="h-8 w-8 text-slate-400 mb-2" />
                                                <p className="text-sm font-bold text-slate-500">Click to select or drag and drop</p>
                                                <p className="text-[10px] text-slate-400 font-black uppercase mt-1">ANY FORMAT SUPPORTED</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button 
                                    className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 font-black uppercase tracking-widest text-sm shadow-xl" 
                                    disabled={isUploadingAsset || !assetFile || !assetData.title}
                                    onClick={handleUploadAsset}
                                >
                                    {isUploadingAsset ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : "Complete Upload"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {siteAssets?.length === 0 ? (
                        <div className="col-span-full py-24 text-center bg-slate-50 dark:bg-slate-900/20 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[2.5rem] flex flex-col items-center justify-center">
                            <div className="h-20 w-20 bg-white dark:bg-slate-800 rounded-3xl flex items-center justify-center shadow-lg mb-4">
                                <ImageIcon className="h-10 w-10 text-slate-300" />
                            </div>
                            <h4 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">No Assets Yet</h4>
                            <p className="text-slate-500 font-bold italic mt-2">Start documenting the site by uploading photos or drawings.</p>
                            <Button variant="outline" className="mt-6 font-black uppercase tracking-widest text-[10px] h-10 border-indigo-200 text-indigo-700 hover:bg-indigo-50" onClick={() => setIsAssetUploadOpen(true)}>
                                Add First Asset
                            </Button>
                        </div>
                    ) : (
                        siteAssets?.map((asset: any) => (
                            <Card key={asset._id} className="border-none shadow-md overflow-hidden bg-white dark:bg-slate-900 group hover:shadow-xl transition-all duration-500 flex flex-col h-full rounded-2xl border border-slate-100 dark:border-white/5">
                                <div className="relative h-48 bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                                    {asset.format.startsWith('image/') ? (
                                        <img 
                                            src={asset.url} 
                                            alt={asset.title} 
                                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                        />
                                    ) : (
                                        <div className="flex flex-col items-center gap-3">
                                            {asset.type === 'Drawing' ? <PenTool className="h-12 w-12 text-slate-400" /> : 
                                             asset.type === 'Measurement' ? <Ruler className="h-12 w-12 text-slate-400" /> : 
                                             <FileIcon className="h-12 w-12 text-slate-400" />}
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{asset.format.split('/')[1]}</span>
                                        </div>
                                    )}
                                    <div className="absolute top-3 left-3">
                                        <Badge className={cn(
                                            "font-black text-[9px] uppercase px-3 py-1 border-none shadow-lg",
                                            asset.type === 'Photo' ? "bg-emerald-500 text-white" :
                                            asset.type === 'Drawing' ? "bg-indigo-500 text-white" :
                                            asset.type === 'Measurement' ? "bg-amber-500 text-white" :
                                            "bg-slate-600 text-white"
                                        )}>
                                            {asset.type}
                                        </Badge>
                                    </div>
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                        <Button variant="secondary" size="icon" className="rounded-full h-10 w-10 shadow-xl" asChild>
                                            <a href={asset.url} target="_blank" rel="noopener noreferrer">
                                                <Eye className="h-5 w-5" />
                                            </a>
                                        </Button>
                                        <Button variant="destructive" size="icon" className="rounded-full h-10 w-10 shadow-xl" onClick={() => handleDeleteAsset(asset._id)}>
                                            <Trash2 className="h-5 w-5" />
                                        </Button>
                                    </div>
                                </div>
                                <CardContent className="p-5 flex-1 flex flex-col justify-between">
                                    <div>
                                        <h4 className="font-black text-slate-900 dark:text-white leading-tight mb-1 truncate">{asset.title}</h4>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                                            <User className="h-3 w-3" /> {asset.uploadedBy}
                                        </p>
                                    </div>
                                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100 dark:border-white/5">
                                        <span className="text-[10px] font-bold text-slate-400">{new Date(asset.created_at).toLocaleDateString()}</span>
                                        <Button variant="ghost" size="sm" className="h-8 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50" asChild>
                                            <a href={asset.url} download={asset.title}>
                                                <Download className="mr-1.5 h-3 w-3" /> Download
                                            </a>
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </TabsContent>
            
            <TabsContent value="history">
                 <Card className="border-none shadow-xl h-full">
                    <CardHeader>
                        <CardTitle className="text-xl font-black">Transaction Vault</CardTitle>
                        <CardDescription className="font-medium">Every rupee accounted for</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                         <DataTable 
                            columns={[
                                { 
                                    key: 'date', 
                                    header: 'Date', 
                                    cell: (v) => <span className="text-[11px] font-bold text-slate-500">{String(v)}</span>
                                },
                                { 
                                    key: 'type', 
                                    header: 'Nature',
                                    cell: (v) => <span className={cn("text-[10px] uppercase font-black px-2 py-0.5 rounded-full", v === 'CREDIT' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700')}>{String(v)}</span>
                                },
                                { 
                                    key: 'purpose', 
                                    header: 'Description',
                                    cell: (v, row) => (
                                        <div className="flex flex-col">
                                            <span className="font-bold text-xs">{String(v)}</span>
                                            <span className="text-[10px] text-muted-foreground">{row.source_or_vendor} ({row.category || 'General'})</span>
                                        </div>
                                    )
                                },
                                { 
                                    key: 'used_by', 
                                    header: 'Owner',
                                    cell: (v) => <span className="text-[11px] font-bold">{String(v)}</span>
                                },
                                {
                                    key: 'amount',
                                    header: 'Amount',
                                    cell: (v, row) => (
                                        <span className={cn(
                                            "font-black text-xs",
                                            row.type === 'CREDIT' ? "text-emerald-500" : "text-rose-500"
                                        )}>
                                            ₹{Number(v).toLocaleString()}
                                        </span>
                                    )
                                },
                                {
                                    key: 'isInternalTransfer',
                                    header: 'Class',
                                    cell: (v) => v ? <Badge variant="secondary" className="text-[9px] font-bold bg-blue-50 text-blue-600 border-none uppercase">Internal</Badge> : <Badge variant="outline" className="text-[9px] font-bold uppercase">Expense</Badge>
                                }
                            ]}
                             data={transactions || []}
                         />
                    </CardContent>
                 </Card>
            </TabsContent>

            <TabsContent value="estimates" className="space-y-6">
                <Card className="border-none shadow-xl h-full bg-white dark:bg-slate-900/50">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-xl font-black uppercase tracking-tight">Project Estimates</CardTitle>
                            <CardDescription className="font-bold text-xs">Estimate drafts, client sign-offs, and converted budgets</CardDescription>
                        </div>
                        <Button 
                            onClick={() => router.push('/dashboard/estimation')} 
                            className="bg-indigo-600 hover:bg-indigo-700 shadow-md font-bold text-[10px] uppercase tracking-widest h-9 px-4 rounded-xl"
                        >
                            Manage Estimates
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                         <DataTable 
                             columns={[
                                 { 
                                     key: 'estimateNumber', 
                                     header: 'Number', 
                                     cell: (v) => <span className="text-[11px] font-black text-indigo-600 font-mono whitespace-nowrap bg-indigo-500/5 px-2 py-0.5 rounded border border-indigo-500/10">{String(v)}</span>
                                 },
                                 { 
                                     key: 'clientName', 
                                     header: 'Client',
                                     cell: (v) => <span className="font-bold text-xs">{String(v)}</span>
                                 },
                                 { 
                                     key: 'projectType', 
                                     header: 'Project Type',
                                     cell: (v) => <span className="text-[11px] font-bold text-slate-500">{String(v)}</span>
                                 },
                                 { 
                                     key: 'estimateDate', 
                                     header: 'Date',
                                     cell: (v) => <span className="text-[11px] font-bold text-slate-400">{String(v)}</span>
                                 },
                                 {
                                     key: 'grandTotal',
                                     header: 'Grand Total',
                                     cell: (v) => (
                                         <span className="font-black text-xs text-slate-900 dark:text-slate-100">
                                             ₹{Number(v).toLocaleString()}
                                         </span>
                                     )
                                 },
                                 {
                                     key: 'status',
                                     header: 'Status',
                                     cell: (v) => (
                                         <span className={cn(
                                             "font-black text-[9px] uppercase px-2 py-0.5 rounded-full border-none",
                                             v === 'approved' ? 'bg-emerald-500/10 text-emerald-500' :
                                             v === 'converted' ? 'bg-indigo-500/10 text-indigo-500' :
                                             v === 'rejected' ? 'bg-rose-500/10 text-rose-500' :
                                             v === 'sent' ? 'bg-blue-500/10 text-blue-500' : 'bg-slate-500/10 text-slate-500'
                                         )}>
                                             {String(v)}
                                         </span>
                                     )
                                 }
                             ]}
                             data={siteEstimates || []}
                         />
                    </CardContent>
                </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column - Team Management */}
        <div className="space-y-8">
            <Card className="border-none shadow-lg">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-lg font-black tracking-tight">Assigned Team</CardTitle>
                        <CardDescription className="text-xs font-bold">{site.teamMembers.length} active members</CardDescription>
                    </div>
                    {isOwner && (
                        <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
                            <DialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-indigo-600 hover:bg-indigo-50"><Plus className="h-5 w-5" /></Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md">
                                <DialogHeader>
                                    <DialogTitle className="text-2xl font-black">Assign Team Member</DialogTitle>
                                    <DialogDescription className="font-bold">Select a user to assign to this site project.</DialogDescription>
                                </DialogHeader>
                                <div className="py-6 space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-black uppercase text-slate-500">Search User</Label>
                                        <Select value={selectedNewMember} onValueChange={setSelectedNewMember}>
                                            <SelectTrigger className="h-12 text-lg font-bold">
                                                <SelectValue placeholder="Select user to add" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {users?.filter(u => !site.teamMembers.includes(u.name)).map(u => (
                                                    <SelectItem key={u._id} value={u.name} className="py-3 px-4">
                                                        <div className="flex flex-col">
                                                            <span className="font-black text-sm">{u.name}</span>
                                                            <span className="text-[10px] text-slate-400 font-black uppercase">{u.role}</span>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                                {users?.filter(u => !site.teamMembers.includes(u.name)).length === 0 && (
                                                    <div className="p-4 text-center text-xs font-bold text-slate-400">All users are already assigned</div>
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button onClick={handleAddMember} className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 font-bold text-lg" disabled={isSaving || !selectedNewMember}>
                                        {isSaving ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : "Confirm Assignment"}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    )}
                </CardHeader>
                <CardContent className="space-y-4">
                    {site.teamMembers.length === 0 ? (
                        <p className="text-slate-500 italic text-xs font-bold uppercase tracking-widest text-[10px]">No team members assigned</p>
                    ) : site.teamMembers.map((member, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-white dark:bg-slate-700 flex items-center justify-center text-[10px] font-black border border-slate-200 dark:border-slate-600 shadow-sm">
                                    {member.charAt(0)}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-black text-slate-900 dark:text-white leading-none">{member}</span>
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-black uppercase mt-1">Staff Member</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[9px] font-black py-0 px-2 bg-white dark:bg-slate-700 border-none shadow-sm">ACTIVE</Badge>
                                {isOwner && (
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:bg-rose-50" onClick={() => handleRemoveMember(member)}>
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
      </div>

      {/* Allocation Dialog */}
      <Dialog open={allocateOpen} onOpenChange={setAllocateOpen}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle className="text-2xl font-black">Allocate Funds</DialogTitle>
                <DialogDescription className="font-bold">Move money from Company Wallet to Site Wallet</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label className="font-black text-xs uppercase text-slate-500">Amount (₹)</Label>
                    <Input 
                        type="number" 
                        placeholder="0.00" 
                        className="h-12 text-2xl font-black"
                        value={allocateData.amount}
                        onChange={(e) => setAllocateData({...allocateData, amount: Number(e.target.value)})}
                    />
                </div>
                <div className="space-y-2">
                    <Label className="font-black text-xs uppercase text-slate-500">Allocation Purpose</Label>
                    <Input 
                        placeholder="e.g. Initial purchase for electrical work" 
                        value={allocateData.notes}
                        onChange={(e) => setAllocateData({...allocateData, notes: e.target.value})}
                    />
                </div>
            </div>
            <DialogFooter>
                <Button onClick={handleAllocate} className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 font-bold text-lg shadow-xl" disabled={isSaving}>
                    {isSaving ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : "Confirm Allocation"}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Top-up Dialog */}
      <Dialog open={topUpOpen} onOpenChange={setTopUpOpen}>
        <DialogContent className="sm:max-w-[550px] bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 rounded-xl p-0 max-h-[90vh] overflow-y-auto shadow-3xl">
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 dark:from-white dark:to-slate-200 p-8 text-white dark:text-slate-900">
                <DialogTitle className="text-3xl font-black uppercase tracking-tight italic flex items-center gap-3">
                    <ArrowUpRight className="h-8 w-8" /> Team Top-up
                </DialogTitle>
                <DialogDescription className="text-white/60 dark:text-slate-600 font-bold mt-1">Distribute funds from site budget to team members.</DialogDescription>
            </div>
            <div className="p-8 space-y-6 text-slate-900 dark:text-white">
                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Select Member</Label>
                        <Select value={topUpData.userId} onValueChange={(v) => setTopUpData({...topUpData, userId: v})}>
                            <SelectTrigger className="h-12 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white font-black italic">
                                <SelectValue placeholder={site.teamMembers.length > 0 ? "Select member" : "No members"} />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white">
                                {site.teamMembers.map(m => <SelectItem key={m} value={m} className="font-bold">{m}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Amount (₹)</Label>
                            <span className="text-[9px] font-black text-indigo-500 uppercase">Avail: ₹{wallet?.balance.toLocaleString()}</span>
                        </div>
                        <Input 
                            type="number" 
                            placeholder="0.00" 
                            className="h-12 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-xl font-black text-slate-900 dark:text-white text-lg focus:ring-2 focus:ring-indigo-500"
                            value={topUpData.amount}
                            onChange={(e) => setTopUpData({...topUpData, amount: e.target.value})}
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Reason for Top-up</Label>
                    <Input 
                        placeholder="e.g. Travel and miscellaneous" 
                        className="h-12 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white font-bold italic"
                        value={topUpData.reason}
                        onChange={(e) => setTopUpData({...topUpData, reason: e.target.value})}
                    />
                </div>
            </div>
            <DialogFooter className="p-8 pt-0">
                <Button onClick={handleTopUp} className="w-full h-14 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 rounded-2xl font-black text-lg shadow-xl uppercase tracking-widest transition-all" disabled={isSaving}>
                    {isSaving ? <Loader2 className="animate-spin h-6 w-6 mr-2" /> : "Authorize Funding"}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Dialog */}
      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle className="text-2xl font-black uppercase italic tracking-tight">Request Funds</DialogTitle>
                <DialogDescription className="font-bold">Submit a request to top up your wallet for this site.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label className="font-black text-xs uppercase text-slate-500">Requested Amount (₹)</Label>
                    <Input 
                        type="number" 
                        placeholder="0.00" 
                        className="h-12 text-2xl font-black rounded-xl bg-slate-50 border-none shadow-inner"
                        value={requestData.amount}
                        onChange={(e) => setRequestData({...requestData, amount: Number(e.target.value)})}
                    />
                </div>
                <div className="space-y-2">
                    <Label className="font-black text-xs uppercase text-slate-500">Reason / Usage Plan</Label>
                    <textarea 
                        className="w-full rounded-xl bg-slate-50 p-4 text-sm font-bold placeholder:italic h-32 focus:ring-2 focus:ring-indigo-500 transition-all outline-none border-none shadow-inner"
                        placeholder="Explain why you need these funds..." 
                        value={requestData.reason}
                        onChange={(e) => setRequestData({...requestData, reason: e.target.value})}
                    />
                </div>
            </div>
            <DialogFooter>
                <Button onClick={handleRequestMoney} className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 font-black uppercase tracking-widest text-sm shadow-xl rounded-xl" disabled={requestLoading}>
                    {requestLoading ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : "Submit Request"}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Site Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-xl">
            <DialogHeader>
                <DialogTitle className="text-2xl font-black">Edit Site Intelligence</DialogTitle>
                <DialogDescription className="font-bold">Update core project parameters and identifiers.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
                <div className="space-y-2">
                    <Label className="font-black text-xs uppercase text-slate-500">Site Name</Label>
                    <Input value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                    <Label className="font-black text-xs uppercase text-slate-500">Site Code (Unique)</Label>
                    <Input value={editData.code} onChange={e => setEditData({...editData, code: e.target.value})} />
                </div>
                <div className="space-y-2">
                    <Label className="font-black text-xs uppercase text-slate-500">Client Name</Label>
                    <Input value={editData.clientName} onChange={e => setEditData({...editData, clientName: e.target.value})} />
                </div>
                <div className="space-y-2">
                    <Label className="font-black text-xs uppercase text-slate-500">Location</Label>
                    <Input value={editData.location} onChange={e => setEditData({...editData, location: e.target.value})} />
                </div>
                <div className="space-y-2">
                    <Label className="font-black text-xs uppercase text-slate-500">Site Manager</Label>
                    <Select value={editData.managerId} onValueChange={v => setEditData({...editData, managerId: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {users?.map(u => <SelectItem key={u._id} value={u.name}>{u.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label className="font-black text-xs uppercase text-slate-500">Project Type</Label>
                    <Select value={editData.projectType} onValueChange={v => setEditData({...editData, projectType: v as any})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Commercial">Commercial</SelectItem>
                            <SelectItem value="Residential">Residential</SelectItem>
                            <SelectItem value="Villa">Villa</SelectItem>
                            <SelectItem value="Apartments">Apartments</SelectItem>
                            <SelectItem value="Others">Others</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label className="font-black text-xs uppercase text-slate-500">Status</Label>
                    <Select value={editData.status} onValueChange={v => setEditData({...editData, status: v as any})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Active">Active</SelectItem>
                            <SelectItem value="On Hold">On Hold</SelectItem>
                            <SelectItem value="Completed">Completed</SelectItem>
                            <SelectItem value="Archived">Archived</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Notes / Description</Label>
                    <Input 
                        className="h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-bold italic"
                        value={editData.notes}
                        onChange={(e) => setEditData({...editData, notes: e.target.value})}
                    />
                </div>
                <div className="space-y-2 md:col-span-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 italic">Site Photo Proof</Label>
                    <button 
                        onClick={() => setEditData({ ...editData, requiresAttendancePhoto: !editData.requiresAttendancePhoto })}
                        className={cn(
                            "flex items-center gap-4 w-full p-4 rounded-2xl transition-all border-2",
                            editData.requiresAttendancePhoto 
                                ? "bg-rose-500/5 border-rose-500/20 text-rose-500 shadow-xl shadow-rose-500/5" 
                                : "bg-slate-50 dark:bg-slate-800 border-transparent text-slate-400"
                        )}
                    >
                        <div className={cn(
                            "h-10 w-10 rounded-xl flex items-center justify-center transition-colors",
                            editData.requiresAttendancePhoto ? "bg-rose-500 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-500"
                        )}>
                            <Camera className="h-5 w-5" />
                        </div>
                        <div className="text-left">
                            <p className="text-xs font-black uppercase tracking-widest leading-none">
                                {editData.requiresAttendancePhoto ? "Mandatory Photo Proof" : "Photo Proof Optional"}
                            </p>
                            <p className="text-[10px] font-bold mt-1 opacity-70 italic">
                                {editData.requiresAttendancePhoto ? "Employees MUST upload a site photo to check-in" : "Standard check-in without mandatory photo proof"}
                            </p>
                        </div>
                    </button>
                </div>
            </div>
            <DialogFooter className="pt-6 border-t border-slate-100 dark:border-slate-800">
                <Button variant="outline" className="h-12 rounded-xl font-black uppercase tracking-widest text-xs" onClick={() => setEditOpen(false)}>Cancel</Button>
                <Button onClick={handleUpdateSite} className="h-12 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black rounded-xl shadow-xl transition-all active:scale-95 px-8 italic uppercase tracking-widest text-xs" disabled={isSaving}>
                    {isSaving ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : "Save Changes"}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function DownloadIcon() {
    return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
}
