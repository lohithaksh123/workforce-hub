'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DarkModeToggle } from '@/components/dark-mode-toggle'
import { AlertCircle, Plus, KeyIcon } from 'lucide-react'

type SetupAction = 'create' | 'join' | 'skip' | null

function CompanySetupContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('sessionId')
  const phone = searchParams.get('phone')

  const [action, setAction] = useState<SetupAction>(null)
  const [formData, setFormData] = useState({
    companyName: '',
    businessType: '',
    joinCode: '',
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
      if (action === 'create') {
        if (!formData.companyName.trim()) {
          setError('Company name is required')
          return
        }
      } else if (action === 'join') {
        if (!formData.joinCode.trim()) {
          setError('Join code is required')
          return
        }
      }

      const response = await fetch('/api/auth/company-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          phone,
          action,
          companyName: formData.companyName || undefined,
          businessType: formData.businessType || undefined,
          joinCode: formData.joinCode || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to setup company')
      }

      // Navigate to dashboard
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (action === null) {
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
            <CardTitle className="text-2xl">Set up Your Workspace</CardTitle>
            <CardDescription>
              Choose how you want to proceed
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            <button
              onClick={() => setAction('create')}
              className="w-full flex items-center gap-4 p-4 border border-border rounded-lg hover:bg-secondary transition-colors text-left"
            >
              <div className="flex-shrink-0">
                <Plus className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="font-medium">Create a Wallet</p>
                <p className="text-sm text-muted-foreground">
                  Start a new company workspace
                </p>
              </div>
            </button>

            <button
              onClick={() => setAction('join')}
              className="w-full flex items-center gap-4 p-4 border border-border rounded-lg hover:bg-secondary transition-colors text-left"
            >
              <div className="flex-shrink-0">
                <KeyIcon className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="font-medium">Join a Wallet</p>
                <p className="text-sm text-muted-foreground">
                  Enter a code to join existing workspace
                </p>
              </div>
            </button>

            <button
              onClick={() => setAction('skip')}
              className="w-full flex items-center gap-4 p-4 border border-border rounded-lg hover:bg-secondary transition-colors text-left"
            >
              <div className="flex-shrink-0">
                <AlertCircle className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="font-medium">Skip for Now</p>
                <p className="text-sm text-muted-foreground">
                  Access the dashboard without a workspace
                </p>
              </div>
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (action === 'skip') {
    handleSubmit({ preventDefault: () => {} } as React.FormEvent)
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
          <CardTitle className="text-2xl">
            {action === 'create' ? 'Create a Wallet' : 'Join a Wallet'}
          </CardTitle>
          <CardDescription>
            {action === 'create' 
              ? 'Set up your company workspace'
              : 'Enter the code to join a workspace'
            }
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {action === 'create' && (
              <>
                <div className="space-y-2">
                  <label htmlFor="companyName" className="text-sm font-medium">
                    Wallet Name
                  </label>
                  <Input
                    id="companyName"
                    name="companyName"
                    placeholder="e.g., Acme Corp"
                    value={formData.companyName}
                    onChange={handleChange}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="businessType" className="text-sm font-medium">
                    Business Type (Optional)
                  </label>
                  <Input
                    id="businessType"
                    name="businessType"
                    placeholder="e.g., Technology, Retail"
                    value={formData.businessType}
                    onChange={handleChange}
                    disabled={loading}
                  />
                </div>
              </>
            )}

            {action === 'join' && (
              <div className="space-y-2">
                <label htmlFor="joinCode" className="text-sm font-medium">
                  Join Code
                </label>
                <Input
                  id="joinCode"
                  name="joinCode"
                  placeholder="Enter 6-8 character code"
                  value={formData.joinCode}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  maxLength={8}
                />
              </div>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setAction(null)}
                disabled={loading}
              >
                Back
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={loading}
              >
                {loading ? 'Setting up...' : 'Continue'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default function CompanySetup() {
  return (
    <Suspense fallback={<div>Loading setup...</div>}>
      <CompanySetupContent />
    </Suspense>
  )
}
