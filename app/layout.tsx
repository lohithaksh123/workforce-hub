import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { DarkModeProvider } from '@/lib/dark-mode-provider'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'Acme Interiors - Financial Management',
  description: 'Comprehensive financial management platform for tracking transactions, approving requests, and managing team permissions with complete audit trails.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

import { ConvexClientProvider } from '@/components/ConvexClientProvider'
import SessionProviderWrapper from '@/components/SessionProviderWrapper'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <SessionProviderWrapper>
          <ConvexClientProvider>
            <DarkModeProvider>
              {children}
              <Toaster />
              <Sonner />
            </DarkModeProvider>
          </ConvexClientProvider>
        </SessionProviderWrapper>
        <Analytics />
      </body>
    </html>
  )
}
