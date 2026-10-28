"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Check } from "lucide-react";

import { ProductMark } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { cn } from "@/lib/utils";

/** IELTS order: Listening, Reading, Writing, Speaking. */
const WEAK_AREAS_OPTIONS = ["Listening", "Reading", "Writing", "Speaking"];
const BAND_SCORE_OPTIONS = ["4.0", "4.5", "5.0", "5.5", "6.0", "6.5", "7.0", "7.5", "8.0", "8.5", "9.0"];

const completeProfileSchema = z.object({
  currentBand: z.string().optional(),
  targetBand: z.string().min(1, "Choose the band you are aiming for"),
  examDate: z.string().min(1, "Enter your exam date"),
  weakAreas: z.array(z.string()).min(1, "Pick at least one module"),
  studyHours: z.number().int().min(1, "Enter at least 1 hour"),
});

type CompleteProfileValues = z.infer<typeof completeProfileSchema>;

const selectClass =
  "h-10 w-full cursor-pointer rounded-[10px] border border-input bg-sheet px-3 text-[15px] text-ink outline-none transition-[border-color] duration-[var(--duration-quick)] hover:border-line-strong focus-visible:border-brand disabled:opacity-50 aria-invalid:border-bad";
const labelClass = "text-sm font-medium text-ink";
const messageClass = "text-[13px] font-normal text-bad";

export default function CompleteProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isVerifying, setIsVerifying] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);

  const form = useForm<CompleteProfileValues>({
    resolver: zodResolver(completeProfileSchema),
    defaultValues: {
      currentBand: "",
      targetBand: "7.0",
      examDate: "",
      weakAreas: [],
      studyHours: 2,
    },
  });

  useEffect(() => {
    const getUserSession = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
          toast.error("Sign in to set up your profile.");
          router.push("/auth/login");
        } else {
          setUser(user);
          // Pre-fill from an existing profile so revisiting onboarding never resets it to defaults.
          const { data: profile } = await supabase
            .from("profiles")
            .select("current_band, target_band, exam_date, weak_areas, study_hours_per_day")
            .eq("id", user.id)
            .maybeSingle();
          if (profile?.exam_date) {
            setHasProfile(true);
            form.reset({
              currentBand: profile.current_band != null ? Number(profile.current_band).toFixed(1) : "",
              targetBand: Number(profile.target_band).toFixed(1),
              examDate: profile.exam_date,
              weakAreas: profile.weak_areas || [],
              studyHours: profile.study_hours_per_day || 2,
            });
          }
        }
      } catch {
        router.push("/auth/login");
      } finally {
        setIsVerifying(false);
      }
    };
    getUserSession();
  }, [router, form]);

  const onSubmit = async (values: CompleteProfileValues) => {
    if (!user) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          current_band: values.currentBand ? parseFloat(values.currentBand) : null,
          target_band: parseFloat(values.targetBand),
          exam_date: values.examDate,
          weak_areas: values.weakAreas,
          study_hours_per_day: values.studyHours,
        });

      if (error) throw error;

      toast.success(hasProfile ? "Profile saved." : "You're set up.");
      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Your profile didn't save. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const name = (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0];

  return (
    <div className="min-h-dvh bg-sheet">
      <header className="flex h-16 items-center justify-between border-b border-border px-4 sm:px-8">
        <Link
          href={hasProfile ? "/dashboard" : "/"}
          className="-mx-2 flex items-center gap-2.5 rounded-[8px] px-2 py-1.5 transition-colors duration-[var(--duration-quick)] hover:bg-panel focus-visible:outline-2 focus-visible:outline-brand"
        >
          <ProductMark />
          <span className="text-[15px] font-medium text-ink">IELTS Prep</span>
        </Link>
        {hasProfile && (
          <Link href="/dashboard" className="text-sm text-ink underline decoration-1 underline-offset-4 hover:decoration-2">
            Back to home
          </Link>
        )}
      </header>

      <main className="mx-auto w-full max-w-[1132px] px-4 pt-8 pb-20 sm:px-6 lg:pt-[72px]">
        <div className="mb-10 max-w-[760px] lg:mb-12">
          <h1 className="font-display text-[32px] text-balance text-ink sm:text-[44px]">
            {hasProfile ? "Your exam and targets." : name ? `${name}, tell us about your exam.` : "Tell us about your exam."}
          </h1>
          <p className="mt-3 text-[17px] leading-normal text-soft">
            These set your countdown, the target line on your scores and the shape of your study plan.
          </p>
        </div>

        {isVerifying ? (
          <ProfileSkeleton />
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="t-revealed">
              <Section title="Your bands" description="The overall band you need, and where you think you are now.">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="targetBand"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={labelClass}>Target band</FormLabel>
                        <FormControl>
                          <select className={selectClass} disabled={isSubmitting} {...field}>
                            {BAND_SCORE_OPTIONS.map((score) => (
                              <option key={score} value={score}>
                                Band {score}
                              </option>
                            ))}
                          </select>
                        </FormControl>
                        <FormMessage className={messageClass} />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="currentBand"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={labelClass}>
                          Current band <span className="font-normal text-soft">(optional)</span>
                        </FormLabel>
                        <FormControl>
                          <select className={selectClass} disabled={isSubmitting} {...field}>
                            <option value="">Not taken yet, or not sure</option>
                            {BAND_SCORE_OPTIONS.map((score) => (
                              <option key={score} value={score}>
                                Band {score}
                              </option>
                            ))}
                          </select>
                        </FormControl>
                        <FormMessage className={messageClass} />
                      </FormItem>
                    )}
                  />
                </div>
              </Section>

              <Section title="Your exam" description="We count down to this date and fit each week to the hours you have.">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="examDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={labelClass}>Exam date</FormLabel>
                        <FormControl>
                          <Input type="date" disabled={isSubmitting} {...field} />
                        </FormControl>
                        <FormMessage className={messageClass} />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="studyHours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className={labelClass}>Study hours a day</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            inputMode="numeric"
                            min="1"
                            max="24"
                            className="tabular"
                            disabled={isSubmitting}
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                          />
                        </FormControl>
                        <FormMessage className={messageClass} />
                      </FormItem>
                    )}
                  />
                </div>
              </Section>

              <Section
                title="Focus modules"
                description="Pick the modules that need the most work. Your plan and your home screen start with these."
                last
              >
                <FormField
                  control={form.control}
                  name="weakAreas"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className={labelClass}>Modules to focus on</FormLabel>
                      <div className="flex flex-wrap gap-2" role="group">
                        {WEAK_AREAS_OPTIONS.map((area) => {
                          const isSelected = field.value?.includes(area);
                          return (
                            <button
                              key={area}
                              type="button"
                              aria-pressed={isSelected}
                              disabled={isSubmitting}
                              onClick={() => {
                                const current = field.value || [];
                                const updated = isSelected
                                  ? current.filter((item) => item !== area)
                                  : [...current, area];
                                field.onChange(updated);
                              }}
                              className={cn(
                                "inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[15px] transition-[background-color,color,transform] duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50",
                                isSelected ? "bg-ink text-white hover:bg-ink-hover" : "bg-sheet text-ink ring-1 ring-input hover:bg-panel-strong"
                              )}
                            >
                              {isSelected && <Check aria-hidden className="t-swap size-4" />}
                              {area}
                            </button>
                          );
                        })}
                      </div>
                      <FormMessage className={messageClass} />
                    </FormItem>
                  )}
                />
              </Section>

              <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
                {hasProfile && (
                  <Button asChild variant="ghost">
                    <Link href="/dashboard">Cancel</Link>
                  </Button>
                )}
                <Button type="submit" variant="accent" disabled={isSubmitting}>
                  <span key={isSubmitting ? "busy" : "idle"} className="t-swap">
                    {isSubmitting ? "Saving…" : hasProfile ? "Save changes" : "Save and open my dashboard"}
                  </span>
                </Button>
              </div>
            </form>
          </Form>
        )}
      </main>
    </div>
  );
}

/** One settings row: a label column beside a tonal panel; a rule below unless it is the last. */
function Section({
  title,
  description,
  children,
  last,
}: {
  title: string;
  description: string;
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <section className={cn("grid gap-4 lg:grid-cols-12 lg:gap-8", !last && "mb-8 border-b border-border pb-8")}>
      <div className="lg:col-span-4 lg:pt-1.5">
        <h2 className="text-base font-medium text-ink">{title}</h2>
        <p className="mt-1 text-sm leading-normal text-soft">{description}</p>
      </div>
      <div className="rounded-2xl bg-panel p-4 sm:p-5 lg:col-span-8">{children}</div>
    </section>
  );
}

function ProfileSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading your profile" className="flex flex-col gap-8">
      {[0, 1, 2].map((i) => (
        <div key={i} className="grid gap-4 lg:grid-cols-12 lg:gap-8">
          <div className="flex flex-col gap-2 lg:col-span-4">
            <div className="t-skel h-5 w-32" />
            <div className="t-skel h-4 w-56" />
          </div>
          <div className="t-skel h-[116px] rounded-2xl lg:col-span-8" />
        </div>
      ))}
    </div>
  );
}
