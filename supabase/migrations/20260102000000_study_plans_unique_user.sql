-- One study plan per user (the planner upserts on user_id). No-op on databases created from init.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.study_plans'::regclass AND contype = 'u'
    ) THEN
        ALTER TABLE public.study_plans ADD CONSTRAINT study_plans_user_id_key UNIQUE (user_id);
    END IF;
END $$;
