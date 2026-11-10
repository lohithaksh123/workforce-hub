'use client'

import { useState, useEffect, useContext, useMemo } from 'react'
import { Wallet, TrendingUp, TrendingDown, AlertCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { StatCard } from '@/components/dashboard/stat-card'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/dashboard/data-table'
import { Badge } from '@/components/ui/badge'
import { cn, normalizeWalletUserId } from '@/lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts'

// Sample data for recent transactions
const recentTransactions = [
  {
    id: '1',
    date: '2025-03-11',
    type: 'credit',
    description: 'Payment from ABC Corp',
    amount: 5000,
    status: 'COMPLETED',
  },
  {
    id: '2',
    date: '2025-03-10',
    type: 'debit',
    description: 'Office supplies payment',
    amount: 250,
    status: 'COMPLETED',
  },
  {
    id: '3',
    date: '2025-03-10',
    type: 'debit',
    description: 'Vendor payment pending',
    amount: 1200,
    status: 'PENDING',
  },
  {
    id: '4',
    date: '2025-03-09',
    type: 'credit',
    description: 'Payment from XYZ Ltd',
    amount: 3500,
    status: 'COMPLETED',
  },
]

import { motion, AnimatePresence } from 'framer-motion'
const chartData = [
  { month: 'Jan', spent: 4000, received: 24000 },
  { month: 'Feb', spent: 3000, received: 21000 },
  { month: 'Mar', spent: 2000, received: 29000 },
  { month: 'Apr', spent: 2780, received: 39000 },
  { month: 'May', spent: 1890, received: 48000 },
  { month: 'Jun', spent: 2390, received: 38000 },
]

import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Search, ArrowUpDown, Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { UserContext } from '@/components/dashboard/UserContext'
import { NoticeWidget } from '@/components/dashboard/notice/NoticeWidget'

export default function DashboardPage() {
  const { user } = useContext(UserContext)
  const isOwner = user?.role === 'Owner'

  const financialSummary = useQuery(api.central_wallet.getFinancialSummary, isOwner ? {} : { userId: user?.name })
  const transactions = useQuery(api.requests.getTransactions)
  const requests = useQuery(api.requests.getRequests)
  const siteFinances = useQuery(api.sites.getSiteFinancesForDashboard)
  const staffWallets = useQuery(api.wallets.getWallets)
  
  const [siteSearch, setSiteSearch] = useState('')
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)

  const downloadReport = () => {
    setIsDownloading(true)
    try {
      const now = new Date()
      const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      const filename = `EMP_Financial_Report_${now.toISOString().split('T')[0]}.csv`

      const rows: string[] = []

      // Header
      rows.push('ACME INTERIORS')
      rows.push(`Financial Intelligence Report`)
      rows.push(`Generated On: ${dateStr} at ${timeStr}`)
      rows.push(`Prepared For: ${user?.name || 'Administrator'} (${user?.role || 'Owner'})`)
      rows.push('')

      // Summary Section
      rows.push('=== FINANCIAL SUMMARY ===')
      rows.push('Metric,Value')
      rows.push(`Balance,"₹${balance.toLocaleString('en-IN')}"`)
      rows.push(`Credit,"₹${totalReceived.toLocaleString('en-IN')}"`)
      rows.push(`Debit / Expenses,"₹${totalSpent.toLocaleString('en-IN')}"`)
      const savingsRate = totalReceived > 0 ? Math.max(0, Math.round(((totalReceived - totalSpent) / totalReceived) * 100)) : 0
      rows.push(`Savings Rate,${savingsRate}%`)
      rows.push(`Pending Requests,${pendingRequestsCount}`)
      rows.push('')

      // Site Breakdown
      if (siteFinances && siteFinances.length > 0) {
        rows.push('=== SITE-WISE ALLOCATION BREAKDOWN ===')
        rows.push('Site Name,Location,Total Budget,Total Expenses,Remaining Balance,Budget Utilisation %')
        siteFinances.forEach((site: any) => {
          const utilisation = site.totalAssigned > 0 ? Math.round((site.totalExpenses / site.totalAssigned) * 100) : 0
          rows.push(`"${site.name}","${site.location}","₹${site.totalAssigned.toLocaleString('en-IN')}","₹${site.totalExpenses.toLocaleString('en-IN')}","₹${site.fundsAvailable.toLocaleString('en-IN')}",${utilisation}%`)
        })
        rows.push('')
      }

      // Transaction Ledger
      if (relevantTransactions && relevantTransactions.length > 0) {
        rows.push('=== FULL TRANSACTION LEDGER ===')
        rows.push('Date,Type,Description / Purpose,Source / Vendor,Amount,Status,Performed By,Approved By')
        relevantTransactions.forEach((t: any) => {
          rows.push(`"${t.date}","${t.type}","${(t.purpose || '').replace(/"/g, "'")}","${(t.source_or_vendor || 'N/A').replace(/"/g, "'")}","₹${t.amount.toLocaleString('en-IN')}","${t.status}","${t.performed_by || t.used_by || 'N/A'}","${t.approved_by || 'N/A'}"`)
        })
        rows.push('')
      }

      rows.push('--- End of Report ---')

      const csvContent = rows.join('\n')
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } finally {
      setIsDownloading(false)
    }
  }

  const balance = financialSummary?.balance ?? 0
  const totalReceived = financialSummary?.totalReceived ?? 0
  const totalSpent = financialSummary?.totalSpent ?? 0
  const companyWalletBalance = financialSummary?.companyWalletBalance ?? 0
  const siteWalletsBalance = financialSummary?.siteWalletsBalance ?? 0
  const employeeWalletsBalance = financialSummary?.employeeWalletsBalance ?? 0
  const totalAvailableBalance = financialSummary?.totalAvailableBalance ?? balance

  const staffTotals = useMemo(() => {
    if (!staffWallets) return { balance: 0, credited: 0, debited: 0 }
    return staffWallets.reduce((acc, w) => ({
      balance: acc.balance + w.balance,
      credited: acc.credited + w.total_credited,
      debited: acc.debited + w.total_debited
    }), { balance: 0, credited: 0, debited: 0 })
  }, [staffWallets])
  
  const normUserName = normalizeWalletUserId(user?.name || '')
  const relevantRequests = isOwner ? requests : requests?.filter(r => normalizeWalletUserId(r.requested_by || '') === normUserName)
  const pendingRequestsCount = relevantRequests?.filter(r => r.status === 'PENDING').length ?? 0
  
  const relevantTransactions = isOwner ? transactions : transactions?.filter(t => normalizeWalletUserId(t.used_by || '') === normUserName)
  const recentTransactionsFromDB = relevantTransactions?.slice(0, 5) ?? []

  const inflowTrend = financialSummary?.inflowTrend ?? { value: 0, direction: 'up' as const }
  const outflowTrend = financialSummary?.outflowTrend ?? { value: 0, direction: 'up' as const }

  // Real Chart Data
  const monthlyData = useMemo(() => {
    if (!relevantTransactions) return []
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const isInternal = (t: any) => t.isInternalTransfer === true || t.type === 'TRANSFER' || t.type === 'RETURN';
    const data = months.map((month, idx) => {
      const monthTransactions = relevantTransactions.filter(t => new Date(t.date).getMonth() === idx)
      return {
        month,
        received: monthTransactions.filter(t => t.type === 'CREDIT' && !isInternal(t)).reduce((sum, t) => sum + t.amount, 0),
        spent: monthTransactions.filter(t => t.type === 'DEBIT' && !isInternal(t)).reduce((sum, t) => sum + t.amount, 0)
      }
    })
    const currentMonthIdx = new Date().getMonth()
    return data.slice(Math.max(0, currentMonthIdx - 5), currentMonthIdx + 1)
  }, [relevantTransactions])

  // Table Logic
  const sortedFinances = useMemo(() => {
    let sortableItems = [...(siteFinances || [])]
    if (siteSearch) {
      sortableItems = sortableItems.filter(s => 
        s.name.toLowerCase().includes(siteSearch.toLowerCase()) || 
        s.location.toLowerCase().includes(siteSearch.toLowerCase())
      )
    }
    if (sortConfig !== null) {
      sortableItems.sort((a: any, b: any) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? -1 : 1
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? 1 : -1
        }
        return 0
      })
    }
    return sortableItems
  }, [siteFinances, siteSearch, sortConfig])

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  const grandTotals = useMemo(() => {
    if (!siteFinances) return { assigned: 0, expenses: 0, available: 0 }
    return siteFinances.reduce((acc, s) => ({
      assigned: acc.assigned + s.totalAssigned,
      expenses: acc.expenses + s.totalExpenses,
      available: acc.available + s.fundsAvailable
    }), { assigned: 0, expenses: 0, available: 0 })
  }, [siteFinances])

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-700">
      {/* Header - Refined & Subtle */}
      <div className="relative p-6 sm:p-10 rounded-3xl bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white overflow-hidden shadow-sm border border-slate-100 dark:border-white/5">
        <div className="absolute top-[-50%] right-[-10%] w-[40%] h-[200%] bg-primary/10 rounded-full blur-[100px]" />
        
        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="space-y-3 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200/50 dark:bg-white/5 border border-slate-200 dark:border-white/5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Central Command Center
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tighter italic uppercase leading-tight">
              <span className="text-primary italic">Dashboard</span>
            </h1>
            <p className="text-slate-600 dark:text-slate-400 font-medium italic max-w-lg text-xs md:text-sm leading-relaxed mx-auto lg:mx-0">
               {isOwner ? "Real-time auditing of financial infrastructure and site-wide allocations." : `Welcome back, ${user?.name}. Your personal summary is ready.`}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-4 w-full lg:w-auto min-w-0 lg:min-w-[280px]">
             <div className="p-6 rounded-2xl bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 shadow-sm flex-1 group hover:border-primary/20 transition-all">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">Balance</div>
                <div className="text-3xl md:text-5xl font-black leading-tight pt-1 text-slate-900 dark:text-white tracking-tighter italic tabular-nums group-hover:scale-105 transition-transform origin-left">₹{balance.toLocaleString('en-IN')}</div>
             </div>
             <div className="flex gap-3 justify-center lg:justify-start">
               <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-4 py-2.5 font-black uppercase text-[9px] tracking-widest backdrop-blur-md rounded-xl flex-1 text-center justify-center">
                 Live Updates
               </Badge>
               <Badge className="bg-slate-200/50 dark:bg-white/5 text-slate-400 border-none px-4 py-2.5 font-black uppercase text-[9px] tracking-widest backdrop-blur-md rounded-xl flex-1 text-center justify-center">
                 {new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
               </Badge>
             </div>
          </div>
        </div>
      </div>

  {/* Stats Cards */}
  {isOwner ? (
    <div className="space-y-6">
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        {/* Main Balance Breakdown Card */}
        <Card className="lg:col-span-2 border-none shadow-sm bg-gradient-to-br from-indigo-950/20 via-slate-900/40 to-slate-900/10 border-l-4 border-indigo-500 rounded-3xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform duration-700">
            <Wallet className="h-32 w-32 text-indigo-400" />
          </div>
          
          <div className="space-y-6">
            <div>
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-indigo-400">Total Company System Balance</h3>
              <div className="text-4xl md:text-5xl font-black italic tracking-tighter text-slate-900 dark:text-white mt-1">
                ₹{totalAvailableBalance.toLocaleString('en-IN')}
              </div>
              <p className="text-[10px] text-slate-500 font-bold mt-1">Combined capital across vault, project sites, and staff wallets</p>
            </div>

            {/* Allocation Bar */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-slate-400">
                <span>Capital Distribution Split</span>
              </div>
              <div className="h-4 w-full bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
                {totalAvailableBalance > 0 ? (
                  <>
                    <div 
                      style={{ width: `${(companyWalletBalance / totalAvailableBalance) * 100}%` }} 
                      className="h-full bg-indigo-500 hover:opacity-90 transition-all duration-500"
                      title={`Vault: ₹${companyWalletBalance.toLocaleString('en-IN')}`}
                    />
                    <div 
                      style={{ width: `${(siteWalletsBalance / totalAvailableBalance) * 100}%` }} 
                      className="h-full bg-emerald-500 hover:opacity-90 transition-all duration-500"
                      title={`Sites: ₹${siteWalletsBalance.toLocaleString('en-IN')}`}
                    />
                    <div 
                      style={{ width: `${(employeeWalletsBalance / totalAvailableBalance) * 100}%` }} 
                      className="h-full bg-amber-500 hover:opacity-90 transition-all duration-500"
                      title={`Staff: ₹${employeeWalletsBalance.toLocaleString('en-IN')}`}
                    />
                  </>
                ) : (
                  <div className="h-full w-full bg-slate-700" />
                )}
              </div>
            </div>

            {/* Sub-cards Grid */}
            <div className="grid grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Company Vault</div>
                <div className="text-lg font-black tracking-tight text-indigo-400 mt-1">
                  ₹{companyWalletBalance.toLocaleString('en-IN')}
                </div>
                <div className="text-[8px] text-slate-500 font-bold mt-0.5">
                  {totalAvailableBalance > 0 ? Math.round((companyWalletBalance / totalAvailableBalance) * 100) : 0}% share
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Site Budgets</div>
                <div className="text-lg font-black tracking-tight text-emerald-400 mt-1">
                  ₹{siteWalletsBalance.toLocaleString('en-IN')}
                </div>
                <div className="text-[8px] text-slate-500 font-bold mt-0.5">
                  {totalAvailableBalance > 0 ? Math.round((siteWalletsBalance / totalAvailableBalance) * 100) : 0}% share
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Staff Wallets</div>
                <div className="text-lg font-black tracking-tight text-amber-400 mt-1">
                  ₹{employeeWalletsBalance.toLocaleString('en-IN')}
                </div>
                <div className="text-[8px] text-slate-500 font-bold mt-0.5">
                  {totalAvailableBalance > 0 ? Math.round((employeeWalletsBalance / totalAvailableBalance) * 100) : 0}% share
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Secondary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-4">
          <StatCard
            title="Credit"
            value={`₹${totalReceived.toLocaleString('en-IN')}`}
            icon={<TrendingUp className="h-5 w-5" />}
            trend={inflowTrend}
            description="Total external money received"
            href="/dashboard/transactions"
          />
          <StatCard
            title="Debit / Expenses"
            value={`₹${totalSpent.toLocaleString('en-IN')}`}
            icon={<TrendingDown className="h-5 w-5" />}
            trend={outflowTrend}
            description="External spends (excl. internal transfers)"
            href="/dashboard/transactions"
          />
          <StatCard
            title="Pending Queue"
            value={String(pendingRequestsCount)}
            icon={<AlertCircle className="h-5 w-5" />}
            description="Awaiting approval"
            href="/dashboard/requests"
          />
        </div>
      </div>
    </div>
  ) : (
    <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Credit"
        value={`₹${totalReceived.toLocaleString('en-IN')}`}
        icon={<TrendingUp className="h-5 w-5" />}
        trend={inflowTrend}
        description="Total external money received"
        href="/dashboard/transactions"
      />
      <StatCard
        title="Debit / Expenses"
        value={`₹${totalSpent.toLocaleString('en-IN')}`}
        icon={<TrendingDown className="h-5 w-5" />}
        trend={outflowTrend}
        description="Actual money spent. Internal transfers are excluded."
        href="/dashboard/transactions"
      />
      <StatCard
        title="Balance"
        value={`₹${balance.toLocaleString('en-IN')}`}
        icon={<Wallet className="h-5 w-5" />}
        description="Total funds available across all wallets"
        href="/dashboard/wallets"
      />
      <StatCard
        title="Pending Queue"
        value={String(pendingRequestsCount)}
        icon={<AlertCircle className="h-5 w-5" />}
        description="Awaiting approval"
        href="/dashboard/requests"
      />
    </div>
  )}

      {/* Analytics Section */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main Chart */}
        <Card className="lg:col-span-2 border-none shadow-2xl bg-white dark:bg-slate-900 backdrop-blur-xl overflow-hidden rounded-3xl">
          <CardHeader className="p-6 md:p-10 pb-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <CardTitle className="text-xl md:text-2xl font-black uppercase italic tracking-tighter">Financial Pulse</CardTitle>
                <CardDescription className="font-bold text-slate-500 dark:text-slate-400 text-xs md:text-sm italic">Monthly Income vs Expenditure Trend</CardDescription>
              </div>
              <div className="flex gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">Inflow</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">Outflow</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 md:p-10 pt-6 h-[280px] sm:h-[350px] md:h-[450px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" opacity={0.2} />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 800 }} 
                  dy={15}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 800 }}
                  tickFormatter={(value) => `₹${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`}
                  width={40}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                    border: 'none', 
                    borderRadius: '20px',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
                    backdropFilter: 'blur(10px)',
                    padding: '12px 16px'
                  }}
                  itemStyle={{ fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', padding: '2px 0' }}
                  cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="received" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={5} 
                  dot={{ r: 0 }}
                  activeDot={{ r: 8, fill: "hsl(var(--primary))", strokeWidth: 4, stroke: '#fff' }}
                  animationDuration={2500}
                />
                <Line 
                  type="monotone" 
                  dataKey="spent" 
                  stroke="#f43f5e" 
                  strokeWidth={5} 
                  dot={{ r: 0 }}
                  activeDot={{ r: 8, fill: '#f43f5e', strokeWidth: 4, stroke: '#fff' }}
                  animationDuration={2500}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Breakdown Card */}
        <Card className="border-none shadow-sm bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white overflow-hidden rounded-xl flex flex-col justify-between">
          <CardHeader className="p-6 sm:p-8">
            <CardTitle className="text-lg md:text-xl font-black uppercase italic tracking-tight">Performance Summary</CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400 font-bold italic underline decoration-primary decoration-2 text-xs">Last 30-day snapshot</CardDescription>
          </CardHeader>
          <CardContent className="p-6 sm:p-8 space-y-6 sm:space-y-8">
            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">Savings Rate</span>
                <span className="text-2xl font-black text-emerald-500 italic">
                  {totalReceived > 0 ? Math.max(0, Math.round(((totalReceived - totalSpent) / totalReceived) * 100)) : 0}%
                </span>
              </div>
              <div className="h-2.5 w-full bg-slate-200 dark:bg-white/5 rounded-full overflow-hidden shadow-inner">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${totalReceived > 0 ? Math.max(0, Math.round(((totalReceived - totalSpent) / totalReceived) * 100)) : 0}%` }}
                  transition={{ duration: 1.5, delay: 0.5 }}
                  className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 pt-4">
               <div className="flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-white/5 border border-slate-100 dark:border-white/5">
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <TrendingUp className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total Credits</div>
                    <div className="text-lg font-black tracking-tighter">₹{totalReceived.toLocaleString('en-IN')}</div>
                  </div>
               </div>
               <div className="flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-white/5 border border-slate-100 dark:border-white/5">
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                    <TrendingDown className="h-5 w-5 text-rose-500" />
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total Debit / Expenses</div>
                    <div className="text-lg font-black tracking-tighter">₹{totalSpent.toLocaleString('en-IN')}</div>
                  </div>
               </div>
            </div>
          </CardContent>
          <div className="p-6 sm:p-8 bg-white/5 border-t border-white/5">
             <Button 
               className="w-full h-14 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 font-black uppercase tracking-widest text-xs rounded-2xl transition-all active:scale-95 disabled:opacity-60 shadow-xl"
               onClick={downloadReport}
               disabled={isDownloading}
             >
               {isDownloading ? 'Generating Report...' : '↓ Download Detailed Report'}
             </Button>
          </div>
        </Card>

        {/* Notices Panel */}
        <div className="lg:col-span-1 h-full">
            <NoticeWidget />
        </div>
      </div>

      {/* Site-wise & Staff Financial Tracking Section */}
      {isOwner && (
        <Card className="border-none shadow-2xl bg-white dark:bg-slate-900/40 backdrop-blur-xl overflow-hidden rounded-xl">
          <Tabs defaultValue="sites" className="w-full">
            <CardHeader className="bg-slate-50 dark:bg-slate-900/80 text-slate-900 dark:text-white p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 transition-colors duration-500 border-b border-slate-100 dark:border-slate-800">
              <div className="space-y-4 md:space-y-0 flex flex-col md:flex-row md:items-center gap-6 w-full justify-between">
                <div className="flex flex-col gap-1.5">
                  <CardTitle className="text-xl md:text-2xl font-black uppercase italic tracking-tighter">Capital Allocation Vault</CardTitle>
                  <CardDescription className="font-bold italic text-xs md:text-sm text-slate-500 dark:text-slate-400">Detailed breakdown of allocations across sites and custodians</CardDescription>
                  <TabsList className="bg-slate-200 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700/50 rounded-xl p-1 w-fit mt-2">
                    <TabsTrigger value="sites" className="font-black uppercase tracking-widest text-[9px] px-4 py-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white">Project Sites</TabsTrigger>
                    <TabsTrigger value="staff" className="font-black uppercase tracking-widest text-[9px] px-4 py-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white">Staff Wallets</TabsTrigger>
                  </TabsList>
                </div>
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input 
                      placeholder="Search project, staff or location..." 
                      className="pl-12 h-12 bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-2xl font-bold italic text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:bg-slate-100 dark:focus:bg-white/10 transition-all shadow-sm"
                      value={siteSearch}
                      onChange={(e) => setSiteSearch(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="p-0">
              <TabsContent value="sites" className="mt-0">
                {/* Desktop Table View */}
                <div className="hidden xl:block overflow-x-auto">
                  <table className="w-full text-left min-w-[800px]">
                    <thead>
                      <tr className="bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-800">
                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400">
                          <button onClick={() => requestSort('name')} className="flex items-center gap-2 hover:text-indigo-500 transition-colors">
                              Site Identification <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </th>
                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400 text-right">
                          <button onClick={() => requestSort('totalAssigned')} className="flex items-center gap-2 ml-auto hover:text-indigo-500 transition-colors">
                              Total Budget <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </th>
                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400 text-right">
                          <button onClick={() => requestSort('totalExpenses')} className="flex items-center gap-2 ml-auto hover:text-indigo-500 transition-colors">
                              Total Expenses <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </th>
                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400 text-right">
                          <button onClick={() => requestSort('fundsAvailable')} className="flex items-center gap-2 ml-auto hover:text-primary transition-colors">
                              Available Balance <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                      {sortedFinances.length === 0 ? (
                          <tr>
                              <td colSpan={4} className="px-8 py-24 text-center">
                                  <div className="flex flex-col items-center gap-3 opacity-30">
                                      <AlertCircle className="h-12 w-12 text-slate-400" />
                                      <p className="text-lg font-black italic uppercase tracking-widest">No matching site records</p>
                                  </div>
                              </td>
                          </tr>
                      ) : sortedFinances.map((site: any) => (
                        <tr 
                          key={site.id} 
                          className="hover:bg-primary/5 dark:hover:bg-primary/10 transition-all duration-300 cursor-pointer group"
                          onClick={() => window.location.href = `/dashboard/sites/${site.id}`}
                        >
                          <td className="px-8 py-6">
                            <div className="flex flex-col">
                              <span className="font-semibold text-slate-900 dark:text-white text-base flex items-center gap-2 group-hover:text-primary transition-colors">
                                  {site.name}
                                  <ArrowUpRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-500" />
                              </span>
                              <span className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-1">{site.location}</span>
                            </div>
                          </td>
                          <td className="px-8 py-6 text-right font-medium text-slate-700 dark:text-slate-300 text-base">
                            ₹{site.totalAssigned.toLocaleString('en-IN')}
                          </td>
                          <td className="px-8 py-6 text-right font-medium text-rose-600 dark:text-rose-500 text-base">
                            ₹{site.totalExpenses.toLocaleString('en-IN')}
                          </td>
                          <td className="px-8 py-6 text-right text-base font-medium">
                            <div className="flex flex-col items-end gap-1.5">
                              <Badge className={cn(
                                "font-bold text-xs px-4 py-2 rounded-xl border-none shadow-sm",
                                site.fundsAvailable > 1000 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 dark:bg-emerald-500/20" : "bg-amber-500/10 text-amber-600 dark:text-amber-400 dark:bg-amber-500/20"
                              )}>
                                ₹{site.fundsAvailable.toLocaleString('en-IN')}
                              </Badge>
                              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mt-0.5">
                                {site.totalAssigned > 0 ? Math.round((site.totalExpenses / site.totalAssigned) * 100) : 0}% utilised
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white font-semibold shadow-md relative z-10 border-t border-slate-200 dark:border-slate-800">
                      <tr>
                        <td className="px-8 py-6 text-sm uppercase tracking-widest text-slate-500">Site Budgets Total</td>
                        <td className="px-8 py-6 text-right text-base font-bold">₹{grandTotals.assigned.toLocaleString('en-IN')}</td>
                        <td className="px-8 py-6 text-right text-base text-rose-600 dark:text-rose-500">₹{grandTotals.expenses.toLocaleString('en-IN')}</td>
                        <td className="px-8 py-6 text-right text-base text-emerald-600 dark:text-emerald-500">₹{grandTotals.available.toLocaleString('en-IN')}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="xl:hidden p-4 space-y-4 bg-slate-50/50 dark:bg-slate-900/20">
                  {sortedFinances.length === 0 ? (
                    <div className="py-20 text-center opacity-30">
                      <AlertCircle className="h-10 w-10 mx-auto text-slate-400 mb-3" />
                      <p className="text-xs font-black uppercase tracking-widest text-slate-500">No records found</p>
                    </div>
                  ) : sortedFinances.map((site: any) => (
                    <div 
                      key={site.id}
                      className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm space-y-5 active:scale-[0.98] transition-transform"
                      onClick={() => window.location.href = `/dashboard/sites/${site.id}`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex flex-col">
                          <span className="font-black italic uppercase tracking-tight text-slate-900 dark:text-white text-sm">{site.name}</span>
                          <span className="text-[10px] font-bold text-slate-500 mt-0.5">{site.location}</span>
                        </div>
                        <ArrowUpRight className="h-4 w-4 text-primary" />
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="space-y-1">
                          <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500">Total Budget</p>
                          <p className="text-sm font-black text-slate-900 dark:text-white">₹{site.totalAssigned.toLocaleString('en-IN')}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500">Total Expenses</p>
                          <p className="text-sm font-black text-rose-500 italic">₹{site.totalExpenses.toLocaleString('en-IN')}</p>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                        <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500">Available Balance</p>
                        <Badge className={cn(
                          "font-black text-[10px] px-3 py-1 rounded-lg border-none",
                          site.fundsAvailable > 1000 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        )}>
                          ₹{site.fundsAvailable.toLocaleString('en-IN')}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  
                  {sortedFinances.length > 0 && (
                    <div className="p-5 bg-slate-900 text-white rounded-2xl shadow-xl space-y-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-white/10 pb-2">Institutional Totals</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-[8px] font-bold uppercase text-slate-500">Total Budget</p>
                          <p className="text-base font-black">₹{grandTotals.assigned.toLocaleString('en-IN')}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[8px] font-bold uppercase text-slate-500">Remaining Balance</p>
                          <p className="text-base font-black text-emerald-400">₹{grandTotals.available.toLocaleString('en-IN')}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="staff" className="mt-0">
                {/* Desktop Table View */}
                <div className="hidden xl:block overflow-x-auto">
                  <table className="w-full text-left min-w-[800px]">
                    <thead>
                      <tr className="bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-800">
                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400">
                          Staff Member
                        </th>
                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400">
                          Role
                        </th>
                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400 text-right">
                          Total Allocated
                        </th>
                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400 text-right">
                          Total Spent
                        </th>
                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400 text-right">
                          Wallet Balance
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                      {!staffWallets || staffWallets.length === 0 ? (
                          <tr>
                              <td colSpan={5} className="px-8 py-24 text-center">
                                  <div className="flex flex-col items-center gap-3 opacity-30">
                                      <AlertCircle className="h-12 w-12 text-slate-400" />
                                      <p className="text-lg font-black italic uppercase tracking-widest">No staff wallet records</p>
                                  </div>
                              </td>
                          </tr>
                      ) : staffWallets.filter(w => !siteSearch || w.userId.toLowerCase().includes(siteSearch.toLowerCase())).map((wallet: any) => (
                        <tr 
                          key={wallet._id} 
                          className="hover:bg-primary/5 dark:hover:bg-primary/10 transition-all duration-300 cursor-pointer group"
                          onClick={() => window.location.href = `/dashboard/wallets`}
                        >
                          <td className="px-8 py-6">
                            <span className="font-semibold text-slate-900 dark:text-white text-base group-hover:text-primary transition-colors">
                                {wallet.userId}
                            </span>
                          </td>
                          <td className="px-8 py-6 text-slate-600 dark:text-slate-400 text-sm">
                            {wallet.role}
                          </td>
                          <td className="px-8 py-6 text-right font-medium text-slate-700 dark:text-slate-300 text-base">
                            ₹{wallet.total_credited.toLocaleString('en-IN')}
                          </td>
                          <td className="px-8 py-6 text-right font-medium text-rose-600 dark:text-rose-500 text-base">
                            ₹{wallet.total_debited.toLocaleString('en-IN')}
                          </td>
                          <td className="px-8 py-6 text-right">
                            <Badge className={cn(
                              "font-bold text-xs px-4 py-2 rounded-xl border-none shadow-sm",
                              wallet.balance > 0 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 dark:bg-emerald-500/20" : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                            )}>
                              ₹{wallet.balance.toLocaleString('en-IN')}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white font-semibold shadow-md relative z-10 border-t border-slate-200 dark:border-slate-800">
                      <tr>
                        <td colSpan={2} className="px-8 py-6 text-sm uppercase tracking-widest text-slate-500">Staff Totals</td>
                        <td className="px-8 py-6 text-right text-base font-bold">₹{staffTotals.credited.toLocaleString('en-IN')}</td>
                        <td className="px-8 py-6 text-right text-base text-rose-600 dark:text-rose-500">₹{staffTotals.debited.toLocaleString('en-IN')}</td>
                        <td className="px-8 py-6 text-right text-base text-emerald-600 dark:text-emerald-500">₹{staffTotals.balance.toLocaleString('en-IN')}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="xl:hidden p-4 space-y-4 bg-slate-50/50 dark:bg-slate-900/20">
                  {!staffWallets || staffWallets.length === 0 ? (
                    <div className="py-20 text-center opacity-30">
                      <AlertCircle className="h-10 w-10 mx-auto text-slate-400 mb-3" />
                      <p className="text-xs font-black uppercase tracking-widest text-slate-500">No records found</p>
                    </div>
                  ) : staffWallets.filter(w => !siteSearch || w.userId.toLowerCase().includes(siteSearch.toLowerCase())).map((wallet: any) => (
                    <div 
                      key={wallet._id}
                      className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm space-y-5 active:scale-[0.98] transition-transform"
                      onClick={() => window.location.href = `/dashboard/wallets`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex flex-col">
                          <span className="font-black italic uppercase tracking-tight text-slate-900 dark:text-white text-sm">{wallet.userId}</span>
                          <span className="text-[10px] font-bold text-slate-500 mt-0.5">{wallet.role}</span>
                        </div>
                        <ArrowUpRight className="h-4 w-4 text-primary" />
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="space-y-1">
                          <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500">Allocated</p>
                          <p className="text-sm font-black text-slate-900 dark:text-white">₹{wallet.total_credited.toLocaleString('en-IN')}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500">Spent</p>
                          <p className="text-sm font-black text-rose-500 italic">₹{wallet.total_debited.toLocaleString('en-IN')}</p>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                        <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500">Wallet Balance</p>
                        <Badge className={cn(
                          "font-black text-[10px] px-3 py-1 rounded-lg border-none",
                          wallet.balance > 0 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        )}>
                          ₹{wallet.balance.toLocaleString('en-IN')}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      )}

      {/* Recent Transactions */}
      <Card className="border-none shadow-2xl bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl rounded-xl overflow-hidden">
        <CardHeader className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-xl md:text-2xl font-black uppercase italic tracking-tighter">Audit Vault</CardTitle>
            <CardDescription className="font-bold underline italic decoration-primary decoration-4 underline-offset-8 text-xs md:text-sm text-slate-500 dark:text-slate-400">Centralized immutable ledger of all organizational capital movements</CardDescription>
          </div>
          <Button variant="ghost" className="font-black italic uppercase tracking-widest text-[10px] text-slate-500 hover:text-primary" onClick={() => window.location.href = '/dashboard/transactions'}>
            View Entire Ledger
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={[
              {
                key: 'date',
                header: 'Timestamp',
                cell: (v) => <span className="font-medium text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">{String(v)}</span>
              },
              {
                key: 'purpose',
                header: 'Purpose / Description',
                cell: (v) => <span className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate max-w-[250px]">{String(v)}</span>
              },
              {
                key: 'source_or_vendor',
                header: 'Counterparty',
                cell: (v) => <span className="font-medium text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-md">{String(v || 'N/A')}</span>
              },
              {
                key: 'amount',
                header: 'Fiscal Value',
                cell: (value, row: any) => (
                  <span className={cn(
                    "font-bold text-base",
                    row.type === 'CREDIT' ? "text-emerald-600 dark:text-emerald-500" : "text-rose-600 dark:text-rose-500"
                  )}>
                    {row.type === 'CREDIT' ? '+' : '-'}₹{(value as number).toLocaleString('en-IN')}
                  </span>
                ),
              },
              {
                key: 'used_by',
                header: 'Custodian',
                cell: (v) => <span className="text-xs font-medium text-slate-700 dark:text-slate-300 capitalize">{String(v)}</span>
              },
              {
                key: 'status',
                header: 'Auth Status',
                cell: (value) => (
                  <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-bold text-[10px] uppercase px-2 py-1 rounded-md">
                    {String(value)}
                  </Badge>
                ),
              },
            ]}
            data={recentTransactionsFromDB}
          />
        </CardContent>
      </Card>
    </div>
  )
}
