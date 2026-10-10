import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { publishableKey, supabaseUrl } from "@/lib/supabase";

// The signed-in account, read from the session cookie. Pages and server
// actions call requireAccount() or requireAdmin() before doing anything.

export type Account = {
  id: string;
  username: string;
  name: string | null;
  country: string | null;
  city: string | null;
  role: "player" | "admin";
};

// A client acting as the signed-in user, with the publishable key, so RLS
// applies. Create one per request.
export async function createSessionClient() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl(), publishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components can't set cookies. proxy.ts refreshes the
          // session, so this is safe to ignore.
        }
      },
    },
  });
}

// The account for this request, or null if no one is signed in. The role
// comes from the database, not the token, so a role change applies at once.
export const getCurrentAccount = cache(async (): Promise<Account | null> => {
  const supabase = await createSessionClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, username, name, country, city, role")
    .eq("id", userId)
    .maybeSingle();
  return data;
});

export async function requireAccount(): Promise<Account> {
  const account = await getCurrentAccount();
  if (!account) redirect("/");
  return account;
}

// Non-admins get a 404, so the admin screens don't reveal they exist.
export async function requireAdmin(): Promise<Account> {
  const account = await requireAccount();
  if (account.role !== "admin") notFound();
  return account;
}
