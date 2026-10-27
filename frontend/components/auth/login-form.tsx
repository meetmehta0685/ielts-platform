"use client";

import { useState, type BaseSyntheticEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { OAUTH_NEXT_PATH_KEY, safeInternalPath } from "@/lib/auth-redirect";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { GoogleMark, OrRule } from "./auth-frame";
import { fieldEls, useShake } from "./use-shake";

const loginSchema = z.object({
  email: z.string().min(1, "Enter your email address").email("That email address doesn't look right"),
  password: z.string().min(1, "Enter your password"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const shake = useShake();

  // Check if there's a post-login redirect path
  const redirectPath = safeInternalPath(searchParams.get("redirect"));

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: LoginFormValues, event?: BaseSyntheticEvent) => {
    const formEl = event?.target as HTMLFormElement | undefined;
    setIsLoading(true);
    setFormError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (error) {
        // Handle invalid credentials or other errors
        if (error.status === 400 || error.message.toLowerCase().includes("invalid")) {
          throw new Error("That email and password don't match. Try again.");
        }
        throw error;
      }

      toast.success("Signed in.");

      // Redirect user to target page
      router.push(redirectPath);
      router.refresh();
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : "We couldn't sign you in. Try again.");
      shake(fieldEls(formEl, ["email", "password"]));
    } finally {
      setIsLoading(false);
    }
  };

  const onInvalid = (errors: FieldErrors<LoginFormValues>, event?: BaseSyntheticEvent) => {
    shake(fieldEls(event?.target as HTMLFormElement | undefined, Object.keys(errors)));
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const callbackUrl = new URL("/auth/callback", window.location.origin);
      window.sessionStorage.setItem(OAUTH_NEXT_PATH_KEY, redirectPath);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl.toString(),
        },
      });
      if (error) throw error;
    } catch (error: unknown) {
      window.sessionStorage.removeItem(OAUTH_NEXT_PATH_KEY);
      toast.error(error instanceof Error ? error.message : "Google sign-in didn't start. Try again.");
      setIsLoading(false);
    }
  };

  return (
    <div>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit, onInvalid)}
          onChange={() => formError && setFormError(null)}
          noValidate
          className="flex flex-col gap-4"
        >
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-ink">Email</FormLabel>
                <div data-field="email" className="t-input">
                  <FormControl>
                    <Input
                      placeholder="you@example.com"
                      type="email"
                      autoComplete="email"
                      disabled={isLoading}
                      className={cn(formError && "border-bad")}
                      {...field}
                    />
                  </FormControl>
                </div>
                <FormMessage className="text-[13px] font-normal text-bad" />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-ink">Password</FormLabel>
                <div data-field="password" className="t-input">
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="current-password"
                      disabled={isLoading}
                      className={cn(formError && "border-bad")}
                      {...field}
                    />
                  </FormControl>
                </div>
                <FormMessage className="text-[13px] font-normal text-bad" />
              </FormItem>
            )}
          />

          <div className={cn("t-input-wrap has-[p:empty]:hidden", formError && "is-error")}>
            <p role="alert" className="t-error-msg min-h-0 text-sm text-bad empty:hidden">
              {formError}
            </p>
          </div>

          <Button type="submit" variant="accent" className="mt-1 w-full" disabled={isLoading}>
            <span key={isLoading ? "busy" : "idle"} className="t-swap">
              {isLoading ? "Signing in…" : "Sign in"}
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

export function LoginFooter() {
  return (
    <>
      New here?{" "}
      <Link href="/auth/signup" className="font-medium text-ink underline decoration-1 underline-offset-4 hover:decoration-2">
        Create an account
      </Link>
    </>
  );
}
