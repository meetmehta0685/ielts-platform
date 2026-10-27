import { Metadata } from "next";
import { Suspense } from "react";
import { LoginFooter, LoginForm } from "@/components/auth/login-form";
import { AuthFrame } from "@/components/auth/auth-frame";

export const metadata: Metadata = {
  title: "Sign in · IELTS Prep",
  description: "Sign in to your IELTS practice: marked essays, speaking feedback, timed tests and your study plan.",
};

function FormSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading the sign-in form">
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="t-skel h-4 w-16" />
          <div className="t-skel h-10 w-full rounded-[10px]" />
        </div>
      ))}
      <div className="t-skel mt-1 h-10 w-full rounded-full" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <AuthFrame
      title="Sign in to keep practising"
      lead="Your marked essays, speaking feedback and study plan are where you left them."
      footer={<LoginFooter />}
    >
      {/* useSearchParams needs a Suspense boundary */}
      <Suspense fallback={<FormSkeleton />}>
        <LoginForm />
      </Suspense>
    </AuthFrame>
  );
}
