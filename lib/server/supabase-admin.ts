import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "@/lib/supabase";

// A client with the secret key. It acts as service_role, which bypasses RLS
// and can manage Auth users, so use it only in server code, only after
// checking the caller is allowed, and never expose the key to the browser.
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set");
  return createClient(supabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
