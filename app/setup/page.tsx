'use client'

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, ArrowRight, UserCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function CompanySetupPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const updateUser = useMutation(api.users.updateUserRole);

  const handleSkip = async () => {
    const userId = (session?.user as any)?.id;
    if (!userId) return;
    await updateUser({ userId, role: "Staff" });
    router.push("/dashboard");
  };

  const options = [
    {
      title: "Create Organization",
      description: "Setup a new organization to manage team finances and roles.",
      icon: Building2,
      color: "bg-blue-100 text-blue-600",
      action: async () => {
        const userId = (session?.user as any)?.id;
        if (!userId) return;
        await updateUser({ userId, role: "Owner" });
        router.push("/dashboard");
      },
    },
    {
      title: "Join Organization",
      description: "Ask your administrator for a role assignment to join.",
      icon: Users,
      color: "bg-green-100 text-green-600",
      action: async () => {
        const userId = (session?.user as any)?.id;
        if (!userId) return;
        await updateUser({ userId, role: "Staff" });
        router.push("/dashboard");
      },
    },
    {
      title: "Skip for Now",
      description: "Manage your personal wallet first. You can create a company later.",
      icon: UserCircle,
      color: "bg-slate-100 text-slate-600",
      action: handleSkip,
    },
  ];

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-950 dark:to-slate-900 p-4">
      <div className="w-full max-w-2xl space-y-8 text-center">
        <div className="space-y-2">
          <h1 className="text-4xl font-extrabold tracking-tight">Complete Your Setup</h1>
          <p className="text-lg text-muted-foreground">
            How would you like to use Acme Interiors today?
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {options.map((option, idx) => (
            <Card 
              key={idx}
              className="group cursor-pointer hover:border-blue-500 hover:shadow-xl transition-all duration-300 border-none bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm overflow-hidden"
              onClick={option.action}
            >
              <CardHeader className="pb-4">
                <div className={`w-12 h-12 rounded-xl ${option.color} flex items-center justify-center mb-4 transition-transform group-hover:scale-110`}>
                  <option.icon className="h-6 w-6" />
                </div>
                <CardTitle className="text-xl font-bold">{option.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <CardDescription className="text-sm">
                  {option.description}
                </CardDescription>
                <div className="pt-4 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowRight className="h-5 w-5 text-blue-600" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-sm text-muted-foreground">
          You can change these settings at any time in your profile.
        </p>
      </div>
    </div>
  );
}
