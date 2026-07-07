-- Unified SQL Script for IELTS AI Mentor Database Schema (Supabase PostgreSQL)
-- Executing this script in the Supabase SQL Editor configures the complete DB.

-- =========================================================================
-- 1. PROFILES TABLE (User Onboarding & Metrics)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    current_band NUMERIC(2,1),
    target_band NUMERIC(2,1) NOT NULL DEFAULT 7.0,
    exam_date DATE,
    weak_areas TEXT[] DEFAULT '{}'::TEXT[],
    study_hours_per_day INTEGER DEFAULT 2,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" 
    ON public.profiles FOR SELECT 
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" 
    ON public.profiles FOR INSERT 
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" 
    ON public.profiles FOR UPDATE 
    USING (auth.uid() = id);

-- =========================================================================
-- 2. CHAT SESSIONS & MESSAGES (AI Mentor Chat)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New Chat',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON public.chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON public.chat_messages(session_id);

ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Session Policies
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.chat_sessions;
CREATE POLICY "Users can view their own sessions" 
    ON public.chat_sessions FOR SELECT 
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own sessions" ON public.chat_sessions;
CREATE POLICY "Users can create their own sessions" 
    ON public.chat_sessions FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own sessions" ON public.chat_sessions;
CREATE POLICY "Users can update their own sessions" 
    ON public.chat_sessions FOR UPDATE 
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own sessions" ON public.chat_sessions;
CREATE POLICY "Users can delete their own sessions" 
    ON public.chat_sessions FOR DELETE 
    USING (auth.uid() = user_id);

-- Message Policies
DROP POLICY IF EXISTS "Users can view messages in their sessions" ON public.chat_messages;
CREATE POLICY "Users can view messages in their sessions" 
    ON public.chat_messages FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.chat_sessions 
            WHERE chat_sessions.id = chat_messages.session_id 
            AND chat_sessions.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert messages in their sessions" ON public.chat_messages;
CREATE POLICY "Users can insert messages in their sessions" 
    ON public.chat_messages FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.chat_sessions 
            WHERE chat_sessions.id = chat_messages.session_id 
            AND chat_sessions.user_id = auth.uid()
        )
    );

-- =========================================================================
-- 3. WRITING SUBMISSIONS (Task 1 & Task 2 Evaluations)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.writing_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    task_type TEXT NOT NULL CHECK (task_type IN ('task1', 'task2')),
    prompt TEXT NOT NULL,
    essay TEXT NOT NULL,
    band_score NUMERIC(2,1),
    task_response NUMERIC(2,1),
    coherence_cohesion NUMERIC(2,1),
    lexical_resource NUMERIC(2,1),
    grammatical_range_accuracy NUMERIC(2,1),
    feedback_json JSONB, -- store corrections list, suggestions, and improved version
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_writing_submissions_user_id ON public.writing_submissions(user_id);

ALTER TABLE public.writing_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own writing submissions" ON public.writing_submissions;
CREATE POLICY "Users can view their own writing submissions" 
    ON public.writing_submissions FOR SELECT 
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own writing submissions" ON public.writing_submissions;
CREATE POLICY "Users can insert their own writing submissions" 
    ON public.writing_submissions FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- =========================================================================
-- 4. SPEAKING SUBMISSIONS (Groq Whisper + AI Review)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.speaking_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    part INTEGER NOT NULL CHECK (part IN (1, 2, 3)),
    prompt TEXT NOT NULL,
    transcript TEXT NOT NULL,
    audio_url TEXT,
    band_score NUMERIC(2,1),
    fluency_coherence NUMERIC(2,1),
    lexical_resource NUMERIC(2,1),
    grammatical_range NUMERIC(2,1),
    pronunciation NUMERIC(2,1),
    feedback_json JSONB, -- comments, tips
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_speaking_submissions_user_id ON public.speaking_submissions(user_id);

ALTER TABLE public.speaking_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own speaking submissions" ON public.speaking_submissions;
CREATE POLICY "Users can view their own speaking submissions" 
    ON public.speaking_submissions FOR SELECT 
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own speaking submissions" ON public.speaking_submissions;
CREATE POLICY "Users can insert their own speaking submissions" 
    ON public.speaking_submissions FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- =========================================================================
-- 5. READING & LISTENING ATTEMPTS
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.reading_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    test_title TEXT NOT NULL,
    score INTEGER NOT NULL,
    total_questions INTEGER NOT NULL DEFAULT 40,
    band_score NUMERIC(2,1) NOT NULL,
    answers_json JSONB,
    explanations_json JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.listening_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    test_title TEXT NOT NULL,
    score INTEGER NOT NULL,
    total_questions INTEGER NOT NULL DEFAULT 40,
    band_score NUMERIC(2,1) NOT NULL,
    answers_json JSONB,
    explanations_json JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reading_attempts_user_id ON public.reading_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_listening_attempts_user_id ON public.listening_attempts(user_id);

ALTER TABLE public.reading_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listening_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own reading attempts" ON public.reading_attempts;
CREATE POLICY "Users can view their own reading attempts" 
    ON public.reading_attempts FOR SELECT 
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own reading attempts" ON public.reading_attempts;
CREATE POLICY "Users can insert their own reading attempts" 
    ON public.reading_attempts FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own listening attempts" ON public.listening_attempts;
CREATE POLICY "Users can view their own listening attempts" 
    ON public.listening_attempts FOR SELECT 
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own listening attempts" ON public.listening_attempts;
CREATE POLICY "Users can insert their own listening attempts" 
    ON public.listening_attempts FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- =========================================================================
-- 6. STUDY PLANS
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.study_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_json JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_study_plans_user_id ON public.study_plans(user_id);

ALTER TABLE public.study_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own study plan" ON public.study_plans;
CREATE POLICY "Users can view their own study plan" 
    ON public.study_plans FOR SELECT 
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert/update their own study plan" ON public.study_plans;
CREATE POLICY "Users can insert/update their own study plan" 
    ON public.study_plans FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own study plan" ON public.study_plans;
CREATE POLICY "Users can update their own study plan" 
    ON public.study_plans FOR UPDATE 
    USING (auth.uid() = user_id);

-- =========================================================================
-- 7. AUTO-UPDATE UPDATED_AT TRIGGER
-- =========================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_profiles_timestamp ON public.profiles;
CREATE TRIGGER trigger_update_profiles_timestamp
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_update_chat_sessions_timestamp ON public.chat_sessions;
CREATE TRIGGER trigger_update_chat_sessions_timestamp
    BEFORE UPDATE ON public.chat_sessions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_update_study_plans_timestamp ON public.study_plans;
CREATE TRIGGER trigger_update_study_plans_timestamp
    BEFORE UPDATE ON public.study_plans
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =========================================================================
-- 8. AUTO-CREATE PROFILE ON SIGNUP TRIGGER
-- =========================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, current_band, target_band, study_hours_per_day)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        NULL,
        7.0,
        2
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
