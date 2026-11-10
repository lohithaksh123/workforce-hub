'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { 
  X, 
  Loader2, 
  Download, 
  Mail, 
  Save, 
  FileText, 
  CheckCircle2, 
  AlertCircle,
  PlusCircle,
  RotateCcw,
  Sparkles,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Eye,
  Type,
  User,
  Briefcase,
  Sliders,
  Check
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import * as docx from 'docx'

interface HrDocumentGeneratorProps {
  open: boolean
  onClose: () => void
  preselectedUserId?: string
  requestorEmail: string
}

const DOCUMENT_TYPES = [
  "Offer Letter",
  "Appointment Letter",
  "Joining Letter",
  "Internship Offer Letter",
  "Internship Completion Certificate",
  "Experience Letter",
  "Relieving Letter",
  "Termination Letter",
  "Resignation Acceptance Letter",
  "Salary Certificate",
  "Employment Certificate",
  "Warning Letter",
  "Appreciation Certificate",
  "No Objection Certificate",
  "Custom Document"
]

const FONT_MAP = {
  'Helvetica': 'Helvetica, Arial, sans-serif',
  'Arial': 'Arial, Helvetica, sans-serif',
  'Inter': 'Inter, system-ui, sans-serif',
  'Times New Roman': '"Times New Roman", Times, serif'
}

// ─── Professionally written default template bodies ───────────────────────────
const DEFAULT_TEMPLATE_BODIES: Record<string, { body: string; fields: Record<string, string> }> = {
  "Offer Letter": {
    body: `Dear {{employeeName}},

We are delighted to extend this offer of employment to you for the position of {{designation}} at Acme Interiors. Following our recent discussions and interviews, we are confident that your skills, experience, and vision align perfectly with our organizational goals.

This offer is contingent upon successful completion of the pre-employment verification process and submission of all required documents prior to your start date.

TERMS OF EMPLOYMENT:

Position: {{designation}}
Department: {{department}}
Reporting To: {{reportingManager}}
Date of Joining: {{joiningDate}}
Work Location: {{siteName}}
Monthly Gross Salary: {{salary}} per month

Your compensation package includes health insurance coverage, paid annual leave as per company policy, and performance-based incentives reviewed annually. Complete details of your benefits package will be provided during onboarding.

This offer is subject to your acceptance within 7 calendar days from the date of this letter. Kindly sign and return the duplicate copy of this letter as a token of your acceptance.

We look forward to welcoming you to the Acme Interiors family and are confident that your contribution will be invaluable to our continued growth and success.

Warm regards,`,
    fields: { designation: "Interior Designer", department: "Creative Studio", salary: "Rs. 45,000", joiningDate: "2026-07-01", siteName: "Main Studio, 221 Demo Street, Hyderabad - 500001, India", reportingManager: "Reporting Manager" }
  },

  "Appointment Letter": {
    body: `Dear {{employeeName}},

With great pleasure, we formally appoint you as {{designation}} in the {{department}} division of Acme Interiors, effective from {{joiningDate}}.

This appointment is made on the following terms and conditions:

1. DESIGNATION & DUTIES
   You are appointed as {{designation}} and shall be responsible for performing all duties and responsibilities associated with this role as assigned by the Management from time to time.

2. COMPENSATION
   Your monthly gross salary shall be {{salary}}, payable on or before the 5th of each calendar month.

3. PROBATION PERIOD
   You will be on probation for an initial period of six (6) months from the date of joining, during which your performance will be reviewed. Confirmation of your employment will be subject to satisfactory performance.

4. REPORTING
   You shall report directly to {{reportingManager}} or any other authorized person as designated by the Management.

5. WORK LOCATION
   Your primary place of posting shall be {{siteName}}. The Management reserves the right to transfer you to any other location as per operational requirements.

6. CONDUCT & CONFIDENTIALITY
   You are expected to maintain the highest standards of professional conduct and to preserve the confidentiality of all proprietary information pertaining to the company, its clients, and its projects.

Please sign and return the enclosed duplicate copy of this letter as confirmation of your acceptance of the above terms.

Sincerely,`,
    fields: { designation: "Project Coordinator", department: "Operations", salary: "Rs. 55,000", joiningDate: "2026-07-01", siteName: "Office (Main Branch), 221 Demo Street, Hyderabad - 500001, India", reportingManager: "Reporting Manager" }
  },

  "Joining Letter": {
    body: `Dear {{employeeName}},

We are pleased to confirm that you have officially joined Acme Interiors as {{designation}} effective {{joiningDate}}.

All onboarding formalities have been duly completed. You have been assigned to the {{siteName}} location and will report directly to {{reportingManager}}.

JOINING SUMMARY:
• Employee Name  : {{employeeName}}
• Designation    : {{designation}}
• Department     : {{department}}
• Date of Joining: {{joiningDate}}
• Work Location  : {{siteName}}
• Employee Code  : CC/{{joiningDate}}/01

Your attendance, leave entitlement, and performance cycle will commence from your date of joining as stated above.

We are confident that your skills and enthusiasm will be a valuable asset to our team. The Management and your team are delighted to have you on board, and we wish you a rewarding and successful career with us.

Please retain this letter for your records as it serves as your official Joining Confirmation.

Warm regards,`,
    fields: { designation: "Senior Visualizer", department: "Creative Studio", joiningDate: "2026-07-01", siteName: "Main Studio, 221 Demo Street, Hyderabad - 500001, India", reportingManager: "Reporting Manager" }
  },

  "Internship Offer Letter": {
    body: `Dear {{employeeName}},

We are pleased to offer you an Internship opportunity at Acme Interiors for the position of {{designation}}.

INTERNSHIP DETAILS:
• Role         : {{designation}}
• Duration     : 3 (Three) Months
• Commencement : {{joiningDate}}
• Conclusion   : {{exitDate}}
• Monthly Stipend: {{salary}}
• Work Location : {{siteName}}

During the course of your internship, you will have the opportunity to work alongside our experienced design and project management teams on real interior design and execution projects. You will be expected to contribute actively, maintain professional decorum, and adhere to all company policies.

At the conclusion of your internship, subject to satisfactory performance, you will receive an Internship Completion Certificate from the company.

Kindly confirm your acceptance of this offer by signing and returning the duplicate copy of this letter within 5 days.

We look forward to having you with us and trust that this experience will prove highly enriching for your professional development.

Warm regards,`,
    fields: { designation: "Design Intern", salary: "Rs. 12,000", joiningDate: "2026-07-01", exitDate: "2026-10-01", siteName: "Main Studio, 221 Demo Street, Hyderabad - 500001, India" }
  },

  "Internship Completion Certificate": {
    body: `TO WHOMSOEVER IT MAY CONCERN,

This is to certify that {{employeeName}} has successfully completed an internship program with Acme Interiors from {{joiningDate}} to {{exitDate}}, in the capacity of {{designation}}.

During the tenure of this internship, {{employeeName}} demonstrated exceptional commitment, creativity, and a sincere willingness to learn. Their contributions included but were not limited to:
• Assistance in conceptualizing and developing interior design layouts and mood boards
• Active participation in site visits, client meetings, and project coordination
• Supporting the design team in preparing 3D visualizations and material presentations

Throughout this period, {{employeeName}} displayed a professional attitude and technical aptitude that is commendable for someone at this stage of their career.

We wish {{employeeName}} the very best in their academic and professional pursuits, and we are confident that they will excel in whichever direction they choose to pursue.

This certificate is issued at the specific request of the candidate and is for informational purposes only.

For Acme Interiors,`,
    fields: { designation: "Design Intern", joiningDate: "2026-04-01", exitDate: "2026-06-30" }
  },

  "Experience Letter": {
    body: `TO WHOMSOEVER IT MAY CONCERN,

This is to certify that {{employeeName}} was employed with Acme Interiors from {{joiningDate}} to {{exitDate}}, in the designation of {{designation}}.

During their tenure with us, {{employeeName}} was a dedicated, sincere, and high-performing professional who consistently delivered results in line with the company's quality and design standards. Their key contributions included:
• Managing and executing interior design projects from concept to completion
• Coordinating with clients, vendors, and on-site execution teams
• Upholding the creative and operational standards of the organization

{{employeeName}} has been an asset to our team, and their departure is solely on account of their personal career decision. We respect their choice and extend our fullest support.

During the entire period of their employment, their character, conduct, and integrity have been found to be excellent and beyond reproach.

We wish {{employeeName}} the very best in all their future endeavors and are confident that they will be a valuable addition to any organization.

This letter is issued at the request of {{employeeName}} and without any prejudice on our part.

For Acme Interiors,`,
    fields: { designation: "Senior Designer", joiningDate: "2023-06-01", exitDate: "2026-05-31" }
  },

  "Relieving Letter": {
    body: `Dear {{employeeName}},

This is in reference to your resignation submitted on {{joiningDate}}, from the position of {{designation}} at Acme Interiors.

We hereby confirm that your resignation has been formally accepted by the Management and that you stand relieved from all duties and responsibilities associated with your designation, effective {{exitDate}}.

We confirm that:
1. All pending assignments and handover responsibilities have been duly completed by you.
2. Your dues, final settlement, and remaining leave encashment (if any) will be processed and credited to your registered bank account within 15 working days from your last working day.
3. No disciplinary action or adverse remark is associated with your relieving from service.

Please surrender all company property, access cards, confidential documents, and any equipment in your possession before your final working day.

It has been a pleasure having you as a part of the Acme Interiors family. We sincerely thank you for your contributions and the professionalism you brought to your role throughout your tenure.

We wish you the very best in your future professional endeavors.

Warm regards,`,
    fields: { designation: "Design Manager", joiningDate: "2026-05-15", exitDate: "2026-06-30" }
  },

  "Termination Letter": {
    body: `Dear {{employeeName}},

This letter is to formally notify you that your employment with Acme Interiors as {{designation}} is hereby terminated, effective {{exitDate}}.

This decision has been taken by the Management after due consideration of the circumstances and in accordance with the terms and conditions of your employment agreement dated {{joiningDate}}.

GROUNDS FOR TERMINATION:
The specific grounds for this termination have been communicated to you in person and are on record with the HR Department.

FINAL SETTLEMENT:
1. Your final salary, including all earned but unpaid compensation up to {{exitDate}}, will be processed within 15 working days.
2. Any recoveries or outstanding dues owed to the company will be adjusted against your final settlement.

COMPANY PROPERTY:
You are required to immediately surrender all company assets including but not limited to access cards, laptops, project files, confidential documents, and any other company property in your possession.

CONFIDENTIALITY OBLIGATIONS:
Please be reminded that your confidentiality obligations under your employment agreement remain in full force and effect beyond the termination of your employment.

We regret that circumstances have led to this outcome.

For Acme Interiors,`,
    fields: { designation: "Site Supervisor", joiningDate: "2024-01-01", exitDate: "2026-06-15" }
  },

  "Resignation Acceptance Letter": {
    body: `Dear {{employeeName}},

We acknowledge receipt of your resignation letter dated {{joiningDate}}, wherein you have expressed your intention to resign from the position of {{designation}} at Acme Interiors.

After due deliberation, the Management hereby formally accepts your resignation. Your last working day with the company is confirmed as {{exitDate}}.

We request you to complete the following formalities before your final working day:
1. Handover of all ongoing projects, client files, and design assets to your designated replacement or team lead.
2. Return of all company-issued property including access cards, equipment, project documents, and any other material.
3. Completion of the full and final settlement form with the HR Department.

Your dues including any remaining salary, earned leave encashment, and other applicable benefits will be processed and credited to your registered bank account within 15 working days of your last working day.

We sincerely thank you for your contributions, dedication, and the creative energy you brought to our projects during your tenure. You have been a valuable member of our team and we wish you every success in your future career.

Please maintain the confidentiality of all proprietary and client information even after the cessation of your employment.

Warm regards,`,
    fields: { designation: "Visual Designer", joiningDate: "2026-05-20", exitDate: "2026-06-30" }
  },

  "Salary Certificate": {
    body: `TO WHOMSOEVER IT MAY CONCERN,

This is to certify that {{employeeName}} is currently employed with Acme Interiors as {{designation}} in the {{department}} department, with effect from {{joiningDate}}.

SALARY DETAILS:

• Gross Monthly Salary  : {{salary}} per month
• Mode of Payment       : Bank Transfer (NEFT/IMPS)
• Payment Frequency     : Monthly (on or before 5th of each month)

EMPLOYMENT STATUS: Active Full-Time Employee

This certificate is issued upon the specific request of {{employeeName}} for the purpose of loan application / bank account verification / visa processing / personal records (as applicable), and does not constitute a guarantee or endorsement by the company.

The company does not accept any liability arising from the use of this document for any other purpose.

For Acme Interiors,`,
    fields: { designation: "Lead Architect", department: "Design & Planning", salary: "Rs. 75,000", joiningDate: "2022-09-01" }
  },

  "Employment Certificate": {
    body: `TO WHOMSOEVER IT MAY CONCERN,

This is to certify that {{employeeName}} is a bona fide and active employee of Acme Interiors (hereinafter referred to as "the Company"), and has been continuously employed with us since {{joiningDate}}.

EMPLOYMENT DETAILS:
• Full Name        : {{employeeName}}
• Designation      : {{designation}}
• Department       : {{department}}
• Date of Joining  : {{joiningDate}}
• Employment Type  : Full-Time, Permanent
• Work Location    : {{siteName}}

CONDUCT & CHARACTER:
During their period of employment, {{employeeName}} has maintained exemplary professional standards, demonstrated exceptional competence, and has been a reliable member of our organization.

This certificate is issued at the specific request of {{employeeName}} for the purpose of official verification and should be treated as a genuine document of employment confirmation.

For any further verification, please contact: hr@example.com | +91 90000 00000

For Acme Interiors,`,
    fields: { designation: "Interior Consultant", department: "Client Services", joiningDate: "2023-03-15", siteName: "Main Office, 221 Demo Street, Hyderabad - 500001, India" }
  },

  "Warning Letter": {
    body: `Dear {{employeeName}},

This letter serves as a formal written warning from the Management of Acme Interiors regarding repeated instances of {{warningReason}}.

BACKGROUND:
Despite verbal advisories and prior informal counseling sessions, it has been observed that there has been no meaningful improvement in the matter cited above. This conduct is in direct violation of the company's Standard Operating Procedures and Code of Conduct.

SPECIFIC INCIDENTS:
{{specificIncidents}}

EXPECTED IMPROVEMENT:
With immediate effect, you are required to:
1. Rectify the aforementioned conduct and demonstrate measurable improvement within 30 days.
2. Attend the performance improvement discussion scheduled with your reporting manager.
3. Adhere strictly to all company policies, SOPs, and professional standards.

CONSEQUENCES:
Please be informed that failure to demonstrate immediate and sustained improvement may result in further disciplinary action, including but not limited to suspension or termination of employment, in accordance with your employment agreement.

This letter will be placed on your personnel file as part of your official employment record.

You are requested to sign and return the acknowledgment copy of this letter within 48 hours of receipt.

For Acme Interiors,`,
    fields: { designation: "Site Assistant", warningReason: "habitual tardiness and absence without prior approval", specificIncidents: "Late arrivals on multiple occasions without prior notice. Unexplained absence on 2026-05-28 and 2026-06-04 without informing the reporting manager." }
  },

  "Appreciation Certificate": {
    body: `CERTIFICATE OF APPRECIATION

This is to formally recognize and commend the outstanding contributions of

{{employeeName}}

in the capacity of {{designation}} at Acme Interiors.

{{employeeName}} has consistently demonstrated exceptional dedication, creativity, and professionalism in their role. Their commitment to delivering high-quality interior design solutions, maintaining client relationships, and upholding the company's vision of excellence is truly commendable.

Key Achievements Recognized:
• Outstanding performance on project delivery and client satisfaction
• Consistent display of creativity, attention to detail, and design excellence
• Positive contribution to team collaboration and organizational culture
• Going above and beyond the defined scope of responsibilities

The Management and the entire team at Acme Interiors take great pride in recognizing the exemplary efforts of {{employeeName}}, and we are confident that their dedication will continue to set a benchmark for others.

We sincerely thank {{employeeName}} for their invaluable contribution and look forward to many more milestones together.

Presented with pride and gratitude,`,
    fields: { designation: "Lead Designer" }
  },

  "No Objection Certificate": {
    body: `TO WHOMSOEVER IT MAY CONCERN,

This is to certify that {{employeeName}}, currently employed with Acme Interiors as {{designation}} in the {{department}} department since {{joiningDate}}, has sought our formal No Objection Certificate.

PURPOSE: {{nocPurpose}}

We hereby confirm that Acme Interiors has NO OBJECTION to {{employeeName}} pursuing the above-mentioned purpose. This is issued in good faith and without prejudice to their current employment obligations.

CONDITIONS:
1. The pursuit of the above-mentioned purpose should not interfere with {{employeeName}}'s work responsibilities or attendance.
2. Any obligations and liabilities arising from the external activity remain solely with {{employeeName}}.
3. The company does not assume any financial, legal, or reputational liability arising from the activity for which this NOC is issued.

This certificate is valid for a period of 6 months from the date of issue.

For any clarification or further verification, please contact: hr@example.com

For Acme Interiors,`,
    fields: { designation: "Interior Visualizer", department: "Design Studio", joiningDate: "2023-11-01", nocPurpose: "applying for an educational loan / pursuing a part-time certification program" }
  },

  "Custom Document": {
    body: `Dear {{employeeName}},

[Begin writing your custom document content here. Replace this text with the specific content required.]

[You may use placeholders like {{designation}}, {{joiningDate}}, {{salary}}, {{siteName}}, etc. to auto-fill details from the form fields on the left panel.]

[For any queries or clarifications, please contact the HR Department.]

Warm regards,`,
    fields: {}
  }
}

export default function HrDocumentGenerator({ open, onClose, preselectedUserId, requestorEmail }: HrDocumentGeneratorProps) {
  const members = useQuery(api.hr_documents.getMembersForDocumentGeneration, open && requestorEmail ? { requestorEmail } : "skip")
  const templates = useQuery(api.hr_documents.getDocumentTemplates)
  
  const createDraft = useMutation(api.hr_documents.createGeneratedDocumentDraft)
  const updateDraft = useMutation(api.hr_documents.updateGeneratedDocumentFields)
  const issueDocument = useMutation(api.hr_documents.issueGeneratedDocument)
  const saveDocFiles = useMutation(api.hr_documents.saveGeneratedDocumentFiles)
  const emailDoc = useMutation(api.hr_documents.emailGeneratedDocument)
  const saveUserDocument = useMutation(api.user_documents.saveUserDocument)
  const generateUploadUrl = useMutation(api.user_documents.generateUploadUrl)
  const createCustomTemplate = useMutation(api.hr_documents.createCustomTemplate)

  // Accordion Control State
  const [openAccordion, setOpenAccordion] = useState<string>('recipient')

  // Step 1: Member Selection
  const [memberType, setMemberType] = useState<'existing' | 'custom'>('existing')
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  
  // Custom member fields
  const [customName, setCustomName] = useState('')
  const [customEmail, setCustomEmail] = useState('')
  const [customPhone, setCustomPhone] = useState('')
  const [customDesignation, setCustomDesignation] = useState('')
  const [customJoiningDate, setCustomJoiningDate] = useState('')
  const [customSalary, setCustomSalary] = useState('')
  const [customAddress, setCustomAddress] = useState('')
  const [customDepartment, setCustomDepartment] = useState('')
  const [customSite, setCustomSite] = useState('Main Studio, 221 Demo Street, Hyderabad - 500001, India')
  const [reportingManager, setReportingManager] = useState('')

  // Step 2 & 3: Doc & Template Select
  const [selectedDocType, setSelectedDocType] = useState<string>("Offer Letter")
  const isOfferLetter = selectedDocType === 'Offer Letter' || selectedDocType === 'Internship Offer Letter'
  const [selectedTemplateName, setSelectedTemplateName] = useState<string>("Member Default")
  
  // Fields & Content
  const [documentTitle, setDocumentTitle] = useState('')
  const [documentBody, setDocumentBody] = useState('')
  const [subject, setSubject] = useState('Offer Letter')
  const [terms, setTerms] = useState('')
  const [notes, setNotes] = useState('')
  
  // Signatory & Dates — will be auto-set from requestorEmail once members load
  const [authorizedPerson, setAuthorizedPerson] = useState('')
  const [signatureDesignation, setSignatureDesignation] = useState('Authorized Signatory')
  const [letterDate, setLetterDate] = useState(new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }))
  const [exitDate, setExitDate] = useState('')

  // Styling Customization State
  const [headerAlignment, setHeaderAlignment] = useState<'left' | 'center' | 'right'>('left')
  const [showLogo, setShowLogo] = useState(true)
  const [showRecipientAddress, setShowRecipientAddress] = useState(true)
  const [logoSize, setLogoSize] = useState<'small' | 'medium' | 'large'>('large')
  const [showContactLine, setShowContactLine] = useState(true)
  const [fontFamily, setFontFamily] = useState('Helvetica')
  const [bodyFontSize, setBodyFontSize] = useState(10)
  const [headerFontSize, setHeaderFontSize] = useState(22)
  const [lineHeight, setLineHeight] = useState(1.6)
  const [primaryColor, setPrimaryColor] = useState('#1a1a2e')
  const [accentColor, setAccentColor] = useState('#c8a96e')
  const [footerText, setFooterText] = useState('Acme Interiors')

  // Extracted dynamic fields
  const [dynamicFields, setDynamicFields] = useState<Record<string, string>>({})
  
  // Draft tracking
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null)
  const [documentStatus, setDocumentStatus] = useState<'draft' | 'unissued' | 'issued' | 'emailed' | 'cancelled'>('draft')
  
  // Modals & UI States
  const [isSaving, setIsSaving] = useState(false)
  const [isIssuing, setIsIssuing] = useState(false)
  const [isEmailing, setIsEmailing] = useState(false)
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [emailTo, setEmailTo] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailMessage, setEmailMessage] = useState('')

  // Custom confirmation modal for changing doc types
  const [pendingDocType, setPendingDocType] = useState<string | null>(null)
  const [showDocTypeConfirm, setShowDocTypeConfirm] = useState(false)

  // Custom template save states
  const [saveTemplateDialogOpen, setSaveTemplateDialogOpen] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')
  const [newTemplateRole, setNewTemplateRole] = useState('Staff')
  const [isSavingTemplate, setIsSavingTemplate] = useState(false)

  // Zoom and print controls
  const [zoom, setZoom] = useState(0.85)
  const [printPreview, setPrintPreview] = useState(false)
  const [logoBase64, setLogoBase64] = useState<string>('')
  const [logoAspectRatio, setLogoAspectRatio] = useState<number>(3)
  const [logoLoadError, setLogoLoadError] = useState(false)

  // Textarea Ref for cursor-based insertion
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Fetch logo base64 on mount to ensure zero-failure vector PDF rendering
  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const response = await fetch('/logo.png')
        if (response.ok) {
          const blob = await response.blob()
          const reader = new FileReader()
          reader.onloadend = () => {
            setLogoBase64(reader.result as string)
          }
          reader.readAsDataURL(blob)
        }
      } catch (err) {
        console.error("Failed to prefetch logo.png", err)
      }
    }
    fetchLogo()
  }, [])

  // Check aspect ratio of logo once base64 is loaded
  useEffect(() => {
    if (logoBase64) {
      const img = new Image()
      img.onload = () => {
        if (img.height > 0) {
          setLogoAspectRatio(img.width / img.height)
        }
      }
      img.src = logoBase64
    }
  }, [logoBase64])

  // Pre-select logic if opened from employee card
  useEffect(() => {
    if (preselectedUserId && open) {
      setMemberType('existing')
      setSelectedUserId(preselectedUserId)
    }
  }, [preselectedUserId, open])

  // Auto-set authorized signatory name from the requestor's member record
  useEffect(() => {
    if (members && requestorEmail && !authorizedPerson) {
      const me = members.find(m => m.email === requestorEmail)
      if (me) {
        setAuthorizedPerson(me.name)
        // Set designation-aware title if available
        if (me.designation) {
          setSignatureDesignation(me.designation)
        }
      }
    }
  }, [members, requestorEmail])

  // Fetch and auto-fill when existing member changes
  useEffect(() => {
    if (memberType === 'existing' && selectedUserId && members) {
      const u = members.find(m => m._id === selectedUserId)
      if (u) {
        setCustomName(u.name)
        setCustomEmail(u.email)
        setCustomPhone(u.phone || '')
        setCustomDesignation(u.designation || '')
        setCustomAddress(u.address || '')
        setCustomJoiningDate(u.joiningDate || '')
        setCustomSalary(u.salary ? String(u.salary) : '')
        setDynamicFields(prev => ({
          ...prev,
          employeeName: u.name,
          designation: u.designation || 'Staff',
          joiningDate: u.joiningDate || '',
          salary: u.salary ? `Rs. ${u.salary.toLocaleString('en-IN')}` : '',
        }))
      }
    }
  }, [selectedUserId, memberType, members])

  // Handle template body changes — always prefer local DEFAULT_TEMPLATE_BODIES
  // Only use Convex DB templates if they are user-saved custom ones (not system defaults)
  useEffect(() => {
    // Always use local defaults first — DB templates may be stale
    if (DEFAULT_TEMPLATE_BODIES[selectedDocType]) {
      const def = DEFAULT_TEMPLATE_BODIES[selectedDocType]
      setDocumentBody(def.body)
      setDocumentTitle(`${selectedDocType} - ${customName || 'Draft'}`)
      // Auto-fill subject from document type
      setSubject(selectedDocType)
      const initialFields: Record<string, string> = { ...def.fields }
      initialFields.companyName = "Acme Interiors"
      initialFields.authorizedPerson = authorizedPerson
      initialFields.letterDate = letterDate
      if (customName) initialFields.employeeName = customName
      if (customDesignation) initialFields.designation = customDesignation
      if (customJoiningDate) initialFields.joiningDate = customJoiningDate
      if (customSalary) initialFields.salary = `Rs. ${Number(customSalary).toLocaleString('en-IN')}`
      if (exitDate) initialFields.exitDate = exitDate
      if (customSite) initialFields.siteName = customSite
      if (customDepartment) initialFields.department = customDepartment
      if (reportingManager) initialFields.reportingManager = reportingManager
      setDynamicFields(initialFields)
    } else if (templates) {
      // Fallback to Convex custom templates for unknown doc types
      const matched = templates.find(t => t.documentType === selectedDocType && t.templateName === selectedTemplateName)
      if (matched) {
        setDocumentBody(matched.body)
        setDocumentTitle(`${selectedDocType} - ${customName || 'Draft'}`)
        setSubject(selectedDocType)
        const defaultFields = (matched.defaultFields || {}) as Record<string, string>
        const initialFields: Record<string, string> = { ...defaultFields }
        initialFields.companyName = "Acme Interiors"
        if (customName) initialFields.employeeName = customName
        if (customDesignation) initialFields.designation = customDesignation
        setDynamicFields(initialFields)
      } else {
        setDocumentBody("Dear {{employeeName}},\n\nWrite your document content here.\n\nWarm regards,")
        setDocumentTitle(`${selectedDocType} - ${customName || 'Draft'}`)
        setSubject(selectedDocType)
      }
    }
  }, [selectedDocType, selectedTemplateName])

  // Extract placeholders from body to render input fields
  const getPlaceholders = () => {
    const regex = /\{\{([^}]+)\}\}/g
    const matches: string[] = []
    let match
    while ((match = regex.exec(documentBody)) !== null) {
      if (!matches.includes(match[1])) {
        matches.push(match[1])
      }
    }
    return matches
  }

  const handleFieldChange = (key: string, val: string) => {
    setDynamicFields(prev => ({ ...prev, [key]: val }))
  }

  // Replace placeholders in text
  const compileContent = (text: string) => {
    let compiled = text
    const fields = {
      ...dynamicFields,
      employeeName: customName || dynamicFields.employeeName,
      designation: customDesignation || dynamicFields.designation,
      joiningDate: customJoiningDate || dynamicFields.joiningDate,
      salary: customSalary ? `Rs. ${Number(customSalary).toLocaleString('en-IN')}` : (dynamicFields.salary || 'N/A'),
      companyName: "Acme Interiors",
      siteName: customSite || dynamicFields.siteName,
      authorizedSignatory: authorizedPerson || dynamicFields.authorizedSignatory,
      authorizedPerson: authorizedPerson || dynamicFields.authorizedPerson,
      letterDate: letterDate || dynamicFields.letterDate,
      exitDate: exitDate || dynamicFields.exitDate,
      department: customDepartment || dynamicFields.department,
      reportingManager: reportingManager || dynamicFields.reportingManager,
    }
    for (const [key, val] of Object.entries(fields)) {
      compiled = compiled.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val || `{{${key}}}`)
    }
    return compiled
  }

  // Unresolved variables verification helper
  const getUnresolvedPlaceholders = () => {
    const compiled = compileContent(documentBody)
    const regex = /\{\{([^}]+)\}\}/g
    const matches: string[] = []
    let match
    while ((match = regex.exec(compiled)) !== null) {
      if (!matches.includes(match[1])) {
        matches.push(match[1])
      }
    }
    return matches
  }

  // Insert placeholder helper at textarea cursor position
  const insertPlaceholder = (ph: string) => {
    const textarea = textareaRef.current
    if (!textarea) {
      setDocumentBody(prev => prev + ` {{${ph}}}`)
      return
    }
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = textarea.value
    const before = text.substring(0, start)
    const after = text.substring(end, text.length)
    const newText = before + `{{${ph}}}` + after
    setDocumentBody(newText)
    setTimeout(() => {
      textarea.focus()
      textarea.selectionStart = textarea.selectionEnd = start + ph.length + 4
    }, 50)
  }

  const saveDraftFn = async () => {
    setIsSaving(true)
    try {
      if (currentDraftId) {
        await updateDraft({
          id: currentDraftId as any,
          documentTitle,
          documentBody,
          documentFields: dynamicFields,
          employeeName: customName,
          email: customEmail || undefined,
          phone: customPhone || undefined,
          designation: customDesignation || undefined,
          requestorEmail
        })
        toast({ title: "Draft Updated", description: "HR document draft has been successfully updated." })
      } else {
        const id = await createDraft({
          memberType,
          userId: memberType === 'existing' && selectedUserId ? (selectedUserId as any) : undefined,
          employeeName: customName,
          email: customEmail || undefined,
          phone: customPhone || undefined,
          designation: customDesignation || undefined,
          documentType: selectedDocType,
          templateName: selectedTemplateName,
          documentTitle,
          documentBody,
          documentFields: dynamicFields,
          requestorEmail
        })
        setCurrentDraftId(id)
        setDocumentStatus('draft')
        toast({ title: "Draft Saved", description: "New HR document draft created successfully." })
      }
    } catch (err: any) {
      toast({ title: "Save Failed", variant: "destructive", description: err.message || "Failed to save draft." })
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim()) {
      toast({ title: "Validation Error", variant: "destructive", description: "Template name is required." })
      return
    }
    setIsSavingTemplate(true)
    try {
      await createCustomTemplate({
        templateName: newTemplateName,
        documentType: selectedDocType,
        rolePreset: newTemplateRole,
        body: documentBody,
        defaultFields: dynamicFields,
        requestorEmail
      })
      toast({ title: "Template Saved", description: `Template "${newTemplateName}" has been successfully saved.` })
      setSaveTemplateDialogOpen(false)
      setNewTemplateName('')
    } catch (err: any) {
      toast({ title: "Save Failed", variant: "destructive", description: err.message || "Failed to save template." })
    } finally {
      setIsSavingTemplate(false)
    }
  }

  // Helper to convert hex to RGB
  const hexToRgb = (hex: string) => {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i
    const fullHex = hex.replace(shorthandRegex, (_, r, g, b) => r + r + g + g + b + b)
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 26, g: 26, b: 46 }
  }

  // ─── Generate vector PDF ────────────────────────────────────────────────────
  const generatePdfBlob = (): Blob => {
    const doc = new jsPDF({ format: 'a4', unit: 'mm' })
    const lm = 18 // left margin
    const rm = 18 // right margin
    const pw = 210 - lm - rm // printable width
    const pdfFont = fontFamily === 'Times New Roman' ? 'times' : 'helvetica'
    const primaryRGB = hexToRgb(primaryColor)
    const accentRGB = hexToRgb(accentColor)
    let y = 16

    // ── 1. TOP COLORED ACCENT BAR ─────────────────────────────────────────────
    doc.setFillColor(primaryRGB.r, primaryRGB.g, primaryRGB.b)
    doc.rect(0, 0, 210, 4, 'F')

    // ── 2. LOGO (top-left, large) + DOC TITLE (top-right or centered) ─────────
    let logoWidth = 45
    if (logoSize === 'small') logoWidth = 28
    if (logoSize === 'large') logoWidth = 55
    const logoHeight = logoWidth / logoAspectRatio

    let logoPlaced = false
    if (showLogo && logoBase64 && !logoLoadError) {
      try {
        doc.addImage(logoBase64, 'PNG', lm, y, logoWidth, logoHeight)
        logoPlaced = true
      } catch (err) {
        console.error("Failed to add image to PDF", err)
      }
    }

    if (!logoPlaced) {
      // Text fallback: company name top-left
      doc.setFont(pdfFont, 'bold')
      doc.setFontSize(16)
      doc.setTextColor(primaryRGB.r, primaryRGB.g, primaryRGB.b)
      doc.text('ACME INTERIORS', lm, y + 6)
      doc.setFontSize(7.5)
      doc.setFont(pdfFont, 'bold')
      doc.setTextColor(accentRGB.r, accentRGB.g, accentRGB.b)
      doc.text('INTERIOR SOLUTIONS & DESIGN LAB', lm, y + 11.5)
    }

    // Document title aligned right of logo
    const titleY = y + Math.max(logoHeight / 2 + 2, 8)
    doc.setFont(pdfFont, 'bold')
    doc.setFontSize(18)
    doc.setTextColor(primaryRGB.r, primaryRGB.g, primaryRGB.b)
    const titleX = logoPlaced ? lm + logoWidth + 6 : lm + 70
    const titleWidth = 210 - rm - titleX
    const wrappedTitle = doc.splitTextToSize(selectedDocType.toUpperCase(), titleWidth)
    doc.text(wrappedTitle, 210 - rm, titleY, { align: 'right' })

    y = Math.max(y + logoHeight + 5, titleY + wrappedTitle.length * 7)

    // ── 3. DIVIDER ────────────────────────────────────────────────────────────
    doc.setDrawColor(accentRGB.r, accentRGB.g, accentRGB.b)
    doc.setLineWidth(0.5)
    doc.line(lm, y, 210 - rm, y)
    y += 7

    // ── 4. TWO-COLUMN: Company Info (left) + Date (right) ─────────────────────
    // Company address block (left)
    doc.setFont(pdfFont, 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(primaryRGB.r, primaryRGB.g, primaryRGB.b)
    doc.text('Acme Interiors', lm, y)
    doc.setFont(pdfFont, 'normal')
    doc.setFontSize(8)
    doc.setTextColor(80, 80, 80)
    y += 4.5
    doc.text('221 Demo Street', lm, y)
    y += 4
    doc.text('Hyderabad - 500001, Telangana', lm, y)
    y += 4
    doc.text('Tel: +91 90000 00000  |  Email: hello@example.com', lm, y)
    y += 4
    doc.text('Web: www.example.com', lm, y)

    // Date (right)
    const dateY = y - 12
    doc.setFont(pdfFont, 'bold')
    doc.setFontSize(9)
    doc.setTextColor(primaryRGB.r, primaryRGB.g, primaryRGB.b)
    doc.text(`Date: ${letterDate}`, 210 - rm, dateY, { align: 'right' })

    y += 10

    // ── 5. TO/RECIPIENT BLOCK ─────────────────────────────────────────────────
    doc.setFont(pdfFont, 'bold')
    doc.setFontSize(8)
    doc.setTextColor(120, 120, 120)
    doc.text('TO,', lm, y)
    y += 4.5

    doc.setFont(pdfFont, 'bold')
    doc.setFontSize(11)
    doc.setTextColor(primaryRGB.r, primaryRGB.g, primaryRGB.b)
    doc.text(customName || 'Recipient Name', lm, y)
    y += 5

    if (customDesignation) {
      doc.setFont(pdfFont, 'normal')
      doc.setFontSize(9)
      doc.setTextColor(60, 60, 60)
      doc.text(customDesignation, lm, y)
      y += 4.5
    }
    if (showRecipientAddress && customAddress) {
      doc.setFont(pdfFont, 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(90, 90, 90)
      const addrLines = doc.splitTextToSize(customAddress, pw / 2)
      doc.text(addrLines, lm, y)
      y += addrLines.length * 4 + 1
    }
    if (customEmail) {
      doc.setFont(pdfFont, 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(90, 90, 90)
      doc.text(customEmail, lm, y)
      y += 4.5
    }
    if (customPhone) {
      doc.setFont(pdfFont, 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(90, 90, 90)
      doc.text(customPhone, lm, y)
      y += 4.5
    }

    y += 6

    // ── 6. SUBJECT LINE ───────────────────────────────────────────────────────
    const subjectStr = `Sub: ${subject || selectedDocType}`
    doc.setFont(pdfFont, 'bold')
    doc.setFontSize(10)
    doc.setTextColor(primaryRGB.r, primaryRGB.g, primaryRGB.b)
    const subLines = doc.splitTextToSize(subjectStr, pw)
    doc.text(subLines, lm, y)
    y += subLines.length * 5 + 2

    doc.setDrawColor(accentRGB.r, accentRGB.g, accentRGB.b)
    doc.setLineWidth(0.3)
    doc.line(lm, y, lm + 80, y)
    y += 7

    // ── 7. BODY ───────────────────────────────────────────────────────────────
    const compiledBody = compileContent(documentBody)
    const paragraphs = compiledBody.split('\n')
    const lhMm = bodyFontSize * 0.352778 * lineHeight

    doc.setFont(pdfFont, 'normal')
    doc.setFontSize(bodyFontSize)
    doc.setTextColor(40, 40, 40)

    for (const para of paragraphs) {
      const trimmed = para.trim()
      if (!trimmed) {
        y += lhMm * 0.5
        continue
      }
      const lines = doc.splitTextToSize(trimmed, pw)
      if (y + lines.length * lhMm > 262) {
        doc.addPage()
        y = 20
        // Repeat top bar on new page
        doc.setFillColor(primaryRGB.r, primaryRGB.g, primaryRGB.b)
        doc.rect(0, 0, 210, 2.5, 'F')
      }
      doc.text(lines, lm, y)
      y += lines.length * lhMm + 1.5
    }

    // ── 8. TERMS (optional) ───────────────────────────────────────────────────
    if (terms) {
      y += 4
      if (y > 248) { doc.addPage(); y = 20 }
      doc.setFont(pdfFont, 'bold')
      doc.setFontSize(8.5)
      doc.setTextColor(primaryRGB.r, primaryRGB.g, primaryRGB.b)
      doc.text('Terms & Conditions:', lm, y)
      y += 4
      doc.setFont(pdfFont, 'normal')
      doc.setFontSize(8)
      doc.setTextColor(90, 90, 90)
      const tLines = doc.splitTextToSize(terms, pw)
      doc.text(tLines, lm, y)
      y += tLines.length * 4 + 2
    }

    // ── 9. NOTES ──────────────────────────────────────────────────────────────
    if (notes) {
      y += 3
      doc.setFont(pdfFont, 'italic')
      doc.setFontSize(8)
      doc.setTextColor(140, 140, 140)
      const nLines = doc.splitTextToSize(`Note: ${notes}`, pw)
      doc.text(nLines, lm, y)
      y += nLines.length * 4 + 2
    }

    // ── 10. SIGNATURE BLOCK ───────────────────────────────────────────────────
    y += 10
    if (y > 240) { doc.addPage(); y = 25 }

    doc.setFont(pdfFont, 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(50, 50, 50)
    doc.text('For Acme Interiors,', lm, y)

    if (isOfferLetter) {
      doc.text('Accepted & Confirmed By,', lm + 110, y)
    }

    y += 18

    // Signature line
    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.35)
    doc.line(lm, y, lm + 50, y)

    if (isOfferLetter) {
      doc.line(lm + 110, y, lm + 160, y)
    }

    y += 4.5

    doc.setFont(pdfFont, 'bold')
    doc.setFontSize(10)
    doc.setTextColor(primaryRGB.r, primaryRGB.g, primaryRGB.b)
    doc.text(authorizedPerson, lm, y)

    if (isOfferLetter) {
      doc.text(customName || 'Employee Signature', lm + 110, y)
    }

    y += 4.5

    doc.setFont(pdfFont, 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(100, 100, 100)
    doc.text(signatureDesignation, lm, y)

    if (isOfferLetter) {
      doc.text('Date: _________________', lm + 110, y)
    }

    y += 4
    doc.text('Acme Interiors', lm, y)

    // ── 11. FOOTER BAR (all pages) ────────────────────────────────────────────
    const pageCount = (doc.internal as any).getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      // Dark footer bar
      doc.setFillColor(primaryRGB.r, primaryRGB.g, primaryRGB.b)
      doc.rect(0, 281, 210, 16, 'F')
      // Footer text
      doc.setFont(pdfFont, 'normal')
      doc.setFontSize(7)
      doc.setTextColor(255, 255, 255)
      doc.text(
        '221 Demo Street, Hyderabad - 500001  |  +91 90000 00000  |  hello@example.com  |  www.example.com',
        105, 287, { align: 'center' }
      )
      doc.setFontSize(6.5)
      doc.setTextColor(accentRGB.r, accentRGB.g, accentRGB.b)
      doc.text(`${footerText}  |  Page ${i} of ${pageCount}`, 105, 292.5, { align: 'center' })
    }

    return doc.output('blob')
  }

  // ─── Generate Word Document (DOCX) ──────────────────────────────────────────
  const generateDocxBlob = async (): Promise<Blob> => {
    const compiledBody = compileContent(documentBody)
    const cleanPrimaryHex = primaryColor.replace('#', '')
    const cleanAccentHex = accentColor.replace('#', '')

    const bodyParagraphs = compiledBody.split('\n').map(para =>
      new docx.Paragraph({
        children: [
          new docx.TextRun({
            text: para.trim(),
            size: bodyFontSize * 2,
            font: fontFamily,
            color: '282828',
          }),
        ],
        spacing: { before: 80, after: 80, line: Math.round(lineHeight * 240), lineRule: docx.LineRuleType.AUTO },
      })
    )

    const docxHeaderChildren: any[] = []
    let docxHasLogo = false

    if (showLogo && logoBase64 && !logoLoadError) {
      try {
        const logoBuffer = Uint8Array.from(atob(logoBase64.split(',')[1]), c => c.charCodeAt(0))
        let logoWidth = 160
        if (logoSize === 'small') logoWidth = 100
        if (logoSize === 'large') logoWidth = 200
        const logoHeight = Math.round(logoWidth / logoAspectRatio)
        docxHeaderChildren.push(
          new docx.Paragraph({
            alignment: docx.AlignmentType.LEFT,
            children: [
              new docx.ImageRun({
                data: logoBuffer as any,
                type: "png",
                transformation: { width: logoWidth, height: logoHeight },
              }),
            ],
            spacing: { after: 120 },
          })
        )
        docxHasLogo = true
      } catch (err) {
        console.error("Failed to add image to DOCX", err)
      }
    }

    if (!docxHasLogo) {
      docxHeaderChildren.push(
        new docx.Paragraph({
          alignment: docx.AlignmentType.LEFT,
          children: [
            new docx.TextRun({ text: 'ACME INTERIORS', bold: true, size: 36, font: fontFamily, color: cleanPrimaryHex }),
          ],
        }),
        new docx.Paragraph({
          alignment: docx.AlignmentType.LEFT,
          children: [
            new docx.TextRun({ text: 'INTERIOR SOLUTIONS & DESIGN LAB', bold: true, size: 16, font: fontFamily, color: cleanAccentHex }),
          ],
          spacing: { after: 120 },
        })
      )
    }

    // Document Title
    docxHeaderChildren.push(
      new docx.Paragraph({
        alignment: docx.AlignmentType.CENTER,
        children: [
          new docx.TextRun({ text: selectedDocType.toUpperCase(), bold: true, size: 28, font: fontFamily, color: cleanPrimaryHex }),
        ],
        spacing: { before: 200, after: 200 },
        border: {
          bottom: { color: cleanAccentHex, space: 4, style: docx.BorderStyle.SINGLE, size: 8 },
        },
      })
    )

    const d = new docx.Document({
      sections: [{
        properties: {
          page: {
            margin: { top: 720, right: 720, bottom: 1080, left: 720 },
          },
        },
        children: [
          ...docxHeaderChildren,

          // Company address row
          new docx.Paragraph({
            alignment: docx.AlignmentType.LEFT,
            children: [
              new docx.TextRun({ text: 'Acme Interiors', bold: true, size: 18, font: fontFamily, color: cleanPrimaryHex }),
            ],
            spacing: { before: 200 },
          }),
          new docx.Paragraph({
            children: [new docx.TextRun({ text: '221 Demo Street, Hyderabad - 500001', size: 16, font: fontFamily, color: '505050' })],
          }),
          new docx.Paragraph({
            children: [new docx.TextRun({ text: 'Tel: +91 90000 00000  |  Email: hello@example.com  |  Web: www.example.com', size: 16, font: fontFamily, color: '505050' })],
            spacing: { after: 80 },
          }),

          // Date right aligned
          new docx.Paragraph({
            alignment: docx.AlignmentType.RIGHT,
            children: [new docx.TextRun({ text: `Date: ${letterDate}`, bold: true, size: 20, font: fontFamily })],
            spacing: { after: 200 },
          }),

          // Recipient block
          new docx.Paragraph({
            children: [new docx.TextRun({ text: 'TO,', bold: true, size: 18, font: fontFamily, color: '808080' })],
          }),
          new docx.Paragraph({
            children: [new docx.TextRun({ text: customName || 'Recipient Name', bold: true, size: 22, font: fontFamily, color: cleanPrimaryHex })],
          }),
          ...(customDesignation ? [new docx.Paragraph({ children: [new docx.TextRun({ text: customDesignation, size: 19, font: fontFamily, color: '404040' })] })] : []),
          ...(showRecipientAddress && customAddress ? [new docx.Paragraph({ children: [new docx.TextRun({ text: customAddress, size: 18, font: fontFamily, color: '606060' })] })] : []),
          ...(customEmail ? [new docx.Paragraph({ children: [new docx.TextRun({ text: customEmail, size: 18, font: fontFamily, color: '606060' })] })] : []),
          ...(customPhone ? [new docx.Paragraph({ children: [new docx.TextRun({ text: customPhone, size: 18, font: fontFamily, color: '606060' })], spacing: { after: 120 } })] : []),

          // Subject line
          new docx.Paragraph({
            children: [new docx.TextRun({ text: `Sub: ${subject || selectedDocType}`, bold: true, size: 22, font: fontFamily, color: cleanPrimaryHex })],
            spacing: { before: 200, after: 200 },
            border: { bottom: { color: cleanAccentHex, space: 2, style: docx.BorderStyle.SINGLE, size: 4 } },
          }),

          // Body
          ...bodyParagraphs,

          // Terms
          ...(terms ? [
            new docx.Paragraph({ children: [new docx.TextRun({ text: 'Terms & Conditions:', bold: true, size: 18, font: fontFamily, color: cleanPrimaryHex })], spacing: { before: 240, after: 100 } }),
            new docx.Paragraph({ children: [new docx.TextRun({ text: terms, size: 16, font: fontFamily, color: '505050' })], spacing: { after: 100 } }),
          ] : []),

          // Notes
          ...(notes ? [
            new docx.Paragraph({ children: [new docx.TextRun({ text: `Note: ${notes}`, italics: true, size: 16, font: fontFamily, color: '909090' })], spacing: { before: 100, after: 240 } }),
          ] : []),

          // Signature block
          ...(isOfferLetter ? [
            new docx.Table({
              width: { size: 100, type: docx.WidthType.PERCENTAGE },
              borders: {
                top: { style: docx.BorderStyle.NONE },
                bottom: { style: docx.BorderStyle.NONE },
                left: { style: docx.BorderStyle.NONE },
                right: { style: docx.BorderStyle.NONE },
                insideHorizontal: { style: docx.BorderStyle.NONE },
                insideVertical: { style: docx.BorderStyle.NONE },
              },
              rows: [
                new docx.TableRow({
                  children: [
                    new docx.TableCell({
                      width: { size: 50, type: docx.WidthType.PERCENTAGE },
                      children: [
                        new docx.Paragraph({ children: [new docx.TextRun({ text: 'For Acme Interiors,', size: 20, font: fontFamily })], spacing: { before: 200, after: 300 } }),
                        new docx.Paragraph({ children: [new docx.TextRun({ text: '___________________________', size: 20, font: fontFamily, color: 'AAAAAA' })], spacing: { after: 60 } }),
                        new docx.Paragraph({ children: [new docx.TextRun({ text: authorizedPerson, bold: true, size: 22, font: fontFamily, color: cleanPrimaryHex })] }),
                        new docx.Paragraph({ children: [new docx.TextRun({ text: signatureDesignation, size: 18, font: fontFamily, color: '606060' })] }),
                        new docx.Paragraph({ children: [new docx.TextRun({ text: 'Acme Interiors', size: 18, font: fontFamily, color: '606060' })] }),
                      ],
                    }),
                    new docx.TableCell({
                      width: { size: 50, type: docx.WidthType.PERCENTAGE },
                      children: [
                        new docx.Paragraph({ children: [new docx.TextRun({ text: 'Accepted & Confirmed By,', size: 20, font: fontFamily })], spacing: { before: 200, after: 300 } }),
                        new docx.Paragraph({ children: [new docx.TextRun({ text: '___________________________', size: 20, font: fontFamily, color: 'AAAAAA' })], spacing: { after: 60 } }),
                        new docx.Paragraph({ children: [new docx.TextRun({ text: customName || 'Employee Signature', bold: true, size: 22, font: fontFamily, color: cleanPrimaryHex })] }),
                        new docx.Paragraph({ children: [new docx.TextRun({ text: 'Date: ____________________', size: 18, font: fontFamily, color: '606060' })] }),
                      ],
                    }),
                  ],
                }),
              ],
            })
          ] : [
            new docx.Paragraph({ children: [new docx.TextRun({ text: 'For Acme Interiors,', size: 20, font: fontFamily })], spacing: { before: 400, after: 80 } }),
            new docx.Paragraph({ children: [new docx.TextRun({ text: ' ', size: 40 })], spacing: { after: 80 } }),
            new docx.Paragraph({ children: [new docx.TextRun({ text: '___________________________', size: 20, font: fontFamily, color: 'AAAAAA' })], spacing: { after: 60 } }),
            new docx.Paragraph({ children: [new docx.TextRun({ text: authorizedPerson, bold: true, size: 22, font: fontFamily, color: cleanPrimaryHex })] }),
            new docx.Paragraph({ children: [new docx.TextRun({ text: signatureDesignation, size: 18, font: fontFamily, color: '606060' })] }),
            new docx.Paragraph({ children: [new docx.TextRun({ text: 'Acme Interiors', size: 18, font: fontFamily, color: '606060' })] }),
          ])
        ],
      }],
    })

    return await docx.Packer.toBlob(d)
  }

  const downloadPdfFile = () => {
    try {
      const blob = generatePdfBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${selectedDocType.replace(/\s+/g, '_')}_${(customName || 'Draft').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast({ title: "PDF Exported", description: "PDF downloaded successfully." })
    } catch (err: any) {
      toast({ title: "PDF Export Failed", variant: "destructive", description: err.message })
    }
  }

  const downloadDocxFile = async () => {
    try {
      const blob = await generateDocxBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${selectedDocType.replace(/\s+/g, '_')}_${(customName || 'Draft').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.docx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast({ title: "DOCX Exported", description: "DOCX downloaded successfully." })
    } catch (err: any) {
      toast({ title: "DOCX Export Failed", variant: "destructive", description: err.message })
    }
  }

  const issueDocFn = async () => {
    if (!customName) {
      toast({ title: "Validation Error", variant: "destructive", description: "Recipient name is required." })
      return
    }
    if (!documentBody || !documentBody.trim()) {
      toast({ title: "Validation Error", variant: "destructive", description: "Document body cannot be empty." })
      return
    }
    const unresolved = getUnresolvedPlaceholders()
    if (unresolved.length > 0) {
      toast({ title: "Placeholders Unresolved", variant: "destructive", description: `Please resolve: ${unresolved.map(p => `{{${p}}}`).join(', ')}` })
      return
    }
    
    setIsIssuing(true)
    const activeToast = toast({ title: "Issuing Document", description: "Uploading document files and updating status..." })
    try {
      let targetId = currentDraftId
      if (!targetId) {
        targetId = await createDraft({
          memberType,
          userId: memberType === 'existing' && selectedUserId ? (selectedUserId as any) : undefined,
          employeeName: customName,
          email: customEmail || undefined,
          phone: customPhone || undefined,
          designation: customDesignation || undefined,
          documentType: selectedDocType,
          templateName: selectedTemplateName,
          documentTitle,
          documentBody,
          documentFields: dynamicFields,
          requestorEmail
        })
        setCurrentDraftId(targetId)
      } else {
        await updateDraft({
          id: targetId as any,
          documentTitle,
          documentBody,
          documentFields: dynamicFields,
          employeeName: customName,
          email: customEmail || undefined,
          phone: customPhone || undefined,
          designation: customDesignation || undefined,
          requestorEmail
        })
      }

      const result = await issueDocument({ id: targetId as any, requestorEmail })
      setDocumentStatus('issued')

      const pdfBlob = generatePdfBlob()
      const uploadUrl = await generateUploadUrl({ requestorEmail })
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "application/pdf" },
        body: pdfBlob
      })
      if (!uploadResponse.ok) throw new Error("PDF Storage upload failed")
      const { storageId: pdfStorageId } = await uploadResponse.json()

      await saveDocFiles({ id: targetId as any, pdfStorageId, requestorEmail })

      if (memberType === 'existing' && selectedUserId) {
        await saveUserDocument({
          userId: selectedUserId as any,
          userName: customName,
          documentTitle: documentTitle || selectedDocType,
          documentType: "HR Document",
          fileName: `${selectedDocType.replace(/\s+/g, '_')}_${(customName || 'Draft').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`,
          fileType: "application/pdf",
          fileSize: pdfBlob.size,
          storageId: pdfStorageId,
          notes: notes || `Officially Issued ${selectedDocType}`,
          visibility: "manager_visible",
          requestorEmail
        })
      }

      activeToast.dismiss()
      toast({ title: "Document Issued", description: `Successfully issued: ${result.documentNumber}` })
    } catch (err: any) {
      activeToast.dismiss()
      toast({ title: "Issue Failed", variant: "destructive", description: err.message || "Failed to officially issue document." })
    } finally {
      setIsIssuing(false)
    }
  }

  const triggerEmailDispatch = async () => {
    if (!emailTo) {
      toast({ title: "Recipient Email Needed", variant: "destructive" })
      return
    }
    setIsEmailing(true)
    const emailToast = toast({ title: "Sending Email", description: "Drafting email with document attachment..." })
    try {
      const pdfBlob = generatePdfBlob()
      const reader = new FileReader()
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1]
          resolve(base64)
        }
      })
      reader.readAsDataURL(pdfBlob)
      const pdfBase64 = await base64Promise

      const res = await fetch("/api/hr/send-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: emailTo,
          subject: emailSubject,
          message: emailMessage,
          pdfBase64,
          fileName: `${selectedDocType.replace(/\s+/g, '_')}_${(customName || 'Draft').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
        })
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.message || "Failed to send email")

      if (currentDraftId) {
        await emailDoc({ id: currentDraftId as any, requestorEmail })
        setDocumentStatus('emailed')
      }

      emailToast.dismiss()
      setEmailModalOpen(false)
      toast({ title: "Email Dispatched", description: "Document emailed successfully to recipient." })
    } catch (err: any) {
      emailToast.dismiss()
      toast({ title: "Email Failed", variant: "destructive", description: err.message || "Could not complete email transmission." })
    } finally {
      setIsEmailing(false)
    }
  }

  const openEmailModal = () => {
    setEmailTo(customEmail)
    setEmailSubject(`${selectedDocType} – Acme Interiors`)
    setEmailMessage(`Dear ${customName},\n\nPlease find attached the official ${selectedDocType} issued by Acme Interiors.\n\nFor any queries, please reach out to us at hello@example.com or +91 90000 00000.\n\nWarm regards,\n${authorizedPerson}\n${signatureDesignation}\nAcme Interiors`)
    setEmailModalOpen(true)
  }

  const handleDocTypeSelection = (newType: string) => {
    if (documentBody && documentBody.length > 50) {
      setPendingDocType(newType)
      setShowDocTypeConfirm(true)
    } else {
      setSelectedDocType(newType)
    }
  }

  const handleConfirmDocTypeChange = () => {
    if (pendingDocType) {
      setSelectedDocType(pendingDocType)
      setSelectedTemplateName("Member Default")
      setPendingDocType(null)
    }
    setShowDocTypeConfirm(false)
  }

  const renderAccordionSection = (id: string, icon: React.ReactNode, title: string, content: React.ReactNode) => {
    const isOpen = openAccordion === id
    return (
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl overflow-hidden transition-all duration-300">
        <button
          type="button"
          onClick={() => setOpenAccordion(isOpen ? '' : id)}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-900/60 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            {icon}
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200">{title}</span>
          </div>
          <span className="text-slate-400 text-xs font-black">{isOpen ? '▲' : '▼'}</span>
        </button>
        {isOpen && (
          <div className="p-5 border-t border-slate-800/50 space-y-4 bg-slate-950/20">
            {content}
          </div>
        )}
      </div>
    )
  }

  if (!open) return null

  const unresolvedVars = getUnresolvedPlaceholders()
  const primaryRGBPreview = hexToRgb(primaryColor)
  const accentRGBPreview = hexToRgb(accentColor)
  const previewFont = FONT_MAP[fontFamily as keyof typeof FONT_MAP] || 'sans-serif'

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-950 border border-slate-800 text-white rounded-3xl w-full max-w-7xl h-[92vh] flex flex-col overflow-hidden shadow-2xl relative">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-primary/10 to-transparent shrink-0">
          <div>
            <h1 className="text-xl font-black italic uppercase tracking-tighter text-white">HR Document Studio</h1>
            <p className="text-xs text-slate-400 font-medium">Generate, customize & issue professional HR documents.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl hover:bg-rose-500/10 hover:text-rose-500">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Studio Panel Body */}
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row min-h-0">
          
          {/* LEFT PANEL – Controls (45%) */}
          <div className="w-full lg:w-[42%] p-5 overflow-y-auto border-r border-slate-800 space-y-3 bg-slate-950">
            
            {/* 1. Recipient */}
            {renderAccordionSection(
              'recipient',
              <User className="h-4 w-4 text-emerald-400" />,
              'Recipient Details',
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant={memberType === 'existing' ? 'default' : 'outline'} onClick={() => setMemberType('existing')} className="rounded-xl font-bold uppercase tracking-wider text-[10px] h-9">Existing Employee</Button>
                  <Button type="button" variant={memberType === 'custom' ? 'default' : 'outline'} onClick={() => setMemberType('custom')} className="rounded-xl font-bold uppercase tracking-wider text-[10px] h-9">New / Custom</Button>
                </div>
                {memberType === 'existing' ? (
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-300">Select Employee</Label>
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                      <SelectTrigger className="bg-slate-900 border-slate-800 rounded-xl h-11 text-xs"><SelectValue placeholder="Select operative..." /></SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-800 text-white">
                        {members?.map(m => (<SelectItem key={m._id} value={m._id}>{m.name} ({m.role})</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1"><Label className="text-xs font-bold text-slate-300">Full Name</Label><Input placeholder="Full Name" className="bg-slate-900 border-slate-800 rounded-xl h-10 text-xs" value={customName} onChange={(e) => setCustomName(e.target.value)} /></div>
                    <div className="space-y-1"><Label className="text-xs font-bold text-slate-300">Email</Label><Input type="email" placeholder="email@domain.com" className="bg-slate-900 border-slate-800 rounded-xl h-10 text-xs" value={customEmail} onChange={(e) => setCustomEmail(e.target.value)} /></div>
                    <div className="space-y-1"><Label className="text-xs font-bold text-slate-300">Phone</Label><Input placeholder="Phone" className="bg-slate-900 border-slate-800 rounded-xl h-10 text-xs" value={customPhone} onChange={(e) => setCustomPhone(e.target.value)} /></div>
                    <div className="space-y-1 sm:col-span-2"><Label className="text-xs font-bold text-slate-300">Address</Label><Textarea placeholder="Correspondence address..." rows={2} className="bg-slate-900 border-slate-800 rounded-xl text-xs" value={customAddress} onChange={(e) => setCustomAddress(e.target.value)} /></div>
                  </div>
                )}
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <Label className="text-xs font-bold text-slate-300">Include Address in "TO"</Label>
                  <div className="flex gap-1.5 w-24">
                    <Button type="button" size="sm" variant={showRecipientAddress ? 'default' : 'outline'} onClick={() => setShowRecipientAddress(true)} className="flex-1 rounded-xl h-8 text-[10px]">Yes</Button>
                    <Button type="button" size="sm" variant={!showRecipientAddress ? 'default' : 'outline'} onClick={() => setShowRecipientAddress(false)} className="flex-1 rounded-xl h-8 text-[10px]">No</Button>
                  </div>
                </div>
              </div>
            )}

            {/* 2. Job Details */}
            {renderAccordionSection(
              'job',
              <Briefcase className="h-4 w-4 text-sky-400" />,
              'Job & Location Details',
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs font-bold text-slate-300">Designation</Label><Input placeholder="Job Designation" className="bg-slate-900 border-slate-800 rounded-xl h-10 text-xs" value={customDesignation} onChange={(e) => setCustomDesignation(e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs font-bold text-slate-300">Department</Label><Input placeholder="e.g. Creative, Site Ops" className="bg-slate-900 border-slate-800 rounded-xl h-10 text-xs" value={customDepartment} onChange={(e) => setCustomDepartment(e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs font-bold text-slate-300">Joining Date</Label><Input type="date" className="bg-slate-900 border-slate-800 rounded-xl h-10 text-xs" value={customJoiningDate} onChange={(e) => setCustomJoiningDate(e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs font-bold text-slate-300">Exit / Last Date</Label><Input type="date" className="bg-slate-900 border-slate-800 rounded-xl h-10 text-xs" value={exitDate} onChange={(e) => setExitDate(e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs font-bold text-slate-300">Salary / Stipend</Label><Input placeholder="e.g. 35000" className="bg-slate-900 border-slate-800 rounded-xl h-10 text-xs" value={customSalary} onChange={(e) => setCustomSalary(e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs font-bold text-slate-300">Site / Location</Label><Input placeholder="e.g. Main Studio" className="bg-slate-900 border-slate-800 rounded-xl h-10 text-xs" value={customSite} onChange={(e) => setCustomSite(e.target.value)} /></div>
                <div className="space-y-1 sm:col-span-2"><Label className="text-xs font-bold text-slate-300">Reporting Manager</Label><Input className="bg-slate-900 border-slate-800 rounded-xl h-10 text-xs" value={reportingManager} onChange={(e) => setReportingManager(e.target.value)} /></div>
              </div>
            )}

            {/* 3. Document Config */}
            {renderAccordionSection(
              'doc_config',
              <FileText className="h-4 w-4 text-amber-400" />,
              'Document Details',
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-300">Document Type</Label>
                    <Select value={selectedDocType} onValueChange={handleDocTypeSelection}>
                      <SelectTrigger className="bg-slate-900 border-slate-800 rounded-xl text-xs h-10"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-800 text-white">
                        {DOCUMENT_TYPES.map(t => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-300">Letter Date</Label>
                    <Input value={letterDate} onChange={(e) => setLetterDate(e.target.value)} className="bg-slate-900 border-slate-800 rounded-xl h-10 text-xs" />
                  </div>
                </div>
                <div className="space-y-1"><Label className="text-xs font-bold text-slate-300">Subject Line</Label><Input placeholder="Subject of the letter..." value={subject} onChange={(e) => setSubject(e.target.value)} className="bg-slate-900 border-slate-800 rounded-xl h-10 text-xs" /></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-xs font-bold text-slate-300">Authorized Signatory</Label><Input value={authorizedPerson} onChange={(e) => setAuthorizedPerson(e.target.value)} className="bg-slate-900 border-slate-800 rounded-xl h-10 text-xs" /></div>
                  <div className="space-y-1"><Label className="text-xs font-bold text-slate-300">Signatory Designation</Label><Input value={signatureDesignation} onChange={(e) => setSignatureDesignation(e.target.value)} className="bg-slate-900 border-slate-800 rounded-xl h-10 text-xs" /></div>
                </div>
              </div>
            )}

            {/* 4. Document Content Editor */}
            {renderAccordionSection(
              'editor',
              <Sparkles className="h-4 w-4 text-violet-400" />,
              'Document Content Editor',
              <div className="space-y-4">
                <div className="flex flex-wrap gap-1.5 p-2 bg-slate-900 rounded-xl border border-slate-800">
                  <span className="text-[9px] font-black uppercase text-slate-500 w-full mb-1 px-1">Quick Insert Placeholders:</span>
                  {[
                    ['Name', 'employeeName'], ['Designation', 'designation'], ['Join Date', 'joiningDate'],
                    ['Exit Date', 'exitDate'], ['Salary', 'salary'], ['Company', 'companyName'],
                    ['Site', 'siteName'], ['Dept', 'department'], ['Manager', 'reportingManager'],
                    ['Date', 'letterDate']
                  ].map(([label, token]) => (
                    <button key={token} type="button" onClick={() => insertPlaceholder(token)}
                      className="px-2 py-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[10px] rounded-lg text-slate-300 transition-colors font-medium">
                      + {label}
                    </button>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-300">Document Body</Label>
                  <Textarea ref={textareaRef} rows={12} className="bg-slate-900 border-slate-800 rounded-xl font-mono text-[11px] leading-relaxed" value={documentBody} onChange={(e) => setDocumentBody(e.target.value)} />
                </div>

                {unresolvedVars.length > 0 && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded-xl flex items-start gap-2.5">
                    <AlertCircle className="h-4 w-4 text-rose-400 mt-0.5 shrink-0" />
                    <div className="text-[11px] text-rose-300 leading-normal">
                      <strong>Unresolved Placeholders:</strong> {unresolvedVars.map(p => `{{${p}}}`).join(', ')}
                    </div>
                  </div>
                )}

                {getPlaceholders().length > 0 && (
                  <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 space-y-3">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Variable Values</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {getPlaceholders().map(key => (
                        <div key={key} className="space-y-1">
                          <Label className="text-[10px] font-bold text-slate-400">{key}</Label>
                          <Input value={dynamicFields[key] || ''} onChange={(e) => handleFieldChange(key, e.target.value)} className="bg-slate-950 border-slate-800 h-9 rounded-lg text-xs" placeholder={`Enter ${key}...`} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5"><Label className="text-xs font-bold text-slate-300">Terms & Conditions (Optional)</Label><Textarea rows={3} placeholder="Probation terms, notice period, conditions..." className="bg-slate-900 border-slate-800 rounded-xl text-xs" value={terms} onChange={(e) => setTerms(e.target.value)} /></div>
                <div className="space-y-1.5"><Label className="text-xs font-bold text-slate-300">Footnotes / Notes</Label><Input placeholder="Confidentiality notice, instructions..." className="bg-slate-900 border-slate-800 rounded-xl h-10 text-xs" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>

                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="outline" onClick={() => {
                    const matched = templates?.find(t => t.documentType === selectedDocType && t.templateName === selectedTemplateName)
                    if (matched) { setDocumentBody(matched.body) }
                    else if (DEFAULT_TEMPLATE_BODIES[selectedDocType]) { setDocumentBody(DEFAULT_TEMPLATE_BODIES[selectedDocType].body) }
                    toast({ title: "Template Reset", description: "Body content restored to default." })
                  }} className="flex-1 rounded-xl h-10 border-slate-800 bg-slate-900 text-xs">
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset Template
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setSaveTemplateDialogOpen(true)} className="flex-1 rounded-xl h-10 border-slate-800 bg-slate-900 text-xs text-violet-400 hover:text-violet-300">
                    <PlusCircle className="h-3.5 w-3.5 mr-1.5" /> Save as Template
                  </Button>
                </div>
              </div>
            )}

            {/* 5. Design Customization */}
            {renderAccordionSection(
              'customization',
              <Sliders className="h-4 w-4 text-rose-400" />,
              'Customize Design',
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-300">Show Logo</Label>
                    <div className="flex gap-2">
                      <Button type="button" variant={showLogo ? 'default' : 'outline'} onClick={() => setShowLogo(true)} className="flex-1 rounded-xl h-9 border-slate-800 bg-slate-900 text-[11px]">On</Button>
                      <Button type="button" variant={!showLogo ? 'default' : 'outline'} onClick={() => setShowLogo(false)} className="flex-1 rounded-xl h-9 border-slate-800 bg-slate-900 text-[11px]">Off</Button>
                    </div>
                  </div>
                  {showLogo && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-300">Logo Size</Label>
                      <div className="flex gap-1">
                        {(['small', 'medium', 'large'] as const).map(sz => (
                          <Button key={sz} type="button" variant={logoSize === sz ? 'default' : 'outline'} onClick={() => setLogoSize(sz)} className="flex-1 rounded-xl h-9 border-slate-800 bg-slate-900 text-[10px] capitalize">{sz}</Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-300">Font Family</Label>
                  <Select value={fontFamily} onValueChange={setFontFamily}>
                    <SelectTrigger className="bg-slate-900 border-slate-800 rounded-xl h-10 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-white">
                      <SelectItem value="Helvetica">Helvetica (Sans-Serif)</SelectItem>
                      <SelectItem value="Arial">Arial (Standard Sans)</SelectItem>
                      <SelectItem value="Inter">Inter (Modern Sans)</SelectItem>
                      <SelectItem value="Times New Roman">Times New Roman (Formal Serif)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Body Size</Label>
                    <Select value={String(bodyFontSize)} onValueChange={(val) => setBodyFontSize(Number(val))}>
                      <SelectTrigger className="bg-slate-900 border-slate-800 rounded-xl h-9 text-[11px]"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-800 text-white">
                        {[9, 10, 11, 12, 13].map(sz => (<SelectItem key={sz} value={String(sz)}>{sz}pt</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Line Ht.</Label>
                    <Select value={String(lineHeight)} onValueChange={(val) => setLineHeight(Number(val))}>
                      <SelectTrigger className="bg-slate-900 border-slate-800 rounded-xl h-9 text-[11px]"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-800 text-white">
                        {[1.3, 1.4, 1.5, 1.6, 1.8].map(lh => (<SelectItem key={lh} value={String(lh)}>{lh}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Show Contact</Label>
                    <div className="flex gap-1">
                      <Button type="button" variant={showContactLine ? 'default' : 'outline'} onClick={() => setShowContactLine(true)} className="flex-1 rounded-xl h-9 border-slate-800 bg-slate-900 text-[9px]">Yes</Button>
                      <Button type="button" variant={!showContactLine ? 'default' : 'outline'} onClick={() => setShowContactLine(false)} className="flex-1 rounded-xl h-9 border-slate-800 bg-slate-900 text-[9px]">No</Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-300">Primary Color</Label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {['#1a1a2e', '#0f3460', '#065f46', '#7c2d12', '#1e3a5f'].map(c => (
                      <button key={c} type="button" onClick={() => setPrimaryColor(c)} style={{ backgroundColor: c }} className={`w-7 h-7 rounded-full border-2 transition-all ${primaryColor === c ? 'border-white scale-110' : 'border-transparent'}`} />
                    ))}
                    <Input type="text" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-24 h-8 bg-slate-900 border-slate-800 text-[11px] rounded-lg px-2 ml-auto text-slate-300" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-300">Accent Color</Label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {['#c8a96e', '#f59e0b', '#10b981', '#3b82f6', '#e11d48'].map(c => (
                      <button key={c} type="button" onClick={() => setAccentColor(c)} style={{ backgroundColor: c }} className={`w-7 h-7 rounded-full border-2 transition-all ${accentColor === c ? 'border-white scale-110' : 'border-transparent'}`} />
                    ))}
                    <Input type="text" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="w-24 h-8 bg-slate-900 border-slate-800 text-[11px] rounded-lg px-2 ml-auto text-slate-300" />
                  </div>
                </div>
                <div className="space-y-1.5"><Label className="text-xs font-bold text-slate-300">Footer Text</Label><Input value={footerText} onChange={(e) => setFooterText(e.target.value)} className="bg-slate-900 border-slate-800 rounded-xl h-10 text-xs" /></div>
              </div>
            )}
          </div>

          {/* RIGHT PANEL – Live A4 Preview (58%) */}
          <div className="w-full lg:w-[58%] bg-[#1e2027] overflow-y-auto flex flex-col items-center py-5 px-4">
            
            {/* Preview Controls */}
            <div className="w-full max-w-[620px] bg-slate-950 border border-slate-800 p-2.5 rounded-2xl mb-4 flex items-center justify-between gap-3 text-xs font-bold text-slate-400 shrink-0">
              <span className="uppercase tracking-widest text-[9.5px] text-slate-500 pl-1">A4 Preview ({Math.round(zoom * 100)}%)</span>
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="sm" onClick={() => setZoom(prev => Math.max(0.5, prev - 0.1))} className="h-8 w-14 rounded-xl bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 text-[11px]">− Zoom</Button>
                <Button variant="outline" size="sm" onClick={() => setZoom(0.85)} className="h-8 rounded-xl bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 px-3 text-[11px]">Fit</Button>
                <Button variant="outline" size="sm" onClick={() => setZoom(prev => Math.min(1.4, prev + 0.1))} className="h-8 w-14 rounded-xl bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 text-[11px]">Zoom +</Button>
              </div>
            </div>

            {/* A4 White Document Page */}
            <div className="flex justify-center w-full">
              <div
                id="a4-document-preview"
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top center',
                  transition: 'transform 0.15s ease-out',
                  width: '595px',
                  minHeight: '842px',
                  marginBottom: `${(842 * (zoom - 1)) + 24}px`,
                  fontFamily: previewFont,
                  fontSize: `${bodyFontSize}px`,
                  lineHeight: lineHeight,
                }}
                className="bg-white text-slate-900 shadow-2xl relative overflow-hidden"
              >
                {/* TOP ACCENT BAR */}
                <div style={{ backgroundColor: primaryColor, height: '5px', width: '100%' }} />

                {/* MAIN CONTENT AREA */}
                <div className="px-[20mm] pt-[8mm] pb-[18mm]">

                  {/* LOGO ROW: logo left + doc title right */}
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      {showLogo && logoBase64 && !logoLoadError ? (
                        <img
                          src={logoBase64}
                          alt="Acme Interiors"
                          style={{
                            height: logoSize === 'small' ? '36px' : logoSize === 'large' ? '72px' : '54px',
                            width: 'auto',
                            maxWidth: '220px',
                            objectFit: 'contain',
                          }}
                          onError={() => setLogoLoadError(true)}
                        />
                      ) : (
                        <div>
                          <div style={{ color: primaryColor, fontSize: `${headerFontSize}px` }} className="font-black tracking-tight uppercase leading-none">Acme Interiors</div>
                          <div style={{ color: accentColor }} className="text-[8px] font-bold tracking-widest uppercase mt-0.5">Interior Solutions</div>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div style={{ color: primaryColor, fontSize: '15px' }} className="font-black uppercase tracking-wide leading-tight max-w-[220px] text-right">
                        {selectedDocType.toUpperCase()}
                      </div>
                    </div>
                  </div>

                  {/* ACCENT DIVIDER */}
                  <div style={{ backgroundColor: accentColor, height: '1.5px', width: '100%', marginBottom: '10px' }} />

                  {/* TWO COLUMN: Company Info (left) + Date (right) */}
                  <div className="flex justify-between mb-4" style={{ fontSize: '8px' }}>
                    <div style={{ fontFamily: previewFont }}>
                      <div style={{ color: primaryColor, fontWeight: 700, fontSize: '8.5px', marginBottom: '2px' }}>Acme Interiors</div>
                      <div style={{ color: '#505050' }}>221 Demo Street</div>
                      <div style={{ color: '#505050' }}>Hyderabad - 500001, Telangana</div>
                      {showContactLine && <>
                        <div style={{ color: '#505050' }}>Tel: +91 90000 00000  |  Email: hello@example.com</div>
                        <div style={{ color: '#505050' }}>Web: www.example.com</div>
                      </>}
                    </div>
                    <div style={{ color: primaryColor, fontWeight: 700, fontSize: '9px', whiteSpace: 'nowrap' }}>
                      Date: {letterDate}
                    </div>
                  </div>

                  {/* RECIPIENT BLOCK */}
                  <div className="mb-4">
                    <div style={{ color: '#888', fontSize: '8px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>TO,</div>
                    <div style={{ color: primaryColor, fontWeight: 700, fontSize: '12px', lineHeight: 1.3 }}>{customName || 'Recipient Name'}</div>
                    {customDesignation && <div style={{ color: '#444', fontSize: '9px', marginTop: '2px' }}>{customDesignation}</div>}
                    {showRecipientAddress && customAddress && <div style={{ color: '#666', fontSize: '8px', whiteSpace: 'pre-wrap', maxWidth: '200px', marginTop: '2px' }}>{customAddress}</div>}
                    {customEmail && <div style={{ color: '#666', fontSize: '8px', marginTop: '2px' }}>{customEmail}</div>}
                    {customPhone && <div style={{ color: '#666', fontSize: '8px' }}>{customPhone}</div>}
                  </div>

                  {/* SUBJECT LINE */}
                  <div style={{ color: primaryColor, fontWeight: 700, fontSize: '10px', marginBottom: '8px', paddingBottom: '4px', borderBottom: `1.5px solid ${accentColor}`, display: 'inline-block', maxWidth: '100%' }}>
                    Sub: {subject || selectedDocType}
                  </div>

                  {/* BODY */}
                  <div style={{ color: '#282828', fontSize: `${bodyFontSize}px`, lineHeight: lineHeight, textAlign: 'justify', whiteSpace: 'pre-wrap', marginBottom: '16px' }}>
                    {compileContent(documentBody)}
                  </div>

                  {/* TERMS */}
                  {terms && (
                    <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid #eee' }}>
                      <div style={{ fontWeight: 700, color: primaryColor, fontSize: '8px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>Terms & Conditions:</div>
                      <div style={{ color: '#555', fontSize: '8px', whiteSpace: 'pre-wrap' }}>{terms}</div>
                    </div>
                  )}

                  {/* NOTES */}
                  {notes && (
                    <div style={{ marginTop: '8px', color: '#aaa', fontSize: '7.5px', fontStyle: 'italic' }}>
                      Note: {notes}
                    </div>
                  )}

                  {/* SIGNATURE BLOCK */}
                  <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ color: '#444', fontSize: '9px', marginBottom: '14px' }}>For Acme Interiors,</div>
                      <div style={{ width: '130px', height: '1px', backgroundColor: '#ccc', marginBottom: '6px' }} />
                      <div style={{ color: primaryColor, fontWeight: 700, fontSize: '10.5px' }}>{authorizedPerson}</div>
                      <div style={{ color: '#666', fontSize: '8.5px' }}>{signatureDesignation}</div>
                      <div style={{ color: '#888', fontSize: '8px' }}>Acme Interiors</div>
                    </div>
                    {isOfferLetter && (
                      <div style={{ textAlign: 'left', minWidth: '130px' }}>
                        <div style={{ color: '#444', fontSize: '9px', marginBottom: '14px' }}>Accepted & Confirmed By,</div>
                        <div style={{ width: '130px', height: '1px', backgroundColor: '#ccc', marginBottom: '6px' }} />
                        <div style={{ color: primaryColor, fontWeight: 700, fontSize: '10.5px' }}>{customName || 'Employee Signature'}</div>
                        <div style={{ color: '#666', fontSize: '8.5px' }}>Date: ____________________</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* FOOTER BAR */}
                <div style={{ backgroundColor: primaryColor, position: 'absolute', bottom: 0, left: 0, right: 0, padding: '7px 20px', textAlign: 'center' }}>
                  <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '6.5px', letterSpacing: '0.03em' }}>
                    221 Demo Street, Hyderabad - 500001  |  +91 90000 00000  |  hello@example.com  |  www.example.com
                  </div>
                  <div style={{ color: accentColor, fontSize: '6px', marginTop: '2px', fontWeight: 700, letterSpacing: '0.05em' }}>
                    {footerText}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Bottom Bar */}
        <div className="p-5 border-t border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Status:</span>
            <span className={`px-2.5 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-widest border ${
              documentStatus === 'issued' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20' : 
              documentStatus === 'emailed' ? 'bg-blue-500/20 text-blue-400 border-blue-500/20' : 
              'bg-slate-800 text-slate-400 border-slate-700'
            }`}>
              {documentStatus}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={saveDraftFn} disabled={isSaving || documentStatus === 'issued'} className="rounded-xl font-bold uppercase tracking-wider text-[10px] h-11 border-slate-800 bg-slate-900 hover:bg-slate-800">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save Draft
            </Button>
            <Button variant="default" onClick={issueDocFn} disabled={isIssuing || documentStatus === 'issued'} className="rounded-xl font-black italic uppercase tracking-widest text-[10px] h-11 bg-primary text-white hover:bg-primary/90">
              {isIssuing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Officially Issue
            </Button>
            <Button variant="outline" onClick={downloadPdfFile} className="rounded-xl font-bold uppercase tracking-wider text-[10px] h-11 border-slate-800 bg-slate-900 hover:bg-slate-800">
              <Download className="mr-2 h-4 w-4 text-emerald-500" />Download PDF
            </Button>
            <Button variant="outline" onClick={downloadDocxFile} className="rounded-xl font-bold uppercase tracking-wider text-[10px] h-11 border-slate-800 bg-slate-900 hover:bg-slate-800">
              <Download className="mr-2 h-4 w-4 text-blue-500" />Download DOCX
            </Button>
            <Button variant="outline" onClick={openEmailModal} className="rounded-xl font-bold uppercase tracking-wider text-[10px] h-11 border-slate-800 bg-slate-900 hover:bg-slate-800">
              <Mail className="mr-2 h-4 w-4 text-pink-400" />Email
            </Button>
          </div>
        </div>
      </div>

      {/* Confirm Doc Type Change */}
      <Dialog open={showDocTypeConfirm} onOpenChange={setShowDocTypeConfirm}>
        <DialogContent className="bg-slate-950 border border-slate-800 text-white max-w-sm rounded-3xl shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black uppercase italic tracking-tighter text-white">Change Document Type?</DialogTitle>
            <DialogDescription className="text-slate-400 text-xs mt-1 leading-relaxed">
              Switching the document type will replace your current body content with the default template. Continue?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-900">
            <Button variant="ghost" onClick={() => { setShowDocTypeConfirm(false); setPendingDocType(null) }} className="rounded-xl hover:bg-slate-800 font-bold text-xs h-10 px-4">Cancel</Button>
            <Button onClick={handleConfirmDocTypeChange} className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold text-xs h-10 px-4">Change Type</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Save Template Dialog */}
      <Dialog open={saveTemplateDialogOpen} onOpenChange={setSaveTemplateDialogOpen}>
        <DialogContent className="bg-slate-950 border border-slate-800 text-white max-w-md rounded-3xl shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase italic tracking-tighter text-white">Save Custom Template</DialogTitle>
            <DialogDescription className="text-slate-400 text-xs italic">Save this layout and body as a reusable template preset.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 my-4">
            <div className="space-y-1">
              <Label className="text-xs text-slate-300 font-bold">Template Name</Label>
              <Input value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)} placeholder="e.g. Designer Special Offer" className="bg-slate-900 border-slate-800 rounded-xl text-xs h-11" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-300 font-bold">Target Role</Label>
              <Select value={newTemplateRole} onValueChange={setNewTemplateRole}>
                <SelectTrigger className="bg-slate-900 border-slate-800 rounded-xl text-xs h-11 text-slate-300"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                  <SelectItem value="Staff">Staff / Member</SelectItem>
                  <SelectItem value="Intern">Intern</SelectItem>
                  <SelectItem value="Management">Management</SelectItem>
                  <SelectItem value="Custom">Custom / General</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setSaveTemplateDialogOpen(false)} className="rounded-xl hover:bg-slate-800 font-bold text-xs h-10">Cancel</Button>
            <Button onClick={handleSaveTemplate} disabled={isSavingTemplate} className="bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-bold uppercase tracking-wider text-xs px-5 h-10">
              {isSavingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Template"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Email Dialog */}
      <Dialog open={emailModalOpen} onOpenChange={setEmailModalOpen}>
        <DialogContent className="bg-slate-950 border border-slate-800 text-white max-w-md rounded-3xl shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase italic tracking-tighter text-white">Email Document</DialogTitle>
            <DialogDescription className="text-slate-400 text-xs italic">Send this HR document as a PDF attachment via email.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 my-4">
            <div className="space-y-1"><Label className="text-xs text-slate-300 font-bold">Recipient Email</Label><Input type="email" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="name@employee.com" className="bg-slate-900 border-slate-800 rounded-xl" /></div>
            <div className="space-y-1"><Label className="text-xs text-slate-300 font-bold">Subject</Label><Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} className="bg-slate-900 border-slate-800 rounded-xl" /></div>
            <div className="space-y-1"><Label className="text-xs text-slate-300 font-bold">Message</Label><Textarea rows={5} value={emailMessage} onChange={(e) => setEmailMessage(e.target.value)} className="bg-slate-900 border-slate-800 rounded-xl text-xs leading-relaxed" /></div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setEmailModalOpen(false)} className="rounded-xl hover:bg-slate-800 font-bold text-xs h-10">Cancel</Button>
            <Button onClick={triggerEmailDispatch} disabled={isEmailing} className="bg-primary text-white hover:bg-primary/95 rounded-xl font-bold uppercase tracking-wider text-xs px-5 h-10">
              {isEmailing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Email"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
