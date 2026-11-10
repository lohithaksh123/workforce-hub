'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, ArrowLeft } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';

export default function DisabledAccountPage() {
  const router = useRouter();

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 sm:p-10 text-white relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md bg-white/5 border border-white/10 p-10 rounded-3xl backdrop-blur-2xl shadow-2xl text-center space-y-8">
        
        <div className="space-y-4">
          <div className="mx-auto flex items-center justify-center mb-2">
            <img src="/logo.png" alt="Acme Interiors" className="h-16 w-auto dark:brightness-0 dark:invert" />
          </div>
          <div>
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-1">Acme Interiors</h2>
            <h1 className="text-3xl font-black italic uppercase tracking-tighter text-white">Access Suspended</h1>
          </div>
        </div>

        <div className="p-6 bg-black/20 rounded-2xl border border-white/5">
          <p className="text-sm font-medium text-slate-300 leading-relaxed">
            This account has been deactivated. Please contact the system administrator or management to restore your operational access.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Button 
            onClick={handleLogout}
            className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest text-xs rounded-xl shadow-lg shadow-primary/20 transition-all"
          >
            <LogOut className="h-4 w-4 mr-2" /> End Session & Logout
          </Button>
          <Button 
            onClick={() => router.push('/login')}
            variant="outline"
            className="w-full h-14 bg-transparent border-white/10 hover:bg-white/5 text-slate-400 font-bold uppercase tracking-widest text-[10px] rounded-xl transition-all"
          >
            <ArrowLeft className="h-3 w-3 mr-2" /> Return to Login
          </Button>
        </div>

      </div>

      <div className="mt-12 text-center text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] relative z-10">
        Acme Interiors © {new Date().getFullYear()}
      </div>
    </div>
  );
}
