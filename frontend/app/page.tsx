"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { OAUTH_NEXT_PATH_KEY, safeInternalPath } from "@/lib/auth-redirect";
import {
  Sparkles,
  ArrowRight,
  Mic,
  PenTool,
  BookOpen,
  Headphones,
  CheckCircle2,
  TrendingUp,
  MessageSquare,
  Star,
  Users,
  Award,
  ShieldCheck,
  Mail,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  Check,
  ChevronRight,
  X,
  Sparkle,
  Search,
  Lock,
  User,
  Compass,
  ArrowUpRight
} from "lucide-react";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { CountUp } from "@/components/landing/count-up";

// Mock Data for Interactive Demos
const CHAT_GUIDES = {
  grammar: {
    user: "I want to improve my essay, but I struggles with verbs.",
    ai: "I'd be glad to help! For subject-verb agreement, 'I struggles' changes to 'I struggle' when using the first-person singular.\n\nHere is how we can rewrite that sentence: \"I want to improve my essay, but I [struggle] green-highlight with verbs.\"",
    feedback: "Focus Area: Grammatical Range & Accuracy"
  },
  vocabulary: {
    user: "I think traffic is a very bad problem in big cities.",
    ai: "To elevate your vocabulary score, try replacing general words like 'very bad' with more academic terms.\n\nRecommended rewrite: \"I believe traffic is an [acute/severe] green-highlight problem in metropolitan areas.\"",
    feedback: "Focus Area: Lexical Resource"
  },
  transitions: {
    user: "First I practiced reading. Also I practiced writing.",
    ai: "Adding formal transition markers helps connect your ideas and guides the examiner smoothly through your thoughts.\n\nRecommended rewrite: \"[Initially] green-highlight, I practiced reading, [subsequently] green-highlight proceeding to writing.\"",
    feedback: "Focus Area: Coherence & Cohesion"
  }
};

export default function Home() {
  // Authentication state
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Interface states
  const [demoTab, setDemoTab] = useState<"grammar" | "vocabulary" | "transitions">("grammar");
  const [activeModule, setActiveModule] = useState<"speaking" | "writing" | "reading" | "listening">("speaking");
  
  // Lead capture form
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Load session on mount
  useEffect(() => {
    const currentUrl = new URL(window.location.href);
    const hashParams = new URLSearchParams(currentUrl.hash.slice(1));
    const isOAuthReturn =
      currentUrl.searchParams.has("code") ||
      currentUrl.searchParams.has("error") ||
      hashParams.has("access_token") ||
      hashParams.has("error");
    let isRedirecting = false;

    const finishOAuthReturn = (hasSession: boolean) => {
      if (!isOAuthReturn || isRedirecting) return;

      isRedirecting = true;
      const nextPath = safeInternalPath(
        window.sessionStorage.getItem(OAUTH_NEXT_PATH_KEY)
      );
      window.sessionStorage.removeItem(OAUTH_NEXT_PATH_KEY);
      window.location.replace(hasSession ? nextPath : "/auth/login");
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUser(session?.user ?? null);
      setAuthLoading(false);
      finishOAuthReturn(Boolean(session));
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
      if (session) finishOAuthReturn(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim() && email.includes("@")) {
      setIsSubmitted(true);
    }
  };

  // Scroll position state for hero parallax
  const [scrollY, setScrollY] = useState(0);
  
  // Visibility states for section-specific animations
  const [isRoadmapVisible, setIsRoadmapVisible] = useState(false);
  const [isDashboardVisible, setIsDashboardVisible] = useState(false);

  // Refs for scroll trigger intersections
  const roadmapRef = useRef<HTMLDivElement>(null);
  const dashboardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const roadmapEl = roadmapRef.current;
    if (roadmapEl) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setIsRoadmapVisible(true);
            observer.unobserve(roadmapEl);
          }
        },
        { threshold: 0.15 }
      );
      observer.observe(roadmapEl);
      return () => observer.disconnect();
    }
  }, []);

  useEffect(() => {
    const dashboardEl = dashboardRef.current;
    if (dashboardEl) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setIsDashboardVisible(true);
            observer.unobserve(dashboardEl);
          }
        },
        { threshold: 0.1 }
      );
      observer.observe(dashboardEl);
      return () => observer.disconnect();
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-slate-800 font-sans selection:bg-amber-200 selection:text-slate-900 relative overflow-hidden">
      
      {/* Subtle Warm Linen Radial Pattern Overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(#efebe4_1.5px,transparent_1.5px)] [background-size:24px_24px] opacity-60 pointer-events-none z-0" />

      {/* Low-Opacity Muted Organic Watercolor Wash Background Shapes */}
      <div className="absolute top-[-10%] left-[-5%] w-[45vw] h-[45vw] rounded-full bg-[#f6f1e5]/50 blur-[130px] pointer-events-none z-0" />
      <div className="absolute top-[35%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-[#e8f2ea]/30 blur-[140px] pointer-events-none z-0" />
      <div className="absolute bottom-[-10%] left-[20%] w-[35vw] h-[35vw] rounded-full bg-[#f5ebe0]/40 blur-[120px] pointer-events-none z-0" />

      {/* Floating Header */}
      <header className="sticky top-0 z-40 w-full bg-[#FAF8F5]/85 backdrop-blur-md border-b border-stone-200/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <img src="/logo.png" alt="IELTS Academy Logo" className="h-16 w-auto object-contain" />
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-500">
            <a href="#features" className="hover:text-blue-950 transition-colors">Core Modules</a>
            <a href="#guide" className="hover:text-blue-950 transition-colors">Study Guide</a>
            <a href="#how-it-works" className="hover:text-blue-950 transition-colors">How It Works</a>
            <a href="#dashboard-preview" className="hover:text-blue-950 transition-colors">Learning Journey</a>
            <a href="#testimonials" className="hover:text-blue-950 transition-colors">Reviews</a>
          </nav>

          <div className="flex items-center gap-4">
            {authLoading ? (
              <div className="w-20 h-8 bg-stone-200/50 animate-pulse rounded-xl" />
            ) : currentUser ? (
              <Link
                href="/dashboard"
                className="text-sm font-semibold bg-blue-950 hover:bg-blue-900 text-white px-4 py-2 rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-[0_0_15px_rgba(30,58,138,0.25)] flex items-center gap-1.5 active:scale-95"
              >
                Go to Dashboard <ArrowUpRight className="w-4 h-4 text-amber-500" />
              </Link>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="text-sm font-semibold text-slate-600 hover:text-blue-950 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/signup"
                  className="text-sm font-bold bg-blue-950 hover:bg-blue-900 text-white px-4 py-2.5 rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-[0_0_15px_rgba(30,58,138,0.25)] active:scale-95"
                >
                  Start Free Trial
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Section 1: Hero Area (Updated for Warmth & Student Photo) */}
      <section className="relative z-10 pt-16 pb-20 md:pt-24 md:pb-28">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Column Content */}
            <div className="lg:col-span-6 flex flex-col items-center lg:items-start text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200/50 rounded-full text-amber-800 text-xs font-semibold mb-6 shadow-sm animate-hero-fade-up">
                <Sparkle className="w-3.5 h-3.5 fill-amber-500 text-amber-500 animate-pulse" />
                <span>Personalized Prep Guide</span>
              </div>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-blue-950 leading-[1.15] mb-6 animate-hero-fade-up" style={{ animationDelay: "150ms" }}>
                Unlock Your IELTS Potential with Personalized{" "}
                <span className="relative inline-block bg-gradient-to-r from-blue-950 to-amber-600 bg-clip-text text-transparent">
                  Guidance
                  <Sparkles className="absolute -top-3.5 -right-7 w-5.5 h-5.5 text-amber-500 hidden md:block" />
                </span>
              </h1>
              
              <p className="text-base md:text-lg text-slate-600 max-w-xl mb-8 leading-relaxed font-medium animate-hero-fade-up" style={{ animationDelay: "300ms" }}>
                Prepare with confidence using practice tools, pronunciation reviews, and writing evaluation mapped directly to official IELTS grading criteria.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto mb-10 justify-center lg:justify-start animate-hero-fade-up" style={{ animationDelay: "450ms" }}>
                <Link
                  href={currentUser ? "/dashboard" : "/auth/signup"}
                  className="inline-flex items-center justify-center gap-2 bg-blue-950 hover:bg-blue-900 text-white font-bold px-7 py-4 rounded-xl text-base transition-all duration-300 hover:scale-105 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-950/20 active:scale-95"
                >
                  Start Preparing Free <ArrowRight className="w-5 h-5 text-amber-500" />
                </Link>
                <a
                  href="#features"
                  className="inline-flex items-center justify-center gap-2 border-2 border-amber-400 text-amber-900 hover:bg-amber-50/50 font-bold px-7 py-3.5 rounded-xl text-base transition-all duration-300 hover:scale-105 hover:-translate-y-1 hover:shadow-md active:scale-95"
                >
                  Explore Modules
                </a>
              </div>

              {/* Human Touch indicator */}
              <div className="flex items-center gap-3.5 pt-6 border-t border-stone-200/80 w-full justify-center lg:justify-start animate-hero-fade-up" style={{ animationDelay: "600ms" }}>
                <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-amber-200 bg-amber-50 flex-shrink-0">
                  <div className="absolute inset-0 bg-stone-300 flex items-center justify-center text-slate-600">
                    <User className="w-6 h-6" />
                  </div>
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-blue-950">Speak with Confidence</p>
                  <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                    Study tracks mapped by certified examiners
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: Real student photograph illustration */}
            <div 
              className="lg:col-span-6 flex justify-center relative transition-transform duration-300 ease-out"
              style={{ transform: `translateY(${scrollY * 0.08}px)` }}
            >
              <div className="relative w-full max-w-[500px] aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl border border-stone-200/60 bg-white animate-float-slow">
                <img
                  src="/student_studying.png"
                  alt="Student smiling while studying IELTS materials on a laptop"
                  className="w-full h-full object-cover"
                />
                
                {/* Floating comment badge */}
                <div className="absolute top-6 left-6 bg-white/95 backdrop-blur-sm border border-stone-200/60 rounded-xl p-3.5 shadow-lg flex items-center gap-3 animate-float max-w-[200px]">
                  <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                    <Check className="w-5 h-5 stroke-[2.5px]" />
                  </div>
                  <div>
                    <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pronunciation</h5>
                    <p className="text-xs font-bold text-blue-950 leading-tight">Band 8.0 Flow Checked</p>
                  </div>
                </div>

                {/* Floating score growth badge */}
                <div className="absolute bottom-6 right-6 bg-white/95 backdrop-blur-sm border border-stone-200/60 rounded-xl p-3.5 shadow-lg flex items-center gap-3 animate-float-reverse">
                  <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center flex-shrink-0">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Analytical Assessment</h5>
                    <p className="text-xs font-bold text-blue-950 leading-tight">+1.5 Band growth</p>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Section 2: Core Modules */}
      <section id="features" className="py-20 md:py-24 bg-white relative z-10">
        <div className="max-w-7xl mx-auto px-6">
          <ScrollReveal>
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl md:text-4xl font-extrabold text-blue-950 tracking-tight mb-4">
                Strengthen Every IELTS Component
              </h2>
              <p className="text-base md:text-lg text-slate-500 font-medium">
                Friendly interactive guides, structured practice papers, and rubric evaluations to prepare you for test day.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Speaking Card */}
            <ScrollReveal delay={0} className="h-full">
              <div
                className={`bg-[#fbfaf8] border border-stone-200/60 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-2.5 hover:shadow-xl hover:shadow-blue-950/5 cursor-pointer group h-full ${
                  activeModule === "speaking" ? "ring-2 ring-blue-950 border-transparent bg-white shadow-sm" : ""
                }`}
                onClick={() => setActiveModule("speaking")}
              >
                <div className="w-12 h-12 rounded-xl bg-stone-100 text-blue-950 flex items-center justify-center mb-6 group-hover:bg-blue-950 group-hover:text-white transition-all duration-300">
                  <Mic className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-blue-950 mb-2">Speaking Guide</h3>
                <p className="text-sm text-slate-500 leading-relaxed mb-4">
                  Record your voice to receive friendly reviews on pronunciation, pause habits, and lexical structure.
                </p>
                <span className="inline-flex items-center text-xs font-bold text-blue-950 group-hover:gap-1.5 transition-all">
                  Practice Speaking <ChevronRight className="w-4 h-4 text-amber-500" />
                </span>
              </div>
            </ScrollReveal>

            {/* Writing Card */}
            <ScrollReveal delay={100} className="h-full">
              <div
                className={`bg-[#fbfaf8] border border-stone-200/60 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-2.5 hover:shadow-xl hover:shadow-blue-950/5 cursor-pointer group h-full ${
                  activeModule === "writing" ? "ring-2 ring-blue-950 border-transparent bg-white shadow-sm" : ""
                }`}
                onClick={() => setActiveModule("writing")}
              >
                <div className="w-12 h-12 rounded-xl bg-stone-100 text-blue-950 flex items-center justify-center mb-6 group-hover:bg-blue-950 group-hover:text-white transition-all duration-300">
                  <PenTool className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-blue-950 mb-2">Writing Evaluator</h3>
                <p className="text-sm text-slate-500 leading-relaxed mb-4">
                  Submit essays for line-by-line feedback, grammatical adjustments, and academic vocabulary alternatives.
                </p>
                <span className="inline-flex items-center text-xs font-bold text-blue-950 group-hover:gap-1.5 transition-all">
                  Practice Writing <ChevronRight className="w-4 h-4 text-amber-500" />
                </span>
              </div>
            </ScrollReveal>

            {/* Reading Card */}
            <ScrollReveal delay={200} className="h-full">
              <div
                className={`bg-[#fbfaf8] border border-stone-200/60 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-2.5 hover:shadow-xl hover:shadow-blue-950/5 cursor-pointer group h-full ${
                  activeModule === "reading" ? "ring-2 ring-blue-950 border-transparent bg-white shadow-sm" : ""
                }`}
                onClick={() => setActiveModule("reading")}
              >
                <div className="w-12 h-12 rounded-xl bg-stone-100 text-blue-950 flex items-center justify-center mb-6 group-hover:bg-blue-950 group-hover:text-white transition-all duration-300">
                  <BookOpen className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-blue-950 mb-2">Reading Drills</h3>
                <p className="text-sm text-slate-500 leading-relaxed mb-4">
                  Read academic passages, mark your answers, and view clear annotations explaining correct mappings.
                </p>
                <span className="inline-flex items-center text-xs font-bold text-blue-950 group-hover:gap-1.5 transition-all">
                  Practice Reading <ChevronRight className="w-4 h-4 text-amber-500" />
                </span>
              </div>
            </ScrollReveal>

            {/* Listening Card */}
            <ScrollReveal delay={300} className="h-full">
              <div
                className={`bg-[#fbfaf8] border border-stone-200/60 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-2.5 hover:shadow-xl hover:shadow-blue-950/5 cursor-pointer group h-full ${
                  activeModule === "listening" ? "ring-2 ring-blue-950 border-transparent bg-white shadow-sm" : ""
                }`}
                onClick={() => setActiveModule("listening")}
              >
                <div className="w-12 h-12 rounded-xl bg-stone-100 text-blue-950 flex items-center justify-center mb-6 group-hover:bg-blue-950 group-hover:text-white transition-all duration-300">
                  <Headphones className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-blue-950 mb-2">Listening Drills</h3>
                <p className="text-sm text-slate-500 leading-relaxed mb-4">
                  Listen to accents from different countries, fill out prompt gaps, and track listening comprehension.
                </p>
                <span className="inline-flex items-center text-xs font-bold text-blue-950 group-hover:gap-1.5 transition-all">
                  Practice Listening <ChevronRight className="w-4 h-4 text-amber-500" />
                </span>
              </div>
            </ScrollReveal>

          </div>
        </div>
      </section>

      {/* Section 3: AI Mentor ('Your Intelligent IELTS Guide') */}
      <section id="guide" className="py-20 md:py-24 bg-[#FAF8F5] border-t border-b border-stone-200/50 relative z-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            
            {/* Left Content Column */}
            <ScrollReveal direction="left" className="lg:col-span-5 flex flex-col items-center lg:items-start text-center lg:text-left">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200/50 rounded-full text-amber-800 text-xs font-semibold mb-6 shadow-sm">
                  <Sparkle className="w-3.5 h-3.5 text-amber-600 fill-amber-500/20" />
                  <span>Empowerment through Feedback</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-extrabold text-blue-950 tracking-tight mb-6">
                  Your Intelligent IELTS Guide
                </h2>
                <p className="text-base md:text-lg text-slate-600 mb-8 leading-relaxed font-medium">
                  Unlock line-by-line grammar guidance and advanced academic vocabulary suggestions. Try clicking the options below to see how our guide clarifies and refines real practice drafts.
                </p>

                {/* Toggle Buttons for Chat Demo */}
                <div className="flex flex-wrap gap-2.5 justify-center lg:justify-start">
                  <button
                    onClick={() => setDemoTab("grammar")}
                    className={`px-4.5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
                      demoTab === "grammar"
                        ? "bg-blue-950 text-white shadow-blue-950/10"
                        : "bg-white hover:bg-stone-100 text-slate-600 border border-stone-200/60"
                    }`}
                  >
                    Grammar Check
                  </button>
                  <button
                    onClick={() => setDemoTab("vocabulary")}
                    className={`px-4.5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
                      demoTab === "vocabulary"
                        ? "bg-blue-950 text-white shadow-blue-950/10"
                        : "bg-white hover:bg-stone-100 text-slate-600 border border-stone-200/60"
                    }`}
                  >
                    Vocabulary Upgrade
                  </button>
                  <button
                    onClick={() => setDemoTab("transitions")}
                    className={`px-4.5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
                      demoTab === "transitions"
                        ? "bg-blue-950 text-white shadow-blue-950/10"
                        : "bg-white hover:bg-stone-100 text-slate-600 border border-stone-200/60"
                    }`}
                  >
                    Transitions Check
                  </button>
                </div>
              </div>
            </ScrollReveal>

            {/* Right Chat Mockup Column */}
            <ScrollReveal direction="right" className="lg:col-span-7 w-full">
              <div className="bg-white border border-stone-200/60 rounded-2xl shadow-xl overflow-hidden flex flex-col h-[380px] w-full">
                
                {/* Chat Header */}
                <div className="bg-blue-950 px-5 py-4 flex items-center justify-between text-white border-b border-stone-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-50/10 flex items-center justify-center text-amber-500 border border-amber-500/20">
                      <Sparkles className="w-4 h-4 fill-amber-500/10" />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-white">AI Writing Mentor</h4>
                      <p className="text-[9px] text-amber-500 font-semibold uppercase tracking-wider">Personalized Study Guide</p>
                    </div>
                  </div>
                  <div className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[9px] font-bold">
                    Official Rubric Evaluation
                  </div>
                </div>

                {/* Chat Messages Panel */}
                <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-stone-50/20">
                  
                  {/* User Bubble */}
                  <div className="flex items-start justify-end gap-3">
                    <div className="bg-[#FAF8F5] border border-stone-200 text-slate-800 text-xs py-3 px-4 rounded-2xl rounded-tr-sm max-w-[80%] shadow-xs">
                      <p className="font-semibold">{CHAT_GUIDES[demoTab].user}</p>
                    </div>
                  </div>

                  {/* AI response Bubble with Amber Gradient Border */}
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 flex-shrink-0 mt-1">
                      <Sparkles className="w-4 h-4 fill-amber-500/10" />
                    </div>
                    <div className="bg-white border-2 border-amber-100 rounded-2xl rounded-tl-sm p-4 max-w-[80%] shadow-xs relative">
                      <p className="text-xs text-slate-700 leading-relaxed font-semibold mb-3">
                        {CHAT_GUIDES[demoTab].ai.split("\n\n")[0]}
                      </p>
                      
                      {/* Highlighted edits in soft sage green */}
                      <div className="bg-[#fbfaf8] border border-stone-200 rounded-xl p-3 text-xs text-slate-800 font-mono flex flex-col gap-1.5">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 font-sans">Guidance Revision</span>
                        <p className="leading-relaxed">
                          {CHAT_GUIDES[demoTab].ai.split("\n\n")[1]?.includes("sentence: ") ? (
                            <span>
                              {CHAT_GUIDES[demoTab].ai.split("\n\n")[1].replace("sentence: ", "").split("[")[0]}
                              <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded font-bold">
                                {CHAT_GUIDES[demoTab].ai.split("[")[1]?.split("]")[0]}
                              </span>
                              {CHAT_GUIDES[demoTab].ai.split("]")[1]?.replace(" green-highlight", "")}
                            </span>
                          ) : CHAT_GUIDES[demoTab].ai.split("\n\n")[1]?.includes("rewrite: ") ? (
                            <span>
                              {CHAT_GUIDES[demoTab].ai.split("\n\n")[1].replace("rewrite: ", "").split("[")[0]}
                              <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded font-bold">
                                {CHAT_GUIDES[demoTab].ai.split("[")[1]?.split("]")[0]}
                              </span>
                              {CHAT_GUIDES[demoTab].ai.split("]")[1]?.replace(" green-highlight", "")}
                            </span>
                          ) : (
                            CHAT_GUIDES[demoTab].ai.split("\n\n")[1]
                          )}
                        </p>
                      </div>

                      <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400 font-bold border-t border-stone-100 pt-2.5">
                        <span className="text-emerald-700 font-bold uppercase tracking-wider">{CHAT_GUIDES[demoTab].feedback}</span>
                        <span>Synchronized</span>
                      </div>
                    </div>
                  </div>

                </div>

              </div>
            </ScrollReveal>

          </div>
        </div>
      </section>

      {/* Section 4: How It Works */}
      <section id="how-it-works" className="py-20 md:py-24 bg-white relative z-10">
        <div className="max-w-7xl mx-auto px-6">
          <ScrollReveal>
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl md:text-4xl font-extrabold text-blue-950 tracking-tight mb-4">
                Your Personal Learning Roadmap
              </h2>
              <p className="text-base md:text-lg text-slate-500 font-medium">
                Three streamlined phases focused on building your confidence and achieving your target score.
              </p>
            </div>
          </ScrollReveal>

          <div ref={roadmapRef} className="relative flex flex-col md:flex-row justify-between items-center gap-12 md:gap-6 lg:px-12">
            
            {/* Dashed Connecting Line with glowing golden endpoints */}
            <div className="absolute top-10 left-[15%] right-[15%] h-0.5 border-t border-dashed border-stone-200 z-0 hidden md:block" />
            
            {/* Animated line drawing overlay */}
            <div 
              className="absolute top-10 left-[15%] h-0.5 border-t border-dashed border-amber-500 z-0 hidden md:block transition-all duration-1000 ease-in-out origin-left"
              style={{ width: isRoadmapVisible ? "70%" : "0%" }}
            />

            {/* Step 1 */}
            <ScrollReveal delay={0} className="w-full md:w-auto">
              <div className="relative z-10 flex flex-col items-center text-center max-w-[280px] mx-auto">
                <div className="w-20 h-20 rounded-full bg-blue-950 text-white flex items-center justify-center mb-6 shadow-md transition-transform duration-300 hover:scale-105 border-4 border-amber-100">
                  <TrendingUp className="w-8 h-8 text-amber-500" />
                </div>
                <h3 className="text-lg font-bold text-blue-950 mb-2">1. Diagnose</h3>
                <p className="text-sm text-slate-500 leading-relaxed font-medium">
                  Take a brief diagnostic assessment to chart out your starting level and outline key weaknesses.
                </p>
              </div>
            </ScrollReveal>

            {/* Step 2 */}
            <ScrollReveal delay={200} className="w-full md:w-auto">
              <div className="relative z-10 flex flex-col items-center text-center max-w-[280px] mx-auto">
                <div className="w-20 h-20 rounded-full bg-blue-950 text-white flex items-center justify-center mb-6 shadow-md transition-transform duration-300 hover:scale-105 border-4 border-amber-100">
                  <BookOpen className="w-8 h-8 text-amber-500" />
                </div>
                <h3 className="text-lg font-bold text-blue-950 mb-2">2. Practice</h3>
                <p className="text-sm text-slate-500 leading-relaxed font-medium">
                  Work through customized drills and mock papers with live feedback highlighting exact errors.
                </p>
              </div>
            </ScrollReveal>

            {/* Step 3 */}
            <ScrollReveal delay={400} className="w-full md:w-auto">
              <div className="relative z-10 flex flex-col items-center text-center max-w-[280px] mx-auto">
                <div className="w-20 h-20 rounded-full bg-blue-950 text-white flex items-center justify-center mb-6 shadow-md transition-transform duration-300 hover:scale-105 border-4 border-amber-100">
                  <Award className="w-8 h-8 text-amber-500" />
                </div>
                <h3 className="text-lg font-bold text-blue-950 mb-2">3. Achieve</h3>
                <p className="text-sm text-slate-500 leading-relaxed font-medium">
                  Take the official test with confidence, secure your target score, and achieve your educational goals.
                </p>
              </div>
            </ScrollReveal>

          </div>
        </div>
      </section>

      {/* Section 5: Replicated User Dashboard Constraint */}
      <section id="dashboard-preview" ref={dashboardRef} className="py-20 md:py-24 bg-stone-50 border-t border-b border-stone-200/60 relative z-10">
        <div className="max-w-7xl mx-auto px-6">
          <ScrollReveal>
            <div className="text-center max-w-2xl mx-auto mb-12">
              <h2 className="text-3xl md:text-4xl font-extrabold text-blue-950 tracking-tight mb-4">
                Keep Track of Your Learning Journey
              </h2>
              <p className="text-base md:text-lg text-slate-500 font-medium">
                Monitor your band progress, analytical metrics, and feedback status logs in a unified personal dashboard.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={100} direction="up">
            <div className="max-w-5xl mx-auto bg-white border border-stone-200/80 rounded-2xl shadow-xl overflow-hidden p-6 sm:p-8 space-y-8 relative">
              
              {/* Mock Dashboard Browser Frame Header */}
              <div className="absolute top-0 inset-x-0 bg-stone-100/60 border-b border-stone-200/50 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-400" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                  <span className="text-[10px] font-bold text-slate-400 ml-2 font-mono">dashboard.ielts-prep.ai</span>
                </div>
                <span className="text-[10px] font-bold text-blue-900 bg-blue-50 border border-blue-100/60 px-2 py-0.5 rounded-full">
                  Band 7.5 Target
                </span>
              </div>

              {/* Spacer for browser bar */}
              <div className="pt-6" />

              {/* Metrics cards replicating the screenshot */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Target Band Card */}
                <div className="rounded-xl border border-stone-200/70 p-5 bg-white text-left shadow-xs transition-all duration-300 hover:-translate-y-1.5 hover:shadow-md hover:shadow-blue-950/5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Target Band</span>
                  <h4 className="text-2xl font-extrabold text-blue-950 mt-1">Band 7.5</h4>
                  <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden mt-3 relative">
                    <div 
                      className="bg-indigo-600 h-full rounded-full transition-all duration-1000 ease-out" 
                      style={{ width: isDashboardVisible ? "80%" : "0%" }}
                    />
                  </div>
                </div>

                {/* Remaining Days Card */}
                <div className="rounded-xl border border-stone-200/70 p-5 bg-white text-left shadow-xs transition-all duration-300 hover:-translate-y-1.5 hover:shadow-md hover:shadow-blue-950/5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Remaining Days</span>
                  <h4 className="text-2xl font-extrabold text-blue-950 mt-1">28 Days Left</h4>
                  <p className="text-[10px] text-slate-400 font-semibold mt-2.5">Exam Date: July 12, 2026</p>
                </div>

                {/* Current Average Card */}
                <div className="rounded-xl border border-stone-200/70 p-5 bg-white text-left shadow-xs transition-all duration-300 hover:-translate-y-1.5 hover:shadow-md hover:shadow-blue-950/5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Current Average</span>
                  <h4 className="text-2xl font-extrabold text-blue-950 mt-1">Band 7.0</h4>
                  <span className="inline-flex items-center text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100/50 mt-2.5">
                    ↑ +0.5 from starting baseline
                  </span>
                </div>

              </div>

              {/* Score progression chart replicating the screenshot */}
              <div className="border border-stone-200/70 rounded-xl p-5 bg-white text-left shadow-xs transition-all duration-300 hover:-translate-y-1.5 hover:shadow-md hover:shadow-blue-950/5">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-xs font-bold text-blue-950 uppercase tracking-wider">Weekly Score Progression</span>
                  <span className="text-[10px] font-bold text-slate-400">Updated Just Now</span>
                </div>
                
                {/* Custom SVG Bar Chart Mockup */}
                <div className="h-44 flex items-end justify-between px-4 sm:px-12 pt-4 relative border-b border-stone-200">
                  
                  {/* Horizontal reference grids */}
                  <div className="absolute bottom-[20%] left-0 right-0 border-t border-stone-100" />
                  <div className="absolute bottom-[40%] left-0 right-0 border-t border-stone-100" />
                  <div className="absolute bottom-[60%] left-0 right-0 border-t border-stone-100" />
                  <div className="absolute bottom-[80%] left-0 right-0 border-t border-stone-100" />

                  {/* Week 1 */}
                  <div className="flex flex-col items-center w-16 sm:w-24 group relative z-10">
                    <span className="text-[10px] font-bold text-indigo-700 mb-1 select-none">5.5</span>
                    <div 
                      className="w-full bg-indigo-100 border border-indigo-200/50 rounded-t-lg transition-all duration-1000 ease-out hover:bg-indigo-200" 
                      style={{ height: isDashboardVisible ? "60px" : "0px" }} 
                    />
                    <span className="text-[10px] font-bold text-slate-400 mt-2">Week 1</span>
                  </div>

                  {/* Week 2 */}
                  <div className="flex flex-col items-center w-16 sm:w-24 group relative z-10">
                    <span className="text-[10px] font-bold text-indigo-700 mb-1 select-none">6.0</span>
                    <div 
                      className="w-full bg-indigo-100 border border-indigo-200/50 rounded-t-lg transition-all duration-1000 ease-out hover:bg-indigo-200" 
                      style={{ height: isDashboardVisible ? "70px" : "0px", transitionDelay: "150ms" }} 
                    />
                    <span className="text-[10px] font-bold text-slate-400 mt-2">Week 2</span>
                  </div>

                  {/* Week 3 */}
                  <div className="flex flex-col items-center w-16 sm:w-24 group relative z-10">
                    <span className="text-[10px] font-bold text-indigo-700 mb-1 select-none">6.5</span>
                    <div 
                      className="w-full bg-indigo-100 border border-indigo-200/50 rounded-t-lg transition-all duration-1000 ease-out hover:bg-indigo-200" 
                      style={{ height: isDashboardVisible ? "80px" : "0px", transitionDelay: "300ms" }} 
                    />
                    <span className="text-[10px] font-bold text-slate-400 mt-2">Week 3</span>
                  </div>

                  {/* Week 4 (Highlight) */}
                  <div className="flex flex-col items-center w-16 sm:w-24 group relative z-10">
                    <span className="text-[10px] font-extrabold text-indigo-800 mb-1 select-none">7.5</span>
                    <div 
                      className="w-full bg-indigo-600 border border-indigo-700 rounded-t-lg transition-all duration-1000 ease-out hover:bg-indigo-700 shadow-md shadow-indigo-600/10" 
                      style={{ height: isDashboardVisible ? "100px" : "0px", transitionDelay: "450ms" }} 
                    />
                    <span className="text-[10px] font-extrabold text-indigo-800 mt-2">Week 4</span>
                  </div>

                </div>
              </div>

              {/* Task Status Table Constraint */}
            <div className="border border-stone-200/70 rounded-xl p-5 bg-white text-left shadow-xs">
              <span className="text-xs font-bold text-blue-950 uppercase tracking-wider block mb-4">Task Activity Logs</span>
              
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="bg-stone-50 text-slate-400 font-bold uppercase tracking-wider text-[9px] border-b border-stone-200/60">
                      <th className="px-4 py-3.5">Task Name</th>
                      <th className="px-4 py-3.5">Module</th>
                      <th className="px-4 py-3.5">Feedback Status</th>
                      <th className="px-4 py-3.5">Completion Date</th>
                      <th className="px-4 py-3.5">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    
                    {/* Row 1 */}
                    <tr className="hover:bg-stone-50/40">
                      <td className="px-4 py-3.5 font-bold text-slate-800">Speaking Cue Card: Job Promotion</td>
                      <td className="px-4 py-3.5">Speaking</td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Completed
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-400 font-medium">June 20, 2026</td>
                      <td className="px-4 py-3.5 font-bold text-slate-700">Band 7.5</td>
                    </tr>

                    {/* Row 2 */}
                    <tr className="hover:bg-stone-50/40">
                      <td className="px-4 py-3.5 font-bold text-slate-800">Writing Task 1: Academic Report</td>
                      <td className="px-4 py-3.5">Writing</td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-900">
                          In Progress
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-400 font-medium">June 22, 2026</td>
                      <td className="px-4 py-3.5 font-medium text-slate-400">--</td>
                    </tr>

                    {/* Row 3 */}
                    <tr className="hover:bg-stone-50/40">
                      <td className="px-4 py-3.5 font-bold text-slate-800">Reading Passage: Modern Technology</td>
                      <td className="px-4 py-3.5">Reading</td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Completed
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-400 font-medium">June 23, 2026</td>
                      <td className="px-4 py-3.5 font-bold text-slate-700">Band 7.0</td>
                    </tr>

                    {/* Row 4 */}
                    <tr className="hover:bg-stone-50/40">
                      <td className="px-4 py-3.5 font-bold text-slate-800">Speaking Part 2: Travel Plans</td>
                      <td className="px-4 py-3.5">Speaking</td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900">
                          In Review
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-400 font-medium">June 24, 2026</td>
                      <td className="px-4 py-3.5 font-medium text-slate-400">Pending</td>
                    </tr>

                    {/* Row 5 */}
                    <tr className="hover:bg-stone-50/40">
                      <td className="px-4 py-3.5 font-bold text-slate-800">Writing Task 2: Global Warming</td>
                      <td className="px-4 py-3.5">Writing</td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Completed
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-400 font-medium">June 24, 2026</td>
                      <td className="px-4 py-3.5 font-bold text-slate-700">Band 8.0</td>
                    </tr>

                  </tbody>
                </table>
              </div>
            </div>

            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Section 6: Social Proof & Testimonials */}
      <section id="testimonials" className="py-20 md:py-24 bg-white relative z-10">
        <div className="max-w-7xl mx-auto px-6">
          
          {/* Top stats block */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20 text-center">
            
            <ScrollReveal delay={0}>
              <div className="bg-[#FAF8F5] border border-stone-200/60 rounded-2xl p-8 shadow-xs transition-all duration-300 hover:-translate-y-1.5 hover:shadow-md hover:shadow-blue-950/5">
                <p className="text-4xl md:text-5xl font-extrabold tracking-tight text-blue-950 mb-2">
                  <CountUp end={10000} suffix="+" />
                </p>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Essays Evaluated</p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={100}>
              <div className="bg-[#FAF8F5] border border-stone-200/60 rounded-2xl p-8 shadow-xs transition-all duration-300 hover:-translate-y-1.5 hover:shadow-md hover:shadow-blue-950/5">
                <p className="text-4xl md:text-5xl font-extrabold tracking-tight text-blue-950 mb-2">
                  <CountUp end={1.5} prefix="+" suffix=" Band" decimals={1} />
                </p>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Average Band Shift</p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={200}>
              <div className="bg-[#FAF8F5] border border-stone-200/60 rounded-2xl p-8 shadow-xs transition-all duration-300 hover:-translate-y-1.5 hover:shadow-md hover:shadow-blue-950/5">
                <p className="text-4xl md:text-5xl font-extrabold tracking-tight text-blue-950 mb-2">Instant</p>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Grammar Reports</p>
              </div>
            </ScrollReveal>

          </div>

          {/* Testimonial Cards */}
          <ScrollReveal>
            <div className="text-center mb-12">
              <h2 className="text-3xl font-extrabold text-blue-950 tracking-tight mb-2">
                Encouraged Candidates Globally
              </h2>
              <p className="text-sm text-slate-500 font-semibold">
                Read how our personal guidance platform has built preparation confidence.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Testimonial 1 */}
            <ScrollReveal delay={0} className="h-full">
              <div className="bg-[#FAF8F5] border border-emerald-100 rounded-2xl p-6 shadow-xs flex flex-col justify-between hover:-translate-y-2 hover:shadow-lg hover:shadow-emerald-950/5 transition-all duration-300 h-full">
                <div>
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm text-slate-600 italic leading-relaxed mb-6 font-medium">
                    &ldquo;The speaking simulator felt so supportive. It identified exactly where I lost my flow and gave me clear vocabulary lists to practice.&rdquo;
                  </p>
                </div>
                <div className="flex items-center justify-between border-t border-stone-200/40 pt-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Sarah M.</h4>
                    <p className="text-[10px] text-slate-400 font-medium">University Applicant</p>
                  </div>
                  <span className="text-xs font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
                    Felt Prepared & Confident
                  </span>
                </div>
              </div>
            </ScrollReveal>

            {/* Testimonial 2 */}
            <ScrollReveal delay={150} className="h-full">
              <div className="bg-[#FAF8F5] border border-emerald-100 rounded-2xl p-6 shadow-xs flex flex-col justify-between hover:-translate-y-2 hover:shadow-lg hover:shadow-emerald-950/5 transition-all duration-300 h-full">
                <div>
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm text-slate-600 italic leading-relaxed mb-6 font-medium">
                    &ldquo;I struggled with cohesion structures for weeks. The tutor feedback showed me precisely what transition elements examiners search for.&rdquo;
                  </p>
                </div>
                <div className="flex items-center justify-between border-t border-stone-200/40 pt-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Chen L.</h4>
                    <p className="text-[10px] text-slate-400 font-medium">Postgraduate Applicant</p>
                  </div>
                  <span className="text-xs font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
                    Improved Writing Flow
                  </span>
                </div>
              </div>
            </ScrollReveal>

            {/* Testimonial 3 */}
            <ScrollReveal delay={300} className="h-full">
              <div className="bg-[#FAF8F5] border border-emerald-100 rounded-2xl p-6 shadow-xs flex flex-col justify-between hover:-translate-y-2 hover:shadow-lg hover:shadow-emerald-950/5 transition-all duration-300 h-full">
                <div>
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm text-slate-600 italic leading-relaxed mb-6 font-medium">
                    &ldquo;The weekly study roadmap adapted to my changes. It structured my practice session step-by-step, removing all exam day anxiety.&rdquo;
                  </p>
                </div>
                <div className="flex items-center justify-between border-t border-stone-200/40 pt-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Sofia R.</h4>
                    <p className="text-[10px] text-slate-400 font-medium">Global Career Scholar</p>
                  </div>
                  <span className="text-xs font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
                    Structured Study Plan
                  </span>
                </div>
              </div>
            </ScrollReveal>

          </div>
        </div>
      </section>

      {/* Section 7: Final CTA Banner (Inviting Warm Navy) */}
      <section id="cta" className="py-20 md:py-24 bg-blue-950 text-white relative overflow-hidden z-10">
        
        {/* Subtle watercolor graphic backdrop */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-[80px]" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-900/10 rounded-full blur-[80px]" />

        <ScrollReveal>
          <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mx-auto mb-6 shadow-md">
              <Sparkles className="w-7 h-7 fill-amber-500/10" />
            </div>
            
            <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mb-4">
              Ready to achieve your potential?
            </h2>
            
            <p className="text-stone-300 max-w-xl mx-auto mb-10 text-base md:text-lg font-medium">
              Join thousands of candidates who built study confidence, resolved core grammatical gaps, and prepared effectively.
            </p>

            {isSubmitted ? (
              <div className="max-w-md mx-auto bg-blue-900/30 border border-blue-900/60 p-6 rounded-2xl text-center shadow-lg animate-message-appear">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-3">
                  <Check className="w-5 h-5 stroke-[2.5px]" />
                </div>
                <h4 className="text-base font-bold text-white mb-1">Check your inbox!</h4>
                <p className="text-xs text-stone-300 leading-normal font-medium">
                  We&apos;ve sent a 10% discount study voucher and guide link. Let&apos;s begin the roadmap!
                </p>
              </div>
            ) : (
              <form onSubmit={handleEmailSubmit} className="max-w-md mx-auto flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="Enter your email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#111c3a] border border-blue-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl py-3.5 pl-11 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none transition-all"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-amber-500 hover:bg-amber-600 text-blue-950 font-extrabold text-sm px-6 py-3.5 rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-[0_0_20px_rgba(245,158,11,0.45)] hover:-translate-y-0.5 active:scale-95 whitespace-nowrap"
                >
                  Start Preparing Free
                </button>
              </form>
            )}

            <p className="text-[11px] text-slate-400 mt-6 font-semibold uppercase tracking-wider">
              No commitment required. Start with a free analytical diagnostic.
            </p>
          </div>
        </ScrollReveal>
      </section>

      {/* Footer */}
      <footer className="bg-[#FAF8F5] border-t border-stone-200/50 py-12 relative z-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <Link href="/" className="flex items-center">
            <img src="/logo.png" alt="IELTS Academy Logo" className="h-14 w-auto object-contain" />
          </Link>


          <p className="text-[11px] text-slate-400 font-medium">
            © {new Date().getFullYear()} IELTS Guidance Platform. All rights reserved. Mapped to IELTS criteria.
          </p>
        </div>
      </footer>

    </div>
  );
}
