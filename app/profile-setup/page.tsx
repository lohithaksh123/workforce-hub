'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DarkModeToggle } from '@/components/dark-mode-toggle'
import { AlertCircle } from 'lucide-react'

function ProfileSetupContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('sessionId')
  const phone = searchParams.get('phone')

  const [formData, setFormData] = useState({
    name: '',
    email: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!sessionId || !phone) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <CardTitle>Invalid Session</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Please start from the login page.
            </p>
            <Button onClick={() => router.push('/login')} className="w-full">
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!formData.name.trim()) {
        setError('Name is required')
        return
      }

      const response = await fetch('/api/auth/profile-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          phone,
          name: formData.name,
          email: formData.email || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to setup profile')
      }

      router.push(`/company-setup?sessionId=${sessionId}&phone=${phone}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary p-4">
      <div className="absolute top-4 right-4">
        <DarkModeToggle />
      </div>

      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-lg mx-auto mb-4">
            FX
          </div>
          <CardTitle className="text-2xl">Complete Your Profile</CardTitle>
          <CardDescription>
            Set up your Acme Interiors account
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="phone" className="text-sm font-medium">
                Phone Number
              </label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Full Name
              </label>
              <Input
                id="name"
                name="name"
                placeholder="Enter your name"
                value={formData.name}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email (Optional)
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="your@email.com"
                value={formData.email}
                onChange={handleChange}
                disabled={loading}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Setting up...' : 'Continue'}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-4">
            Phone: {phone}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default function ProfileSetup() {
  return (
    <Suspense fallback={<div>Loading profile setup...</div>}>
      <ProfileSetupContent />
    </Suspense>
  )
}
