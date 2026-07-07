"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Loader2, Calendar, Target, Award, Clock, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const WEAK_AREAS_OPTIONS = ["Reading", "Writing", "Listening", "Speaking"];
const BAND_SCORE_OPTIONS = ["4.0", "4.5", "5.0", "5.5", "6.0", "6.5", "7.0", "7.5", "8.0", "8.5", "9.0"];

const completeProfileSchema = z.object({
  currentBand: z.string().optional(),
  targetBand: z.string().min(1, "Target Band Score is required"),
  examDate: z.string().min(1, "Exam date is required"),
  weakAreas: z.array(z.string()).min(1, "Please select at least one weak area"),
  studyHours: z.number().int().min(1, "Study hours must be greater than 0"),
});

type CompleteProfileValues = z.infer<typeof completeProfileSchema>;

export default function CompleteProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isVerifying, setIsVerifying] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const getUserSession = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
          toast.error("You must be logged in to view this page.");
          router.push("/auth/login");
        } else {
          setUser(user);
        }
      } catch (err) {
        router.push("/auth/login");
      } finally {
        setIsVerifying(false);
      }
    };
    getUserSession();
  }, [router]);

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
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast.success("Profile onboarding completed!");
      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isVerifying) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Verifying session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-radial from-background to-muted/20 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-lg space-y-8">
        <div className="flex flex-col items-center">
          <img src="/logo.png" alt="AI IELTS Logo" className="h-36 w-auto object-contain mb-4" />
          <h1 className="text-center text-3xl font-extrabold tracking-tight text-foreground">
            Complete Your Profile
          </h1>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Personalize your study plan to achieve your target score
          </p>
        </div>

        <Card className="w-full shadow-lg border-muted/50">
          <CardHeader>
            <CardTitle className="text-xl font-bold">Onboarding Form</CardTitle>
            <CardDescription>
              We'll use this information to tailor your AI feedback and dashboard metrics.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  {/* Current Band */}
                  <FormField
                    control={form.control}
                    name="currentBand"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1.5">
                          <Award className="h-4 w-4 text-muted-foreground" />
                          Current Band (Optional)
                        </FormLabel>
                        <FormControl>
                          <select
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
                            disabled={isSubmitting}
                            {...field}
                          >
                            <option value="">Never Taken / Not Sure</option>
                            {BAND_SCORE_OPTIONS.map((score) => (
                              <option key={score} value={score}>
                                Band {score}
                              </option>
                            ))}
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Target Band */}
                  <FormField
                    control={form.control}
                    name="targetBand"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1.5">
                          <Target className="h-4 w-4 text-muted-foreground" />
                          Target Band
                        </FormLabel>
                        <FormControl>
                          <select
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
                            disabled={isSubmitting}
                            {...field}
                          >
                            {BAND_SCORE_OPTIONS.map((score) => (
                              <option key={score} value={score}>
                                Band {score}
                              </option>
                            ))}
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  {/* Exam Date */}
                  <FormField
                    control={form.control}
                    name="examDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1.5">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          Exam Date
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            disabled={isSubmitting}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Study Hours */}
                  <FormField
                    control={form.control}
                    name="studyHours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1.5">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          Study Hours Per Day
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            max="24"
                            disabled={isSubmitting}
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Weak Areas */}
                <FormField
                  control={form.control}
                  name="weakAreas"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel className="flex items-center gap-1.5">
                        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                        Weak Areas (Focus Sections)
                      </FormLabel>
                      <FormDescription>
                        Select all modules where you need the most improvement.
                      </FormDescription>
                      <div className="flex flex-wrap gap-2">
                        {WEAK_AREAS_OPTIONS.map((area) => {
                          const isSelected = field.value?.includes(area);
                          return (
                            <button
                              key={area}
                              type="button"
                              disabled={isSubmitting}
                              onClick={() => {
                                const current = field.value || [];
                                const updated = isSelected
                                  ? current.filter((item) => item !== area)
                                  : [...current, area];
                                field.onChange(updated);
                              }}
                              className={`flex items-center justify-center px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                                isSelected
                                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                  : "bg-background text-foreground border-border hover:bg-muted"
                              }`}
                            >
                              {area}
                            </button>
                          );
                        })}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving profile...
                    </>
                  ) : (
                    "Save & Go to Dashboard"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
