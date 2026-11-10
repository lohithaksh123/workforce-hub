'use client'

import { ShieldAlert, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { motion } from 'framer-motion'

export default function AccessDeniedBoard() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-24 h-24 bg-rose-500/10 text-rose-500 rounded-3xl flex items-center justify-center mb-8 border border-rose-500/20 shadow-2xl shadow-rose-500/10"
      >
        <ShieldAlert className="h-12 w-12" />
      </motion.div>
      
      <motion.h1 
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="text-4xl font-black text-white uppercase tracking-tighter mb-4"
      >
        Access Restricted
      </motion.h1>
      
      <motion.p 
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-slate-500 font-bold max-w-md mx-auto mb-10 leading-relaxed"
      >
        This administrative module is strictly managed by the <span className="text-indigo-400">Owner</span>. 
        Your current role does not have the necessary clearance to view or modify these configurations.
      </motion.p>
      
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <Button asChild className="bg-white text-slate-950 hover:bg-slate-200 font-black px-8 h-12 rounded-2xl shadow-xl transition-all active:scale-95">
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-5 w-5" />
            BACK TO DASHBOARD
          </Link>
        </Button>
      </motion.div>
      
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none -z-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
    </div>
  )
}
