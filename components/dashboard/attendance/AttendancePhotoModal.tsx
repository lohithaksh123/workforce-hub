'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle,
    DialogDescription
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { 
    User, 
    MapPin, 
    Calendar, 
    Clock, 
    Download, 
    Loader2, 
    Image as ImageIcon,
    ExternalLink
} from 'lucide-react'
import { format } from 'date-fns'

interface AttendancePhotoModalProps {
    isOpen: boolean
    onClose: () => void
    attendanceId: any
    requestorEmail: string
    employeeName: string
    siteName: string
    date: string
    checkInTime?: number
}

export function AttendancePhotoModal({
    isOpen,
    onClose,
    attendanceId,
    requestorEmail,
    employeeName,
    siteName,
    date,
    checkInTime
}: AttendancePhotoModalProps) {
    const photoUrl = useQuery(api.attendance.getAttendancePhotoUrl, {
        attendanceId,
        requestorEmail
    })

    const handleDownload = async () => {
        if (!photoUrl) return
        const response = await fetch(photoUrl)
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `attendance_proof_${employeeName}_${date}.jpg`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px] bg-white dark:bg-slate-900 border-none shadow-2xl p-0 max-h-[90vh] overflow-y-auto rounded-[2rem]">
                <div className="relative h-64 sm:h-80 w-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    {photoUrl === undefined ? (
                        <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
                    ) : photoUrl ? (
                        <>
                            <img 
                                src={photoUrl} 
                                alt="Attendance Proof" 
                                className="h-full w-full object-cover"
                            />
                            <div className="absolute top-4 right-4 flex gap-2">
                                <Button size="icon" variant="secondary" className="rounded-full bg-white/90 dark:bg-slate-900/90 shadow-xl" onClick={handleDownload}>
                                    <Download className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="secondary" className="rounded-full bg-white/90 dark:bg-slate-900/90 shadow-xl" asChild>
                                    <a href={photoUrl} target="_blank" rel="noreferrer">
                                        <ExternalLink className="h-4 w-4" />
                                    </a>
                                </Button>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center gap-3 opacity-30">
                            <ImageIcon className="h-12 w-12" />
                            <p className="text-xs font-black uppercase tracking-widest">No photo available</p>
                        </div>
                    )}
                </div>

                <div className="p-6 space-y-6">
                    <DialogHeader>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                                <User className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-black uppercase tracking-tighter italic text-slate-900 dark:text-white">
                                    Photo Proof
                                </DialogTitle>
                                <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                    Visual verification for {employeeName}
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                                <MapPin className="h-3 w-3" /> Site / Branch
                            </span>
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase">{siteName}</p>
                        </div>
                        <div className="space-y-1">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                                <Calendar className="h-3 w-3" /> Date
                            </span>
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{format(new Date(date), "dd MMM yyyy")}</p>
                        </div>
                        <div className="space-y-1">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                                <Clock className="h-3 w-3" /> Check-in Time
                            </span>
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                {checkInTime ? new Date(checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                            </p>
                        </div>
                        <div className="space-y-1">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                                <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Status
                            </span>
                            <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest italic">Verified Upload</p>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                        <Button 
                            className="w-full h-12 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black uppercase tracking-widest text-[10px] rounded-2xl"
                            onClick={onClose}
                        >
                            Close Preview
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

import { CheckCircle2 } from 'lucide-react'
