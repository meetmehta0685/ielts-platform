import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

// Load environment variables from backend root .env
dotenv.config({ path: path.join(__dirname, "../../.env") });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error(
    "[Error] Supabase URL or Service Role Key is missing from environment variables."
  );
}

// Service role key acts as administrative superuser to bypass RLS in backend
export const supabase = createClient(supabaseUrl || "", supabaseServiceRoleKey || "", {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

console.log("[Info] Supabase admin client initialized.");
