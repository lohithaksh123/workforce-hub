// OTP utilities for Acme Interiors authentication
// In production, integrate with an SMS provider like Twilio

const OTP_LENGTH = 6
const OTP_EXPIRY_MINUTES = 5
const MAX_ATTEMPTS = 3

// In-memory storage for demo (replace with database in production)
const otpStore = new Map<string, {
  otp: string
  expiresAt: number
  attempts: number
  verified: boolean
  userId?: string
}>()

export function generateOTP(): string {
  return Math.floor(Math.random() * Math.pow(10, OTP_LENGTH))
    .toString()
    .padStart(OTP_LENGTH, '0')
}

export function createOTPSession(phone: string): string {
  // Use a fixed dummy OTP for demo/development purposes
  const otp = process.env.NODE_ENV === 'development' ? '123456' : generateOTP()
  const expiresAt = Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000
  
  otpStore.set(phone, {
    otp,
    expiresAt,
    attempts: 0,
    verified: false,
  })

  // In production, send via SMS
  console.log(`[DEMO] OTP for ${phone}: ${otp}`)
  
  return otp
}

export function verifyOTP(phone: string, otp: string): { success: boolean; error?: string } {
  const session = otpStore.get(phone)
  
  if (!session) {
    return { success: false, error: 'No OTP session found. Request a new OTP.' }
  }

  if (Date.now() > session.expiresAt) {
    otpStore.delete(phone)
    return { success: false, error: 'OTP has expired. Request a new OTP.' }
  }

  if (session.attempts >= MAX_ATTEMPTS) {
    otpStore.delete(phone)
    return { success: false, error: 'Too many failed attempts. Request a new OTP.' }
  }

  if (session.otp !== otp) {
    session.attempts += 1
    return { success: false, error: `Invalid OTP. ${MAX_ATTEMPTS - session.attempts} attempts remaining.` }
  }

  session.verified = true
  return { success: true }
}

export function getOTPSession(phone: string) {
  return otpStore.get(phone)
}

export function clearOTPSession(phone: string) {
  otpStore.delete(phone)
}

export function markOTPVerified(phone: string, userId: string) {
  const session = otpStore.get(phone)
  if (session) {
    session.verified = true
    session.userId = userId
  }
}
