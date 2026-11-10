'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useAction } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { 
  X, 
  Loader2, 
  Download, 
  CheckCircle2, 
  Calendar, 
  DollarSign, 
  Clock, 
  AlertCircle, 
  FileText 
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { jsPDF } from 'jspdf'

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

interface HrPayrollGeneratorProps {
  open: boolean
  onClose: () => void
  preselectedUserId?: string
  initialMode?: 'payslip' | 'calculator'
  requestorEmail: string
}

export default function HrPayrollGenerator({ open, onClose, preselectedUserId, initialMode = 'payslip', requestorEmail }: HrPayrollGeneratorProps) {
  const members = useQuery(api.hr_documents.getMembersForDocumentGeneration, open && requestorEmail ? { requestorEmail } : "skip")
  const updateUserComprehensive = useAction(api.users.updateUserComprehensive)
  const saveUserDocument = useMutation(api.user_documents.saveUserDocument)
  const generateUploadUrl = useMutation(api.user_documents.generateUploadUrl)

  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1) // 1-indexed

  // UI state
  const [overrideSalary, setOverrideSalary] = useState<string>('')
  const [isUpdatingSalary, setIsUpdatingSalary] = useState(false)
  const [isIssuing, setIsIssuing] = useState(false)
  const [isIssued, setIsIssued] = useState(false)
  const [logoBase64, setLogoBase64] = useState<string>('')

  // New Profile Overrides
  const [bankName, setBankName] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [pan, setPan] = useState('')
  const [pfNumber, setPfNumber] = useState('')
  const [pfUan, setPfUan] = useState('')
  const [esicNo, setEsicNo] = useState('')
  const [location, setLocation] = useState('')

  // Attendance Overrides
  const [standardDays, setStandardDays] = useState<number>(30)
  const [lopDays, setLopDays] = useState<number>(0)
  const [workDays, setWorkDays] = useState<number>(30)

  // Deduction Overrides
  const [providentFund, setProvidentFund] = useState<string>('0')
  const [professionalTax, setProfessionalTax] = useState<string>('0')
  const [incomeTax, setIncomeTax] = useState<string>('0')
  const [esicDeduction, setEsicDeduction] = useState<string>('0')
  const [customDeductionLabel, setCustomDeductionLabel] = useState('Other Deduction')
  const [customDeduction, setCustomDeduction] = useState<string>('0')

  // Load company logo
  useEffect(() => {
    const loadLogo = async () => {
      try {
        const base64 = await getImageBase64('/logo.png')
        setLogoBase64(base64)
      } catch (err) {
        console.error("Failed to load company logo image", err)
      }
    }
    loadLogo()
  }, [])
  
  // Preselect from props
  useEffect(() => {
    if (preselectedUserId && open) {
      setSelectedUserId(preselectedUserId)
    }
  }, [preselectedUserId, open])

  // Get dynamic employee profile to verify salary
  const employee = members?.find(m => m._id === selectedUserId)

  // Auto set override fields when employee changes
  useEffect(() => {
    if (employee) {
      setOverrideSalary(employee.salary ? String(employee.salary) : '')
      setBankName(employee.bankName || '')
      setBankAccount(employee.bankAccount || '')
      setPan(employee.pan || '')
      setPfNumber(employee.pfNumber || '')
      setPfUan(employee.pfUan || '')
      setEsicNo(employee.esicNo || '')
      setLocation(employee.location || '')
      setIsIssued(false)
    } else {
      setBankName('')
      setBankAccount('')
      setPan('')
      setPfNumber('')
      setPfUan('')
      setEsicNo('')
      setLocation('')
    }
  }, [employee])

  // Fetch dynamic calculations from Convex
  const calculationData = useQuery(
    api.hr_documents.calculateSalaryDetails,
    selectedUserId && open
      ? {
          userId: selectedUserId as any,
          year: Number(selectedYear),
          month: Number(selectedMonth),
          requestorEmail
        }
      : "skip"
  )

  // Update attendance days and deductions when calculationData or selection changes
  useEffect(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate()
    setStandardDays(daysInMonth)
    
    if (calculationData?.summary) {
      const summary = calculationData.summary
      const lop = (summary.absents || 0) + (summary.unpaidLeaves || 0)
      setLopDays(lop)
      setWorkDays(Math.max(0, daysInMonth - lop))
    } else {
      setLopDays(0)
      setWorkDays(daysInMonth)
    }
    
    setProvidentFund('0')
    setProfessionalTax('0')
    setIncomeTax('0')
    setEsicDeduction('0')
    setCustomDeduction('0')
    setCustomDeductionLabel('Other Deduction')
    setIsIssued(false)
  }, [selectedUserId, selectedMonth, selectedYear, calculationData])

  const handleStandardDaysChange = (val: string) => {
    const sDays = Number(val) || 0
    setStandardDays(sDays)
    setWorkDays(Math.max(0, sDays - lopDays))
  }

  const handleLopDaysChange = (val: string) => {
    const lDays = Number(val) || 0
    setLopDays(lDays)
    setWorkDays(Math.max(0, standardDays - lDays))
  }

  // Handle salary profile update
  const saveSalaryToProfile = async () => {
    if (!selectedUserId || !overrideSalary || isNaN(Number(overrideSalary))) {
      toast({ title: "Validation Error", variant: "destructive", description: "Please enter a valid salary amount." })
      return
    }

    setIsUpdatingSalary(true)
    try {
      const u = members?.find(m => m._id === selectedUserId)
      if (!u) throw new Error("Operative not found")

      await updateUserComprehensive({
        userId: selectedUserId as any,
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status || 'active',
        salary: Number(overrideSalary),
      })
      toast({ title: "Salary Set", description: `Updated ${u.name}'s profile salary to Rs. ${Number(overrideSalary).toLocaleString('en-IN')}` })
    } catch (err: any) {
      toast({ title: "Update Failed", variant: "destructive", description: err.message || "Failed to update profile." })
    } finally {
      setIsUpdatingSalary(false)
    }
  }

  // Month names helper
  const getMonthName = (m: number) => {
    const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
    return names[m - 1]
  }

  // Draw payslip PDF vector text to match the requested layout style
  // Draw payslip PDF vector text to match the requested layout style
  // Draw payslip PDF vector text to match the requested layout style
  const generatePayslipPdfBlob = (salary: number, summary: any): Blob => {
    const numberToWords = (num: number): string => {
      const a = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '];
      const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

      if (num === 0) return 'zero';

      const g = (n: number): string => {
        if (n < 20) return a[n];
        const digit = n % 10;
        return b[Math.floor(n / 10)] + (digit ? '-' + a[digit] : ' ');
      };

      const h = (n: number): string => {
        if (n >= 100) {
          return a[Math.floor(n / 100)] + 'hundred ' + (n % 100 ? 'and ' + g(n % 100) : '');
        }
        return g(n);
      };

      let str = '';
      let temp = num;

      if (temp >= 10000000) {
        str += h(Math.floor(temp / 10000000)) + 'crore ';
        temp %= 10000000;
      }
      if (temp >= 100000) {
        str += h(Math.floor(temp / 100000)) + 'lakh ';
        temp %= 100000;
      }
      if (temp >= 1000) {
        str += h(Math.floor(temp / 1000)) + 'thousand ';
        temp %= 1000;
      }
      if (temp > 0) {
        str += h(temp);
      }

      return str.trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') + ' Only';
    };

    const doc = new jsPDF({ format: 'a4', unit: 'mm' })
    
    // Brand design tokens
    const brandPrimary = [22, 60, 68];       // `#163C44`
    const brandAccent = [45, 117, 130];      // `#2D7582`
    const brandLightBg = [248, 250, 252];    // Slate 50
    const brandLightBorder = [235, 242, 244]; // Extremely light grey-teal border
    
    const drawLogoFallback = (doc: jsPDF, x: number, y: number) => {
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.1);
      for (let i = 0; i <= 15; i += 3) {
        doc.line(x + i, y, x + i, y + 15);
        doc.line(x, y + i, x + 15, y + i);
      }
      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.2);
      doc.rect(x, y, 15, 15);

      doc.setDrawColor(brandAccent[0], brandAccent[1], brandAccent[2]);
      doc.setLineWidth(0.6);
      doc.line(x + 3, y + 4, x + 9, y + 4);
      doc.line(x + 3, y + 4, x + 3, y + 11);
      doc.line(x + 3, y + 11, x + 9, y + 11);
      
      doc.setDrawColor(brandPrimary[0], brandPrimary[1], brandPrimary[2]);
      doc.setLineWidth(0.6);
      doc.line(x + 6, y + 8, x + 12, y + 8);
      doc.line(x + 12, y + 8, x + 12, y + 13);
      doc.line(x + 6, y + 13, x + 12, y + 13);
    };

    // Header logo
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, 'PNG', 20, 15, 45, 11.25);
      } catch (e) {
        drawLogoFallback(doc, 20, 15);
      }
    } else {
      drawLogoFallback(doc, 20, 15);
    }

    // Header Right
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(brandPrimary[0], brandPrimary[1], brandPrimary[2]);
    doc.text("PAYSLIP", 190, 20, { align: 'right' });

    // Pay Period Badge
    doc.setFillColor(brandLightBg[0], brandLightBg[1], brandLightBg[2]);
    doc.roundedRect(148, 23.5, 42, 5.5, 1, 1, 'F');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(brandAccent[0], brandAccent[1], brandAccent[2]);
    doc.text(getMonthName(selectedMonth).toUpperCase() + " " + selectedYear, 169, 27.5, { align: 'center' });

    // Company Tagline
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(brandAccent[0], brandAccent[1], brandAccent[2]);
    doc.text("INTERIOR SOLUTIONS", 20, 31);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text("221 Demo Street, Hyderabad - 500001, India", 20, 35);
    doc.text("email: hello@example.com  |  web: www.example.com  |  phone: +91 90000 00000", 20, 38.5);

    // Divider
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(20, 41, 190, 41);

    // 3. Employee Profile Grid (2-column layout, 7 rows)
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    
    // Outer rect
    doc.rect(20, 46, 170, 42);
    
    // Column dividers
    doc.line(55, 46, 55, 88);
    doc.line(105, 46, 105, 88);
    doc.line(140, 46, 140, 88);
    
    // Row dividers
    for (let i = 1; i < 7; i++) {
      doc.line(20, 46 + i * 6, 190, 46 + i * 6);
    }
    
    // Fill labels
    doc.setFillColor(245, 248, 249);
    for (let i = 0; i < 7; i++) {
      doc.rect(20.1, 46.1 + i * 6, 34.8, 5.8, 'F');
      doc.rect(105.1, 46.1 + i * 6, 34.8, 5.8, 'F');
    }

    const drawCell = (row: number, col: 1 | 2, label: string, value: string) => {
      const xLabel = col === 1 ? 22 : 107;
      const xValue = col === 1 ? 57 : 142;
      const y = 46 + row * 6 + 4.2;
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text(label, xLabel, y);
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(22, 60, 68);
      doc.text(String(value), xValue, y);
    };
    
    drawCell(0, 1, "Employee ID", employee?.employeeId || "N/A");
    drawCell(0, 2, "Employee Name", employee?.name || "N/A");
    
    drawCell(1, 1, "Designation", employee?.designation || "Staff");
    drawCell(1, 2, "Location", location || "N/A");
    
    drawCell(2, 1, "Date of Joining", employee?.joiningDate || "N/A");
    drawCell(2, 2, "Bank Name", bankName || "N/A");
    
    drawCell(3, 1, "Bank Account No", bankAccount || "N/A");
    drawCell(3, 2, "PAN", pan || "N/A");
    
    drawCell(4, 1, "PF UAN", pfUan || "N/A");
    drawCell(4, 2, "PF Number", pfNumber || "N/A");
    
    drawCell(5, 1, "ESIC Number", esicNo || "N/A");
    drawCell(5, 2, "Standard Days", String(standardDays));
    
    drawCell(6, 1, "Actual Work Days", String(workDays));
    drawCell(6, 2, "LOP Days", String(lopDays));

    // Calculations
    const baseSalaryVal = Number(overrideSalary) || employee?.salary || 0;
    const standardDaysVal = Number(standardDays) || 30;
    const workDaysVal = Number(workDays) || 0;
    const actualSalaryVal = Math.round(baseSalaryVal * (workDaysVal / standardDaysVal));

    const basicVal = Math.round(baseSalaryVal * 0.60);
    const actualBasicVal = Math.round(actualSalaryVal * 0.60);

    const hraVal = Math.round(baseSalaryVal * 0.30);
    const actualHraVal = Math.round(actualSalaryVal * 0.30);

    const baseSpecialVal = baseSalaryVal - (basicVal + hraVal);
    const actualSpecialVal = actualSalaryVal - (actualBasicVal + actualHraVal);

    const pfVal = Number(providentFund) || 0;
    const ptVal = Number(professionalTax) || 0;
    const itVal = Number(incomeTax) || 0;
    const esicVal = Number(esicDeduction) || 0;
    const customDeductVal = Number(customDeduction) || 0;

    const totalDeductionsVal = pfVal + ptVal + itVal + esicVal + customDeductVal;
    const netPayVal = Math.max(0, actualSalaryVal - totalDeductionsVal);

    // 5. Earnings vs Deductions Table
    doc.setFillColor(22, 60, 68);
    doc.rect(20, 93, 85, 6.5, 'F');
    doc.rect(105, 93, 85, 6.5, 'F');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text("EARNINGS", 22, 97.5);
    doc.text("BASE", 72, 97.5, { align: "right" });
    doc.text("ACTUAL", 102, 97.5, { align: "right" });
    doc.text("DEDUCTIONS", 107, 97.5);
    doc.text("AMOUNT (RS.)", 187, 97.5, { align: "right" });

    const rowYStart = 99.5;
    const rowHeight = 6;

    // Draw grid border for table rows (6 rows = 36 mm)
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.rect(20, rowYStart, 85, 36);
    doc.rect(105, rowYStart, 85, 36);

    for (let i = 1; i < 6; i++) {
      doc.line(20, rowYStart + i * 6, 105, rowYStart + i * 6);
      doc.line(105, rowYStart + i * 6, 190, rowYStart + i * 6);
    }

    // Zebra striping
    doc.setFillColor(250, 252, 253);
    for (let i = 1; i < 6; i += 2) {
      doc.rect(20.1, rowYStart + i * 6 + 0.1, 84.8, 5.8, 'F');
      doc.rect(105.1, rowYStart + i * 6 + 0.1, 84.8, 5.8, 'F');
    }

    const drawEarningsCell = (row: number, label: string, base: number | string, actual: number | string) => {
      const y = rowYStart + row * 6 + 4.2;
      const isTotal = row === 5;
      doc.setFont("helvetica", isTotal ? "bold" : "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(isTotal ? brandPrimary[0] : 71, isTotal ? brandPrimary[1] : 85, isTotal ? brandPrimary[2] : 105);
      doc.text(label, 22, y);
      
      const baseStr = typeof base === 'number' ? Math.round(base).toLocaleString('en-IN') : base;
      const actualStr = typeof actual === 'number' ? Math.round(actual).toLocaleString('en-IN') : actual;
      doc.text(baseStr, 72, y, { align: "right" });
      doc.text(actualStr, 102, y, { align: "right" });
    };

    const drawDeductionsCell = (row: number, label: string, amount: number | string) => {
      const y = rowYStart + row * 6 + 4.2;
      const isTotal = row === 5;
      doc.setFont("helvetica", isTotal ? "bold" : "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(isTotal ? brandPrimary[0] : 71, isTotal ? brandPrimary[1] : 85, isTotal ? brandPrimary[2] : 105);
      doc.text(label, 107, y);
      
      const amountStr = typeof amount === 'number' ? (amount > 0 ? Math.round(amount).toLocaleString('en-IN') : "-") : amount;
      doc.text(amountStr, 187, y, { align: "right" });
    };

    drawEarningsCell(0, "Basic Salary", basicVal, actualBasicVal);
    drawEarningsCell(1, "House Rent Allowance", hraVal, actualHraVal);
    drawEarningsCell(2, "Special Allowance", baseSpecialVal, actualSpecialVal);
    drawEarningsCell(3, "-", "-", "-");
    drawEarningsCell(4, "-", "-", "-");
    drawEarningsCell(5, "Total Gross Earnings", baseSalaryVal, actualSalaryVal);

    drawDeductionsCell(0, "Provident Fund (PF)", pfVal);
    drawDeductionsCell(1, "Professional Tax (PT)", ptVal);
    drawDeductionsCell(2, "Income Tax (IT)", itVal);
    drawDeductionsCell(3, "ESIC", esicVal);
    drawDeductionsCell(4, customDeductionLabel || "Other Deduction", customDeductVal);
    drawDeductionsCell(5, "Total Deductions", totalDeductionsVal);

    // 6. Net Payable Banner Box
    const netPayY = 141;
    doc.setFillColor(brandLightBg[0], brandLightBg[1], brandLightBg[2]);
    doc.roundedRect(20, netPayY, 170, 16, 1, 1, 'F');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(brandAccent[0], brandAccent[1], brandAccent[2]);
    doc.text("NET PAYABLE TAKE-HOME SALARY (ROUNDED)", 24, netPayY + 5);

    doc.setFont("helvetica", "oblique");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(numberToWords(netPayVal), 24, netPayY + 11.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12.5);
    doc.setTextColor(brandPrimary[0], brandPrimary[1], brandPrimary[2]);
    doc.text(`Rs. ${netPayVal.toLocaleString('en-IN')}/-`, 186, netPayY + 10, { align: "right" });

    // 7. Notes
    const noteY = 162;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(brandAccent[0], brandAccent[1], brandAccent[2]);
    doc.text("Notes & Declarations:", 20, noteY);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.8);
    doc.setTextColor(115, 135, 145);
    doc.text("1. This document is a confidential electronic salary record issued by Acme Interiors.", 20, noteY + 3.5);
    doc.text("2. All deductions (including loss-of-pay/absences) have been computed as per the company's approved calendar and attendance files.", 20, noteY + 6.5);

    // 8. Signatures
    const sigY = 200;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(24, sigY, 74, sigY);
    doc.line(136, sigY, 186, sigY);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text("Authorized Signatory", 24, sigY + 4);
    doc.text("Employee Signature", 136, sigY + 4);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text("Acme Interiors", 24, sigY + 7.5);
    doc.text("Acknowledge Receipt of Payment", 136, sigY + 7.5);

    // 9. Footer
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text("This is an electronically generated document. No physical signature is required for validity.", 105, 282, { align: "center" });

    return doc.output('blob')
  }

  const handleDownloadPayslip = () => {
    if (!calculationData || !employee) return

    const summary = calculationData.summary
    const finalSalary = employee.salary || Number(overrideSalary) || 0

    try {
      const blob = generatePayslipPdfBlob(finalSalary, summary)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Payslip_${employee.name.replace(/\s+/g, '_')}_${getMonthName(selectedMonth)}_${selectedYear}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast({ title: "Payslip Exported", description: "Payslip PDF downloaded successfully." })
    } catch (err: any) {
      toast({ title: "Failed to download payslip", variant: "destructive", description: err.message })
    }
  }

  const handleIssuePayslip = async () => {
    if (!calculationData || !employee) return
    setIsIssuing(true)
    const activeToast = toast({ title: "Compiling Payslip", description: "Uploading document files and recording details..." })
    
    try {
      const summary = calculationData.summary
      const finalSalary = employee.salary || Number(overrideSalary) || 0
      const pdfBlob = generatePayslipPdfBlob(finalSalary, summary)

      const standardDaysVal = Number(standardDays) || 30;
      const workDaysVal = Number(workDays) || 0;
      const actualSalaryVal = Math.round(finalSalary * (workDaysVal / standardDaysVal));
      const pfVal = Number(providentFund) || 0;
      const ptVal = Number(professionalTax) || 0;
      const itVal = Number(incomeTax) || 0;
      const esicVal = Number(esicDeduction) || 0;
      const customDeductVal = Number(customDeduction) || 0;
      const totalDeductionsVal = pfVal + ptVal + itVal + esicVal + customDeductVal;
      const netPayVal = Math.max(0, actualSalaryVal - totalDeductionsVal);

      // 1. Generate Upload url from storage
      const uploadUrl = await generateUploadUrl({ requestorEmail })
      
      // 2. Upload file
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "application/pdf" },
        body: pdfBlob
      })
      if (!uploadResponse.ok) throw new Error("Payslip upload failed")
      const { storageId } = await uploadResponse.json()

      // 3. Save into employee document vault
      await saveUserDocument({
        userId: selectedUserId as any,
        userName: employee.name,
        documentTitle: `Salary Payslip - ${getMonthName(selectedMonth)} ${selectedYear}`,
        documentType: "HR Document",
        fileName: `Payslip_${employee.name.replace(/\s+/g, '_')}_${getMonthName(selectedMonth)}_${selectedYear}.pdf`,
        fileType: "application/pdf",
        fileSize: pdfBlob.size,
        storageId: storageId,
        notes: `Salary Slip. Paid Days: ${workDaysVal}, LOP Days: ${lopDays}, Net Payable: Rs. ${netPayVal.toLocaleString('en-IN')}`,
        visibility: "manager_visible",
        requestorEmail
      })

      activeToast.dismiss()
      setIsIssued(true)
      toast({ title: "Payslip Issued", description: "Payslip officially issued and saved to operative's vault." })
    } catch (err: any) {
      activeToast.dismiss()
      toast({ title: "Issue Failed", variant: "destructive", description: err.message })
    } finally {
      setIsIssuing(false)
    }
  }

  if (!open) return null

  // Summary helper fields
  const summary = calculationData?.summary
  const dateBreakdown = calculationData?.dateBreakdown || []

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-950 border border-slate-800 text-white rounded-3xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden shadow-2xl relative">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-primary/10 to-transparent">
          <div>
            <h1 className="text-xl sm:text-2xl font-black italic uppercase tracking-tighter text-white">Payroll & Salary Suite</h1>
            <p className="text-xs text-slate-400 font-medium italic">Exclude holidays and calculate payroll based on attendance files.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl hover:bg-rose-500/10 hover:text-rose-500">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content Wrapper */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          
          {/* Inputs Section */}
          <div className="w-full md:w-1/3 p-6 border-r border-slate-800 overflow-y-auto space-y-6 custom-scrollbar bg-slate-950">
            
            {/* Filter Group */}
            <div className="bg-white/5 p-5 rounded-2xl border border-white/5 space-y-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Target Selector</span>
              
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-300">Target Employee</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="bg-slate-900 border-slate-800 rounded-xl h-11">
                    <SelectValue placeholder="Select operative..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white">
                    {members?.map(m => (
                      <SelectItem key={m._id} value={m._id}>{m.name} ({m.role})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-300">Month</Label>
                  <Select value={String(selectedMonth)} onValueChange={(v) => { setSelectedMonth(Number(v)); setIsIssued(false); }}>
                    <SelectTrigger className="bg-slate-900 border-slate-800 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-white">
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                        <SelectItem key={m} value={String(m)}>{getMonthName(m)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-300">Year</Label>
                  <Select value={String(selectedYear)} onValueChange={(v) => { setSelectedYear(Number(v)); setIsIssued(false); }}>
                    <SelectTrigger className="bg-slate-900 border-slate-800 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-white">
                      {[2025, 2026, 2027].map(y => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Profile base salary verification */}
            {employee && (
              <div className="bg-white/5 p-5 rounded-2xl border border-white/5 space-y-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Base Salary Profile</span>
                
                {employee.salary ? (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold tracking-wider opacity-60">Profile Salary</span>
                        <span className="text-sm font-bold">Rs. {employee.salary.toLocaleString('en-IN')} / mo</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-1">
                      <span className="text-xs font-bold">No Profile Salary Defined</span>
                      <p className="text-[10px] opacity-80 leading-normal">
                        This employee does not have a salary set. You can set it below to run monthly calculations.
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-300">Set Monthly Base Salary (Rs.)</Label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="e.g. 35000"
                      value={overrideSalary}
                      onChange={(e) => setOverrideSalary(e.target.value)}
                      className="bg-slate-900 border-slate-800 rounded-xl h-11"
                    />
                    <Button 
                      onClick={saveSalaryToProfile}
                      disabled={isUpdatingSalary || !overrideSalary}
                      className="h-11 rounded-xl font-bold bg-white text-slate-900 hover:bg-slate-200"
                    >
                      {isUpdatingSalary ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Profile Overrides */}
            {employee && (
              <div className="bg-white/5 p-5 rounded-2xl border border-white/5 space-y-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Employee Details (Overrides)</span>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-300">Bank Name</Label>
                    <Input 
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="bg-slate-900 border-slate-800 rounded-xl"
                      placeholder="Bank Name"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-300">Bank Account</Label>
                    <Input 
                      value={bankAccount}
                      onChange={(e) => setBankAccount(e.target.value)}
                      className="bg-slate-900 border-slate-800 rounded-xl"
                      placeholder="A/c No"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-300">PAN</Label>
                    <Input 
                      value={pan}
                      onChange={(e) => setPan(e.target.value)}
                      className="bg-slate-900 border-slate-800 rounded-xl"
                      placeholder="PAN"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-300">Location</Label>
                    <Input 
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="bg-slate-900 border-slate-800 rounded-xl"
                      placeholder="Location"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-300">PF Number</Label>
                    <Input 
                      value={pfNumber}
                      onChange={(e) => setPfNumber(e.target.value)}
                      className="bg-slate-900 border-slate-800 rounded-xl"
                      placeholder="PF No"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-300">PF UAN</Label>
                    <Input 
                      value={pfUan}
                      onChange={(e) => setPfUan(e.target.value)}
                      className="bg-slate-900 border-slate-800 rounded-xl"
                      placeholder="UAN"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-300">ESIC Number</Label>
                  <Input 
                    value={esicNo}
                    onChange={(e) => setEsicNo(e.target.value)}
                    className="bg-slate-900 border-slate-800 rounded-xl"
                    placeholder="ESIC Number"
                  />
                </div>
              </div>
            )}

            {/* Attendance & Days Overrides */}
            {employee && (
              <div className="bg-white/5 p-5 rounded-2xl border border-white/5 space-y-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Attendance overrides</span>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-300">Std Days</Label>
                    <Input 
                      type="number"
                      value={standardDays}
                      onChange={(e) => handleStandardDaysChange(e.target.value)}
                      className="bg-slate-900 border-slate-800 rounded-xl"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-300">LOP Days</Label>
                    <Input 
                      type="number"
                      value={lopDays}
                      onChange={(e) => handleLopDaysChange(e.target.value)}
                      className="bg-slate-900 border-slate-800 rounded-xl"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-300">Work Days</Label>
                    <Input 
                      type="number"
                      value={workDays}
                      onChange={(e) => setWorkDays(Number(e.target.value) || 0)}
                      className="bg-slate-900 border-slate-800 rounded-xl"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Deductions Overrides */}
            {employee && (
              <div className="bg-white/5 p-5 rounded-2xl border border-white/5 space-y-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Deduction overrides</span>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-300">Provident Fund (PF)</Label>
                    <Input 
                      type="number"
                      value={providentFund}
                      onChange={(e) => setProvidentFund(e.target.value)}
                      className="bg-slate-900 border-slate-800 rounded-xl"
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-300">Professional Tax</Label>
                    <Input 
                      type="number"
                      value={professionalTax}
                      onChange={(e) => setProfessionalTax(e.target.value)}
                      className="bg-slate-900 border-slate-800 rounded-xl"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-300">Income Tax (IT)</Label>
                    <Input 
                      type="number"
                      value={incomeTax}
                      onChange={(e) => setIncomeTax(e.target.value)}
                      className="bg-slate-900 border-slate-800 rounded-xl"
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-300">ESIC Deduction</Label>
                    <Input 
                      type="number"
                      value={esicDeduction}
                      onChange={(e) => setEsicDeduction(e.target.value)}
                      className="bg-slate-900 border-slate-800 rounded-xl"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-300">Custom Label</Label>
                    <Input 
                      value={customDeductionLabel}
                      onChange={(e) => setCustomDeductionLabel(e.target.value)}
                      className="bg-slate-900 border-slate-800 rounded-xl"
                      placeholder="Other Deduction"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-300">Custom Amount</Label>
                    <Input 
                      type="number"
                      value={customDeduction}
                      onChange={(e) => setCustomDeduction(e.target.value)}
                      className="bg-slate-900 border-slate-800 rounded-xl"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Salary Breakdown & Details Section */}
          <div className="flex-1 p-6 overflow-y-auto space-y-6 custom-scrollbar bg-slate-900">
            {!selectedUserId ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 text-center space-y-3">
                <Calendar className="h-12 w-12 text-slate-600" />
                <span className="text-sm font-bold italic">Select an employee to fetch payroll summary</span>
              </div>
            ) : calculationData === undefined ? (
              <div className="flex flex-col items-center justify-center h-full space-y-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Calculating Salary Grid...</span>
              </div>
            ) : (() => {
              const baseSalaryVal = Number(overrideSalary) || employee?.salary || 0;
              const standardDaysVal = Number(standardDays) || 30;
              const workDaysVal = Number(workDays) || 0;
              const lopDaysVal = Number(lopDays) || 0;
              const dailyRateVal = standardDaysVal > 0 ? Math.round(baseSalaryVal / standardDaysVal) : 0;
              const actualSalaryVal = Math.round(baseSalaryVal * (workDaysVal / standardDaysVal));

              const pfVal = Number(providentFund) || 0;
              const ptVal = Number(professionalTax) || 0;
              const itVal = Number(incomeTax) || 0;
              const esicVal = Number(esicDeduction) || 0;
              const customDeductVal = Number(customDeduction) || 0;

              const totalDeductionsVal = pfVal + ptVal + itVal + esicVal + customDeductVal;
              const netPayVal = Math.max(0, actualSalaryVal - totalDeductionsVal);

              return (
                <div className="space-y-6">
                  
                  {/* Summary Statistics Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Standard Days</span>
                      <span className="text-xl sm:text-2xl font-black text-slate-200 block mt-1">{standardDaysVal} Days</span>
                      <span className="text-[9px] text-slate-500 italic block mt-0.5">Excludes {summary?.holidays || 0} Hol/Sun</span>
                    </div>
                    <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Paid Work Days</span>
                      <span className="text-xl sm:text-2xl font-black text-primary block mt-1">{workDaysVal} Days</span>
                      <span className="text-[9px] text-slate-500 italic block mt-0.5">Standard minus LOP Days</span>
                    </div>
                    <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Total Deductions</span>
                      <span className="text-xl sm:text-2xl font-black text-rose-500 block mt-1">Rs. {totalDeductionsVal.toLocaleString('en-IN')}</span>
                      <span className="text-[9px] text-slate-500 italic block mt-0.5">For LOP + other deductions</span>
                    </div>
                    <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Net Salary</span>
                      <span className="text-xl sm:text-2xl font-black text-emerald-400 block mt-1">Rs. {netPayVal.toLocaleString('en-IN')}</span>
                      <span className="text-[9px] text-slate-500 italic block mt-0.5">Rate: Rs. {dailyRateVal}/day</span>
                    </div>
                  </div>

                  {/* Date-Level Attendance Breakdown List */}
                  <div className="bg-white/5 rounded-2xl border border-white/5 overflow-hidden">
                    <div className="p-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date-Level Attendance Breakdown</span>
                      <span className="text-[9px] text-slate-500 font-bold">{dateBreakdown.length} Calendar Days</span>
                    </div>

                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-white/5 text-[9px] font-black text-slate-500 uppercase tracking-wider bg-slate-950">
                            <th className="p-3 pl-4">Date</th>
                            <th className="p-3">Day</th>
                            <th className="p-3">Status</th>
                            <th className="p-3">Hrs</th>
                            <th className="p-3">Pay Weight</th>
                            <th className="p-3 pr-4">Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dateBreakdown.map((row: any) => (
                            <tr key={row.date} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                              <td className="p-3 pl-4 font-mono font-bold text-slate-300">{row.date}</td>
                              <td className="p-3 text-slate-400 font-bold">{row.dayOfWeek}</td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                  row.category === 'present' ? 'bg-emerald-500/20 text-emerald-400' :
                                  row.category === 'half-day' ? 'bg-amber-500/20 text-amber-400' :
                                  row.category === 'paid-leave' ? 'bg-indigo-500/20 text-indigo-400' :
                                  row.category === 'holiday' ? 'bg-slate-700 text-slate-300' :
                                  'bg-rose-500/20 text-rose-500'
                                }`}>
                                  {row.attendanceStatus}
                                  {row.holidayName && row.holidayName !== 'Holiday' && ` (${row.holidayName})`}
                                </span>
                              </td>
                              <td className="p-3 text-slate-400 font-mono">{row.hoursWorked > 0 ? `${row.hoursWorked.toFixed(1)}h` : '0h'}</td>
                              <td className="p-3 text-slate-300 font-mono font-bold">{row.salaryWeight.toFixed(1)}x</td>
                              <td className="p-3 pr-4 text-slate-500 italic max-w-xs truncate" title={row.notes}>{row.notes || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              );
            })()}
          </div>

        </div>

        {/* Action Bottom Bar */}
        <div className="p-6 border-t border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {isIssued && (
              <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1.5 uppercase tracking-wider">
                <CheckCircle2 className="h-4 w-4" /> Payslip issued to operative's vault
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              onClick={handleDownloadPayslip}
              disabled={!calculationData || !employee}
              className="rounded-xl font-bold uppercase tracking-wider text-xs h-12 border-slate-800 bg-slate-900"
            >
              <Download className="mr-2 h-4 w-4 text-emerald-500" />
              Download Payslip PDF
            </Button>

            {initialMode === 'payslip' && (
              <Button 
                variant="default"
                onClick={handleIssuePayslip}
                disabled={!calculationData || !employee || isIssuing || isIssued}
                className="rounded-xl font-black italic uppercase tracking-widest text-xs h-12 bg-primary text-white"
              >
                {isIssuing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                Issue Payslip
              </Button>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
