'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle,
    DialogFooter,
    DialogDescription
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Clock, Calendar, User, Building2, Save, Loader2, Camera, Image as ImageIcon, X, Upload } from 'lucide-react'
import { Id } from '@/convex/_generated/dataModel'

const formatDuration = (decimalHours: number) => {
    if (!decimalHours || decimalHours <= 0) return "0h 0m";
    const hours = Math.floor(decimalHours);
    const minutes = Math.round((decimalHours - hours) * 60);
    if (hours === 0) return `${minutes}m`;
    return `${hours}h ${minutes}m`;
};

export function AttendanceModal({ 
    isOpen, 
    onClose, 
    record, 
    isAdmin,
    requestorEmail
}: { 
    isOpen: boolean, 
    onClose: () => void, 
    record: any, 
    isAdmin: boolean,
    requestorEmail?: string
}) {
    const updateRecord = useMutation(api.attendance.updateAttendanceByAdmin)
    const sites = useQuery(api.sites.getSites)
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        status: record?.status || 'Present',
        approvalStatus: record?.approvalStatus || 'Auto',
        notes: record?.notes || '',
        checkIn: record?.checkIn || null,
        checkOut: record?.checkOut || null,
        totalHours: record?.totalHours || 0,
        siteId: record?.siteId || undefined,
        siteName: record?.siteName || 'Office (Main Branch)',
        photoStorageId: record?.photoStorageId || undefined,
    })
    
    const [locationValue, setLocationValue] = useState(
        record?.siteId ? record.siteId : 
        (record?.siteName === 'Work from Home' ? 'wfh' : 'office')
    )

    const isVirtual = record?._id && typeof record._id === 'string' && (record._id.startsWith('absent_') || record._id.startsWith('holiday_'));
    const photoUrl = useQuery(api.attendance.getAttendancePhotoUrl, 
        (record?._id && !isVirtual) ? {
            attendanceId: record._id,
            requestorEmail: requestorEmail!
        } : "skip"
    )
    const generateUploadUrl = useMutation(api.attendance.generateUploadUrl)
    const [uploadingPhoto, setUploadingPhoto] = useState(false)

    // Convert timestamp to HH:mm string for input
    const formatTimeForInput = (timestamp: number | null) => {
        if (!timestamp) return "";
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    };

    const [checkInTime, setCheckInTime] = useState(formatTimeForInput(record?.checkIn));
    const [checkOutTime, setCheckOutTime] = useState(formatTimeForInput(record?.checkOut));

    useEffect(() => {
        if (record) {
            setFormData({
                status: record.status,
                approvalStatus: record.approvalStatus,
                notes: record.notes || '',
                checkIn: record.checkIn || null,
                checkOut: record.checkOut || null,
                totalHours: record.totalHours || 0,
                siteId: record.siteId || undefined,
                siteName: record.siteName || 'Office (Main Branch)',
                photoStorageId: record.photoStorageId || undefined,
            })
            setLocationValue(record.siteId ? record.siteId : (record.siteName === 'Work from Home' ? 'wfh' : 'office'));
            setCheckInTime(formatTimeForInput(record.checkIn));
            setCheckOutTime(formatTimeForInput(record.checkOut));
        }
    }, [record])

    // Helper to merge date string and time string into a timestamp
    const getTimeStamp = (dateStr: string, timeStr: string) => {
        if (!timeStr) return null;
        // Ensure format is YYYY-MM-DDTHH:mm
        return new Date(`${dateStr}T${timeStr}:00`).getTime();
    };

    // Auto-calculate hours and status when time changes
    useEffect(() => {
        if (!record?.date) return;
        const newCheckIn = getTimeStamp(record.date, checkInTime);
        const newCheckOut = getTimeStamp(record.date, checkOutTime);
        
        let newHours = 0;
        let newStatus = formData.status;

        if (newCheckIn && newCheckOut) {
            if (newCheckOut < newCheckIn) {
                newHours = 0;
            } else {
                newHours = (newCheckOut - newCheckIn) / (1000 * 60 * 60);
            }
        }

        // Simple status auto-suggestion
        if (newCheckIn) {
            if (newHours > 0) {
                if (newHours < 4) newStatus = "Half-day";
                else newStatus = "Present";
            } else {
                newStatus = "Present";
            }
        }

        setFormData(prev => ({
            ...prev,
            checkIn: newCheckIn,
            checkOut: newCheckOut,
            totalHours: newHours,
            status: newStatus,
            // Automatically set approval to Manual if times are touched
            approvalStatus: (checkInTime !== formatTimeForInput(record.checkIn) || checkOutTime !== formatTimeForInput(record.checkOut)) ? "Manual" : prev.approvalStatus
        }));
    }, [checkInTime, checkOutTime, record?.date]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        
        if (formData.checkIn && formData.checkOut && formData.checkOut < formData.checkIn) {
            toast.error("Check-out time cannot be earlier than check-in time.");
            return;
        }

        try {
            setLoading(true)
            await updateRecord({
                id: record._id,
                employeeId: record.employeeId,
                date: record.date,
                status: formData.status as any,
                approvalStatus: formData.approvalStatus as any,
                notes: formData.notes,
                checkIn: formData.checkIn || undefined,
                checkOut: formData.checkOut || undefined,
                siteId: locationValue as any,
                siteName: locationValue === 'wfh' ? 'Work from Home' : (locationValue === 'office' ? 'Office (Main Branch)' : sites?.find(s => s._id === locationValue)?.name),
                photoStorageId: formData.photoStorageId as Id<"_storage"> | undefined,
                requestorEmail: requestorEmail!
            })
            toast.success('Attendance record updated successfully')
            onClose()
        } catch (error) {
            toast.error('Failed to update attendance record')
        } finally {
            setLoading(false)
        }
    }

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !record) return

        try {
            setUploadingPhoto(true)
            const postUrl = await generateUploadUrl()
            const result = await fetch(postUrl, {
                method: "POST",
                headers: { "Content-Type": file.type },
                body: file,
            })
            const { storageId } = await result.json()
            setFormData(prev => ({ ...prev, photoStorageId: storageId }))
            toast.success('Photo uploaded! Click update to save.')
        } catch (error) {
            toast.error('Failed to upload photo')
        } finally {
            setUploadingPhoto(false)
        }
    }

    if (!record) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl bg-white dark:bg-slate-900 border-none shadow-2xl rounded-3xl p-0 max-h-[90vh] overflow-y-auto">
                <DialogHeader className="p-8 pb-0">
                    <DialogTitle className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                            <Clock className="h-5 w-5" />
                        </div>
                        Attendance Detail
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground mt-1 font-medium italic">
                        View and manage precise attendance timestamps and site verification data.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="p-8 space-y-8">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                <User className="h-3 w-3" /> Staff Name
                            </Label>
                            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl font-bold text-slate-700 dark:text-slate-300">
                                {record.employeeName}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                <Calendar className="h-3 w-3" /> Date
                            </Label>
                            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl font-bold text-slate-700 dark:text-slate-300">
                                {record.date}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                <Clock className="h-3 w-3" /> Log In Time
                            </Label>
                            <Input 
                                type="time"
                                disabled={!isAdmin && record.employeeId !== record.currentUserId} // Allow self-edit if desired, but we check isAdmin here
                                value={checkInTime}
                                onChange={(e) => setCheckInTime(e.target.value)}
                                className="h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-bold px-4"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                <Clock className="h-3 w-3" /> Log Out Time
                            </Label>
                            <Input 
                                type="time"
                                disabled={!isAdmin && record.employeeId !== record.currentUserId}
                                value={checkOutTime}
                                onChange={(e) => setCheckOutTime(e.target.value)}
                                className="h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-bold px-4"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                <Building2 className="h-3 w-3" /> Site / Branch
                            </Label>
                            {isAdmin ? (
                                <Select 
                                    value={locationValue} 
                                    onValueChange={(v) => {
                                        setLocationValue(v);
                                        if (v === 'wfh') {
                                            setFormData(prev => ({...prev, status: 'WFH'}));
                                        }
                                    }}
                                >
                                    <SelectTrigger className="h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-bold">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                                        <SelectItem value="office">🏢 Office (Main Branch)</SelectItem>
                                        <SelectItem value="wfh">🏠 Work from Home</SelectItem>
                                        {sites?.map(site => (
                                            <SelectItem key={site._id} value={site._id}>📍 {site.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl font-bold text-slate-700 dark:text-slate-300">
                                    {record.siteName || "N/A"}
                                </div>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                Worked Hours
                            </Label>
                            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl font-black text-primary tabular-nums">
                                {formData.totalHours ? formatDuration(formData.totalHours) : 'Ongoing shift'}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Attendance Status</Label>
                            <Select 
                                disabled={!isAdmin} 
                                value={formData.status} 
                                onValueChange={(v) => setFormData({...formData, status: v})}
                            >
                                <SelectTrigger className="h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-bold">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Present">Present</SelectItem>
                                    <SelectItem value="Late">Late</SelectItem>
                                    <SelectItem value="Half-day">Half-day</SelectItem>
                                    <SelectItem value="Absent">Absent</SelectItem>
                                    <SelectItem value="Leave">Leave</SelectItem>
                                    <SelectItem value="holiday">Holiday</SelectItem>
                                    <SelectItem value="holiday_working">Holiday Work</SelectItem>
                                    <SelectItem value="WFH">WFH (Work From Home)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Approval Status</Label>
                            <Select 
                                disabled={!isAdmin} 
                                value={formData.approvalStatus} 
                                onValueChange={(v) => setFormData({...formData, approvalStatus: v})}
                            >
                                <SelectTrigger className="h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-bold">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Auto">Auto</SelectItem>
                                    <SelectItem value="Manual">Manual</SelectItem>
                                    <SelectItem value="Pending">Pending</SelectItem>
                                    <SelectItem value="Approved">Approved</SelectItem>
                                    <SelectItem value="Rejected">Rejected</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Notes / Remarks</Label>
                        <Textarea 
                            disabled={!isAdmin && record.employeeId !== record.currentUserId}
                            value={formData.notes}
                            onChange={(e) => setFormData({...formData, notes: e.target.value})}
                            placeholder="Add any specific observations or reasons..."
                            className="bg-slate-50 dark:bg-slate-800 border-none rounded-2xl min-h-[100px] p-4 font-medium"
                        />
                    </div>

                    <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center justify-between">
                            Site Photo Proof
                            {record.photoRequired && <span className="text-rose-500 lowercase font-bold tracking-normal italic">(Required)</span>}
                        </Label>
                        <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                            {(photoUrl || formData.photoStorageId) ? (
                                <div className="relative group">
                                    <div className="h-20 w-20 rounded-xl overflow-hidden ring-2 ring-primary/20">
                                        <img 
                                            src={formData.photoStorageId === record.photoStorageId ? (photoUrl || undefined) : URL.createObjectURL(new Blob())} // Simplified preview
                                            alt="Proof" 
                                            className="h-full w-full object-cover" 
                                            onError={(e) => {
                                                // Handle case where we don't have a local blob URL for new upload yet
                                                (e.target as HTMLImageElement).src = 'https://placehold.co/80x80?text=Uploaded';
                                            }}
                                        />
                                    </div>
                                    {isAdmin && (
                                        <button 
                                            type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, photoStorageId: undefined }))}
                                            className="absolute -top-2 -right-2 bg-rose-500 text-white h-6 w-6 rounded-full flex items-center justify-center shadow-lg hover:bg-rose-600 transition-colors"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-20 w-20 bg-slate-100 dark:bg-slate-700/50 rounded-xl">
                                    <ImageIcon className="h-6 w-6 text-slate-400" />
                                </div>
                            )}

                            <div className="flex-1 space-y-2">
                                <p className="text-[10px] font-bold text-slate-500 italic">
                                    {photoUrl ? "Current site proof is available." : "No site photo proof uploaded yet."}
                                </p>
                                {isAdmin && (
                                    <div className="flex items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={uploadingPhoto}
                                            onClick={() => document.getElementById('manual-photo-upload')?.click()}
                                            className="h-8 rounded-lg font-bold text-[10px] uppercase tracking-widest gap-2 bg-white dark:bg-slate-900"
                                        >
                                            {uploadingPhoto ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                                            {photoUrl ? "Replace Photo" : "Upload Photo"}
                                        </Button>
                                        <input 
                                            type="file" 
                                            id="manual-photo-upload"
                                            className="hidden" 
                                            accept="image/*"
                                            onChange={handlePhotoUpload}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="pt-4">
                        <Button 
                            type="button" 
                            variant="ghost" 
                            onClick={onClose}
                            className="h-12 px-6 font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                            Cancel
                        </Button>
                        {(isAdmin || record.employeeId === record.currentUserId) && (
                            <Button 
                                type="submit" 
                                disabled={loading}
                                className="h-12 px-8 bg-slate-900 dark:bg-white dark:text-slate-900 font-black rounded-xl shadow-xl transition-all active:scale-95"
                            >
                                {loading ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : <Save className="h-5 w-5 mr-2" />}
                                Update Record
                            </Button>
                        )}
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
