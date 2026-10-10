import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publishableKey, supabaseUrl } from "@/lib/supabase";

// Keeps the Supabase session fresh: if the access token has expired,
// getClaims() refreshes it and the new cookies go to both the page being
// rendered and the browser. Access checks happen in the pages and actions
// (lib/server/session.ts), not here.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl(), publishableKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Responses that set session cookies must not be cached.
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  await supabase.auth.getClaims();

  return response;
}

export const config = {
  // Skip static files and the health check, which don't use the session.
  matcher: ["/((?!api/health|_next/static|_next/image|favicon.ico).*)"],
};
