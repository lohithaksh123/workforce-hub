'use client'

import { useDarkMode } from '@/lib/dark-mode-provider'
import { Button } from '@/components/ui/button'
import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'

export function DarkModeToggle() {
  const { isDark, setTheme } = useDarkMode()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        disabled
        className="rounded-full"
      >
        <Moon className="h-5 w-5 text-slate-700" />
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => {
        setTheme(isDark ? 'light' : 'dark')
      }}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="rounded-full"
    >
      {isDark ? (
        <Sun className="h-5 w-5 text-yellow-500" />
      ) : (
        <Moon className="h-5 w-5 text-slate-700" />
      )}
    </Button>
  )
}
