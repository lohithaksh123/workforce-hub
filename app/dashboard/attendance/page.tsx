'use client'

import { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useSession } from 'next-auth/react'
import { 
    Users, 
    UserMinus, 
    Clock, 
    CheckCircle2, 
    Timer, 
    TrendingUp,
    Loader2,
    Calendar
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckInOutButtons } from '@/components/dashboard/attendance/CheckInOutButtons'
import { AttendanceTable } from '@/components/dashboard/attendance/AttendanceTable'
import { LeaveRequestsSection } from '@/components/dashboard/attendance/LeaveRequestsSection'
import { HolidaySettingsSection } from '@/components/dashboard/attendance/HolidaySettingsSection'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

const formatDuration = (decimalHours: number) => {
    if (!decimalHours || decimalHours <= 0) return "0h 0m";
    const hours = Math.floor(decimalHours);
    const minutes = Math.round((decimalHours - hours) * 60);
    if (hours === 0) return `${minutes}m`;
    return `${hours}h ${minutes}m`;
};

export default function AttendancePage() {
    const { data: session } = useSession()
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
    const dbUser = useQuery(api.users.getUserFromEmail, session?.user?.email ? { email: session.user.email } : "skip")
    const stats = useQuery(api.attendance.getAttendanceStatsByDate, { 
        date: selectedDate,
        requestorEmail: session?.user?.email ?? undefined
    })
    const pendingLeavesCount = useQuery(api.leaves.getPendingLeaveRequests, {
        requestorEmail: session?.user?.email ?? ""
    })

    if (!dbUser || !stats) {
        return (
            <div className="flex h-[70vh] items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary opacity-50" />
            </div>
        )
    }

    const hasManageAttendance = dbUser.role === 'Owner' || 
                              (dbUser.permissions as any[])?.find(p => p.key === 'manage_attendance' || p.name === 'Manage Attendance')?.allowed

    const statCards = hasManageAttendance ? [
        {
            title: 'Staff Present',
            value: stats.present.toString(),
            sub: selectedDate === new Date().toISOString().split('T')[0] ? 'Today' : new Date(selectedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
            icon: <Users className="h-5 w-5" />,
            color: 'text-emerald-500',
            bg: 'bg-emerald-500/10'
        },
        {
            title: 'Absent',
            value: stats.absent.toString(),
            sub: selectedDate === new Date().toISOString().split('T')[0] ? 'Today' : new Date(selectedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
            icon: <UserMinus className="h-5 w-5" />,
            color: 'text-rose-500',
            bg: 'bg-rose-500/10'
        },
        {
            title: 'On Leave',
            value: (stats as any).leave?.toString() || "0",
            sub: selectedDate === new Date().toISOString().split('T')[0] ? 'Today' : new Date(selectedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
            icon: <Calendar className="h-5 w-5" />,
            color: 'text-sky-500',
            bg: 'bg-sky-500/10'
        },
        {
            title: 'Late Log-ins',
            value: stats.late.toString(),
            sub: selectedDate === new Date().toISOString().split('T')[0] ? 'Today' : new Date(selectedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
            icon: <Clock className="h-5 w-5" />,
            color: 'text-amber-500',
            bg: 'bg-amber-500/10'
        },
        {
            title: 'Pending Approvals',
            value: stats.pendingApprovals.toString(),
            sub: 'On this date',
            icon: <CheckCircle2 className="h-5 w-5" />,
            color: 'text-blue-500',
            bg: 'bg-blue-500/10'
        },
        {
            title: 'Hours Worked',
            value: `${stats.totalHours.toFixed(1)}h`,
            sub: 'Cumulative',
            icon: <Timer className="h-5 w-5" />,
            color: 'text-indigo-500',
            bg: 'bg-indigo-500/10'
        },
        {
            title: 'Overtime',
            value: `${stats.overtime.toFixed(1)}h`,
            sub: 'Above shift',
            icon: <TrendingUp className="h-5 w-5" />,
            color: 'text-violet-500',
            bg: 'bg-violet-500/10'
        }
    ] : [
        {
            title: 'Presence Status',
            value: stats.present > 0 ? 'Present' : ((stats as any).leave > 0 ? 'On Leave' : 'Not Logged'),
            sub: stats.present > 0 ? 'Active session' : ((stats as any).leave > 0 ? 'Approved leave' : 'Awaiting check-in'),
            icon: <Users className="h-5 w-5" />,
            color: stats.present > 0 ? 'text-emerald-500' : ((stats as any).leave > 0 ? 'text-sky-500' : 'text-slate-400'),
            bg: stats.present > 0 ? 'bg-emerald-500/10' : ((stats as any).leave > 0 ? 'bg-sky-500/10' : 'bg-slate-500/10')
        },
        {
            title: 'Late Entries',
            value: stats.late.toString(),
            sub: 'Total late logs',
            icon: <Clock className="h-5 w-5" />,
            color: 'text-amber-500',
            bg: 'bg-amber-500/10'
        },
        {
            title: 'Leaves Logged',
            value: ((stats as any).leave || 0).toString(),
            sub: 'Approved leaves',
            icon: <Calendar className="h-5 w-5" />,
            color: 'text-sky-500',
            bg: 'bg-sky-500/10'
        },
        {
            title: 'Logged Hours',
            value: formatDuration(stats.totalHours),
            sub: 'Shift duration',
            icon: <Timer className="h-5 w-5" />,
            color: 'text-indigo-500',
            bg: 'bg-indigo-500/10'
        },
        {
            title: 'Extra Hours',
            value: formatDuration(stats.overtime),
            sub: 'Post-shift work',
            icon: <TrendingUp className="h-5 w-5" />,
            color: 'text-violet-500',
            bg: 'bg-violet-500/10'
        }
    ]

    return (
        <div className="space-y-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 w-full min-w-0 pr-0 md:pr-10">
                <div className="text-center md:text-left">
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white uppercase tracking-tighter italic leading-tight">
                        {hasManageAttendance ? "Attendance Command Center" : "My Attendance Portal"}
                    </h1>
                    <p className="text-muted-foreground mt-1 font-medium italic text-xs sm:text-sm md:text-base mx-auto md:mx-0 max-w-lg">
                        {hasManageAttendance ? "Track, manage and analyze team availability" : "View your personal logs and manage your sessions"}
                    </p>
                </div>
            </div>

            <div className={cn(
                "grid gap-4",
                hasManageAttendance ? "grid-cols-2 md:grid-cols-4 lg:grid-cols-7" : "grid-cols-2 lg:grid-cols-5"
            )}>
                {statCards.map((card, i) => (
                    <Card key={i} className="border-none shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
                        <CardHeader className="p-4 pb-0 flex flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-500">{card.title}</CardTitle>
                            <div className={cn("p-2 rounded-lg", card.bg, card.color)}>
                                {card.icon}
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 pt-2">
                            <div className="text-2xl font-black tabular-nums">{card.value}</div>
                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mt-1">{card.sub}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="space-y-10">
                <CheckInOutButtons userId={dbUser._id} />
                
                <div className="pt-8 border-t border-slate-100 dark:border-slate-800/50">
                    <Tabs defaultValue="logs" className="w-full">
                        <TabsList className="grid p-1 rounded-2xl mb-8 bg-slate-100 dark:bg-slate-800 grid-cols-3 max-w-[600px]">
                            <TabsTrigger value="logs" className="rounded-xl font-bold py-2 text-xs uppercase tracking-widest">
                                Attendance Logs
                            </TabsTrigger>
                            <TabsTrigger value="leaves" className="rounded-xl font-bold py-2 text-xs uppercase tracking-widest flex items-center justify-center gap-2">
                                Leave Requests
                                {pendingLeavesCount !== undefined && pendingLeavesCount > 0 ? (
                                    <span className="bg-rose-500 text-white rounded-full text-[9px] font-black px-1.5 py-0.5 leading-none animate-pulse">
                                        {pendingLeavesCount}
                                    </span>
                                ) : null}
                            </TabsTrigger>
                            <TabsTrigger value="holidays" className="rounded-xl font-bold py-2 text-xs uppercase tracking-widest">
                                {hasManageAttendance ? "Holiday Settings" : "Holidays"}
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="logs" className="space-y-8 mt-0 outline-none">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="h-8 w-1.5 bg-primary rounded-full" />
                                <div className="flex flex-col">
                                    <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white uppercase tracking-tighter leading-none">
                                        {hasManageAttendance ? "Team Attendance Logs" : "My Attendance Logs"}
                                    </h2>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">
                                        {hasManageAttendance ? "Showing records for " : "Viewing your logs for "}
                                        <span className="text-primary">{new Date(selectedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                                    </p>
                                </div>
                            </div>
                            <AttendanceTable 
                                isAdmin={hasManageAttendance} 
                                currentUserId={dbUser._id} 
                                selectedDate={selectedDate}
                                onDateChange={setSelectedDate} 
                                requestorEmail={session?.user?.email ?? undefined}
                                requestorName={dbUser.name}
                            />
                        </TabsContent>

                        <TabsContent value="leaves" className="space-y-8 mt-0 outline-none">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="h-8 w-1.5 bg-primary rounded-full" />
                                <div className="flex flex-col">
                                    <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white uppercase tracking-tighter leading-none">
                                        {hasManageAttendance ? "Leave Management Center" : "My Leave Requests"}
                                    </h2>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">
                                        {hasManageAttendance ? "Review, approve, and track staff leaves" : "View leave history and apply for new leaves"}
                                    </p>
                                </div>
                            </div>
                            <LeaveRequestsSection 
                                isAdmin={hasManageAttendance}
                                currentUserId={dbUser._id}
                                requestorEmail={session?.user?.email ?? ''}
                                dbUser={dbUser}
                            />
                        </TabsContent>

                        <TabsContent value="holidays" className="space-y-8 mt-0 outline-none">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="h-8 w-1.5 bg-primary rounded-full" />
                                <div className="flex flex-col">
                                    <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white uppercase tracking-tighter leading-none">
                                        {hasManageAttendance ? "Holiday Control Center" : "Holidays"}
                                    </h2>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">
                                        {hasManageAttendance 
                                            ? "Configure weekly off days, custom holidays, and attendance overrides"
                                            : "View weekly off days and upcoming calendar holidays"
                                        }
                                    </p>
                                </div>
                            </div>
                            <HolidaySettingsSection 
                                requestorEmail={session?.user?.email ?? ""} 
                                isAdmin={hasManageAttendance} 
                            />
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    )
}
