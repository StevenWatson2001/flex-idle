import { createClient } from "@supabase/supabase-js";

export function supabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  return url;
}

export function publishableKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!key) throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set");
  return key;
}

// A client with the publishable key: it can do only what RLS and grants
// allow the anon role.
export function createPublicClient() {
  return createClient(supabaseUrl(), publishableKey(), {
    auth: { persistSession: false },
  });
}

// The Supabase project this deploy talks to, e.g. "abcd1234" from
// https://abcd1234.supabase.co. Not secret: it's in the public URL.
export function projectRef(): string {
  return new URL(supabaseUrl()).hostname.split(".")[0];
}
