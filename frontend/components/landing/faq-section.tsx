"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { ScrollReveal } from "./scroll-reveal";
import { cn } from "@/lib/utils";

const faqs = [
  {
    q: "Is this aligned with official IELTS grading criteria?",
    a: "Yes. Every module — speaking, writing, reading, and listening — is mapped to the four official IELTS assessment bands: Task Achievement, Coherence & Cohesion, Lexical Resource, and Grammatical Range & Accuracy.",
  },
  {
    q: "How does the AI writing feedback work?",
    a: "Submit your Task 1 or Task 2 response and receive line-by-line corrections with explanations. The guide highlights grammar fixes, suggests stronger vocabulary, and shows how each change could affect your band score.",
  },
  {
    q: "Do I need prior IELTS experience to start?",
    a: "Not at all. The onboarding diagnostic identifies your current level and builds a personalized study plan. Whether you're starting from Band 5 or pushing toward Band 8, the platform adapts to your goals.",
  },
  {
    q: "Can I track my progress over time?",
    a: "Your dashboard shows weekly score progression, task completion logs, exam countdown, and module-specific breakdowns — so you always know where you stand and what to focus on next.",
  },
  {
    q: "Is there a free tier to try before committing?",
    a: "Absolutely. Create a free account to access practice modules, the AI guide, and your personal dashboard. No credit card required to start preparing.",
  },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="py-20 bg-white border-t border-stone-200/60">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <ScrollReveal className="text-center space-y-3 mb-12">
          <span className="inline-block text-xs font-bold uppercase tracking-widest text-amber-700">
            Common Questions
          </span>
          <h2 className="font-heading text-3xl font-extrabold tracking-tight text-blue-950 sm:text-4xl">
            Everything You Need to Know
          </h2>
          <p className="text-slate-500 font-medium">
            Quick answers about how the platform works and what to expect.
          </p>
        </ScrollReveal>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <ScrollReveal key={faq.q} delay={i * 80}>
              <div className="rounded-2xl border border-stone-200/60 overflow-hidden bg-stone-50/30">
                <button
                  type="button"
                  onClick={() => setOpenIndex(openIndex === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-amber-50/40 transition-colors"
                >
                  <span className="font-bold text-sm sm:text-base text-slate-800">{faq.q}</span>
                  <ChevronDown
                    className={cn(
                      "h-5 w-5 text-amber-600 shrink-0 transition-transform duration-300",
                      openIndex === i && "rotate-180"
                    )}
                  />
                </button>
                <div
                  className={cn(
                    "grid transition-all duration-300 ease-out",
                    openIndex === i ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  )}
                >
                  <div className="overflow-hidden">
                    <p className="px-5 pb-4 text-sm text-slate-500 font-medium leading-relaxed">
                      {faq.a}
                    </p>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
