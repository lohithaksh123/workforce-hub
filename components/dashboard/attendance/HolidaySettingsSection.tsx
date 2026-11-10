'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2, Calendar, Settings, AlertCircle, Building2, User, HelpCircle, Save } from 'lucide-react'

const DAYS_OF_WEEK = [
    { value: 'monday', label: 'Monday' },
    { value: 'tuesday', label: 'Tuesday' },
    { value: 'wednesday', label: 'Wednesday' },
    { value: 'thursday', label: 'Thursday' },
    { value: 'friday', label: 'Friday' },
    { value: 'saturday', label: 'Saturday' },
    { value: 'sunday', label: 'Sunday' }
]

const HOLIDAY_TYPES = [
    "Festival",
    "Company Holiday",
    "Government Holiday",
    "Custom"
]

export function HolidaySettingsSection({ requestorEmail, isAdmin = false }: { requestorEmail: string; isAdmin?: boolean }) {
    // Queries
    const settings = useQuery(api.attendance.getAttendanceSettings)
    const holidays = useQuery(api.attendance.getHolidays)
    const overrides = useQuery(api.attendance.getOverrides)
    const sites = useQuery(api.sites.getSites)
    const users = useQuery(api.users.getUsers)
    const roles = useQuery(api.roles.getRoles)

    // Mutations
    const updateSettings = useMutation(api.attendance.updateAttendanceSettings)
    const createHoliday = useMutation(api.attendance.createHoliday)
    const updateHoliday = useMutation(api.attendance.updateHoliday)
    const deleteHoliday = useMutation(api.attendance.deleteHoliday)
    const createOverride = useMutation(api.attendance.createOverride)
    const deleteOverride = useMutation(api.attendance.deleteOverride)

    // Loading states
    const [updatingSettings, setUpdatingSettings] = useState(false)
    const [addingHoliday, setAddingHoliday] = useState(false)
    const [addingOverride, setAddingOverride] = useState(false)

    // UI Dialog modals
    const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false)
    const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false)

    // Forms
    const [weeklyOffs, setWeeklyOffs] = useState<string[]>([])
    const [prevSettingsLoaded, setPrevSettingsLoaded] = useState(false)

    const [holidayForm, setHolidayForm] = useState({
        name: '',
        date: '',
        type: HOLIDAY_TYPES[0],
        appliesTo: 'all' as 'all' | 'site' | 'role',
        siteId: undefined as string | undefined,
        roleId: undefined as string | undefined,
        notes: ''
    })

    const [overrideForm, setOverrideForm] = useState({
        targetType: 'user' as 'user' | 'site',
        userId: undefined as string | undefined,
        siteId: undefined as string | undefined,
        date: '',
        overrideType: 'working_day' as 'working_day' | 'holiday',
        reason: ''
    })

    // Sync weekly off local state with DB
    if (settings && !prevSettingsLoaded) {
        setWeeklyOffs(settings.weeklyOffDays || [])
        setPrevSettingsLoaded(true)
    }

    const handleWeeklyOffToggle = (day: string, checked: boolean) => {
        if (checked) {
            setWeeklyOffs(prev => [...prev, day])
        } else {
            setWeeklyOffs(prev => prev.filter(d => d !== day))
        }
    }

    const handleSaveWeeklyOffs = async () => {
        try {
            setUpdatingSettings(true)
            await updateSettings({
                weeklyOffDays: weeklyOffs,
                requestorEmail
            })
            toast.success('Weekly holidays settings updated successfully')
        } catch (error: any) {
            toast.error(error.message || 'Failed to update weekly off settings')
        } finally {
            setUpdatingSettings(false)
        }
    }

    const handleAddHolidaySubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!holidayForm.name || !holidayForm.date) {
            toast.error('Holiday name and date are required.')
            return
        }

        try {
            setAddingHoliday(true)
            await createHoliday({
                name: holidayForm.name,
                date: holidayForm.date,
                type: holidayForm.type,
                appliesTo: holidayForm.appliesTo,
                siteId: holidayForm.appliesTo === 'site' ? (holidayForm.siteId as any) : undefined,
                roleId: holidayForm.appliesTo === 'role' ? holidayForm.roleId : undefined,
                notes: holidayForm.notes || undefined,
                requestorEmail
            })
            toast.success('Custom holiday added successfully')
            setIsHolidayModalOpen(false)
            setHolidayForm({
                name: '',
                date: '',
                type: HOLIDAY_TYPES[0],
                appliesTo: 'all',
                siteId: undefined,
                roleId: undefined,
                notes: ''
            })
        } catch (error: any) {
            toast.error(error.message || 'Failed to add custom holiday')
        } finally {
            setAddingHoliday(false)
        }
    }

    const handleToggleHolidayActive = async (holiday: any) => {
        try {
            await updateHoliday({
                id: holiday._id,
                name: holiday.name,
                date: holiday.date,
                type: holiday.type,
                appliesTo: holiday.appliesTo,
                siteId: holiday.siteId,
                roleId: holiday.roleId,
                notes: holiday.notes,
                isActive: !holiday.isActive,
                requestorEmail
            })
            toast.success(`Holiday status toggled successfully`)
        } catch (error: any) {
            toast.error(error.message || 'Failed to toggle status')
        }
    }

    const handleDeleteHoliday = async (id: string) => {
        if (!confirm('Are you sure you want to delete this custom holiday?')) return
        try {
            await deleteHoliday({ id: id as any, requestorEmail })
            toast.success('Custom holiday deleted')
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete custom holiday')
        }
    }

    const handleAddOverrideSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!overrideForm.date || !overrideForm.reason) {
            toast.error('Date and reason are required.')
            return
        }

        if (overrideForm.targetType === 'user' && !overrideForm.userId) {
            toast.error('Please select an employee.')
            return
        }

        if (overrideForm.targetType === 'site' && !overrideForm.siteId) {
            toast.error('Please select a site.')
            return
        }

        try {
            setAddingOverride(true)
            await createOverride({
                userId: overrideForm.targetType === 'user' ? (overrideForm.userId as any) : undefined,
                siteId: overrideForm.targetType === 'site' ? (overrideForm.siteId as any) : undefined,
                date: overrideForm.date,
                overrideType: overrideForm.overrideType,
                reason: overrideForm.reason,
                requestorEmail
            })
            toast.success('Holiday override added successfully')
            setIsOverrideModalOpen(false)
            setOverrideForm({
                targetType: 'user',
                userId: undefined,
                siteId: undefined,
                date: '',
                overrideType: 'working_day',
                reason: ''
            })
        } catch (error: any) {
            toast.error(error.message || 'Failed to add override')
        } finally {
            setAddingOverride(false)
        }
    }

    const handleDeleteOverride = async (id: string) => {
        if (!confirm('Are you sure you want to delete this holiday override?')) return
        try {
            await deleteOverride({ id: id as any, requestorEmail })
            toast.success('Override removed successfully')
        } catch (error: any) {
            toast.error(error.message || 'Failed to remove override')
        }
    }

    const activeUsers = users?.filter(u => u.status === 'active' && u.role !== 'Owner') || []

    return (
        <div className="space-y-8 pb-10">
            {/* 1. WEEKLY HOLIDAYS SETTINGS */}
            <Card className="border-none shadow-sm bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
                <CardHeader className="p-6 border-b border-slate-50 dark:border-slate-800/50">
                    <CardTitle className="text-base font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Settings className="h-4 w-4 text-primary" /> Weekly Off Configuration
                    </CardTitle>
                    <CardDescription className="text-xs italic text-slate-400 font-medium mt-1">
                        Select days of the week when your office/sites are closed by default. Normal staff will not be marked absent on these days.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                    {settings === undefined ? (
                        <div className="flex justify-center p-6"><Loader2 className="h-6 w-6 animate-spin text-primary opacity-50" /></div>
                    ) : (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-4">
                                {DAYS_OF_WEEK.map(day => {
                                    const isChecked = weeklyOffs.includes(day.value)
                                    return (
                                        <div 
                                            key={day.value}
                                            onClick={() => isAdmin && handleWeeklyOffToggle(day.value, !isChecked)}
                                            className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all select-none ${
                                                isAdmin ? 'cursor-pointer' : 'cursor-default'
                                            } ${
                                                isChecked 
                                                    ? 'border-primary/20 bg-primary/5 dark:bg-primary/10 text-primary' 
                                                    : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30'
                                            }`}
                                        >
                                            <Checkbox 
                                                id={`weeklyOff-${day.value}`}
                                                checked={isChecked}
                                                onCheckedChange={(c) => isAdmin && handleWeeklyOffToggle(day.value, !!c)}
                                                disabled={!isAdmin}
                                                className="mb-3 data-[state=checked]:bg-primary"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                            <Label 
                                                htmlFor={`weeklyOff-${day.value}`}
                                                className="text-xs font-black uppercase tracking-wider text-center cursor-pointer"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {day.label}
                                            </Label>
                                        </div>
                                    )
                                })}
                            </div>

                            {isAdmin && (
                                <div className="flex justify-end pt-2 border-t border-slate-50 dark:border-slate-800/50">
                                    <Button
                                        onClick={handleSaveWeeklyOffs}
                                        disabled={updatingSettings}
                                        className="h-12 px-6 font-bold bg-primary hover:bg-primary/95 text-white gap-2 shadow-sm"
                                    >
                                        {updatingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                        Save Weekly Off Days
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* 2. CUSTOM HOLIDAYS */}
            <Card className="border-none shadow-sm bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
                <CardHeader className="p-6 border-b border-slate-50 dark:border-slate-800/50 flex flex-row items-center justify-between space-y-0">
                    <div>
                        <CardTitle className="text-base font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-primary" /> Custom & Gazetted Holidays
                        </CardTitle>
                        <CardDescription className="text-xs italic text-slate-400 font-medium mt-1">
                            Add festival dates, company annual days, and national holidays.
                        </CardDescription>
                    </div>
                    {isAdmin && (
                        <Button
                            onClick={() => setIsHolidayModalOpen(true)}
                            className="h-10 px-4 font-bold bg-primary hover:bg-primary/95 text-white gap-2 shadow-sm rounded-xl"
                        >
                            <Plus className="h-4 w-4" /> Add Holiday
                        </Button>
                    )}
                </CardHeader>
                <CardContent className="p-0">
                    {holidays === undefined ? (
                        <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" /></div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50">
                                                                   <TableRow>
                                        <TableHead className="font-black text-[10px] uppercase tracking-widest px-6 h-12">Holiday Name</TableHead>
                                        <TableHead className="font-black text-[10px] uppercase tracking-widest h-12">Date</TableHead>
                                        <TableHead className="font-black text-[10px] uppercase tracking-widest h-12">Type</TableHead>
                                        <TableHead className="font-black text-[10px] uppercase tracking-widest h-12">Applies To</TableHead>
                                        <TableHead className="font-black text-[10px] uppercase tracking-widest h-12">Status</TableHead>
                                        {isAdmin && <TableHead className="font-black text-[10px] uppercase tracking-widest h-12 text-right px-6">Actions</TableHead>}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {holidays.map(h => {
                                        let targetText = "All Employees"
                                        if (h.appliesTo === 'site' && h.siteId) {
                                            targetText = `Site: ${sites?.find(s => s._id === h.siteId)?.name || 'Unknown Site'}`
                                        } else if (h.appliesTo === 'role' && h.roleId) {
                                            targetText = `Role: ${h.roleId}`
                                        }

                                        return (
                                            <TableRow key={h._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors border-slate-100 dark:border-slate-800/50">
                                                <TableCell className="px-6 py-4 font-bold text-slate-900 dark:text-slate-100">{h.name}</TableCell>
                                                <TableCell className="font-medium tabular-nums">{h.date}</TableCell>
                                                <TableCell>
                                                    <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 px-2 py-0.5 font-bold text-[10px] uppercase">{h.type}</Badge>
                                                </TableCell>
                                                <TableCell className="font-medium text-slate-600 dark:text-slate-400">{targetText}</TableCell>
                                                <TableCell>
                                                    {isAdmin ? (
                                                        <Button 
                                                            variant="ghost" 
                                                            size="sm"
                                                            onClick={() => handleToggleHolidayActive(h)}
                                                            className={`h-7 px-2.5 font-bold text-[9px] uppercase tracking-widest rounded-lg border ${
                                                                h.isActive 
                                                                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400' 
                                                                    : 'border-slate-200 bg-slate-100 text-slate-500 dark:bg-slate-800 dark:border-slate-700'
                                                            }`}
                                                        >
                                                            {h.isActive ? 'Active' : 'Inactive'}
                                                        </Button>
                                                    ) : (
                                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                                                            h.isActive 
                                                                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                                                                : 'border-slate-200 bg-slate-100 text-slate-500 dark:bg-slate-800 dark:border-slate-700'
                                                        }`}>
                                                            {h.isActive ? 'Active' : 'Inactive'}
                                                        </span>
                                                    )}
                                                </TableCell>
                                                {isAdmin && (
                                                    <TableCell className="text-right px-6">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleDeleteHoliday(h._id)}
                                                            className="h-8 w-8 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-full"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        )
                                    })}
                                    {holidays.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={isAdmin ? 6 : 5} className="h-32 text-center">
                                                <div className="flex flex-col items-center justify-center opacity-40 py-6">
                                                    <Calendar className="h-8 w-8 text-muted-foreground mb-2" />
                                                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">No custom holidays added yet</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* 3. ATTENDANCE OVERRIDES */}
            {isAdmin && (
                <Card className="border-none shadow-sm bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
                    <CardHeader className="p-6 border-b border-slate-50 dark:border-slate-800/50 flex flex-row items-center justify-between space-y-0">
                        <div>
                            <CardTitle className="text-base font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <AlertCircle className="h-4 w-4 text-primary" /> Special Working Days & Overrides
                            </CardTitle>
                            <CardDescription className="text-xs italic text-slate-400 font-medium mt-1">
                                Override default rules (e.g. declare a normally off Sunday as a "working day" for a site or staff member, or assign special holidays).
                            </CardDescription>
                        </div>
                        <Button
                            onClick={() => setIsOverrideModalOpen(true)}
                            className="h-10 px-4 font-bold bg-primary hover:bg-primary/95 text-white gap-2 shadow-sm rounded-xl"
                        >
                            <Plus className="h-4 w-4" /> Add Override
                        </Button>
                    </CardHeader>
                <CardContent className="p-0">
                    {overrides === undefined ? (
                        <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" /></div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50">
                                    <TableRow>
                                        <TableHead className="font-black text-[10px] uppercase tracking-widest px-6 h-12">Target (Employee / Site)</TableHead>
                                        <TableHead className="font-black text-[10px] uppercase tracking-widest h-12">Date</TableHead>
                                        <TableHead className="font-black text-[10px] uppercase tracking-widest h-12">Override Type</TableHead>
                                        <TableHead className="font-black text-[10px] uppercase tracking-widest h-12">Reason</TableHead>
                                        <TableHead className="font-black text-[10px] uppercase tracking-widest h-12">Created By</TableHead>
                                        <TableHead className="font-black text-[10px] uppercase tracking-widest h-12 text-right px-6">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {overrides.map(o => (
                                        <TableRow key={o._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors border-slate-100 dark:border-slate-800/50">
                                            <TableCell className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    {o.userId ? (
                                                        <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-muted-foreground" /> {o.userName}</span>
                                                    ) : (
                                                        <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-muted-foreground" /> Site: {o.siteName}</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-medium tabular-nums">{o.date}</TableCell>
                                            <TableCell>
                                                {o.overrideType === 'working_day' ? (
                                                    <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-2 py-0.5 font-bold text-[10px] uppercase">Working Day</Badge>
                                                ) : (
                                                    <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 px-2 py-0.5 font-bold text-[10px] uppercase">Special Holiday</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="font-medium text-slate-500 dark:text-slate-400 max-w-[200px] truncate">{o.reason}</TableCell>
                                            <TableCell className="font-medium text-slate-500 dark:text-slate-400">{o.createdBy}</TableCell>
                                            <TableCell className="text-right px-6">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDeleteOverride(o._id)}
                                                    className="h-8 w-8 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-full"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {overrides.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-32 text-center">
                                                <div className="flex flex-col items-center justify-center opacity-40 py-6">
                                                    <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
                                                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">No active overrides configured</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
            )}

            {/* ADD CUSTOM HOLIDAY DIALOG */}
            <Dialog open={isHolidayModalOpen} onOpenChange={setIsHolidayModalOpen}>
                <DialogContent className="max-w-md bg-white dark:bg-slate-900 border-none shadow-2xl rounded-3xl p-0">
                    <DialogHeader className="p-6 pb-0">
                        <DialogTitle className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-primary" /> Add Custom Holiday
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground italic font-medium mt-1">
                            Set up festival dates, office closures, or local calendar exemptions.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleAddHolidaySubmit} className="p-6 space-y-5">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Holiday Name</Label>
                            <Input 
                                required
                                value={holidayForm.name}
                                onChange={e => setHolidayForm({...holidayForm, name: e.target.value})}
                                placeholder="e.g. Diwali, Independence Day"
                                className="h-11 bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-bold"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Date</Label>
                                <Input 
                                    type="date"
                                    required
                                    value={holidayForm.date}
                                    onChange={e => setHolidayForm({...holidayForm, date: e.target.value})}
                                    className="h-11 bg-slate-50 dark:bg-slate-800 border-none rounded-xl"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Type</Label>
                                <Select 
                                    value={holidayForm.type} 
                                    onValueChange={v => setHolidayForm({...holidayForm, type: v})}
                                >
                                    <SelectTrigger className="h-11 bg-slate-50 dark:bg-slate-800 border-none font-bold">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {HOLIDAY_TYPES.map(t => (
                                            <SelectItem key={t} value={t}>{t}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Applies To</Label>
                            <Select 
                                value={holidayForm.appliesTo} 
                                onValueChange={(v: any) => setHolidayForm({...holidayForm, appliesTo: v, siteId: undefined, roleId: undefined})}
                            >
                                <SelectTrigger className="h-11 bg-slate-50 dark:bg-slate-800 border-none font-bold">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">🌍 All Employees</SelectItem>
                                    <SelectItem value="site">📍 Specific Site / Project</SelectItem>
                                    <SelectItem value="role">💼 Specific Role</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {holidayForm.appliesTo === 'site' && (
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Select Site</Label>
                                <Select 
                                    value={holidayForm.siteId} 
                                    onValueChange={v => setHolidayForm({...holidayForm, siteId: v})}
                                >
                                    <SelectTrigger className="h-11 bg-slate-50 dark:bg-slate-800 border-none font-bold">
                                        <SelectValue placeholder="Choose site" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {sites?.map(s => (
                                            <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {holidayForm.appliesTo === 'role' && (
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Select Role</Label>
                                <Select 
                                    value={holidayForm.roleId} 
                                    onValueChange={v => setHolidayForm({...holidayForm, roleId: v})}
                                >
                                    <SelectTrigger className="h-11 bg-slate-50 dark:bg-slate-800 border-none font-bold">
                                        <SelectValue placeholder="Choose role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {roles?.map(r => (
                                            <SelectItem key={r._id} value={r.name}>{r.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Notes (Optional)</Label>
                            <Textarea 
                                value={holidayForm.notes}
                                onChange={e => setHolidayForm({...holidayForm, notes: e.target.value})}
                                placeholder="Remarks, notification notes..."
                                className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl min-h-[70px] p-3 text-xs"
                            />
                        </div>

                        <DialogFooter className="pt-3 border-t border-slate-50 dark:border-slate-800/50">
                            <Button 
                                type="button" 
                                variant="ghost" 
                                onClick={() => setIsHolidayModalOpen(false)}
                                className="h-11 font-bold text-slate-500"
                            >
                                Cancel
                            </Button>
                            <Button 
                                type="submit" 
                                disabled={addingHoliday}
                                className="h-11 px-5 bg-primary text-white font-bold gap-2 rounded-xl"
                            >
                                {addingHoliday && <Loader2 className="h-4 w-4 animate-spin" />}
                                Add Holiday
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ADD OVERRIDE DIALOG */}
            <Dialog open={isOverrideModalOpen} onOpenChange={setIsOverrideModalOpen}>
                <DialogContent className="max-w-md bg-white dark:bg-slate-900 border-none shadow-2xl rounded-3xl p-0">
                    <DialogHeader className="p-6 pb-0">
                        <DialogTitle className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-primary" /> Add Holiday Override
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground italic font-medium mt-1">
                            Override default holiday rules for a specific employee or site on a particular date.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleAddOverrideSubmit} className="p-6 space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Override Date</Label>
                                <Input 
                                    type="date"
                                    required
                                    value={overrideForm.date}
                                    onChange={e => setOverrideForm({...overrideForm, date: e.target.value})}
                                    className="h-11 bg-slate-50 dark:bg-slate-800 border-none rounded-xl"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Override Type</Label>
                                <Select 
                                    value={overrideForm.overrideType} 
                                    onValueChange={(v: any) => setOverrideForm({...overrideForm, overrideType: v})}
                                >
                                    <SelectTrigger className="h-11 bg-slate-50 dark:bg-slate-800 border-none font-bold">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="working_day">💼 Working Day (Mark Working)</SelectItem>
                                        <SelectItem value="holiday">🎉 Special Holiday (Mark Off)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Override Target</Label>
                            <Select 
                                value={overrideForm.targetType} 
                                onValueChange={(v: any) => setOverrideForm({...overrideForm, targetType: v, userId: undefined, siteId: undefined})}
                            >
                                <SelectTrigger className="h-11 bg-slate-50 dark:bg-slate-800 border-none font-bold">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="user">👤 Specific Employee</SelectItem>
                                    <SelectItem value="site">📍 Entire Site / Project Team</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {overrideForm.targetType === 'user' && (
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Select Employee</Label>
                                <Select 
                                    value={overrideForm.userId} 
                                    onValueChange={v => setOverrideForm({...overrideForm, userId: v})}
                                >
                                    <SelectTrigger className="h-11 bg-slate-50 dark:bg-slate-800 border-none font-bold">
                                        <SelectValue placeholder="Choose employee" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {activeUsers.map(u => (
                                            <SelectItem key={u._id} value={u._id}>{u.name} ({u.role})</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {overrideForm.targetType === 'site' && (
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Select Site</Label>
                                <Select 
                                    value={overrideForm.siteId} 
                                    onValueChange={v => setOverrideForm({...overrideForm, siteId: v})}
                                >
                                    <SelectTrigger className="h-11 bg-slate-50 dark:bg-slate-800 border-none font-bold">
                                        <SelectValue placeholder="Choose site" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {sites?.map(s => (
                                            <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Reason / Comments</Label>
                            <Textarea 
                                required
                                value={overrideForm.reason}
                                onChange={e => setOverrideForm({...overrideForm, reason: e.target.value})}
                                placeholder="Explain why this override is requested (e.g. Sunday concrete pouring, emergency works)..."
                                className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl min-h-[70px] p-3 text-xs"
                            />
                        </div>

                        <DialogFooter className="pt-3 border-t border-slate-50 dark:border-slate-800/50">
                            <Button 
                                type="button" 
                                variant="ghost" 
                                onClick={() => setIsOverrideModalOpen(false)}
                                className="h-11 font-bold text-slate-500"
                            >
                                Cancel
                            </Button>
                            <Button 
                                type="submit" 
                                disabled={addingOverride}
                                className="h-11 px-5 bg-primary text-white font-bold gap-2 rounded-xl"
                            >
                                {addingOverride && <Loader2 className="h-4 w-4 animate-spin" />}
                                Add Override
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
