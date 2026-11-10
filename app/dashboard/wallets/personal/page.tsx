'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { Loader2 } from 'lucide-react'

function WalletInitializer() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const userId = searchParams.get('userId')
    
    const wallet = useQuery(api.wallets.getMyWallet, userId ? { userId } : "skip")
    const createWallet = useMutation(api.wallets.createUserWallet)

    useEffect(() => {
        if (wallet) {
            router.replace(`/dashboard/wallets/${wallet._id}`)
        } else if (wallet === null && userId) {
            // Wallet definitely doesn't exist, create it
            createWallet({ userId }).then((newId) => {
                router.replace(`/dashboard/wallets/${newId}`)
            })
        }
    }, [wallet, userId, router, createWallet])

    return (
        <div className="flex h-[70vh] items-center justify-center flex-col gap-4">
            <Loader2 className="h-10 w-10 text-indigo-500 animate-spin" />
            <p className="font-black uppercase tracking-widest text-slate-400 text-xs">Initializing Secure Wallet Access...</p>
        </div>
    )
}

export default function PersonalWalletPage() {
    return (
        <Suspense fallback={
            <div className="flex h-[70vh] items-center justify-center flex-col gap-4">
                <Loader2 className="h-10 w-10 text-indigo-500 animate-spin" />
                <p className="font-black uppercase tracking-widest text-slate-400 text-xs">Preparing Workspace...</p>
            </div>
        }>
            <WalletInitializer />
        </Suspense>
    )
}

