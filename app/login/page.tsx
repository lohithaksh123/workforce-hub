'use client'

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordInput } from "@/components/ui/password-input";
import { LayoutDashboard, Wallet, Mail } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setLoading(true);
    setError(null);
    const result = await signIn("credentials", { 
      email, 
      password, 
      callbackUrl: "/dashboard", 
      redirect: false 
    });

    if (result?.error) {
      if (result.error.includes("pending") || result.error.includes("rejected") || result.error.includes("inactive") || result.error.includes("suspended")) {
        setError(result.error);
      } else {
        setError("Invalid email or password");
      }
    } else {
      window.location.href = "/dashboard";
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
        headers: { "Content-Type": "application/json" },
      });
      setForgotSent(true);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[conic-gradient(at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-primary/5 to-background p-4 animate-in fade-in duration-1000">
      <Card className="w-full max-w-md border-none shadow-2xl bg-white/90 dark:bg-slate-950/80 backdrop-blur-xl">
        <CardHeader className="space-y-4 text-center pb-8 border-b border-slate-100 dark:border-slate-800">
          <div className="flex justify-center">
            <div className="p-2 rounded-2xl bg-transparent overflow-hidden">
              <img src="/logo.png" alt="Acme Interiors" className="h-24 w-auto drop-shadow-sm dark:brightness-0 dark:invert" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {showForgot ? (
            forgotSent ? (
              <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-300 rounded-xl border border-green-200 dark:border-green-800">
                <Mail className="h-8 w-8 mx-auto mb-2" />
                <p className="font-semibold">Check your email!</p>
                <p className="text-sm mt-1">If an account exists, we sent a password reset link to {email}</p>
                <Button variant="link" onClick={() => setShowForgot(false)} className="mt-4">Back to Login</Button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="h-12 border-slate-200 bg-white dark:bg-slate-900"
                    required
                  />
                </div>
                <Button 
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 text-base font-bold transition-all bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20"
                >
                  {loading ? "Sending..." : "Send Reset Link"}
                </Button>
                <Button
                  type="button" // Changed from 'submit' to 'button'
                  variant="outline"
                  className="w-full h-11 border-primary/20 text-primary hover:bg-primary/5 font-bold"
                  onClick={() => setShowForgot(false)} // Added onClick
                  disabled={loading}
                >
                  Back to Login
                </Button>
              </form>
            )
          ) : (
            <form onSubmit={handleSignIn} className="space-y-4">
              {error && (
                <p className="text-sm text-red-500 text-center font-medium">{error}</p>
              )}
              <div className="space-y-4">
                <Input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="h-12 border-slate-200 bg-white dark:bg-slate-900"
                  required
                />
                <PasswordInput
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="h-12 border-slate-200 bg-white dark:bg-slate-900"
                  required
                />
              </div>
              <div className="flex justify-end">
                <Button 
                  variant="link" 
                  type="button"
                  onClick={() => setShowForgot(true)}
                  className="text-sm text-primary p-0 h-auto font-bold"
                >
                  Forgot Password?
                </Button>
              </div>
              <Button 
                type="submit"
                disabled={loading}
                className="w-full h-12 text-base font-bold transition-all hover:scale-[1.01] active:scale-[0.99] bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20"
              >
                {loading ? "Logging in..." : "Login"}
              </Button>
            </form>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
