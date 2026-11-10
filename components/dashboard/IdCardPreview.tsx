'use client'

import React, { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Loader2, User } from 'lucide-react'

export interface UserType {
  _id: string
  name: string
  email: string
  role: string
  designation?: string
  employeeId?: string
  phone?: string
  image?: string
  bloodGroup?: string
  emergencyContact?: string
}

export interface TemplateType {
  frontStorageId?: string
  backStorageId?: string
}

export interface IdCardProps {
  user: UserType
  profileImageUrl?: string | null
  templateUrl?: string | null
  isStatic?: boolean
}

// 1. Strict Configuration-driven layouts
// Card size matches default template ratio (644 x 1024) -> 350px width x 556px height
export const CARD_WIDTH = 350
export const CARD_HEIGHT = 556

// Helper for dynamic font scaling
export const getNameFontSize = (name: string) => {
  if (name.length <= 12) return '17px'
  if (name.length <= 18) return '14px'
  if (name.length <= 24) return '11.5px'
  return '9.5px'
}

export const getDesignationFontSize = (desg: string) => {
  if (desg.length <= 15) return '10px'
  if (desg.length <= 25) return '8.5px'
  return '7.5px'
}

export const getEmailFontSize = (email: string) => {
  if (email.length <= 18) return '10.5px'
  if (email.length <= 24) return '9px'
  if (email.length <= 32) return '7.5px'
  return '6px'
}

// Layout coordinate systems scaled precisely from template pixels
export const FRONT_LAYOUT = {
  // Blocker to cover "NAME" and "DESIGNATION" template label placeholders
  nameBlocker: {
    top: '226px',      // covers Y=415..550
    left: '40px',
    width: '255px',
    height: '72px',
    backgroundColor: '#173d49',
    zIndex: 9,
  },
  // Blocker for vertical ID text
  empIdBlocker: {
    top: '330px',      // Y=608 -> 608 * 350 / 644 = 330px
    left: '269px',     // X=495 -> 495 * 350 / 644 = 269px
    width: '18px',     // X=528 - 495 = 33 -> 33 * 350 / 644 = 18px
    height: '136px',   // Y=857 - 608 = 249 -> 249 * 350 / 644 = 135.3px -> 136px
    backgroundColor: '#173d49',
    zIndex: 9,
  },
  name: {
    top: '228px',
    left: '42px',      // X=77 -> 77 * 350 / 644 = 42px
    width: '248px',
    height: '38px',
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'left' as const,
    textTransform: 'uppercase' as const,
    zIndex: 10,
  },
  designation: {
    top: '270px',
    left: '42px',      // X=77 -> 77 * 350 / 644 = 42px
    width: '248px',
    height: '24px',
    fontWeight: '600',
    color: '#f7b28a',
    textAlign: 'left' as const,
    textTransform: 'uppercase' as const,
    zIndex: 10,
  },
  photo: {
    top: '316px',      // Y=581 -> 581 * 350 / 644 = 316px
    left: '59px',      // X=109 -> 109 * 350 / 644 = 59px
    width: '165px',    // X=413 - 109 = 304 -> 304 * 350 / 644 = 165px
    height: '197px',   // Y=944 - 581 = 363 -> 363 * 350 / 644 = 197px
    border: '2px solid #ffffff',
    borderRadius: '16px',
    padding: '3px',
    backgroundColor: '#173d49',
    zIndex: 10,
  },
  employeeId: {
    top: '330px',      // Y=608 -> 608 * 350 / 644 = 330px
    left: '269px',     // X=495 -> 495 * 350 / 644 = 269px
    width: '18px',
    height: '136px',
    fontWeight: '800',
    color: '#ffffff',
    transform: 'rotate(-90deg)',
    textAlign: 'center' as const,
    textTransform: 'uppercase' as const,
    zIndex: 10,
  }
}

export const BACK_LAYOUT = {
  // Blocker for details values on the right
  detailsBlocker: {
    top: '56px',       // Y=103 -> 103 * 350 / 644 = 56px
    left: '146px',     // X=268 -> 268 * 350 / 644 = 146px (labels end before this)
    width: '182px',    // Adjusted to 182px to cover the template's placeholder email suffix without overlapping the peach border
    height: '106px',   // Y=298 - 103 = 195 -> 195 * 350 / 644 = 106px
    backgroundColor: '#173d49',
    zIndex: 9,
  },
  // Precise value Y rows mapping to back-side labels
  bloodGroup: {
    top: '63px',       // label center Y=117px -> 117 * 350 / 644 = 63.6px -> 63px
    left: '150px',
    width: '170px',
    height: '18px',
    fontWeight: '800',
    color: '#f7b28a',
    zIndex: 10,
  },
  contact: {
    top: '85px',       // label center Y=158px -> 158 * 350 / 644 = 85.9px -> 85px
    left: '150px',
    width: '170px',
    height: '18px',
    fontWeight: '700',
    color: '#ffffff',
    zIndex: 10,
  },
  emergencyContact: {
    top: '109px',      // label center Y=202px -> 202 * 350 / 644 = 109.8px -> 109px
    left: '150px',
    width: '170px',
    height: '18px',
    fontWeight: '700',
    color: '#ffffff',
    zIndex: 10,
  },
  mailId: {
    top: '129px',      // label center Y=239px -> 239 * 350 / 644 = 129.9px -> 129px
    left: '150px',
    width: '170px',
    height: '18px',
    fontWeight: '700',
    color: '#ffffff',
    zIndex: 10,
  },
  officeContact: {
    top: '151px',      // label center Y=279px -> 279 * 350 / 644 = 151.6px -> 151px
    left: '150px',
    width: '170px',
    height: '18px',
    fontWeight: '700',
    color: '#ffffff',
    zIndex: 10,
  },
  // QR code box covering the template placeholder exactly
  qrCode: {
    top: '203px',      // Y=373 -> 373 * 350 / 644 = 203px
    left: '167px',     // X=308 -> 308 * 350 / 644 = 167px
    width: '126px',    // X=539 - 308 = 231 -> 231 * 350 / 644 = 126px
    height: '116px',   // Y=586 - 373 = 213 -> 213 * 350 / 644 = 116px
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    padding: '10px',   // padding inside container to keep QR square and proportionate
    zIndex: 10,
  }
}

export const IdCardFront: React.FC<IdCardProps> = ({
  user,
  profileImageUrl,
  templateUrl,
  isStatic,
}) => {
  const bgImage = templateUrl || '/id_card_front_default.png'
  const formatEmpId = (id?: string) => {
    if (!id) return 'EMP-000';
    const trimmed = id.trim();
    if (trimmed.toUpperCase().startsWith('EMP-')) {
      return `EMP-${trimmed.substring(5)}`;
    }
    return `EMP-${trimmed}`;
  }
  const displayEmpId = formatEmpId(user.employeeId)
  const nameFontSize = getNameFontSize(user.name)
  const designationFontSize = getDesignationFontSize(user.designation || user.role)

  return (
    <div
      className={`relative select-none overflow-hidden bg-[#173d49] flex-shrink-0 rounded-[20px] ${isStatic ? '' : 'shadow-2xl'}`}
      style={{
        width: `${CARD_WIDTH}px`,
        height: `${CARD_HEIGHT}px`,
        fontFamily: 'Inter, system-ui, sans-serif',
        backgroundColor: '#173d49',
      }}
    >
      {/* Background Template */}
      <img
        src={bgImage}
        alt="Front Template"
        className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none"
        crossOrigin="anonymous"
      />

      {/* Name and Designation Blocker */}
      <div
        className="absolute"
        style={{
          top: FRONT_LAYOUT.nameBlocker.top,
          left: FRONT_LAYOUT.nameBlocker.left,
          width: FRONT_LAYOUT.nameBlocker.width,
          height: FRONT_LAYOUT.nameBlocker.height,
          backgroundColor: FRONT_LAYOUT.nameBlocker.backgroundColor,
          zIndex: FRONT_LAYOUT.nameBlocker.zIndex,
        }}
      />

      {/* Vertical ID Blocker */}
      <div
        className="absolute"
        style={{
          top: FRONT_LAYOUT.empIdBlocker.top,
          left: FRONT_LAYOUT.empIdBlocker.left,
          width: FRONT_LAYOUT.empIdBlocker.width,
          height: FRONT_LAYOUT.empIdBlocker.height,
          backgroundColor: FRONT_LAYOUT.empIdBlocker.backgroundColor,
          zIndex: FRONT_LAYOUT.empIdBlocker.zIndex,
        }}
      />

      {/* Name Field */}
      <div
        className="absolute flex items-center"
        style={{
          top: FRONT_LAYOUT.name.top,
          left: FRONT_LAYOUT.name.left,
          width: FRONT_LAYOUT.name.width,
          height: FRONT_LAYOUT.name.height,
          zIndex: FRONT_LAYOUT.name.zIndex,
        }}
      >
        <h3
          className="text-white font-extrabold tracking-tight w-full card-text-field"
          style={{
            fontSize: nameFontSize,
            lineHeight: '1.2',
            whiteSpace: 'normal',
            wordBreak: 'break-word',
            overflow: 'hidden',
            textTransform: FRONT_LAYOUT.name.textTransform,
            textAlign: FRONT_LAYOUT.name.textAlign,
          }}
          title={user.name}
        >
          {user.name}
        </h3>
      </div>

      {/* Designation Field */}
      <div
        className="absolute flex items-center"
        style={{
          top: FRONT_LAYOUT.designation.top,
          left: FRONT_LAYOUT.designation.left,
          width: FRONT_LAYOUT.designation.width,
          height: FRONT_LAYOUT.designation.height,
          zIndex: FRONT_LAYOUT.designation.zIndex,
        }}
      >
        <p
          className="font-semibold tracking-wider w-full card-text-field"
          style={{
            fontSize: designationFontSize,
            color: FRONT_LAYOUT.designation.color,
            lineHeight: '1.25',
            whiteSpace: 'normal',
            wordBreak: 'break-word',
            overflow: 'hidden',
            textTransform: FRONT_LAYOUT.designation.textTransform,
            textAlign: FRONT_LAYOUT.designation.textAlign,
          }}
        >
          {user.designation || user.role}
        </p>
      </div>

      {/* Employee Photo Container */}
      <div
        className="absolute overflow-hidden flex items-center justify-center shadow-md"
        style={{
          top: FRONT_LAYOUT.photo.top,
          left: FRONT_LAYOUT.photo.left,
          width: FRONT_LAYOUT.photo.width,
          height: FRONT_LAYOUT.photo.height,
          border: FRONT_LAYOUT.photo.border,
          borderRadius: FRONT_LAYOUT.photo.borderRadius,
          padding: FRONT_LAYOUT.photo.padding,
          backgroundColor: FRONT_LAYOUT.photo.backgroundColor,
          zIndex: FRONT_LAYOUT.photo.zIndex,
        }}
      >
        {profileImageUrl ? (
          <img
            src={profileImageUrl}
            alt={user.name}
            className="w-full h-full object-cover rounded-[13px]"
            crossOrigin="anonymous"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-white/20 gap-2 w-full h-full bg-[#14343e] rounded-[13px]">
            <User className="h-12 w-12 stroke-[1]" />
            <span className="text-[9px] font-black uppercase tracking-widest">No Photo</span>
          </div>
        )}
      </div>

      {/* Employee ID Vertical Text */}
      <div
        className="absolute flex items-center justify-center"
        style={{
          top: FRONT_LAYOUT.employeeId.top,
          left: FRONT_LAYOUT.employeeId.left,
          width: FRONT_LAYOUT.employeeId.width,
          height: FRONT_LAYOUT.employeeId.height,
          zIndex: FRONT_LAYOUT.employeeId.zIndex,
        }}
      >
        <span
          className="text-white font-extrabold tracking-widest text-[12px]"
          style={{
            transform: FRONT_LAYOUT.employeeId.transform,
            textAlign: FRONT_LAYOUT.employeeId.textAlign,
            textTransform: FRONT_LAYOUT.employeeId.textTransform,
            whiteSpace: 'nowrap',
          }}
        >
          EMP ID - {displayEmpId}
        </span>
      </div>
    </div>
  )
}

// 3. Component for Card Back
export const IdCardBack: React.FC<IdCardProps> = ({
  user,
  templateUrl,
  isStatic,
}) => {
  const bgImage = templateUrl || '/id_card_back_default.png'
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)
  const emailFontSize = getEmailFontSize(user.email)

  useEffect(() => {
    const generateQR = async () => {
      try {
        // Using a static URL for the company website instead of dynamic employee data
        const companyWebsiteUrl = "https://www.example.com" // Replace with exact URL if different
        const url = await QRCode.toDataURL(companyWebsiteUrl, {
          margin: 1,
          width: 150,
          color: {
            dark: '#173d49',
            light: '#ffffff'
          }
        })
        setQrCodeUrl(url)
      } catch (err) {
        console.error('Failed to generate QR code', err)
      }
    }
    generateQR()
  }, [user])

  return (
    <div
      className={`relative select-none overflow-hidden bg-[#173d49] flex-shrink-0 rounded-[20px] ${isStatic ? '' : 'shadow-2xl'}`}
      style={{
        width: `${CARD_WIDTH}px`,
        height: `${CARD_HEIGHT}px`,
        fontFamily: 'Inter, system-ui, sans-serif',
        backgroundColor: '#173d49',
      }}
    >
      {/* Background Template */}
      <img
        src={bgImage}
        alt="Back Template"
        className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none"
        crossOrigin="anonymous"
      />

      {/* Details Blocker */}
      <div
        className="absolute"
        style={{
          top: BACK_LAYOUT.detailsBlocker.top,
          left: BACK_LAYOUT.detailsBlocker.left,
          width: BACK_LAYOUT.detailsBlocker.width,
          height: BACK_LAYOUT.detailsBlocker.height,
          backgroundColor: BACK_LAYOUT.detailsBlocker.backgroundColor,
          zIndex: BACK_LAYOUT.detailsBlocker.zIndex,
        }}
      />

      {/* Blood Group Value */}
      <div
        className="absolute flex items-center"
        style={{
          top: `${parseInt(BACK_LAYOUT.bloodGroup.top) - 9}px`, // center alignment adjustment
          left: BACK_LAYOUT.bloodGroup.left,
          width: BACK_LAYOUT.bloodGroup.width,
          height: BACK_LAYOUT.bloodGroup.height,
          zIndex: BACK_LAYOUT.bloodGroup.zIndex,
        }}
      >
        <span
          className="font-extrabold uppercase text-[10.5px] tracking-wide truncate"
          style={{
            color: BACK_LAYOUT.bloodGroup.color,
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            display: 'block',
            width: '100%',
          }}
        >
          {user.bloodGroup || 'N/A'}
        </span>
      </div>

      {/* Contact Value */}
      <div
        className="absolute flex items-center"
        style={{
          top: `${parseInt(BACK_LAYOUT.contact.top) - 9}px`,
          left: BACK_LAYOUT.contact.left,
          width: BACK_LAYOUT.contact.width,
          height: BACK_LAYOUT.contact.height,
          zIndex: BACK_LAYOUT.contact.zIndex,
        }}
      >
        <span
          className="font-bold text-[10.5px] truncate"
          style={{
            color: BACK_LAYOUT.contact.color,
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            display: 'block',
            width: '100%',
          }}
        >
          {user.phone || 'N/A'}
        </span>
      </div>

      {/* Emergency Contact Value */}
      <div
        className="absolute flex items-center"
        style={{
          top: `${parseInt(BACK_LAYOUT.emergencyContact.top) - 9}px`,
          left: BACK_LAYOUT.emergencyContact.left,
          width: BACK_LAYOUT.emergencyContact.width,
          height: BACK_LAYOUT.emergencyContact.height,
          zIndex: BACK_LAYOUT.emergencyContact.zIndex,
        }}
      >
        <span
          className="font-bold text-[10.5px] truncate"
          style={{
            color: BACK_LAYOUT.emergencyContact.color,
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            display: 'block',
            width: '100%',
          }}
        >
          {user.emergencyContact || 'N/A'}
        </span>
      </div>

      {/* Mail ID Value */}
      <div
        className="absolute flex items-center"
        style={{
          top: `${parseInt(BACK_LAYOUT.mailId.top) - 9}px`,
          left: BACK_LAYOUT.mailId.left,
          width: BACK_LAYOUT.mailId.width,
          height: BACK_LAYOUT.mailId.height,
          zIndex: BACK_LAYOUT.mailId.zIndex,
        }}
      >
        <span
          className="font-bold lowercase truncate"
          style={{
            fontSize: emailFontSize,
            color: BACK_LAYOUT.mailId.color,
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            display: 'block',
            width: '100%',
          }}
          title={user.email}
        >
          {user.email}
        </span>
      </div>

      {/* Office Contact Value */}
      <div
        className="absolute flex items-center"
        style={{
          top: `${parseInt(BACK_LAYOUT.officeContact.top) - 9}px`,
          left: BACK_LAYOUT.officeContact.left,
          width: BACK_LAYOUT.officeContact.width,
          height: BACK_LAYOUT.officeContact.height,
          zIndex: BACK_LAYOUT.officeContact.zIndex,
        }}
      >
        <span
          className="font-bold text-[10.5px] truncate"
          style={{
            color: BACK_LAYOUT.officeContact.color,
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            display: 'block',
            width: '100%',
          }}
        >
          +91 91777 56888
        </span>
      </div>

      {/* QR Code Container */}
      <div
        className="absolute flex items-center justify-center shadow-md border border-white/5"
        style={{
          top: BACK_LAYOUT.qrCode.top,
          left: BACK_LAYOUT.qrCode.left,
          width: BACK_LAYOUT.qrCode.width,
          height: BACK_LAYOUT.qrCode.height,
          backgroundColor: BACK_LAYOUT.qrCode.backgroundColor,
          borderRadius: BACK_LAYOUT.qrCode.borderRadius,
          padding: BACK_LAYOUT.qrCode.padding,
          zIndex: BACK_LAYOUT.qrCode.zIndex,
        }}
      >
        {qrCodeUrl ? (
          <img
            src={qrCodeUrl}
            alt="Verification QR"
            className="w-full h-full object-contain"
          />
        ) : (
          <Loader2 className="h-5 w-5 animate-spin text-[#173d49]" />
        )}
      </div>
    </div>
  )
}

// 4. Dedicated Responsive Preview Wrapper Component
export const IdCardPreview: React.FC<{
  user: UserType
  side: 'front' | 'back'
  profileImageUrl?: string | null
  templateUrl?: string | null
}> = ({ user, side, profileImageUrl, templateUrl }) => {
  return (
    <div className="id-card-scale-container flex items-center justify-center overflow-visible w-full py-2">
      <div
        className="id-card-wrapper transition-transform duration-300 ease-out origin-center"
        style={{
          width: `${CARD_WIDTH}px`,
          height: `${CARD_HEIGHT}px`,
          flexShrink: 0,
        }}
      >
        {side === 'front' ? (
          <IdCardFront
            user={user}
            profileImageUrl={profileImageUrl}
            templateUrl={templateUrl}
          />
        ) : (
          <IdCardBack
            user={user}
            templateUrl={templateUrl}
          />
        )}
      </div>

      <style jsx global>{`
        .id-card-scale-container {
          perspective: 1000px;
        }
        @media (max-width: 440px) {
          .id-card-wrapper {
            transform: scale(0.85);
          }
        }
        @media (max-width: 375px) {
          .id-card-wrapper {
            transform: scale(0.72);
          }
        }
        @media (max-width: 320px) {
          .id-card-wrapper {
            transform: scale(0.62);
          }
        }
      `}</style>
    </div>
  )
}

// 5. Component for Off-screen fixed scale drawing for html2canvas
export const IdCardExport: React.FC<{
  user: UserType
  side: 'front' | 'back'
  profileImageUrl?: string | null
  templateUrl?: string | null
}> = ({ user, side, profileImageUrl, templateUrl }) => {
  return (
    <div
      style={{
        width: `${CARD_WIDTH}px`,
        height: `${CARD_HEIGHT}px`,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {side === 'front' ? (
        <IdCardFront
          user={user}
          profileImageUrl={profileImageUrl}
          templateUrl={templateUrl}
          isStatic={true}
        />
      ) : (
        <IdCardBack
          user={user}
          templateUrl={templateUrl}
          isStatic={true}
        />
      )}
    </div>
  )
}
