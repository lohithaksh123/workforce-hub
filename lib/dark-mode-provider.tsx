'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  isDark: boolean
}

const defaultContextValue: ThemeContextType = {
  theme: 'system',
  setTheme: () => {},
  isDark: false,
}

const ThemeContext = createContext<ThemeContextType>(defaultContextValue)

export function DarkModeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system')
  const [isDark, setIsDark] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Get saved theme preference or default to system
    const saved = localStorage.getItem('theme') as Theme | null
    const initialTheme = saved || 'system'
    setThemeState(initialTheme)

    // Apply theme
    const root = document.documentElement
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const shouldBeDark =
      initialTheme === 'dark' || (initialTheme === 'system' && systemDark)

    if (shouldBeDark) {
      root.classList.add('dark')
      setIsDark(true)
    } else {
      root.classList.remove('dark')
      setIsDark(false)
    }

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e: MediaQueryListEvent) => {
      if (initialTheme === 'system') {
        if (e.matches) {
          root.classList.add('dark')
          setIsDark(true)
        } else {
          root.classList.remove('dark')
          setIsDark(false)
        }
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    setMounted(true)
    
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem('theme', newTheme)

    const root = document.documentElement
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const shouldBeDark =
      newTheme === 'dark' || (newTheme === 'system' && systemDark)

    if (shouldBeDark) {
      root.classList.add('dark')
      setIsDark(true)
    } else {
      root.classList.remove('dark')
      setIsDark(false)
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useDarkMode() {
  const context = useContext(ThemeContext)
  return context
}
