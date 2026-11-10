'use client'

import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
    Download,
    Clock,
    Search,
    Filter,
    MoreHorizontal,
    Eye,
    CheckCircle2,
    XCircle,
    Edit3,
    FileText
} from 'lucide-react'
import { useRef } from 'react'
import { Input } from '@/components/ui/input'
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select'
import { toast } from 'sonner'
import { AttendanceModal } from './AttendanceModal'
import { format, parseISO } from 'date-fns'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar as CalendarIcon, Camera, Image as ImageIcon } from 'lucide-react'
import { AttendancePhotoModal } from './AttendancePhotoModal'
import { AttendanceReportModal } from './AttendanceReportModal'

const formatDuration = (decimalHours: number) => {
    if (!decimalHours || decimalHours <= 0) return "0hrs 0min";
    const hours = Math.floor(decimalHours);
    const minutes = Math.round((decimalHours - hours) * 60);
    if (hours === 0) return `${minutes}min`;
    if (minutes === 0) return `${hours}hrs`;
    return `${hours}hrs ${minutes}min`;
};

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


export function AttendanceTable({ 
    isAdmin, 
    currentUserId,
    selectedDate,
    onDateChange,
    requestorEmail,
    requestorName
}: { 
    isAdmin: boolean, 
    currentUserId?: string,
    selectedDate: string,
    onDateChange: (date: string) => void,
    requestorEmail?: string,
    requestorName?: string
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [selectedRecord, setSelectedRecord] = useState<any>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)
  const [photoModalOpen, setPhotoModalOpen] = useState(false)
  const [activePhotoRecord, setActivePhotoRecord] = useState<any>(null)
  const [uploadingRecordId, setUploadingRecordId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const logs = useQuery(api.attendance.getAttendanceLogs, {
    status: statusFilter === 'ALL' ? undefined : statusFilter,
    employeeId: isAdmin ? undefined : currentUserId as any,
    startDate: selectedDate,
    endDate: selectedDate,
    requestorEmail: requestorEmail
  })

  const approve = useMutation(api.attendance.approveAttendance)
  const reject = useMutation(api.attendance.rejectAttendance)

  const filteredLogs = logs?.filter(log => 
    log.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.siteName.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleApprove = async (id: any) => {
    try {
      await approve({ id, requestorEmail: requestorEmail! })
      toast.success('Attendance record approved')
    } catch (error) {
      toast.error('Failed to approve attendance')
    }
  }

  const handleReject = async (id: any) => {
    try {
      await reject({ id, requestorEmail: requestorEmail! })
      toast.success('Attendance record rejected')
    } catch (error) {
      toast.error('Failed to reject attendance')
    }
  }

  const exportToCSV = () => {
    if (!filteredLogs) return;
    
    const headers = ['Employee', 'Role', 'Site', 'Date', 'Check-In', 'Check-Out', 'Total Hours', 'Status', 'Approval'];
    const data = filteredLogs.map(log => [
      log.employeeName,
      log.employeeRole,
      log.siteName,
      log.date,
      log.checkIn ? new Date(log.checkIn).toLocaleTimeString() : 'N/A',
      log.checkOut ? new Date(log.checkOut).toLocaleTimeString() : 'N/A',
      log.totalHours?.toFixed(2) || '0',
      (() => {
        if ((log.status === 'holiday' || log.status === 'Holiday') && log.date) {
          const [yr, mt, dy] = log.date.split("-").map(Number);
          const isSunday = new Date(Date.UTC(yr, mt - 1, dy)).getUTCDay() === 0;
          if (isSunday) return 'Sunday';
          return 'Holiday';
        }
        return log.status;
      })(),
      log.approvalStatus
    ]);

    const csvContent = [headers, ...data].map(e => e.join(",")).join("\n");
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `attendance_report_${selectedDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const exportToPDF = async () => {
    if (!filteredLogs) return;
    
    try {
      toast.loading('Generating PDF report...')
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF()
      
      // Try to load the logo
      let logoBase64 = '';
      try {
        logoBase64 = await getImageBase64('/logo.png');
      } catch (error) {
        console.error('Failed to load logo, generating PDF without it', error);
      }

      // Page dimensions
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      // Draw Header
      const drawHeader = (pageNum: number) => {
        // Logo on top left
        if (logoBase64) {
          doc.addImage(logoBase64, 'PNG', 10, 10, 40, 9.7);
        } else {
          // Fallback if logo fails to load: Draw text logo
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(14);
          doc.setTextColor(15, 23, 42);
          doc.text("ACME INTERIORS", 10, 17);
        }
        
        // Document metadata on the top right
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(15, 23, 42);
        doc.text("ATTENDANCE REPORT", pageWidth - 10, 15, { align: 'right' });
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.text("Acme Interiors", pageWidth - 10, 20, { align: 'right' });
        
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(`Report Date: ${format(parseISO(selectedDate), "dd MMMM yyyy")}`, pageWidth - 10, 25, { align: 'right' });
        doc.text(`Generated On: ${new Date().toLocaleString('en-IN')}`, pageWidth - 10, 29, { align: 'right' });
        
        // Horizontal divider line below header
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.5);
        doc.line(10, 33, pageWidth - 10, 33);
        
        // Footer: Page Number & confidential notice
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(`Page ${pageNum}`, pageWidth - 10, pageHeight - 10, { align: 'right' });
        doc.text("Acme Interiors - Confidential", 10, pageHeight - 10);
      }

      // Draw Table Headers
      const drawTableHeader = (startY: number) => {
        // Draw Header Background (gray block)
        doc.setFillColor(229, 231, 235);
        doc.rect(10, startY, 190, 8, 'F');
        
        // Draw borders around header cells
        doc.setDrawColor(156, 163, 175);
        doc.setLineWidth(0.15);
        doc.rect(10, startY, 190, 8);
        const dividers = [38, 52, 84, 104, 125, 146, 164, 180];
        dividers.forEach(x => {
          doc.line(x, startY, x, startY + 8);
        });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(17, 24, 39);
        
        // Header Text positions
        doc.text("Employee", 12, startY + 5.5);
        doc.text("Role", 40, startY + 5.5);
        doc.text("Site", 54, startY + 5.5);
        doc.text("Date", 86, startY + 5.5);
        doc.text("Check-In", 106, startY + 5.5);
        doc.text("Check-Out", 127, startY + 5.5);
        doc.text("Total Hours", 147.5, startY + 5.5);
        doc.text("Status", 166, startY + 5.5);
        doc.text("Approval", 182, startY + 5.5);
      }

      let currentPage = 1;
      drawHeader(currentPage);
      
      let y = 38;
      drawTableHeader(y);
      y += 8;

      filteredLogs.forEach((log, index) => {
        if (y > pageHeight - 20) {
          doc.addPage();
          currentPage++;
          drawHeader(currentPage);
          y = 30;
          drawTableHeader(y);
          y += 8;
        }

        // Draw Alternating Background
        if (index % 2 === 1) {
          doc.setFillColor(249, 250, 251);
          doc.rect(10, y, 190, 8, 'F');
        }

        const employeeName = (log.employeeName || '').substring(0, 18);
        const role = (log.employeeRole || '').substring(0, 8);
        const site = (log.siteName || '').substring(0, 22);
        const date = log.date || '';
        const checkIn = log.checkIn ? new Date(log.checkIn).toLocaleTimeString() : 'N/A';
        const checkOut = log.checkOut ? new Date(log.checkOut).toLocaleTimeString() : 'N/A';
        const totalHours = log.totalHours ? formatDuration(log.totalHours) : '0h 0m';
        const status = log.status || '';
        const approval = log.approvalStatus || '';

        // Write row cell values
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(17, 24, 39);
        doc.text(employeeName, 12, y + 5.5);
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(55, 65, 81);
        doc.text(role, 40, y + 5.5);
        doc.text(site, 54, y + 5.5);
        
        const [yr, mt, dy] = date.split("-").map(Number);
        const isSunday = date ? new Date(Date.UTC(yr, mt - 1, dy)).getUTCDay() === 0 : false;
        if (isSunday) doc.setTextColor(124, 58, 237); // Premium Violet for Sunday Date
        doc.text(date, 86, y + 5.5);
        
        doc.setTextColor(55, 65, 81);
        doc.text(checkIn, 106, y + 5.5);
        doc.text(checkOut, 127, y + 5.5);
        doc.text(totalHours, 147.5, y + 5.5);
        
        // Status styling colors
        if (status === 'Present') doc.setTextColor(16, 185, 129);
        else if (status === 'Absent') doc.setTextColor(239, 68, 68);
        else if (status === 'Late') doc.setTextColor(245, 158, 11);
        else if (status === 'holiday' || status === 'Holiday') {
          doc.setTextColor(124, 58, 237); // Premium Violet for Sunday and Holidays
        }
        else if (status === 'holiday_working') doc.setTextColor(139, 92, 246);
        
        const displayStatus = (status === 'holiday' || status === 'Holiday') 
          ? (isSunday ? 'Sunday' : 'Holiday')
          : status;
        doc.text(displayStatus, 166, y + 5.5);

        // Approval styling colors
        doc.setTextColor(55, 65, 81);
        if (approval === 'Approved' || approval === 'Auto') doc.setTextColor(16, 185, 129);
        else if (approval === 'Rejected') doc.setTextColor(239, 68, 68);
        else if (approval === 'Pending') doc.setTextColor(245, 158, 11);
        doc.text(approval, 182, y + 5.5);

        // Draw borders around cells
        doc.setDrawColor(209, 213, 219);
        doc.setLineWidth(0.1);
        doc.rect(10, y, 190, 8);
        const dividers = [38, 52, 84, 104, 125, 146, 164, 180];
        dividers.forEach(dividerX => {
          doc.line(dividerX, y, dividerX, y + 8);
        });

        y += 8;
      });

      doc.save(`attendance_report_${selectedDate}.pdf`);
      toast.dismiss();
      toast.success('PDF report downloaded successfully');
    } catch (e: any) {
      console.error(e);
      toast.dismiss();
      toast.error('Failed to generate PDF report');
    }
  };

  const generateUploadUrl = useMutation(api.attendance.generateUploadUrl)
  const uploadPhoto = useMutation(api.attendance.uploadAttendancePhoto)

  const handleCaptureClick = (recordId: string) => {
    setUploadingRecordId(recordId)
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !uploadingRecordId) return

    try {
      toast.loading('Uploading proof...')
      const postUrl = await generateUploadUrl()
      const result = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      })
      const { storageId } = await result.json()

      await uploadPhoto({
        attendanceId: uploadingRecordId as any,
        photoStorageId: storageId,
        requestorEmail: requestorEmail!
      })

      toast.dismiss()
      toast.success('Photo proof uploaded successfully')
      setUploadingRecordId(null)
    } catch (error: any) {
      toast.dismiss()
      toast.error(error.message || 'Failed to upload photo')
    }
  }

  const getStatusBadge = (status: string, holidayName?: string, dateStr?: string) => {
    switch (status) {
      case 'Present': return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-2 py-0.5 font-bold text-[10px] uppercase">Present</Badge>
      case 'Late': return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 px-2 py-0.5 font-bold text-[10px] uppercase">Late</Badge>
      case 'Half-day': return <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20 px-2 py-0.5 font-bold text-[10px] uppercase">Half-day</Badge>
      case 'Absent': return <Badge className="bg-rose-500/10 text-rose-500 border-rose-500/20 px-2 py-0.5 font-bold text-[10px] uppercase">Absent</Badge>
      case 'Leave': return <Badge className="bg-slate-500/10 text-slate-500 border-slate-500/20 px-2 py-0.5 font-bold text-[10px] uppercase">Leave</Badge>
      case 'holiday':
      case 'Holiday':
        const [yr, mt, dy] = (dateStr || '').split("-").map(Number);
        const isSunday = dateStr ? new Date(Date.UTC(yr, mt - 1, dy)).getUTCDay() === 0 : false;
        const labelText = isSunday ? 'Sunday' : 'Holiday';
        return (
          <div className="flex flex-col items-start gap-0.5">
            <Badge className="bg-violet-500/10 text-violet-500 border-violet-500/20 dark:bg-violet-500/20 dark:text-violet-400 px-2 py-0.5 font-bold text-[10px] uppercase">{labelText}</Badge>
            {holidayName && holidayName !== 'Holiday' && holidayName !== 'Sunday' && <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap">{holidayName}</span>}
          </div>
        )
      case 'holiday_working':
        return (
          <div className="flex flex-col items-start gap-0.5">
            <Badge className="bg-violet-500/10 text-violet-500 border-violet-500/20 px-2 py-0.5 font-bold text-[10px] uppercase">Holiday Work</Badge>
            <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500">Present</span>
          </div>
        )
      case 'WFH': return <Badge className="bg-fuchsia-500/10 text-fuchsia-500 border-fuchsia-500/20 px-2 py-0.5 font-bold text-[10px] uppercase">WFH</Badge>
      default: return <Badge variant="outline">{status}</Badge>
    }
  }

  const getProofBadge = (log: any) => {
    if (log.status === 'Absent' || log.status === 'holiday' || log.status === 'Holiday' || (typeof log._id === 'string' && (log._id.startsWith('absent_') || log._id.startsWith('holiday_')))) {
      return <span className="text-xs text-muted-foreground italic opacity-50">No proof</span>;
    }
    if (log.photoStatus === 'uploaded') {
      return (
        <div className="flex items-center gap-2">
          <div 
            className="flex items-center gap-2 cursor-pointer group"
            onClick={() => { setActivePhotoRecord(log); setPhotoModalOpen(true); }}
          >
            <div className="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20 group-hover:bg-emerald-500 group-hover:text-white transition-all">
              <ImageIcon className="h-3.5 w-3.5" />
            </div>
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest hidden lg:block">View Proof</span>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={() => handleCaptureClick(log._id)}
          >
            <Camera className="h-3.5 w-3.5 text-slate-400" />
          </Button>
        </div>
      )
    }
    return (
      <div className="flex items-center gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          className={cn(
            "h-8 gap-2 font-black text-[9px] uppercase tracking-widest rounded-xl transition-all",
            log.photoRequired 
              ? "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/20 dark:border-rose-900/30" 
              : "border-slate-200 text-slate-500 opacity-50 grayscale hover:grayscale-0 hover:opacity-100"
          )}
          onClick={() => handleCaptureClick(log._id)}
        >
          <Camera className="h-3.5 w-3.5" />
          {log.photoRequired ? "Capture" : "Optional"}
        </Button>
        {log.photoRequired && (
          <span className="text-[9px] font-black text-rose-500/50 uppercase tracking-tighter animate-pulse hidden lg:block">Action Req.</span>
        )}
      </div>
    )
  }

  const getApprovalBadge = (status: string) => {
    switch (status) {
      case 'Approved': return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 px-2 py-0.5 font-bold text-[10px] uppercase">Approved</Badge>
      case 'Pending': return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800 px-2 py-0.5 font-bold text-[10px] uppercase animate-pulse">Pending</Badge>
      case 'Rejected': return <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200 dark:border-rose-800 px-2 py-0.5 font-bold text-[10px] uppercase">Rejected</Badge>
      case 'Auto': return <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700 px-2 py-0.5 font-bold text-[10px] uppercase">Auto</Badge>
      case 'Manual': return <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 px-2 py-0.5 font-bold text-[10px] uppercase">Manual</Badge>
      default: return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 w-full min-w-0 pr-0 md:pr-10">
        <div className="flex flex-col sm:flex-row flex-1 items-center gap-3 w-full">
          {isAdmin && (
            <div className="relative flex-1 w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search staff or site..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-12 bg-slate-50 dark:bg-slate-800 border-none font-medium w-full"
              />
            </div>
          )}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="flex-1 md:w-[160px] h-12 bg-slate-50 dark:bg-slate-800 border-none font-bold">
                <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="Present">Present</SelectItem>
                <SelectItem value="Late">Late</SelectItem>
                <SelectItem value="Half-day">Half-day</SelectItem>
                <SelectItem value="Absent">Absent</SelectItem>
                <SelectItem value="WFH">WFH</SelectItem>
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    "flex items-center gap-3 bg-slate-50 dark:bg-slate-800 px-4 rounded-xl h-12 border border-transparent hover:border-primary/20 transition-all flex-1 md:flex-none justify-start font-bold",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="h-4 w-4 text-primary" />
                  <div className="flex flex-col items-start leading-none gap-1">
                    <span className="text-[9px] font-black uppercase text-slate-400">Selected Date</span>
                    <span className="text-sm">
                      {selectedDate ? format(parseISO(selectedDate), "dd MMM yyyy") : "Pick a date"}
                    </span>
                  </div>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 border-none shadow-2xl" align="end">
                <Calendar
                  mode="single"
                  selected={parseISO(selectedDate)}
                  onSelect={(date) => {
                    if (date) {
                      onDateChange(format(date, "yyyy-MM-dd"));
                    }
                  }}
                  captionLayout="dropdown"
                  fromYear={2020}
                  toYear={2030}
                  initialFocus
                  className="rounded-2xl border-none bg-white dark:bg-slate-900 p-4"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto mt-4 md:mt-0">
          {isAdmin ? (
            <>
              <Button 
                variant="outline" 
                onClick={exportToCSV}
                className="h-12 px-6 font-bold gap-2 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
              <Button 
                variant="outline" 
                onClick={exportToPDF}
                className="h-12 px-6 font-bold gap-2 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                Export PDF
              </Button>
              <Button 
                variant="default" 
                onClick={() => setIsReportModalOpen(true)}
                className="h-12 px-6 font-bold gap-2 bg-primary hover:bg-primary/90 text-white w-full sm:w-auto shadow-sm"
              >
                <FileText className="h-4 w-4" />
                Generate Report
              </Button>
            </>
          ) : (
            <Button 
              variant="default" 
              onClick={() => setIsReportModalOpen(true)}
              className="h-12 px-6 font-bold gap-2 bg-primary hover:bg-primary/90 text-white w-full sm:w-auto shadow-sm"
            >
              <Download className="h-4 w-4" />
              Download My Report
            </Button>
          )}
        </div>
      </div>


      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block">
          <Table>
            <TableHeader className="bg-slate-50/50 dark:bg-slate-800/50">
            <TableRow>
              <TableHead className="font-black text-[10px] uppercase tracking-widest px-6 h-12">Employee</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest h-12">Site / Branch</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest h-12">Date</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest h-12 text-center">Log In</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest h-12 text-center">Log Out</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest h-12 text-center">Total Hours</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest h-12">Proof</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest h-12">Status</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest h-12">Approval</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest h-12 text-right px-6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLogs?.map((log) => (
              <TableRow key={log._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors border-slate-100 dark:border-slate-800">
                <TableCell className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-900 dark:text-slate-100">{log.employeeName}</span>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">{log.employeeRole}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="font-medium text-slate-600 dark:text-slate-400">{log.siteName}</span>
                </TableCell>
                <TableCell>
                  <span className={`font-medium tabular-nums ${
                    (() => {
                      const [yr, mt, dy] = (log.date || '').split("-").map(Number);
                      const isSunday = log.date ? new Date(Date.UTC(yr, mt - 1, dy)).getUTCDay() === 0 : false;
                      return isSunday ? 'text-violet-500 font-bold dark:text-violet-400' : 'text-slate-600 dark:text-slate-400';
                    })()
                  }`}>{log.date}</span>
                </TableCell>
                <TableCell className="text-center font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                  {log.checkIn ? new Date(log.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                </TableCell>
                <TableCell className="text-center font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                  {log.checkOut ? new Date(log.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                </TableCell>
                <TableCell className="text-center font-black text-primary tabular-nums">
                  {log.totalHours ? formatDuration(log.totalHours) : '-'}
                </TableCell>
                <TableCell>
                  {getProofBadge(log)}
                </TableCell>
                <TableCell>
                  {getStatusBadge(log.status, log.holidayName, log.date)}
                </TableCell>
                <TableCell>
                  {getApprovalBadge(log.approvalStatus)}
                </TableCell>
                <TableCell className="text-right px-6">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 p-2 rounded-xl">
                      <DropdownMenuItem 
                        onClick={() => { setSelectedRecord(log); setIsModalOpen(true); }}
                        className="flex items-center gap-3 p-2 font-bold text-xs rounded-lg cursor-pointer"
                      >
                        <Eye className="h-4 w-4 text-blue-500" />
                        View Details
                      </DropdownMenuItem>
                      {log.photoStatus === 'uploaded' && (
                        <DropdownMenuItem 
                          onClick={() => { setActivePhotoRecord(log); setPhotoModalOpen(true); }}
                          className="flex items-center gap-3 p-2 font-bold text-xs rounded-lg cursor-pointer lg:hidden"
                        >
                          <ImageIcon className="h-4 w-4 text-emerald-500" />
                          View Photo Proof
                        </DropdownMenuItem>
                      )}
                      {(isAdmin || log.employeeId === currentUserId) && (
                        <DropdownMenuItem 
                          onClick={() => { setSelectedRecord(log); setIsModalOpen(true); }}
                          className="flex items-center gap-3 p-2 font-bold text-xs rounded-lg cursor-pointer"
                        >
                          <Edit3 className="h-4 w-4 text-amber-500" />
                          Manual Edit
                        </DropdownMenuItem>
                      )}
                      {isAdmin && log.approvalStatus === 'Pending' && (
                        <>
                          <DropdownMenuItem 
                            onClick={() => handleApprove(log._id)}
                            className="flex items-center gap-3 p-2 font-bold text-xs rounded-lg cursor-pointer text-emerald-600"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Approve
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleReject(log._id)}
                            className="flex items-center gap-3 p-2 font-bold text-xs rounded-lg cursor-pointer text-rose-600"
                          >
                            <XCircle className="h-4 w-4" />
                            Reject
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {filteredLogs?.length === 0 && (
                <TableRow>
                    <TableCell colSpan={9} className="h-48 text-center py-10">
                        <div className="flex flex-col items-center justify-center space-y-3 opacity-40">
                            <Clock className="h-10 w-10 text-muted-foreground" />
                            <p className="text-muted-foreground font-medium italic">
                                No attendance records found for {new Date(selectedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}.
                            </p>
                        </div>
                    </TableCell>
                </TableRow>
            )}
          </TableBody>
          </Table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
          {filteredLogs?.map((log) => (
            <div key={log._id} className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="font-bold text-slate-900 dark:text-slate-100">{log.employeeName}</span>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">{log.employeeRole}</span>
                </div>
                {getApprovalBadge(log.approvalStatus)}
              </div>
              
              <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Log In</span>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {log.checkIn ? new Date(log.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Log Out</span>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {log.checkOut ? new Date(log.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Time</span>
                  <span className="text-xs font-black text-primary">
                    {log.totalHours ? formatDuration(log.totalHours) : '-'}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</span>
                  <div>{getStatusBadge(log.status, log.holidayName, log.date)}</div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-[10px] font-bold text-slate-400 italic">📍 {log.siteName}</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 gap-2 font-bold text-[10px] uppercase tracking-widest rounded-lg">
                      Actions <MoreHorizontal className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 p-2 rounded-xl">
                    <DropdownMenuItem 
                      onClick={() => { setSelectedRecord(log); setIsModalOpen(true); }}
                      className="flex items-center gap-3 p-2 font-bold text-xs rounded-lg cursor-pointer"
                    >
                      <Eye className="h-4 w-4 text-blue-500" />
                      View Details
                    </DropdownMenuItem>
                    {(isAdmin || log.employeeId === currentUserId) && (
                      <DropdownMenuItem 
                        onClick={() => { setSelectedRecord(log); setIsModalOpen(true); }}
                        className="flex items-center gap-3 p-2 font-bold text-xs rounded-lg cursor-pointer"
                      >
                        <Edit3 className="h-4 w-4 text-amber-500" />
                        Manual Edit
                      </DropdownMenuItem>
                    )}
                    {isAdmin && log.approvalStatus === 'Pending' && (
                      <>
                        <DropdownMenuItem 
                          onClick={() => handleApprove(log._id)}
                          className="flex items-center gap-3 p-2 font-bold text-xs rounded-lg cursor-pointer text-emerald-600"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Approve
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleReject(log._id)}
                          className="flex items-center gap-3 p-2 font-bold text-xs rounded-lg cursor-pointer text-rose-600"
                        >
                          <XCircle className="h-4 w-4" />
                          Reject
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
          
          {filteredLogs?.length === 0 && (
            <div className="py-20 text-center opacity-40">
              <Clock className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-xs font-black uppercase tracking-widest">No records found</p>
            </div>
          )}
        </div>
      </div>

      {selectedRecord && (
        <AttendanceModal 
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); setSelectedRecord(null); }}
          record={selectedRecord}
          isAdmin={isAdmin}
          requestorEmail={requestorEmail}
        />
      )}

      {activePhotoRecord && (
        <AttendancePhotoModal
          isOpen={photoModalOpen}
          onClose={() => { setPhotoModalOpen(false); setActivePhotoRecord(null); }}
          attendanceId={activePhotoRecord._id}
          requestorEmail={requestorEmail!}
          employeeName={activePhotoRecord.employeeName}
          siteName={activePhotoRecord.siteName}
          date={activePhotoRecord.date}
          checkInTime={activePhotoRecord.checkIn}
        />
      )}

      {isReportModalOpen && (
        <AttendanceReportModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          isAdmin={isAdmin}
          currentUserId={currentUserId}
          requestorEmail={requestorEmail}
          requestorName={requestorName}
        />
      )}

      <input 
        type="file" 
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        capture="environment"
        className="hidden"
      />
    </div>
  )
}
