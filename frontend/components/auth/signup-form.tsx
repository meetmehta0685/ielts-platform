"use client";

import { useState, type BaseSyntheticEvent } from "react";
import { useRouter } from "next/navigation";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { startGoogleSignIn } from "@/lib/auth-redirect";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { GoogleMark, OrRule } from "./auth-frame";
import { fieldEls, useShake } from "./use-shake";

const signupSchema = z.object({
  fullName: z.string().min(1, "Enter your name"),
  email: z.string().min(1, "Enter your email address").email("That email address doesn't look right"),
  password: z.string().min(8, "Use at least 8 characters"),
});

type SignupFormValues = z.infer<typeof signupSchema>;
type FieldName = keyof SignupFormValues;

export function SignupForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const shake = useShake();

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: SignupFormValues, event?: BaseSyntheticEvent) => {
    const formEl = event?.target as HTMLFormElement | undefined;
    setIsLoading(true);
    setFormError(null);
    try {
      // 1. Sign up the user in Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            full_name: values.fullName,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;

      // The profile row is created by the on_auth_user_created database trigger.
      if (!data.session) {
        toast.success("Account created. Confirm your email address, then sign in.");
        router.push("/auth/login");
        return;
      }

      toast.success("Account created.");
      router.push("/complete-profile");
      router.refresh();
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : "We couldn't create your account. Try again.");
      shake(fieldEls(formEl, ["email", "password"]));
    } finally {
      setIsLoading(false);
    }
  };

  const onInvalid = (errors: FieldErrors<SignupFormValues>, event?: BaseSyntheticEvent) => {
    shake(fieldEls(event?.target as HTMLFormElement | undefined, Object.keys(errors)));
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      await startGoogleSignIn("/complete-profile");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Google sign-up didn't start. Try again.");
      setIsLoading(false);
    }
  };

  const fields: { name: FieldName; label: string; type: string; autoComplete: string; placeholder?: string; hint?: string }[] = [
    { name: "fullName", label: "Your name", type: "text", autoComplete: "name", placeholder: "Priya Nair" },
    { name: "email", label: "Email", type: "email", autoComplete: "email", placeholder: "you@example.com" },
    { name: "password", label: "Password", type: "password", autoComplete: "new-password", hint: "At least 8 characters." },
  ];

  return (
    <div>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit, onInvalid)}
          onChange={() => formError && setFormError(null)}
          noValidate
          className="flex flex-col gap-4"
        >
          {fields.map((f) => (
            <FormField
              key={f.name}
              control={form.control}
              name={f.name}
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-ink">{f.label}</FormLabel>
                  <div data-field={f.name} className="t-input">
                    <FormControl>
                      <Input
                        type={f.type}
                        autoComplete={f.autoComplete}
                        placeholder={f.placeholder}
                        disabled={isLoading}
                        className={cn(formError && f.name !== "fullName" && "border-bad")}
                        {...field}
                      />
                    </FormControl>
                  </div>
                  {f.hint && !fieldState.error && <FormDescription className="text-[13px]">{f.hint}</FormDescription>}
                  <FormMessage className="text-[13px] font-normal text-bad" />
                </FormItem>
              )}
            />
          ))}

          <div className={cn("t-input-wrap has-[p:empty]:hidden", formError && "is-error")}>
            <p role="alert" className="t-error-msg text-sm text-bad empty:hidden">
              {formError}
            </p>
          </div>

          <Button type="submit" variant="accent" className="mt-1 w-full" disabled={isLoading}>
            <span key={isLoading ? "busy" : "idle"} className="t-swap">
              {isLoading ? "Creating your account…" : "Create account"}
            </span>
          </Button>
        </form>
      </Form>

      <OrRule />

      <Button type="button" variant="secondary" className="w-full" disabled={isLoading} onClick={handleGoogleLogin}>
        <GoogleMark />
        Continue with Google
      </Button>
    </div>
  );
}

export function SignupFooter() {
  return (
    <>
      Already practising here?{" "}
      <Link href="/auth/login" className="font-medium text-ink underline decoration-1 underline-offset-4 hover:decoration-2">
        Sign in
      </Link>
      <p className="mt-3 text-[13px]">
        By creating an account you agree to how we handle your data, set out in our{" "}
        <Link href="/privacy" className="underline decoration-1 underline-offset-4 hover:text-ink">
          privacy policy
        </Link>
        .
      </p>
    </>
  );
}
