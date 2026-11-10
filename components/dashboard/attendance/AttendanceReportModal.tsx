'use client'

import { useState, useEffect } from 'react'
import { useQuery } from 'convex/react'
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
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select'
import { toast } from 'sonner'
import { 
    Loader2, 
    Calendar as CalendarIcon, 
    Download, 
    Eye, 
    FileText, 
    Building2, 
    User,
    CheckCircle2,
    XCircle,
    Info,
    Calendar,
    Users
} from 'lucide-react'
import * as XLSX from 'xlsx'

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

const getPhotoProofStatusText = (r: any) => {
    if (r.photoRequired === true) {
        return r.photoStatus === 'uploaded' ? 'Yes' : 'No';
    }
    return 'Not Uploaded';
};

const getStatusText = (r: any) => {
    if ((r.status === 'holiday' || r.status === 'Holiday') && r.date) {
        const [yr, mt, dy] = r.date.split("-").map(Number);
        const isSunday = new Date(Date.UTC(yr, mt - 1, dy)).getUTCDay() === 0;
        if (isSunday) return "Sunday";
        return "Holiday";
    }
    return r.status;
};

interface AttendanceReportModalProps {
    isOpen: boolean
    onClose: () => void
    isAdmin: boolean
    currentUserId?: string
    requestorEmail?: string
    requestorName?: string
}

const REPORT_TYPES = [
    { value: "monthly", label: "Monthly Attendance Report" },
    { value: "custom_range", label: "Custom Date Range Report" },
    { value: "employee", label: "Employee-wise Report" },
    { value: "site", label: "Site-wise Report" },
    { value: "leave", label: "Leave Report" }
]

const LEAVE_TYPES = [
    "Casual Leave",
    "Sick Leave",
    "Paid Leave",
    "Unpaid Leave",
    "Special Leave"
]

export function AttendanceReportModal({
    isOpen,
    onClose,
    isAdmin,
    currentUserId,
    requestorEmail,
    requestorName: propRequestorName
}: AttendanceReportModalProps) {
    const [reportType, setReportType] = useState<string>("monthly")
    
    // Date states
    const [month, setMonth] = useState<string>(new Date().toISOString().substring(0, 7)) // YYYY-MM
    const [fromDate, setFromDate] = useState<string>("")
    const [toDate, setToDate] = useState<string>("")

    // Filter states
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("ALL")
    const [selectedSiteId, setSelectedSiteId] = useState<string>("ALL")
    const [statusFilter, setStatusFilter] = useState<string>("ALL")
    const [leaveTypeFilter, setLeaveTypeFilter] = useState<string>("ALL")
    const [proofStatusFilter, setProofStatusFilter] = useState<string>("ALL")
    const [exportFormat, setExportFormat] = useState<string>("pdf")
    const [showPhotoProof, setShowPhotoProof] = useState<string>("no")

    // Preview / Data loading states
    const [previewData, setPreviewData] = useState<any>(null)
    const [loadingPreview, setLoadingPreview] = useState(false)
    const [previewTriggered, setPreviewTriggered] = useState(false)

    // DB lists
    const users = useQuery(api.users.getUsers)
    const sites = useQuery(api.sites.getSites)

    const activeUsers = users?.filter(u => u.status === 'active') || []

    const requestorName = propRequestorName || requestorEmail || "System"

    // Reset preview when fields change
    useEffect(() => {
        setPreviewData(null)
        setPreviewTriggered(false)
        setLoadingPreview(false)
    }, [
        reportType, month, fromDate, toDate, 
        selectedEmployeeId, selectedSiteId, statusFilter, 
        leaveTypeFilter, proofStatusFilter
    ])

    // Prefill employee if normal staff
    useEffect(() => {
        if (!isAdmin && currentUserId) {
            setSelectedEmployeeId(currentUserId)
        }
    }, [isAdmin, currentUserId])

    // Query builder parameters for API
    const reportQueryArgs = {
        reportType,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        month: month || undefined,
        employeeId: selectedEmployeeId === "ALL" ? undefined : (selectedEmployeeId as any),
        siteId: selectedSiteId === "ALL" ? undefined : (selectedSiteId as any),
        status: statusFilter === "ALL" ? undefined : statusFilter,
        leaveType: leaveTypeFilter === "ALL" ? undefined : leaveTypeFilter,
        proofStatus: proofStatusFilter === "ALL" ? undefined : proofStatusFilter,
        requestorEmail: requestorEmail || ""
    }

    const fetchedReportData = useQuery(
        api.reports.generateAttendanceReportData, 
        previewTriggered ? reportQueryArgs : "skip"
    )

    useEffect(() => {
        if (previewTriggered) {
            if (fetchedReportData === undefined) {
                setLoadingPreview(true)
            } else {
                setPreviewData(fetchedReportData)
                setLoadingPreview(false)
            }
        }
    }, [fetchedReportData, previewTriggered])

    const handlePreviewClick = () => {
        if (reportType === "monthly" && !month) {
            toast.error("Please select a month.")
            return
        }
        if (reportType !== "monthly" && reportType !== "leave" && (!fromDate || !toDate)) {
            toast.error("Please select a valid date range.")
            return
        }
        if (fromDate && toDate && toDate < fromDate) {
            toast.error("To Date cannot be before From Date.")
            return
        }
        if (reportType === "employee" && selectedEmployeeId === "ALL") {
            toast.error("Please select an employee.")
            return
        }
        if (reportType === "site" && selectedSiteId === "ALL") {
            toast.error("Please select a site.")
            return
        }

        setLoadingPreview(true)
        setPreviewTriggered(true)
    }

    const handleExportCSV = () => {
        if (!previewData || previewData.records.length === 0) return

        const toastId = toast.loading("Generating CSV report...")
        try {
            let csvContent = "\uFEFF" // UTF-8 BOM
            
            let headers: string[] = []
            let rows: string[][] = []

            if (reportType === 'leave') {
                headers = ["Employee", "Type", "Duration", "Days", "Status"]
                rows = previewData.records.map((r: any) => [
                    r.employeeName,
                    r.leaveType,
                    `${r.fromDate} to ${r.toDate}`,
                    String(r.totalDays),
                    r.status
                ])
            } else if (reportType === 'employee') {
                const hasPhotoCol = showPhotoProof === 'yes'
                headers = hasPhotoCol
                    ? ["Date", "Site / Branch", "Log In", "Log Out", "Hours", "Status", "Photo Proof", "Notes"]
                    : ["Date", "Site / Branch", "Log In", "Log Out", "Hours", "Status", "Notes"]
                
                rows = previewData.records.map((r: any) => {
                    const rowVals = [
                        r.date,
                        r.siteName,
                        r.checkIn ? new Date(r.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
                        r.checkOut ? new Date(r.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
                        r.totalHours ? formatDuration(r.totalHours) : '0hrs 0min',
                        getStatusText(r)
                    ]
                    if (hasPhotoCol) rowVals.push(getPhotoProofStatusText(r))
                    rowVals.push(r.notes || "")
                    return rowVals
                })
            } else {
                const hasPhotoCol = showPhotoProof === 'yes'
                headers = hasPhotoCol
                    ? ["Date", "Employee", "Site / Branch", "Log In", "Log Out", "Hours", "Status", "Photo Proof", "Notes"]
                    : ["Date", "Employee", "Site / Branch", "Log In", "Log Out", "Hours", "Status", "Notes"]
                
                rows = previewData.records.map((r: any) => {
                    const rowVals = [
                        r.date,
                        r.employeeName,
                        r.siteName,
                        r.checkIn ? new Date(r.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
                        r.checkOut ? new Date(r.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
                        r.totalHours ? formatDuration(r.totalHours) : '0hrs 0min',
                        getStatusText(r)
                    ]
                    if (hasPhotoCol) rowVals.push(getPhotoProofStatusText(r))
                    rowVals.push(r.notes || "")
                    return rowVals
                })
            }

            const escapeCSV = (val: string) => {
                let escaped = val.replace(/"/g, '""')
                if (escaped.includes(',') || escaped.includes('\n') || escaped.includes('"')) {
                    escaped = `"${escaped}"`
                }
                return escaped
            }

            csvContent += headers.map(escapeCSV).join(",") + "\n"
            rows.forEach(row => {
                csvContent += row.map(escapeCSV).join(",") + "\n"
            })

            const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
            const link = document.createElement("a")
            const url = URL.createObjectURL(blob)
            link.setAttribute("href", url)
            link.setAttribute("download", `attendance-${reportType}-${new Date().toISOString().split('T')[0]}.csv`)
            link.style.visibility = 'hidden'
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)

            toast.dismiss(toastId)
            toast.success("CSV report downloaded successfully!")
        } catch (error: any) {
            console.error(error)
            toast.dismiss(toastId)
            toast.error("Failed to generate CSV report: " + error.message)
        }
    }

    const handleExportExcel = () => {
        if (!previewData || previewData.records.length === 0) return

        const toastId = toast.loading("Generating Excel report...")
        try {
            const wb = XLSX.utils.book_new()
            const sum = previewData.summary

            const rows: any[][] = []

            // Add Header Info
            rows.push(["ACME INTERIORS"])
            const dateRangeText = reportType === 'monthly'
                ? `Month: ${month}`
                : (fromDate && toDate ? `Date Range: ${fromDate} to ${toDate}` : '')
            rows.push([
                `Report: ${REPORT_TYPES.find(r => r.value === reportType)?.label}`,
                dateRangeText,
                `Generated By: ${requestorName}`,
                `Generated On: ${new Date().toLocaleString()}`
            ])
            rows.push([]) // empty row

            // Add Summary Section horizontally
            if (reportType === 'monthly' || reportType === 'custom_range') {
                rows.push([
                    `Total Records: ${sum.totalRecords}`,
                    `Present Count: ${sum.presentCount}`,
                    `Absent Count: ${sum.absentCount}`,
                    `Leave Count: ${sum.leaveCount}`,
                    `Holiday Count: ${sum.holidayCount || 0}`,
                    `Total Hours: ${formatDuration(sum.totalHours)}`
                ])
            } else if (reportType === 'employee') {
                rows.push([
                    `Employee: ${sum.employeeName} (${sum.role})`,
                    `Present Days: ${sum.totalPresentDays}`,
                    `Absent Days: ${sum.totalAbsentDays}`,
                    `Leave Days: ${sum.totalLeaveDays}`,
                    `Holiday Days: ${sum.totalHolidayDays || 0}`,
                    `Total Hours: ${formatDuration(sum.totalHours)}`,
                    `Late: ${sum.lateCount}`,
                    `Missing Proof: ${sum.missingProofCount}`
                ])
            } else if (reportType === 'site') {
                rows.push([
                    `Site Name: ${sum.siteName}`,
                    `Total Staff Worked: ${sum.totalStaffWorked}`,
                    `Total Hours: ${formatDuration(sum.totalHours)}`,
                    `Present: ${sum.presentCount}`,
                    `Absent: ${sum.absentCount}`,
                    `Leave: ${sum.leaveCount}`,
                    `Holiday Count: ${sum.holidayCount || 0}`,
                    `Missing Proof: ${sum.missingProofCount}`
                ])
            } else if (reportType === 'leave') {
                rows.push([
                    `Total Leaves: ${sum.totalLeaves}`,
                    `Approved: ${sum.approvedCount}`,
                    `Pending: ${sum.pendingCount}`,
                    `Rejected: ${sum.rejectedCount}`,
                    `Cancelled: ${sum.cancelledCount}`
                ])
            }
            rows.push([]) // empty row

            // Add Detailed Records
            let headers: string[] = []
            let dataRows: any[][] = []

            if (reportType === 'leave') {
                headers = ["Employee", "Type", "Duration", "Days", "Status"]
                dataRows = previewData.records.map((r: any) => [
                    r.employeeName,
                    r.leaveType,
                    `${r.fromDate} to ${r.toDate}`,
                    r.totalDays,
                    r.status
                ])
            } else if (reportType === 'employee') {
                const hasPhotoCol = showPhotoProof === 'yes'
                headers = hasPhotoCol
                    ? ["Date", "Site / Branch", "Log In", "Log Out", "Hours", "Status", "Photo Proof", "Notes"]
                    : ["Date", "Site / Branch", "Log In", "Log Out", "Hours", "Status", "Notes"]
                
                dataRows = previewData.records.map((r: any) => {
                    const rowVals = [
                        r.date,
                        r.siteName,
                        r.checkIn ? new Date(r.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
                        r.checkOut ? new Date(r.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
                        r.totalHours ? formatDuration(r.totalHours) : '0hrs 0min',
                        getStatusText(r)
                    ]
                    if (hasPhotoCol) rowVals.push(getPhotoProofStatusText(r))
                    rowVals.push(r.notes || "")
                    return rowVals
                })
            } else {
                const hasPhotoCol = showPhotoProof === 'yes'
                headers = hasPhotoCol
                    ? ["Date", "Employee", "Site / Branch", "Log In", "Log Out", "Hours", "Status", "Photo Proof", "Notes"]
                    : ["Date", "Employee", "Site / Branch", "Log In", "Log Out", "Hours", "Status", "Notes"]
                
                dataRows = previewData.records.map((r: any) => {
                    const rowVals = [
                        r.date,
                        r.employeeName,
                        r.siteName,
                        r.checkIn ? new Date(r.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
                        r.checkOut ? new Date(r.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
                        r.totalHours ? formatDuration(r.totalHours) : '0hrs 0min',
                        getStatusText(r)
                    ]
                    if (hasPhotoCol) rowVals.push(getPhotoProofStatusText(r))
                    rowVals.push(r.notes || "")
                    return rowVals
                })
            }

            rows.push(headers)
            dataRows.forEach(dr => rows.push(dr))

            const ws = XLSX.utils.aoa_to_sheet(rows)
            XLSX.utils.book_append_sheet(wb, ws, "Attendance Report")

            XLSX.writeFile(wb, `attendance-${reportType}-${new Date().toISOString().split('T')[0]}.xlsx`)
            toast.dismiss(toastId)
            toast.success("Excel report downloaded successfully!")
        } catch (error: any) {
            console.error(error)
            toast.dismiss(toastId)
            toast.error("Failed to generate Excel report: " + error.message)
        }
    }

    const handleExportPDF = async () => {
        if (!previewData || previewData.records.length === 0) return

        const toastId = toast.loading("Generating PDF report...")
        try {
            const { jsPDF } = await import("jspdf")
            const isLandscape = reportType === 'leave'
            const doc = new jsPDF({ 
                orientation: isLandscape ? 'landscape' : 'portrait' 
            })

            const pageWidth = doc.internal.pageSize.getWidth()
            const pageHeight = doc.internal.pageSize.getHeight()

            // Try to load the logo
            let logoBase64 = '';
            try {
                logoBase64 = await getImageBase64('/logo.png');
            } catch (error) {
                console.error('Failed to load logo, generating PDF without it', error);
            }

            const drawHeader = (pageNum: number) => {
                if (logoBase64) {
                    doc.addImage(logoBase64, 'PNG', 10, 8, 40, 9.7)
                    doc.setFont('helvetica', 'normal')
                    doc.setFontSize(8)
                    doc.setTextColor(71, 85, 105)
                    doc.text("Financial Intelligence Unit", 10, 22)
                } else {
                    doc.setFont('helvetica', 'bold')
                    doc.setFontSize(14)
                    doc.setTextColor(15, 23, 42)
                    doc.text("ACME INTERIORS", 10, 15)

                    doc.setFont('helvetica', 'normal')
                    doc.setFontSize(9)
                    doc.setTextColor(71, 85, 105)
                    doc.text("Financial Intelligence Unit", 10, 20)
                }

                doc.setFont('helvetica', 'bold')
                doc.setFontSize(12)
                doc.setTextColor(15, 23, 42)
                const titleText = `${reportType.toUpperCase().replace('_', ' ')} REPORT`
                doc.text(titleText, pageWidth - 10, 15, { align: 'right' })

                doc.setFont('helvetica', 'normal')
                doc.setFontSize(8)
                doc.setTextColor(100, 116, 139)
                doc.text(`Generated By: ${requestorName}`, pageWidth - 10, 20, { align: 'right' })
                doc.text(`Generated On: ${new Date().toLocaleString('en-IN')}`, pageWidth - 10, 24, { align: 'right' })

                doc.setDrawColor(226, 232, 240)
                doc.setLineWidth(0.5)
                doc.line(10, 28, pageWidth - 10, 28)

                doc.setFont('helvetica', 'italic')
                doc.setFontSize(8)
                doc.setTextColor(148, 163, 184)
                doc.text(`Page ${pageNum}`, pageWidth - 10, pageHeight - 10, { align: 'right' })
                doc.text("Acme Interiors - Confidential FIU", 10, pageHeight - 10)
            }

            let currentPage = 1
            drawHeader(currentPage)

            let startY = 34
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(10)
            doc.setTextColor(15, 23, 42)
            doc.text("Report Summary", 10, startY)
            startY += 4

            doc.setFillColor(248, 250, 252)
            doc.rect(10, startY, pageWidth - 20, 16, 'F')
            doc.setDrawColor(226, 232, 240)
            doc.rect(10, startY, pageWidth - 20, 16)

            doc.setFont('helvetica', 'normal')
            doc.setFontSize(8)
            doc.setTextColor(71, 85, 105)

            const sum = previewData.summary
            if (reportType === 'monthly' || reportType === 'custom_range') {
                doc.text(`Total Records: ${sum.totalRecords}`, 15, startY + 6)
                doc.text(`Present Count: ${sum.presentCount}`, 15, startY + 11)
                doc.text(`Absent Count: ${sum.absentCount}`, 70, startY + 6)
                doc.text(`Leave Count: ${sum.leaveCount}`, 70, startY + 11)
                doc.text(`Holiday Count: ${sum.holidayCount || 0}`, 130, startY + 6)
                doc.text(`Total Hours: ${formatDuration(sum.totalHours)}`, 130, startY + 11)
            } else if (reportType === 'employee') {
                doc.text(`Employee: ${sum.employeeName} (${sum.role})`, 15, startY + 6)
                doc.text(`Present Days: ${sum.totalPresentDays}`, 15, startY + 11)
                doc.text(`Absent Days: ${sum.totalAbsentDays}`, 70, startY + 6)
                doc.text(`Leave Days: ${sum.totalLeaveDays}`, 70, startY + 11)
                doc.text(`Holiday Days: ${sum.totalHolidayDays || 0}`, 130, startY + 6)
                doc.text(`Total Hours: ${formatDuration(sum.totalHours)}`, 130, startY + 11)
            } else if (reportType === 'site') {
                doc.text(`Site: ${sum.siteName}`, 15, startY + 6)
                doc.text(`Total Staff Worked: ${sum.totalStaffWorked}`, 15, startY + 11)
                doc.text(`Total Hours Worked: ${formatDuration(sum.totalHours)}`, 65, startY + 6)
                doc.text(`Present / Absent / Leave: ${sum.presentCount} / ${sum.absentCount} / ${sum.leaveCount}`, 65, startY + 11)
                doc.text(`Holiday Count: ${sum.holidayCount || 0}`, 165, startY + 6)
            } else if (reportType === 'leave') {
                doc.text(`Total Requests: ${sum.totalLeaves}`, 15, startY + 6)
                doc.text(`Approved: ${sum.approvedCount}`, 15, startY + 11)
                doc.text(`Pending: ${sum.pendingCount}`, 70, startY + 6)
                doc.text(`Rejected: ${sum.rejectedCount}`, 70, startY + 11)
                doc.text(`Cancelled: ${sum.cancelledCount}`, 130, startY + 6)
            }

            startY += 24
            doc.setFont('helvetica', 'bold')
            doc.setFontSize(10)
            doc.setTextColor(15, 23, 42)
            doc.text("Detailed Logs", 10, startY)
            startY += 4

            let cols: { header: string; width: number }[] = []
            if (reportType === 'leave') {
                cols = [
                    { header: "Employee", width: 40 },
                    { header: "Type", width: 35 },
                    { header: "Duration", width: 55 },
                    { header: "Days", width: 30 },
                    { header: "Status", width: 30 }
                ]
            } else if (reportType === 'employee') {
                cols = showPhotoProof === 'yes' ? [
                    { header: "Date", width: 20 },
                    { header: "Site / Branch", width: 35 },
                    { header: "In", width: 16 },
                    { header: "Out", width: 16 },
                    { header: "Hours", width: 16 },
                    { header: "Status", width: 22 },
                    { header: "Photo Proof", width: 18 },
                    { header: "Notes", width: 47 }
                ] : [
                    { header: "Date", width: 20 },
                    { header: "Site / Branch", width: 45 },
                    { header: "In", width: 18 },
                    { header: "Out", width: 18 },
                    { header: "Hours", width: 18 },
                    { header: "Status", width: 25 },
                    { header: "Notes", width: 46 }
                ]
            } else {
                cols = showPhotoProof === 'yes' ? [
                    { header: "Date", width: 18 },
                    { header: "Employee", width: 25 },
                    { header: "Site / Branch", width: 25 },
                    { header: "In", width: 16 },
                    { header: "Out", width: 16 },
                    { header: "Hours", width: 16 },
                    { header: "Status", width: 20 },
                    { header: "Photo Proof", width: 18 },
                    { header: "Notes", width: 36 }
                ] : [
                    { header: "Date", width: 18 },
                    { header: "Employee", width: 28 },
                    { header: "Site / Branch", width: 32 },
                    { header: "In", width: 18 },
                    { header: "Out", width: 18 },
                    { header: "Hours", width: 18 },
                    { header: "Status", width: 22 },
                    { header: "Notes", width: 36 }
                ]
            }

            const drawTableHeader = (yPos: number) => {
                doc.setFillColor(241, 245, 249)
                doc.rect(10, yPos, pageWidth - 20, 7, 'F')
                doc.setDrawColor(203, 213, 225)
                doc.setLineWidth(0.2)
                doc.rect(10, yPos, pageWidth - 20, 7)

                doc.setFont('helvetica', 'bold')
                doc.setFontSize(7.5)
                doc.setTextColor(51, 65, 85)

                let currentX = 10
                cols.forEach(col => {
                    doc.text(col.header, currentX + 2, yPos + 4.8)
                    currentX += col.width
                })
            }

            drawTableHeader(startY)
            let y = startY + 7

            previewData.records.forEach((r: any, idx: number) => {
                if (y > pageHeight - 18) {
                    doc.addPage()
                    currentPage++
                    drawHeader(currentPage)
                    y = 34
                    drawTableHeader(y)
                    y += 7
                }

                if (idx % 2 === 1) {
                    doc.setFillColor(248, 250, 252)
                    doc.rect(10, y, pageWidth - 20, 7, 'F')
                }

                doc.setDrawColor(241, 245, 249)
                doc.rect(10, y, pageWidth - 20, 7)

                doc.setFont('helvetica', 'normal')
                doc.setFontSize(7)
                doc.setTextColor(55, 65, 81)

                let currentX = 10
                const inStr = r.checkIn ? new Date(r.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'
                const outStr = r.checkOut ? new Date(r.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'
                const hoursStr = r.totalHours ? formatDuration(r.totalHours) : '0hrs 0min'

                let vals: string[] = []
                if (reportType === 'leave') {
                    vals = [
                        r.employeeName.substring(0, 25),
                        r.leaveType,
                        `${r.fromDate} to ${r.toDate}`,
                        String(r.totalDays),
                        r.status
                    ]
                } else if (reportType === 'employee') {
                    const hasPhotoCol = showPhotoProof === 'yes'
                    vals = [
                        r.date,
                        r.siteName.substring(0, 30),
                        inStr,
                        outStr,
                        hoursStr,
                        getStatusText(r)
                    ]
                    if (hasPhotoCol) vals.push(getPhotoProofStatusText(r))
                    vals.push((r.notes || "").substring(0, hasPhotoCol ? 32 : 40))
                } else {
                    const hasPhotoCol = showPhotoProof === 'yes'
                    vals = [
                        r.date,
                        r.employeeName.substring(0, 18),
                        r.siteName.substring(0, 18),
                        inStr,
                        outStr,
                        hoursStr,
                        getStatusText(r)
                    ]
                    if (hasPhotoCol) vals.push(getPhotoProofStatusText(r))
                    vals.push((r.notes || "").substring(0, hasPhotoCol ? 24 : 32))
                }

                const isSunday = r.date ? (() => {
                    const [yr, mt, dy] = r.date.split("-").map(Number)
                    return new Date(Date.UTC(yr, mt - 1, dy)).getUTCDay() === 0
                })() : false

                vals.forEach((val, colIdx) => {
                    const isStatusCol = cols[colIdx].header === "Status"
                    const isDateCol = cols[colIdx].header === "Date"
                    const isPhotoCol = cols[colIdx].header === "Photo Proof"
                    if (isStatusCol && (val === 'Absent' || val === 'rejected')) {
                        doc.setTextColor(239, 68, 68)
                    } else if (isStatusCol && (val === 'Present' || val === 'approved')) {
                        doc.setTextColor(16, 185, 129)
                    } else if (isStatusCol && (r.status === 'holiday' || r.status === 'Holiday')) {
                        doc.setTextColor(124, 58, 237) // Premium Violet for Sunday and Holidays
                    } else if (isDateCol && isSunday) {
                        doc.setTextColor(124, 58, 237) // Premium Violet for Sunday Date
                    } else if (isPhotoCol && val === 'Yes') {
                        doc.setTextColor(16, 185, 129) // Green for Yes (photo uploaded)
                    } else if (isPhotoCol && val === 'No') {
                        doc.setTextColor(239, 68, 68) // Red for No (photo missing)
                    } else {
                        doc.setTextColor(55, 65, 81)
                    }
                    doc.text(val, currentX + 2, y + 4.8)
                    currentX += cols[colIdx].width
                })

                y += 7
            })

            doc.save(`attendance-${reportType}-${new Date().toISOString().split('T')[0]}.pdf`)
            toast.dismiss(toastId)
            toast.success("PDF report downloaded successfully!")
        } catch (error: any) {
            console.error(error)
            toast.dismiss(toastId)
            toast.error("Failed to generate PDF report: " + error.message)
        }
    }

    const handleDownloadClick = () => {
        if (!previewData || previewData.records.length === 0) {
            toast.error("No data available to download.")
            return
        }

        if (exportFormat === "csv") {
            handleExportCSV()
        } else if (exportFormat === "xlsx") {
            handleExportExcel()
        } else {
            handleExportPDF()
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl bg-slate-900 text-white border border-slate-800 shadow-2xl rounded-3xl p-0 max-h-[92vh] overflow-y-auto">
                <DialogHeader className="p-6 pb-2 border-b border-slate-800">
                    <DialogTitle className="text-2xl font-black text-white flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                            <FileText className="h-5 w-5" />
                        </div>
                        Generate Attendance Report
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-400 mt-1 font-medium italic">
                        Generate and download reports filtered by date ranges, sites, or specific employees.
                    </DialogDescription>
                </DialogHeader>

                <div className="p-6 space-y-6">
                    {/* Setup Filters Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-950/40 p-5 rounded-2xl border border-slate-800/60">
                        {/* A) Report Type Selection */}
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Report Type
                            </Label>
                            <Select value={reportType} onValueChange={setReportType}>
                                <SelectTrigger className="w-full h-11 bg-slate-800/80 border-slate-700/80 font-bold text-sm text-white">
                                    <SelectValue placeholder="Select Report Type" />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-800 text-white border-slate-700">
                                    {REPORT_TYPES.map(t => (
                                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* B) Date Pickers depending on Report Type */}
                        {reportType === "monthly" ? (
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    Select Month
                                </Label>
                                <Input 
                                    type="month"
                                    required
                                    value={month}
                                    onChange={(e) => setMonth(e.target.value)}
                                    className="h-11 bg-slate-800/80 border-slate-700/80 text-white font-medium focus:ring-primary focus:border-primary"
                                />
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        From Date
                                    </Label>
                                    <Input 
                                        type="date"
                                        required
                                        value={fromDate}
                                        onChange={(e) => setFromDate(e.target.value)}
                                        className="h-11 bg-slate-800/80 border-slate-700/80 text-white font-medium"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        To Date
                                    </Label>
                                    <Input 
                                        type="date"
                                        required
                                        value={toDate}
                                        min={fromDate}
                                        onChange={(e) => setToDate(e.target.value)}
                                        className="h-11 bg-slate-800/80 border-slate-700/80 text-white font-medium"
                                    />
                                </div>
                            </div>
                        )}

                        {/* C) Additional Filters based on type */}
                        {/* Employee Select */}
                        {reportType !== "site" && (
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                    <User className="h-3 w-3" /> Select Employee
                                </Label>
                                <Select 
                                    value={selectedEmployeeId} 
                                    onValueChange={setSelectedEmployeeId}
                                    disabled={!isAdmin}
                                >
                                    <SelectTrigger className="w-full h-11 bg-slate-800/80 border-slate-700/80 font-bold text-sm text-white">
                                        <SelectValue placeholder="All Employees" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-800 text-white border-slate-700">
                                        {isAdmin && <SelectItem value="ALL">All Employees</SelectItem>}
                                        {activeUsers.map(u => (
                                            <SelectItem key={u._id} value={u._id}>{u.name} ({u.role})</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Site Select */}
                        {reportType !== "employee" && reportType !== "leave" && (
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                    <Building2 className="h-3 w-3" /> Select Site / Branch
                                </Label>
                                <Select 
                                    value={selectedSiteId} 
                                    onValueChange={setSelectedSiteId}
                                    disabled={!isAdmin}
                                >
                                    <SelectTrigger className="w-full h-11 bg-slate-800/80 border-slate-700/80 font-bold text-sm text-white">
                                        <SelectValue placeholder="All Sites" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-800 text-white border-slate-700">
                                        <SelectItem value="ALL">All Sites</SelectItem>
                                        {sites?.map(s => (
                                            <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Status Select for Attendance logs */}
                        {reportType !== "leave" && (
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    Attendance Status
                                </Label>
                                <Select value={statusFilter} onValueChange={setStatusFilter}>
                                    <SelectTrigger className="w-full h-11 bg-slate-800/80 border-slate-700/80 font-bold text-sm text-white">
                                        <SelectValue placeholder="All Statuses" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-800 text-white border-slate-700">
                                        <SelectItem value="ALL">All Statuses</SelectItem>
                                        <SelectItem value="Present">Present</SelectItem>
                                        <SelectItem value="Late">Late</SelectItem>
                                        <SelectItem value="Half-day">Half-day</SelectItem>
                                        <SelectItem value="Absent">Absent</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Proof Status Select */}
                        {reportType !== "leave" && (
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    Photo Proof Status
                                </Label>
                                <Select value={proofStatusFilter} onValueChange={setProofStatusFilter}>
                                    <SelectTrigger className="w-full h-11 bg-slate-800/80 border-slate-700/80 font-bold text-sm text-white">
                                        <SelectValue placeholder="All Statuses" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-800 text-white border-slate-700">
                                        <SelectItem value="ALL">All Statuses</SelectItem>
                                        <SelectItem value="uploaded">Uploaded (Proof Attached)</SelectItem>
                                        <SelectItem value="missing">Missing Proof (Action Required)</SelectItem>
                                        <SelectItem value="not_required">Not Required</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Show Photo Proof Column Select */}
                        {reportType !== "leave" && (
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    Show Photo Proof in Report?
                                </Label>
                                <Select value={showPhotoProof} onValueChange={setShowPhotoProof}>
                                    <SelectTrigger className="w-full h-11 bg-slate-800/80 border-slate-700/80 font-bold text-sm text-white">
                                        <SelectValue placeholder="No" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-800 text-white border-slate-700">
                                        <SelectItem value="yes">Yes</SelectItem>
                                        <SelectItem value="no">No</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Leave Type Select (Leave Report only) */}
                        {reportType === "leave" && (
                            <div className="grid grid-cols-2 gap-3 col-span-1 md:col-span-2">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        Leave Type
                                    </Label>
                                    <Select value={leaveTypeFilter} onValueChange={setLeaveTypeFilter}>
                                        <SelectTrigger className="w-full h-11 bg-slate-800/80 border-slate-700/80 font-bold text-sm text-white">
                                            <SelectValue placeholder="All Leave Types" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-800 text-white border-slate-700">
                                            <SelectItem value="ALL">All Leave Types</SelectItem>
                                            {LEAVE_TYPES.map(t => (
                                                <SelectItem key={t} value={t}>{t}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        Leave Request Status
                                    </Label>
                                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                                        <SelectTrigger className="w-full h-11 bg-slate-800/80 border-slate-700/80 font-bold text-sm text-white">
                                            <SelectValue placeholder="All Statuses" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-800 text-white border-slate-700">
                                            <SelectItem value="ALL">All Statuses</SelectItem>
                                            <SelectItem value="pending">Pending</SelectItem>
                                            <SelectItem value="approved">Approved</SelectItem>
                                            <SelectItem value="rejected">Rejected</SelectItem>
                                            <SelectItem value="cancelled">Cancelled</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}

                        {/* D) Format selection */}
                        <div className="space-y-2 md:col-span-2 border-t border-slate-800/80 pt-4 mt-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Download Export Format
                            </Label>
                            <div className="grid grid-cols-3 gap-3">
                                {["pdf", "csv", "xlsx"].map(format => (
                                    <button
                                        key={format}
                                        type="button"
                                        onClick={() => setExportFormat(format)}
                                        className={`h-11 rounded-xl font-bold uppercase text-xs tracking-wider border transition-all ${
                                            exportFormat === format 
                                                ? "bg-primary border-primary text-white shadow-md shadow-primary/10" 
                                                : "bg-slate-800/40 border-slate-700 text-slate-300 hover:bg-slate-800"
                                        }`}
                                    >
                                        {format === "xlsx" ? "Excel (.xlsx)" : format.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Preview Section */}
                    {loadingPreview ? (
                        <div className="h-44 flex flex-col items-center justify-center gap-3 bg-slate-950/20 rounded-2xl border border-slate-800/40">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-xs text-slate-400 font-bold tracking-wider uppercase animate-pulse">
                                Fetching report preview...
                            </p>
                        </div>
                    ) : previewData ? (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                                <h3 className="text-sm font-black text-slate-200 uppercase tracking-wider">
                                    Report Preview Summary
                                </h3>
                                <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">
                                    {previewData.totalCount} records matched
                                </span>
                            </div>

                            {/* Summary cards layout */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                {(reportType === 'monthly' || reportType === 'custom_range') && (
                                    <>
                                        <div className="bg-slate-950/30 border border-slate-800/80 p-3 rounded-xl">
                                            <span className="text-[9px] font-black uppercase text-slate-400 block tracking-widest">Total logs</span>
                                            <span className="text-lg font-black text-white">{previewData.summary.totalRecords}</span>
                                        </div>
                                        <div className="bg-slate-950/30 border border-slate-800/80 p-3 rounded-xl">
                                            <span className="text-[9px] font-black uppercase text-slate-400 block tracking-widest">Present Count</span>
                                            <span className="text-lg font-black text-emerald-500">{previewData.summary.presentCount}</span>
                                        </div>
                                        <div className="bg-slate-950/30 border border-slate-800/80 p-3 rounded-xl">
                                            <span className="text-[9px] font-black uppercase text-slate-400 block tracking-widest">Absent Count</span>
                                            <span className="text-lg font-black text-rose-500">{previewData.summary.absentCount}</span>
                                        </div>
                                        <div className="bg-slate-950/30 border border-slate-800/80 p-3 rounded-xl">
                                            <span className="text-[9px] font-black uppercase text-slate-400 block tracking-widest">Leave Count</span>
                                            <span className="text-lg font-black text-sky-500">{previewData.summary.leaveCount}</span>
                                        </div>
                                    </>
                                )}
                                {reportType === 'employee' && (
                                    <>
                                        <div className="bg-slate-950/30 border border-slate-800/80 p-3 rounded-xl">
                                            <span className="text-[9px] font-black uppercase text-slate-400 block tracking-widest">Present / Absent</span>
                                            <span className="text-base font-black text-white">
                                                {previewData.summary.totalPresentDays}d / {previewData.summary.totalAbsentDays}d
                                            </span>
                                        </div>
                                        <div className="bg-slate-950/30 border border-slate-800/80 p-3 rounded-xl">
                                            <span className="text-[9px] font-black uppercase text-slate-400 block tracking-widest">Leave Days</span>
                                            <span className="text-lg font-black text-sky-500">{previewData.summary.totalLeaveDays}d</span>
                                        </div>
                                        <div className="bg-slate-950/30 border border-slate-800/80 p-3 rounded-xl">
                                            <span className="text-[9px] font-black uppercase text-slate-400 block tracking-widest">Hours Worked</span>
                                            <span className="text-lg font-black text-indigo-500">{formatDuration(previewData.summary.totalHours)}</span>
                                        </div>
                                        <div className="bg-slate-950/30 border border-slate-800/80 p-3 rounded-xl">
                                            <span className="text-[9px] font-black uppercase text-slate-400 block tracking-widest">Late Logs</span>
                                            <span className="text-lg font-black text-amber-500">{previewData.summary.lateCount}</span>
                                        </div>
                                    </>
                                )}
                                {reportType === 'site' && (
                                    <>
                                        <div className="bg-slate-950/30 border border-slate-800/80 p-3 rounded-xl col-span-2">
                                            <span className="text-[9px] font-black uppercase text-slate-400 block tracking-widest">Site Name</span>
                                            <span className="text-sm font-black text-white truncate block">{previewData.summary.siteName}</span>
                                        </div>
                                        <div className="bg-slate-950/30 border border-slate-800/80 p-3 rounded-xl">
                                            <span className="text-[9px] font-black uppercase text-slate-400 block tracking-widest">Staff Worked</span>
                                            <span className="text-lg font-black text-white">{previewData.summary.totalStaffWorked}</span>
                                        </div>
                                        <div className="bg-slate-950/30 border border-slate-800/80 p-3 rounded-xl">
                                            <span className="text-[9px] font-black uppercase text-slate-400 block tracking-widest">Hours Worked</span>
                                            <span className="text-lg font-black text-primary">{formatDuration(previewData.summary.totalHours)}</span>
                                        </div>
                                    </>
                                )}
                                {reportType === 'leave' && (
                                    <>
                                        <div className="bg-slate-950/30 border border-slate-800/80 p-3 rounded-xl">
                                            <span className="text-[9px] font-black uppercase text-slate-400 block tracking-widest">Total Requests</span>
                                            <span className="text-lg font-black text-white">{previewData.summary.totalLeaves}</span>
                                        </div>
                                        <div className="bg-slate-950/30 border border-slate-800/80 p-3 rounded-xl">
                                            <span className="text-[9px] font-black uppercase text-slate-400 block tracking-widest">Approved Requests</span>
                                            <span className="text-lg font-black text-emerald-500">{previewData.summary.approvedCount}</span>
                                        </div>
                                        <div className="bg-slate-950/30 border border-slate-800/80 p-3 rounded-xl">
                                            <span className="text-[9px] font-black uppercase text-slate-400 block tracking-widest">Pending Requests</span>
                                            <span className="text-lg font-black text-amber-500 animate-pulse">{previewData.summary.pendingCount}</span>
                                        </div>
                                        <div className="bg-slate-950/30 border border-slate-800/80 p-3 rounded-xl">
                                            <span className="text-[9px] font-black uppercase text-slate-400 block tracking-widest">Rejected Requests</span>
                                            <span className="text-lg font-black text-rose-500">{previewData.summary.rejectedCount}</span>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Mini detailed table preview (first 5 records) */}
                            {previewData.records.length > 0 ? (
                                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/20 max-h-56 overflow-y-auto">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="bg-slate-800/60 text-slate-300 font-bold border-b border-slate-800 uppercase text-[9px] tracking-wider">
                                                {reportType === "leave" ? (
                                                    <>
                                                        <th className="p-2.5">Employee</th>
                                                        <th className="p-2.5">Type</th>
                                                        <th className="p-2.5">Duration</th>
                                                        <th className="p-2.5 text-center">Days</th>
                                                        <th className="p-2.5 text-right">Status</th>
                                                    </>
                                                ) : (
                                                    <>
                                                        <th className="p-2.5">Date</th>
                                                        {reportType !== "employee" && <th className="p-2.5">Employee</th>}
                                                        <th className="p-2.5">Site / Branch</th>
                                                        <th className="p-2.5 text-center">Log In</th>
                                                        <th className="p-2.5 text-center">Log Out</th>
                                                        <th className="p-2.5 text-center">Hours</th>
                                                        {showPhotoProof === 'yes' && <th className="p-2.5">Photo Proof</th>}
                                                        <th className="p-2.5">Notes</th>
                                                        <th className="p-2.5 text-right">Status</th>
                                                    </>
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/60 text-slate-300">
                                            {previewData.records.slice(0, 5).map((row: any, rIdx: number) => (
                                                <tr key={rIdx} className="hover:bg-slate-800/20 transition-colors">
                                                    {reportType === "leave" ? (
                                                        <>
                                                            <td className="p-2.5 font-bold text-white">{row.employeeName}</td>
                                                            <td className="p-2.5 text-slate-400">{row.leaveType}</td>
                                                            <td className="p-2.5 text-slate-400 font-medium">{row.fromDate} to {row.toDate}</td>
                                                            <td className="p-2.5 text-center text-primary font-black">{row.totalDays}</td>
                                                            <td className="p-2.5 text-right">
                                                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                                                                    row.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500' :
                                                                    row.status === 'pending' ? 'bg-amber-500/10 text-amber-500' : 'bg-rose-500/10 text-rose-500'
                                                                }`}>
                                                                    {row.status}
                                                                </span>
                                                            </td>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <td className={`p-2.5 font-medium tabular-nums ${
                                                                (() => {
                                                                    const [yr, mt, dy] = row.date.split("-").map(Number);
                                                                    const isSunday = new Date(Date.UTC(yr, mt - 1, dy)).getUTCDay() === 0;
                                                                    return isSunday ? 'text-violet-400 font-bold' : 'text-slate-300';
                                                                })()
                                                            }`}>{row.date}</td>
                                                            {reportType !== "employee" && <td className="p-2.5 font-bold text-white">{row.employeeName}</td>}
                                                            <td className="p-2.5 text-slate-400">{row.siteName}</td>
                                                            <td className="p-2.5 text-center tabular-nums text-slate-300">
                                                                {row.checkIn ? new Date(row.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                                            </td>
                                                            <td className="p-2.5 text-center tabular-nums text-slate-300">
                                                                {row.checkOut ? new Date(row.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                                            </td>
                                                            <td className="p-2.5 text-center tabular-nums font-black text-primary">
                                                                {row.totalHours ? formatDuration(row.totalHours) : '0hrs 0min'}
                                                            </td>
                                                            {showPhotoProof === 'yes' && (
                                                                 <td className="p-2.5">
                                                                     <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                                                                         row.photoRequired === true ? (
                                                                             row.photoStatus === 'uploaded' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                                                                         ) : 'bg-slate-800 text-slate-500'
                                                                     }`}>
                                                                         {getPhotoProofStatusText(row)}
                                                                     </span>
                                                                 </td>
                                                             )}
                                                            <td className="p-2.5 text-slate-400 truncate max-w-[120px]">{row.notes || "-"}</td>
                                                            <td className="p-2.5 text-right">
                                                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                                                                    row.status === 'Present' ? 'bg-emerald-500/10 text-emerald-500' :
                                                                    row.status === 'Late' ? 'bg-amber-500/10 text-amber-500' :
                                                                    row.status === 'Absent' ? 'bg-rose-500/10 text-rose-500' :
                                                                    (row.status === 'holiday' || row.status === 'Holiday') ? 'bg-violet-500/20 text-violet-400' : 'bg-slate-800 text-slate-400'
                                                                }`}>
                                                                    {getStatusText(row)}
                                                                </span>
                                                            </td>
                                                        </>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {previewData.records.length > 5 && (
                                        <div className="p-2 bg-slate-900 border-t border-slate-800 text-[10px] text-center text-slate-400 font-bold uppercase tracking-wider italic">
                                            + {previewData.records.length - 5} more records will be exported
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="p-8 text-center bg-slate-950/20 rounded-xl border border-slate-800/80 text-xs italic text-slate-400 flex items-center justify-center gap-2">
                                    <Info className="h-4 w-4 text-amber-500" />
                                    No records found for selected report filters.
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="p-8 text-center bg-slate-950/10 rounded-2xl border border-slate-800/40 text-xs text-slate-400 font-medium italic">
                            Select filters and click "Preview Report" above to review before exporting.
                        </div>
                    )}
                </div>

                <DialogFooter className="p-6 border-t border-slate-800 flex items-center justify-between gap-3 w-full">
                    <Button 
                        type="button" 
                        variant="ghost" 
                        onClick={onClose}
                        className="font-bold text-xs text-slate-400 hover:text-white"
                    >
                        Cancel
                    </Button>
                    <div className="flex items-center gap-3">
                        <Button
                            type="button"
                            onClick={handlePreviewClick}
                            disabled={loadingPreview}
                            className="font-bold text-xs uppercase tracking-wider gap-2 border border-slate-700 bg-slate-800 hover:bg-slate-750 text-white"
                        >
                            <Eye className="h-4 w-4" />
                            Preview Report
                        </Button>
                        <Button
                            type="button"
                            onClick={handleDownloadClick}
                            disabled={!previewData || previewData.records.length === 0}
                            className="font-bold text-xs uppercase tracking-wider gap-2 bg-primary hover:bg-primary/95 text-white shadow-lg"
                        >
                            <Download className="h-4 w-4" />
                            Download Report
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
