'use client'

import React, { useEffect, useState, useRef } from 'react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
import { Loader2, Download, Eye, FileText, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'

import {
  UserType,
  TemplateType,
  IdCardFront,
  IdCardBack,
  IdCardPreview,
  IdCardExport,
  CARD_WIDTH,
  CARD_HEIGHT,
  FRONT_LAYOUT,
  BACK_LAYOUT,
  getNameFontSize,
  getDesignationFontSize,
  getEmailFontSize,
} from './IdCardPreview'

export {
  type UserType,
  type TemplateType,
  IdCardFront,
  IdCardBack,
  IdCardPreview,
  IdCardExport,
}

// Helper to load images safely with CORS enabled
const loadImage = (src: string): Promise<HTMLImageElement | null> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(null)
      return
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null) // resolve with null so it doesn't crash the generation
    img.src = src
  })
}

// Drawing path helper for rounded corners on canvas
const drawRoundedRectPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) => {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
  ctx.lineTo(x + width, y + height - radius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  ctx.lineTo(x + radius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

// Draw a stylized vector face user placeholder when profile image is missing
const drawUserPlaceholder = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  scale: number
) => {
  // Draw background color
  ctx.fillStyle = '#14343e'
  ctx.fillRect(x, y, w, h)

  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
  const centerX = x + w / 2
  const centerY = y + h * 0.45
  const headRadius = w * 0.18

  // Head circle
  ctx.beginPath()
  ctx.arc(centerX, centerY - headRadius, headRadius, 0, Math.PI * 2)
  ctx.fill()

  // Shoulder arc
  ctx.beginPath()
  ctx.arc(centerX, centerY + headRadius * 1.5, headRadius * 1.6, Math.PI, 0)
  ctx.fill()

  // "NO PHOTO" label
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
  ctx.font = `900 ${Math.round(w * 0.075)}px Inter, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('NO PHOTO', centerX, y + h * 0.82)
}

// Wrap long text and draw it with max-lines limit on canvas
const drawWrappedText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
  initialFontSize: number,
  fontFamily: string = 'Inter, sans-serif',
  fontWeight: string = 'bold',
  color: string = '#ffffff',
  align: CanvasTextAlign = 'left'
) => {
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.textBaseline = 'top'

  let fontSize = initialFontSize
  const words = text.split(' ')
  let lines: string[] = []

  const splitTextIntoLines = (size: number): string[] => {
    ctx.font = `${fontWeight} ${size}px ${fontFamily}`
    const tempLines: string[] = []
    let currentLine = ''

    for (const word of words) {
      const testLine = currentLine ? currentLine + ' ' + word : word
      const metrics = ctx.measureText(testLine)
      if (metrics.width > maxWidth) {
        if (currentLine) {
          tempLines.push(currentLine)
        }
        currentLine = word
      } else {
        currentLine = testLine
      }
    }
    if (currentLine) {
      tempLines.push(currentLine)
    }
    return tempLines
  }

  // Shrink font size if it overflows max lines
  while (fontSize > 6) {
    lines = splitTextIntoLines(fontSize)
    if (lines.length <= maxLines) {
      break
    }
    fontSize -= 0.5
  }

  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`
  for (let i = 0; i < Math.min(lines.length, maxLines); i++) {
    ctx.fillText(lines[i], x, y + i * lineHeight)
  }
}

// Shrink font size until single-line text fits inside max width
const drawTextFit = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  initialFontSize: number,
  fontFamily: string = 'Inter, sans-serif',
  fontWeight: string = 'bold',
  color: string = '#ffffff',
  align: CanvasTextAlign = 'left'
) => {
  let fontSize = initialFontSize
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.textBaseline = 'middle'

  do {
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`
    const metrics = ctx.measureText(text)
    if (metrics.width <= maxWidth || fontSize <= 6) {
      break
    }
    fontSize -= 0.5
  } while (fontSize > 6)

  ctx.fillText(text, x, y)
}

// Generate the Front side canvas programmatically at 640x1010
export const generateIdCardFrontCanvas = async (
  user: UserType,
  profileImageUrl: string | null,
  templateUrl: string | null
): Promise<HTMLCanvasElement> => {
  const canvas = document.createElement('canvas')
  // We specify target dimensions 640x1010 but scale internally 2x for premium output sharpness
  canvas.width = 1280
  canvas.height = 2020
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get 2D canvas context')

  // Wait for font loading before drawing text
  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    await document.fonts.ready
  }

  // Scale context to draw using standard 640x1010 coordinates
  ctx.scale(2, 2)

  // Layout scale factors from 350x556 preview design space to 640x1010 canvas space
  const scaleX = 640 / 350
  const scaleY = 1010 / 556
  const getScaledProp = (valStr: string, scale: number) => parseFloat(valStr) * scale

  // 1. Background image
  const bgImageSrc = templateUrl || '/id_card_front_default.png'
  const bgImg = await loadImage(bgImageSrc)
  if (bgImg) {
    ctx.drawImage(bgImg, 0, 0, 640, 1010)
  } else {
    ctx.fillStyle = '#173d49'
    ctx.fillRect(0, 0, 640, 1010)
  }

  // 2. Name blocker
  ctx.fillStyle = FRONT_LAYOUT.nameBlocker.backgroundColor
  ctx.fillRect(
    getScaledProp(FRONT_LAYOUT.nameBlocker.left, scaleX),
    getScaledProp(FRONT_LAYOUT.nameBlocker.top, scaleY),
    getScaledProp(FRONT_LAYOUT.nameBlocker.width, scaleX),
    getScaledProp(FRONT_LAYOUT.nameBlocker.height, scaleY)
  )

  // 3. Employee ID blocker
  ctx.fillStyle = FRONT_LAYOUT.empIdBlocker.backgroundColor
  ctx.fillRect(
    getScaledProp(FRONT_LAYOUT.empIdBlocker.left, scaleX),
    getScaledProp(FRONT_LAYOUT.empIdBlocker.top, scaleY),
    getScaledProp(FRONT_LAYOUT.empIdBlocker.width, scaleX),
    getScaledProp(FRONT_LAYOUT.empIdBlocker.height, scaleY)
  )

  // 4. Photo container
  const photoX = getScaledProp(FRONT_LAYOUT.photo.left, scaleX)
  const photoY = getScaledProp(FRONT_LAYOUT.photo.top, scaleY)
  const photoW = getScaledProp(FRONT_LAYOUT.photo.width, scaleX)
  const photoH = getScaledProp(FRONT_LAYOUT.photo.height, scaleY)
  const photoRadius = 16 * scaleX
  const photoPadding = 3 * scaleX

  ctx.fillStyle = FRONT_LAYOUT.photo.backgroundColor
  ctx.save()
  drawRoundedRectPath(ctx, photoX, photoY, photoW, photoH, photoRadius)
  ctx.fill()

  const innerX = photoX + photoPadding
  const innerY = photoY + photoPadding
  const innerW = photoW - (photoPadding * 2)
  const innerH = photoH - (photoPadding * 2)
  const innerRadius = 13 * scaleX

  ctx.beginPath()
  drawRoundedRectPath(ctx, innerX, innerY, innerW, innerH, innerRadius)
  ctx.clip()

  if (profileImageUrl) {
    const profileImg = await loadImage(profileImageUrl)
    if (profileImg) {
      const imgRatio = profileImg.width / profileImg.height
      const innerRatio = innerW / innerH

      let drawW, drawH, drawX, drawY
      if (imgRatio > innerRatio) {
        drawH = innerH
        drawW = innerH * imgRatio
        drawX = innerX - (drawW - innerW) / 2
        drawY = innerY
      } else {
        drawW = innerW
        drawH = innerW / imgRatio
        drawX = innerX
        drawY = innerY - (drawH - innerH) / 2
      }
      ctx.drawImage(profileImg, drawX, drawY, drawW, drawH)
    } else {
      drawUserPlaceholder(ctx, innerX, innerY, innerW, innerH, scaleX)
    }
  } else {
    drawUserPlaceholder(ctx, innerX, innerY, innerW, innerH, scaleX)
  }
  ctx.restore()

  // Draw Photo container border
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2 * scaleX
  ctx.beginPath()
  drawRoundedRectPath(ctx, photoX, photoY, photoW, photoH, photoRadius)
  ctx.stroke()

  // 5. Employee Name
  const nameX = getScaledProp(FRONT_LAYOUT.name.left, scaleX)
  const nameY = getScaledProp(FRONT_LAYOUT.name.top, scaleY)
  const nameW = getScaledProp(FRONT_LAYOUT.name.width, scaleX)
  const nameH = getScaledProp(FRONT_LAYOUT.name.height, scaleY)
  const initialNameFS = parseFloat(getNameFontSize(user.name)) * scaleX
  const nameLineHeight = 1.2 * initialNameFS

  drawWrappedText(
    ctx,
    user.name.toUpperCase(),
    nameX,
    nameY + (nameH - nameLineHeight) / 2,
    nameW,
    nameLineHeight,
    2,
    initialNameFS,
    'Inter, sans-serif',
    '800',
    '#ffffff',
    FRONT_LAYOUT.name.textAlign
  )

  // 6. Designation
  const desgX = getScaledProp(FRONT_LAYOUT.designation.left, scaleX)
  const desgY = getScaledProp(FRONT_LAYOUT.designation.top, scaleY)
  const desgW = getScaledProp(FRONT_LAYOUT.designation.width, scaleX)
  const desgH = getScaledProp(FRONT_LAYOUT.designation.height, scaleY)
  const desgText = (user.designation || user.role).toUpperCase()
  const initialDesgFS = parseFloat(getDesignationFontSize(user.designation || user.role)) * scaleX
  const desgLineHeight = 1.25 * initialDesgFS

  drawWrappedText(
    ctx,
    desgText,
    desgX,
    desgY + (desgH - desgLineHeight) / 2,
    desgW,
    desgLineHeight,
    2,
    initialDesgFS,
    'Inter, sans-serif',
    '600',
    FRONT_LAYOUT.designation.color,
    FRONT_LAYOUT.designation.textAlign
  )

  // 7. Vertical Employee ID (rotated text)
  const empIdX = getScaledProp(FRONT_LAYOUT.employeeId.left, scaleX)
  const empIdY = getScaledProp(FRONT_LAYOUT.employeeId.top, scaleY)
  const empIdW = getScaledProp(FRONT_LAYOUT.employeeId.width, scaleX)
  const empIdH = getScaledProp(FRONT_LAYOUT.employeeId.height, scaleY)

  const formatEmpId = (id?: string) => {
    if (!id) return 'EMP-000'
    const trimmed = id.trim()
    if (trimmed.toUpperCase().startsWith('EMP-')) {
      return `EMP-${trimmed.substring(5)}`
    }
    return `EMP-${trimmed}`
  }
  const displayEmpId = formatEmpId(user.employeeId)
  const displayEmpIdText = `EMP ID - ${displayEmpId}`.toUpperCase()

  const centerX = empIdX + empIdW / 2
  const centerY = empIdY + empIdH / 2
  const empIdFS = 12 * scaleX

  ctx.save()
  ctx.translate(centerX, centerY)
  ctx.rotate(-Math.PI / 2) // rotate -90 degrees
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ffffff'
  ctx.font = `800 ${empIdFS}px Inter, sans-serif`
  ctx.fillText(displayEmpIdText, 0, 0)
  ctx.restore()

  return canvas
}

// Generate the Back side canvas programmatically at 640x1010
export const generateIdCardBackCanvas = async (
  user: UserType,
  qrCodeUrl: string | null,
  templateUrl: string | null
): Promise<HTMLCanvasElement> => {
  const canvas = document.createElement('canvas')
  canvas.width = 1280
  canvas.height = 2020
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get 2D canvas context')

  // Wait for font loading before drawing text
  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    await document.fonts.ready
  }

  // Scale context to draw using standard 640x1010 coordinates
  ctx.scale(2, 2)

  // Layout scale factors from 350x556 preview design space to 640x1010 canvas space
  const scaleX = 640 / 350
  const scaleY = 1010 / 556
  const getScaledProp = (valStr: string, scale: number) => parseFloat(valStr) * scale

  // 1. Background image
  const bgImageSrc = templateUrl || '/id_card_back_default.png'
  const bgImg = await loadImage(bgImageSrc)
  if (bgImg) {
    ctx.drawImage(bgImg, 0, 0, 640, 1010)
  } else {
    ctx.fillStyle = '#173d49'
    ctx.fillRect(0, 0, 640, 1010)
  }

  // 2. Details blocker
  ctx.fillStyle = BACK_LAYOUT.detailsBlocker.backgroundColor
  ctx.fillRect(
    getScaledProp(BACK_LAYOUT.detailsBlocker.left, scaleX),
    getScaledProp(BACK_LAYOUT.detailsBlocker.top, scaleY),
    getScaledProp(BACK_LAYOUT.detailsBlocker.width, scaleX),
    getScaledProp(BACK_LAYOUT.detailsBlocker.height, scaleY)
  )

  // 3. Blood Group
  const bgX = getScaledProp(BACK_LAYOUT.bloodGroup.left, scaleX)
  const bgY = getScaledProp(BACK_LAYOUT.bloodGroup.top, scaleY)
  const bgW = getScaledProp(BACK_LAYOUT.bloodGroup.width, scaleX)
  const bloodGroupText = (user.bloodGroup || 'N/A').toUpperCase()
  drawTextFit(
    ctx,
    bloodGroupText,
    bgX,
    bgY,
    bgW,
    10.5 * scaleX,
    'Inter, sans-serif',
    '800',
    BACK_LAYOUT.bloodGroup.color,
    'left'
  )

  // 4. Contact phone
  const cX = getScaledProp(BACK_LAYOUT.contact.left, scaleX)
  const cY = getScaledProp(BACK_LAYOUT.contact.top, scaleY)
  const cW = getScaledProp(BACK_LAYOUT.contact.width, scaleX)
  const phoneText = user.phone || 'N/A'
  drawTextFit(
    ctx,
    phoneText,
    cX,
    cY,
    cW,
    10.5 * scaleX,
    'Inter, sans-serif',
    '700',
    BACK_LAYOUT.contact.color,
    'left'
  )

  // 5. Emergency Contact
  const ecX = getScaledProp(BACK_LAYOUT.emergencyContact.left, scaleX)
  const ecY = getScaledProp(BACK_LAYOUT.emergencyContact.top, scaleY)
  const ecW = getScaledProp(BACK_LAYOUT.emergencyContact.width, scaleX)
  const ecText = user.emergencyContact || 'N/A'
  drawTextFit(
    ctx,
    ecText,
    ecX,
    ecY,
    ecW,
    10.5 * scaleX,
    'Inter, sans-serif',
    '700',
    BACK_LAYOUT.emergencyContact.color,
    'left'
  )

  // 6. Mail ID
  const mX = getScaledProp(BACK_LAYOUT.mailId.left, scaleX)
  const mY = getScaledProp(BACK_LAYOUT.mailId.top, scaleY)
  const mW = getScaledProp(BACK_LAYOUT.mailId.width, scaleX)
  const emailText = user.email.toLowerCase()
  const emailFS = parseFloat(getEmailFontSize(user.email)) * scaleX
  drawTextFit(
    ctx,
    emailText,
    mX,
    mY,
    mW,
    emailFS,
    'Inter, sans-serif',
    '700',
    BACK_LAYOUT.mailId.color,
    'left'
  )

  // 7. Office Contact phone
  const ocX = getScaledProp(BACK_LAYOUT.officeContact.left, scaleX)
  const ocY = getScaledProp(BACK_LAYOUT.officeContact.top, scaleY)
  const ocW = getScaledProp(BACK_LAYOUT.officeContact.width, scaleX)
  drawTextFit(
    ctx,
    '+91 91777 56888',
    ocX,
    ocY,
    ocW,
    10.5 * scaleX,
    'Inter, sans-serif',
    '700',
    BACK_LAYOUT.officeContact.color,
    'left'
  )

  // 8. QR Code box
  const qrX = getScaledProp(BACK_LAYOUT.qrCode.left, scaleX)
  const qrY = getScaledProp(BACK_LAYOUT.qrCode.top, scaleY)
  const qrW = getScaledProp(BACK_LAYOUT.qrCode.width, scaleX)
  const qrH = getScaledProp(BACK_LAYOUT.qrCode.height, scaleY)
  const qrRadius = 8 * scaleX
  const qrPadding = 10 * scaleX

  ctx.fillStyle = BACK_LAYOUT.qrCode.backgroundColor
  ctx.save()
  drawRoundedRectPath(ctx, qrX, qrY, qrW, qrH, qrRadius)
  ctx.fill()
  ctx.restore()

  if (qrCodeUrl) {
    const qrImg = await loadImage(qrCodeUrl)
    if (qrImg) {
      const innerQrX = qrX + qrPadding
      const innerQrY = qrY + qrPadding
      const innerQrW = qrW - (qrPadding * 2)
      const innerQrH = qrH - (qrPadding * 2)
      ctx.drawImage(qrImg, innerQrX, innerQrY, innerQrW, innerQrH)
    }
  }

  return canvas
}

// Master blob generator for background / email uploads and combined side-by-side export
export const generateIdCardBlobs = async (
  user: UserType,
  profileImageUrl: string | null,
  frontTemplateUrl: string | null,
  backTemplateUrl: string | null
): Promise<{ pdfBlob: Blob; pngBlob: Blob }> => {
  // Generate static QR Code for company website
  const companyWebsiteUrl = "https://www.example.com" // Replace with exact URL if different
  const qrCodeUrl = await QRCode.toDataURL(companyWebsiteUrl, {
    margin: 1,
    width: 150,
    color: {
      dark: '#173d49',
      light: '#ffffff'
    }
  })

  // Programmatically generate canvas drawings
  const canvasFront = await generateIdCardFrontCanvas(user, profileImageUrl, frontTemplateUrl)
  const canvasBack = await generateIdCardBackCanvas(user, qrCodeUrl, backTemplateUrl)

  // Construct Side-by-Side Composite Canvas for PNG download
  const paddingX = 40
  const paddingY = 40
  const gap = 40

  const compositeCanvas = document.createElement('canvas')
  compositeCanvas.width = canvasFront.width + canvasBack.width + (paddingX * 2) + gap
  compositeCanvas.height = Math.max(canvasFront.height, canvasBack.height) + (paddingY * 2)
  const ctx = compositeCanvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = '#1e293b' // Dark slate bg for side-by-side image download
    ctx.fillRect(0, 0, compositeCanvas.width, compositeCanvas.height)

    const frontY = paddingY + (compositeCanvas.height - (paddingY * 2) - canvasFront.height) / 2
    const backY = paddingY + (compositeCanvas.height - (paddingY * 2) - canvasBack.height) / 2

    ctx.drawImage(canvasFront, paddingX, frontY)
    ctx.drawImage(canvasBack, paddingX + canvasFront.width + gap, backY)
  }

  const pngBlob = await new Promise<Blob>((resolve) => {
    compositeCanvas.toBlob((b) => resolve(b || new Blob()), 'image/png')
  })

  // Generate jsPDF (2 pages: Front centered, Back centered)
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [54, 86]
  })

  const frontDataUrl = canvasFront.toDataURL('image/png')
  const backDataUrl = canvasBack.toDataURL('image/png')

  // Calculate layout preserving aspect ratio with 2mm safe padding
  const pdfWidth = 54
  const pdfHeight = 86
  const pdfPadding = 2

  const imgRatio = 640 / 1010
  const maxW = pdfWidth - (pdfPadding * 2)
  const maxH = pdfHeight - (pdfPadding * 2)

  let imgW = maxW
  let imgH = maxW / imgRatio

  if (imgH > maxH) {
    imgH = maxH
    imgW = maxH * imgRatio
  }

  const posX = (pdfWidth - imgW) / 2
  const posY = (pdfHeight - imgH) / 2

  pdf.addImage(frontDataUrl, 'PNG', posX, posY, imgW, imgH)
  pdf.addPage([54, 86], 'portrait')
  pdf.addImage(backDataUrl, 'PNG', posX, posY, imgW, imgH)

  const pdfBlob = pdf.output('blob')

  return { pdfBlob, pngBlob }
}

// 2. Side-by-Side Live Preview component with Download buttons
export const IdCardSuite: React.FC<{
  user: UserType
  template: TemplateType | null
  profileImageUrl?: string | null
  frontTemplateUrl?: string | null
  backTemplateUrl?: string | null
  lastUpdated?: number
  onRegenerate?: () => Promise<void>
  showAdminControls?: boolean
}> = ({
  user,
  template,
  profileImageUrl,
  frontTemplateUrl,
  backTemplateUrl,
  lastUpdated,
  onRegenerate,
  showAdminControls = false,
}) => {
  const [isExporting, setIsExporting] = useState(false)

  const triggerDownload = (dataUrl: string, fileName: string) => {
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const handleDownloadPDF = async () => {
    setIsExporting(true)
    const toastId = toast({ title: 'Exporting PDF', description: 'Generating PDF document...' })
    try {
      const { pdfBlob } = await generateIdCardBlobs(user, profileImageUrl || null, frontTemplateUrl || null, backTemplateUrl || null)
      const url = URL.createObjectURL(pdfBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `EMP_ID_${user.name.replace(/\s+/g, '_')}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast({ title: 'PDF Downloaded', description: 'Your office ID Card has been saved.' })
    } catch (e) {
      toast({ title: 'Export Failed', variant: 'destructive', description: 'Unable to generate ID card. Please try again.' })
    } finally {
      setIsExporting(false)
    }
  }

  const handleDownloadFrontPNG = async () => {
    setIsExporting(true)
    const toastId = toast({ title: 'Exporting Image', description: 'Drawing high-res front canvas...' })
    try {
      const canvasFront = await generateIdCardFrontCanvas(user, profileImageUrl || null, frontTemplateUrl || null)
      const dataUrl = canvasFront.toDataURL('image/png')
      triggerDownload(dataUrl, `EMP_ID_Front_${user.name.replace(/\s+/g, '_')}.png`)
      toast({ title: 'Front PNG Downloaded', description: 'High-res front side PNG saved.' })
    } catch (e) {
      toast({ title: 'Export Failed', variant: 'destructive', description: 'Unable to generate ID card. Please try again.' })
    } finally {
      setIsExporting(false)
    }
  }

  const handleDownloadBackPNG = async () => {
    setIsExporting(true)
    const toastId = toast({ title: 'Exporting Image', description: 'Drawing high-res back canvas...' })
    try {
      const companyWebsiteUrl = "https://www.example.com" // Replace with exact URL if different
      const qrCodeUrl = await QRCode.toDataURL(companyWebsiteUrl, {
        margin: 1,
        width: 150,
        color: {
          dark: '#173d49',
          light: '#ffffff'
        }
      })
      const canvasBack = await generateIdCardBackCanvas(user, qrCodeUrl, backTemplateUrl || null)
      const dataUrl = canvasBack.toDataURL('image/png')
      triggerDownload(dataUrl, `EMP_ID_Back_${user.name.replace(/\s+/g, '_')}.png`)
      toast({ title: 'Back PNG Downloaded', description: 'High-res back side PNG saved.' })
    } catch (e) {
      toast({ title: 'Export Failed', variant: 'destructive', description: 'Unable to generate ID card. Please try again.' })
    } finally {
      setIsExporting(false)
    }
  }

  const handleDownloadBothPNG = async () => {
    setIsExporting(true)
    const toastId = toast({ title: 'Exporting Image', description: 'Drawing high-res composite canvas...' })
    try {
      const { pngBlob } = await generateIdCardBlobs(user, profileImageUrl || null, frontTemplateUrl || null, backTemplateUrl || null)
      const url = URL.createObjectURL(pngBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `EMP_ID_Combined_${user.name.replace(/\s+/g, '_')}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast({ title: 'Combined PNG Downloaded', description: 'High-res side-by-side composite PNG saved.' })
    } catch (e) {
      toast({ title: 'Export Failed', variant: 'destructive', description: 'Unable to generate ID card. Please try again.' })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-center gap-8 py-6 bg-slate-900/50 rounded-3xl p-6 border border-white/5">
        {/* Front side */}
        <div className="space-y-2 flex flex-col items-center">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Front Side Preview</span>
          <IdCardPreview
            user={user}
            side="front"
            profileImageUrl={profileImageUrl}
            templateUrl={frontTemplateUrl}
          />
        </div>

        {/* Back side */}
        <div className="space-y-2 flex flex-col items-center">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Back Side Preview</span>
          <IdCardPreview
            user={user}
            side="back"
            templateUrl={backTemplateUrl}
          />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/5 p-4 rounded-2xl border border-white/5 text-xs">
        <div className="text-slate-400">
          {lastUpdated ? (
            <span className="font-medium">
              Last Generated: <strong className="text-slate-200">{new Date(lastUpdated).toLocaleString('en-IN')}</strong>
            </span>
          ) : (
            <span className="italic">No ID Card generated yet. Use buttons to generate.</span>
          )}
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {onRegenerate && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRegenerate}
              disabled={isExporting}
              className="h-10 px-4 rounded-xl border-white/10 bg-white/5 font-bold text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-2" />
              Regenerate
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadFrontPNG}
            disabled={isExporting}
            className="h-10 px-4 rounded-xl border-white/10 bg-white/5 font-bold text-xs"
          >
            <Download className="h-3.5 w-3.5 mr-2" />
            Front PNG
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadBackPNG}
            disabled={isExporting}
            className="h-10 px-4 rounded-xl border-white/10 bg-white/5 font-bold text-xs"
          >
            <Download className="h-3.5 w-3.5 mr-2" />
            Back PNG
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadBothPNG}
            disabled={isExporting}
            className="h-10 px-4 rounded-xl border-white/10 bg-white/5 font-bold text-xs"
          >
            <Download className="h-3.5 w-3.5 mr-2" />
            Combined PNG
          </Button>
          <Button
            size="sm"
            onClick={handleDownloadPDF}
            disabled={isExporting}
            className="h-10 px-4 rounded-xl bg-primary text-white font-bold text-xs"
          >
            <FileText className="h-3.5 w-3.5 mr-2" />
            Download PDF
          </Button>
        </div>
      </div>
    </div>
  )
}

// 4. Programmatic client-side ID Card regeneration helper
export const handleRegenerateIdCard = async ({
  user,
  profileImageUrl,
  frontTemplateUrl,
  backTemplateUrl,
  requestorEmail,
  generateUploadUrlFn,
  saveOfficeIdCardFn,
}: {
  user: UserType
  profileImageUrl: string | null
  frontTemplateUrl: string | null
  backTemplateUrl: string | null
  requestorEmail: string
  generateUploadUrlFn: (args: { requestorEmail: string }) => Promise<string>
  saveOfficeIdCardFn: (args: {
    userId: any
    userName: string
    storageId: any
    fileSize: number
    fileName: string
    fileType: string
    requestorEmail: string
  }) => Promise<any>
}) => {
  // 1. Generate Blobs
  const { pdfBlob } = await generateIdCardBlobs(
    user,
    profileImageUrl,
    frontTemplateUrl,
    backTemplateUrl
  )

  // 2. Generate Upload URL
  const uploadUrl = await generateUploadUrlFn({ requestorEmail })

  // 3. Post PDF data to Convex storage
  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/pdf' },
    body: pdfBlob,
  })

  if (!res.ok) {
    throw new Error('Failed to upload generated ID card to storage.')
  }

  const { storageId } = await res.json()

  // 4. Save or update the office ID card document
  await saveOfficeIdCardFn({
    userId: user._id as any,
    userName: user.name,
    storageId,
    fileSize: pdfBlob.size,
    fileName: `Office_ID_${user.name.replace(/\s+/g, '_')}.pdf`,
    fileType: 'application/pdf',
    requestorEmail,
  })
}

