'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PasswordInput } from '@/components/ui/password-input'
import { LayoutDashboard, Lock } from 'lucide-react'

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing reset token')
    }
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setSuccess(true)
      setTimeout(() => router.push('/login'), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-950 dark:to-slate-900 p-4">
      <Card className="w-full max-w-md border-none shadow-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
        <CardHeader className="space-y-4 text-center pb-8">
          <div className="flex justify-center">
            <div className="p-3 rounded-2xl bg-blue-600 shadow-lg shadow-blue-500/20">
              <Lock className="h-10 w-10 text-white" />
            </div>
          </div>
          <div className="space-y-2">
            <CardTitle className="text-3xl font-bold tracking-tight bg-gradient-to-br from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Reset Password
            </CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              Enter your new password below
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {success ? (
            <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 text-green-600 rounded-xl border border-green-200 dark:border-green-800">
              <p className="font-semibold text-lg">Password Reset Successfully!</p>
              <p className="text-sm mt-2">Redirecting you to login page...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <p className="text-sm text-red-500 text-center font-medium bg-red-50 p-2 rounded-lg">{error}</p>
              )}
              <div className="space-y-4">
                <PasswordInput
                  placeholder="New Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading || !!error && !token}
                  className="h-12 border-slate-200 bg-white dark:bg-slate-900"
                  required
                />
                <PasswordInput
                  placeholder="Confirm New Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading || !!error && !token}
                  className="h-12 border-slate-200 bg-white dark:bg-slate-900"
                  required
                />
              </div>
              <Button 
                type="submit"
                disabled={loading || !!error && !token}
                className="w-full h-12 text-base font-semibold transition-all bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
              >
                {loading ? "Resetting..." : "Reset Password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div>Loading reset page...</div>}>
      <ResetPasswordContent />
    </Suspense>
  )
}
