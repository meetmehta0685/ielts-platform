import { SignupForm } from "@/components/auth/signup-form";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up - IELTS AI Platform",
  description: "Register to start your personalized AI-powered IELTS preparation journey.",
};

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-radial from-background to-muted/20 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center">
          <img src="/logo.png" alt="AI IELTS Logo" className="h-36 w-auto object-contain mb-4" />
          <h1 className="text-center text-3xl font-extrabold tracking-tight text-foreground">
            IELTS AI Prep
          </h1>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Your journey to a band 8.0+ begins here
          </p>
        </div>
        <SignupForm />
      </div>
    </div>
  );
}
