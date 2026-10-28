import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ProductMark } from "@/components/app/app-shell";
import "@/components/landing/landing.css";

export const metadata: Metadata = {
  title: "Privacy · IELTS Prep",
  description: "What IELTS Prep stores about you, which services process it, and how to have it deleted.",
};

const CONTACT = "mehtameet685@gmail.com";
const UPDATED = "28 October 2026";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-12 first:mt-0">
      <h2 className="text-[21px] font-semibold tracking-[-0.015em] text-ink">{title}</h2>
      <div className="mt-4 flex flex-col gap-4 text-[17px] leading-[1.65] text-ink/85">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="lp min-h-svh">
      <header className="border-b border-border">
        <div className="lp-wrap flex h-16 items-center">
          <Link href="/" className="flex items-center gap-2.5 rounded-[8px]">
            <ProductMark />
            <span className="text-[15px] font-semibold tracking-[-0.01em]">IELTS Prep</span>
          </Link>
        </div>
      </header>

      <main className="lp-wrap pt-14 pb-24 sm:pt-20">
        <article className="max-w-[68ch]">
          <h1 className="font-display text-[40px] text-balance sm:text-[56px]">Privacy</h1>
          <p className="mt-4 text-[15px] text-soft">Last updated {UPDATED}</p>
          <p className="mt-8 text-[19px] leading-[1.6] text-pretty text-ink/85">
            IELTS Prep is an independent practice tool. This page explains what it keeps about you, which services
            handle your answers to mark them, and how to have everything deleted.
          </p>

          <div className="mt-14">
            <Section title="What we store">
              <p>When you create an account we keep your name, your email address and how you signed in.</p>
              <p>
                If you sign in with Google, we receive your name, email address and profile picture from Google. We
                ask for nothing else from your Google account.
              </p>
              <p>
                Your exam details: target band, current band, exam date, focus modules and daily study hours. These
                set your countdown and your study plan.
              </p>
              <p>
                Your practice: essays and the marking that comes back, speaking transcripts and their bands, reading
                and listening answers and scores, mock test results, your study plan and your conversations with the
                mentor.
              </p>
            </Section>

            <Section title="What we don't store">
              <p>
                In speaking practice, your recording is sent once to be transcribed and then discarded. Only the
                transcript is saved.
              </p>
              <p>
                In the full mock, the live interview runs as a voice call and is not recorded. Your camera stays off
                unless you turn it on; if you do, the video is only shown during the call and is not saved.
              </p>
              <p>We don&apos;t use advertising or analytics trackers, and we don&apos;t sell your data.</p>
            </Section>

            <Section title="Who processes your answers">
              <p>To mark your work and run the app, your data passes through these services:</p>
              <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-soft">
                <li>Supabase stores your account and practice history.</li>
                <li>Vercel and Render host the website and the server that marks your answers.</li>
                <li>Groq and OpenRouter run the AI models that mark writing and speaking and answer the mentor.</li>
                <li>Groq transcribes speaking practice recordings.</li>
                <li>
                  LiveKit runs the full-mock interview: your voice is transcribed and the examiner&apos;s replies are
                  generated and spoken through its service.
                </li>
                <li>ElevenLabs reads the examiner&apos;s questions aloud. It receives the question text, never your answers.</li>
                <li>Google handles sign-in when you choose Continue with Google.</li>
              </ul>
              <p>Each receives only what it needs for its part of the job.</p>
            </Section>

            <Section title="Cookies">
              <p>
                We set only the cookies that keep you signed in. There are no advertising or tracking cookies.
              </p>
            </Section>

            <Section title="Who can see your work">
              <p>
                Your practice history is visible to your account only. The database enforces this, so other users
                cannot read your essays, transcripts or scores.
              </p>
            </Section>

            <Section title="Deleting your data">
              <p>
                Email{" "}
                <a href={`mailto:${CONTACT}`} className="text-ink underline decoration-1 hover:decoration-2">
                  {CONTACT}
                </a>{" "}
                from the address on your account and ask for it to be deleted. Your account and everything linked to
                it are removed together.
              </p>
            </Section>

            <Section title="Changes and contact">
              <p>
                If this policy changes, the date at the top changes with it. Questions go to{" "}
                <a href={`mailto:${CONTACT}`} className="text-ink underline decoration-1 hover:decoration-2">
                  {CONTACT}
                </a>
                .
              </p>
            </Section>
          </div>
        </article>
      </main>
    </div>
  );
}
