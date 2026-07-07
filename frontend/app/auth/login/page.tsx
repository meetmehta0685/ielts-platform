import { LoginForm } from "@/components/auth/login-form";
import { Metadata } from "next";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Login - IELTS AI Platform",
  description: "Sign in to access your IELTS exam study dashboard and practice tools.",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-radial from-background to-muted/20 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center">
          <img src="/logo.png" alt="AI IELTS Logo" className="h-36 w-auto object-contain mb-4" />
          <h1 className="text-center text-3xl font-extrabold tracking-tight text-foreground">
            Welcome Back
          </h1>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Sign in to continue your preparation
          </p>
        </div>
        
        {/* Wrap in Suspense to resolve searchParams client-side smoothly */}
        <Suspense
          fallback={
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
