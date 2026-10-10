import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { firewallAllows } from "@/lib/server/firewall";
import { publishableKey, supabaseUrl } from "@/lib/supabase";

// Static files and the health check don't use the session.
const SKIPS_SESSION = /^\/(api\/health|_next\/static|_next\/image|favicon\.ico)/;

// On live, only IPs on the allowlist get in; everyone else gets a bare 404
// for every path (docs/firewall.md). Vercel sets x-real-ip itself.
//
// Then it keeps the Supabase session fresh: if the access token has expired,
// getClaims() refreshes it and the new cookies go to both the page being
// rendered and the browser. Account checks happen in the pages and actions
// (lib/server/session.ts), not here.
export async function proxy(request: NextRequest) {
  if (
    process.env.VERCEL_ENV === "production" &&
    !firewallAllows(request.headers.get("x-real-ip"), process.env.ALLOWED_IPS)
  ) {
    return new NextResponse("Not Found", { status: 404 });
  }

  let response = NextResponse.next({ request });
  if (SKIPS_SESSION.test(request.nextUrl.pathname)) return response;

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
