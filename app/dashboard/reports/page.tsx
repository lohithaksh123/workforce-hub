'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts'
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Loader2, TrendingUp, TrendingDown, Wallet, CheckCircle2, Clock } from 'lucide-react'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { useContext } from 'react'
import { UserContext } from '@/components/dashboard/UserContext'
import AccessDeniedBoard from '@/components/dashboard/AccessDeniedBoard'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useState } from 'react'

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#475569']

const chartConfig = {
  revenue: {
    label: "Income",
    color: "#10b981",
  },
  spent: {
    label: "Expense",
    color: "#f59e0b",
  },
  amount: {
    label: "Amount",
    color: "#3b82f6",
  },
  value: {
    label: "Value",
    color: "#3b82f6",
  }
}

export default function ReportsPage() {
  const { user } = useContext(UserContext)
  const [selectedSiteId, setSelectedSiteId] = useState<string>("ALL")
  const sites = useQuery(api.sites.getSites)

  const hasPermission = (key: string) => {
    if (user?.role === 'Owner') return true;
    if (!user || !Array.isArray(user.permissions)) return false
    return user.permissions.find((p: any) => p.key === key || p.name === key)?.allowed || false
  }

  const reportsData = useQuery(api.central_wallet.getReportsData, { 
    siteId: selectedSiteId === "ALL" ? undefined : selectedSiteId as any 
  })

  if (user && !hasPermission('view_reports')) {
    return <AccessDeniedBoard />
  }

  if (!reportsData) {
    return <div className="flex h-96 items-center justify-center text-muted-foreground"><Loader2 className="animate-spin h-8 w-8 mr-2" /> Generating reports...</div>
  }

  const { monthly, vendors, requesters } = reportsData
  const totalRevenue = monthly.reduce((sum: number, m: any) => sum + m.revenue, 0)
  const totalSpent = monthly.reduce((sum: number, m: any) => sum + m.spent, 0)
  const netProfit = totalRevenue - totalSpent

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 w-full min-w-0 pr-0 md:pr-10">
        <div className="text-center md:text-left">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white uppercase italic tracking-tighter leading-tight">Financial Reports</h1>
            <p className="text-muted-foreground mt-1 font-medium italic text-xs sm:text-sm md:text-base mx-auto md:mx-0 max-w-lg">Project-wise and company-wide analytics</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 w-full sm:w-auto">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Filter By Site</span>
            <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                <SelectTrigger className="w-full sm:w-[240px] h-10 border-none bg-slate-50 dark:bg-slate-800 font-bold rounded-xl">
                    <SelectValue placeholder="All Sites" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-2xl">
                    <SelectItem value="ALL">All Sites (Company Wide)</SelectItem>
                    {sites?.map((s: any) => (
                        <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="bg-emerald-500/5 border-emerald-500/10 rounded-2xl border-none shadow-sm overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.07] transition-all">
            <TrendingUp className="h-16 w-16" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-2">
              <TrendingUp className="h-3 w-3" /> Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-black text-emerald-600 tabular-nums">₹{totalRevenue.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/5 border-amber-500/10 rounded-2xl border-none shadow-sm overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.07] transition-all">
            <TrendingDown className="h-16 w-16" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-amber-600 flex items-center gap-2">
              <TrendingDown className="h-3 w-3" /> Total Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-black text-amber-600 tabular-nums">₹{totalSpent.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/5 border-blue-500/10 rounded-2xl border-none shadow-sm overflow-hidden relative group sm:col-span-2 lg:col-span-1">
          <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.07] transition-all">
            <Wallet className="h-16 w-16" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-blue-600 flex items-center gap-2">
              <Wallet className="h-3 w-3" /> Net Surplus
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl sm:text-3xl font-black tabular-nums ${netProfit >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>₹{netProfit.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-3xl border-none shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
        <CardHeader className="p-6 pb-0">
          <CardTitle className="text-xl font-black text-slate-900 dark:text-white uppercase italic tracking-tighter">Cash Flow Trend</CardTitle>
          <CardDescription className="text-xs font-medium italic">Monthly revenue vs spending</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <ChartContainer config={chartConfig} className="h-[250px] sm:h-[350px] w-full">
            <BarChart data={monthly}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.1} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v >= 1000 ? v/1000 + 'k' : v}`} />
              <ChartTooltip content={<ChartTooltipContent formatter={(value) => `₹${Number(value).toLocaleString()}`} />} />
              <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
              <Bar dataKey="revenue" fill="var(--color-revenue)" name="Income" radius={[4, 4, 0, 0]} barSize={30} />
              <Bar dataKey="spent" fill="var(--color-spent)" name="Expense" radius={[4, 4, 0, 0]} barSize={30} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <Card className="rounded-3xl border-none shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
          <CardHeader className="p-6 pb-0">
            <CardTitle className="text-xl font-black text-slate-900 dark:text-white uppercase italic tracking-tighter">Expense by Vendor</CardTitle>
            <CardDescription className="text-xs font-medium italic">Distribution of spending across vendors</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {vendors.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[250px] sm:h-[300px] w-full">
                <PieChart>
                  <Pie
                    data={vendors}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {vendors.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent formatter={(value) => `₹${Number(value).toLocaleString()}`} />} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                </PieChart>
              </ChartContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground font-medium italic text-sm">No vendor data available</div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-none shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
          <CardHeader className="p-6 pb-0">
            <CardTitle className="text-xl font-black text-slate-900 dark:text-white uppercase italic tracking-tighter">Expense by Staff</CardTitle>
            <CardDescription className="text-xs font-medium italic">Spending volume by requester</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {requesters.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[250px] sm:h-[300px] w-full">
                <BarChart data={requesters} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.1} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="employee" type="category" width={80} tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(value) => `₹${Number(value).toLocaleString()}`} />} />
                  <Bar dataKey="amount" fill="var(--color-amount)" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground font-medium italic text-sm">No staff spending data</div>
            )}
          </CardContent>
        </Card>      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <Card className="rounded-3xl border-none shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
          <CardHeader className="p-6 pb-0">
            <CardTitle className="text-xl font-black text-slate-900 dark:text-white uppercase italic tracking-tighter">Attendance Trend</CardTitle>
            <CardDescription className="text-xs font-medium italic">Monthly staff presence and late arrivals</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {reportsData.attendance?.monthly.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[250px] sm:h-[300px] w-full">
                <BarChart data={reportsData.attendance.monthly}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                  <Bar dataKey="present" fill="#10b981" name="Present" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey="late" fill="#f59e0b" name="Late" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey="leave" fill="#3b82f6" name="Leave" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground font-medium italic text-sm">No attendance data available</div>
            )}
          </CardContent>
        </Card>
 
        <Card className="rounded-3xl border-none shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
          <CardHeader className="p-6 pb-0">
            <CardTitle className="text-xl font-black text-slate-900 dark:text-white uppercase italic tracking-tighter">Attendance Metrics</CardTitle>
            <CardDescription className="text-xs font-medium italic">Key performance indicators</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-1 gap-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl group hover:bg-emerald-500/5 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-black text-[10px] uppercase tracking-widest text-slate-400">Total Present</span>
                    <span className="font-bold text-sm">Days Logged</span>
                  </div>
                </div>
                <span className="text-2xl font-black tabular-nums">{reportsData.attendance?.totalPresent || 0}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl group hover:bg-amber-500/5 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-black text-[10px] uppercase tracking-widest text-slate-400">Late Arrivals</span>
                    <span className="font-bold text-sm">Time Exceptions</span>
                  </div>
                </div>
                <span className="text-2xl font-black tabular-nums">{reportsData.attendance?.totalLate || 0}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl group hover:bg-sky-500/5 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-900/30 text-sky-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-black text-[10px] uppercase tracking-widest text-slate-400">Leaves Logged</span>
                    <span className="font-bold text-sm">Approved Absence</span>
                  </div>
                </div>
                <span className="text-2xl font-black tabular-nums">{reportsData.attendance?.totalLeave || 0}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl group hover:bg-violet-500/5 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 text-violet-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-black text-[10px] uppercase tracking-widest text-slate-400">Overtime</span>
                    <span className="font-bold text-sm">Extra Effort</span>
                  </div>
                </div>
                <span className="text-2xl font-black tabular-nums">{reportsData.attendance?.totalOvertime?.toFixed(1) || 0}h</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  )
}
