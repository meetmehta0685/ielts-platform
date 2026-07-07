import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { RecordsList } from "@/components/records/records-list";

export const revalidate = 0;

export default async function RecordsPage() {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get("sb-auth-token");

  if (!authCookie?.value) {
    redirect("/auth/login");
  }

  let user = null;
  let trackRecord: any[] = [];

  try {
    let session;
    try {
      session = JSON.parse(authCookie.value);
    } catch (err) {
      try {
        session = JSON.parse(decodeURIComponent(authCookie.value));
      } catch (innerErr) {
        console.error("Failed to parse auth cookie in records:", innerErr);
        redirect("/auth/login");
      }
    }
    const token = session?.access_token;

    if (!token) {
      redirect("/auth/login");
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    // Create server-side Supabase client with authorized user token
    const serverSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    // Verify session
    const { data: { user: verifiedUser }, error: userError } = await serverSupabase.auth.getUser(token);
    if (userError || !verifiedUser) {
      console.error("[Records Page] getUser failed:", userError?.message || "User is null");
      redirect("/auth/login");
    }
    user = verifiedUser;

    // Fetch all module attempts in parallel for the track record log
    const [writingRes, speakingRes, readingRes, listeningRes] = await Promise.all([
      serverSupabase
        .from("writing_submissions")
        .select("id, task_type, band_score, created_at")
        .eq("user_id", user.id),
      serverSupabase
        .from("speaking_submissions")
        .select("id, part, band_score, created_at")
        .eq("user_id", user.id),
      serverSupabase
        .from("reading_attempts")
        .select("id, test_title, score, total_questions, band_score, created_at")
        .eq("user_id", user.id),
      serverSupabase
        .from("listening_attempts")
        .select("id, test_title, score, total_questions, band_score, created_at")
        .eq("user_id", user.id)
    ]);

    const writingList = (writingRes.data || []).map(w => ({
      id: w.id,
      module: "Writing",
      title: w.task_type === "task1" ? "Task 1: Academic Report" : "Task 2: Essay writing",
      score: w.band_score ? `Band ${Number(w.band_score).toFixed(1)}` : "Pending Evaluation",
      rawScore: null,
      date: w.created_at
    }));

    const speakingList = (speakingRes.data || []).map(s => ({
      id: s.id,
      module: "Speaking",
      title: `Part ${s.part} Audio Interview`,
      score: s.band_score ? `Band ${Number(s.band_score).toFixed(1)}` : "Pending Evaluation",
      rawScore: null,
      date: s.created_at
    }));

    const readingList = (readingRes.data || []).map(r => ({
      id: r.id,
      module: "Reading",
      title: r.test_title || "Comprehension Practice Test",
      score: `Band ${Number(r.band_score).toFixed(1)}`,
      rawScore: `${r.score}/${r.total_questions || 40}`,
      date: r.created_at
    }));

    const listeningList = (listeningRes.data || []).map(l => ({
      id: l.id,
      module: "Listening",
      title: l.test_title || "Listening Audio Test",
      score: `Band ${Number(l.band_score).toFixed(1)}`,
      rawScore: `${l.score}/${l.total_questions || 40}`,
      date: l.created_at
    }));

    trackRecord = [...writingList, ...speakingList, ...readingList, ...listeningList]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  } catch (err) {
    console.error("Records page auth/fetch error:", err);
    redirect("/auth/login");
  }

  return <RecordsList initialRecords={trackRecord} />;
}
