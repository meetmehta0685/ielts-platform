import { Metadata } from "next";
import { SignupFooter, SignupForm } from "@/components/auth/signup-form";
import { AuthFrame } from "@/components/auth/auth-frame";

export const metadata: Metadata = {
  title: "Create your account · IELTS Prep",
  description: "Create an account to practise IELTS Writing, Speaking, Reading and Listening with marked feedback.",
};

export default function SignupPage() {
  return (
    <AuthFrame
      title="Create your practice account"
      lead="Set a target band and an exam date next, and we'll plan your weeks around them."
      footer={<SignupFooter />}
    >
      <SignupForm />
    </AuthFrame>
  );
}
