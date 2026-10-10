# Firewall

Only approved IPs can reach the live game. Everyone else gets a bare `404`
on every path, so the site looks like nothing is there.

## Where the list lives
The Vercel environment variable `ALLOWED_IPS`, set for **Production only**
(Vercel → the project → Settings → Environment Variables). It isn't in the
repo, because the repo is public.

It holds a JSON list. Each entry is one exact IP address and a label saying
what it is:

```json
[
  { "ip": "203.0.113.5", "label": "Steven home" },
  { "ip": "2001:db8::5", "label": "Steven home (IPv6)" }
]
```

## Adding or removing an IP
1. Edit `ALLOWED_IPS` in Vercel and save.
2. Redeploy production (Deployments → the latest production deployment →
   Redeploy). A change only applies to new deployments.
3. Check from the connection you changed.

To find a connection's address, visit a "what is my IP" site from it. If
the connection has both an IPv4 and an IPv6 address, add both, since the
browser may use either one.

## Rules
- It applies only to live (`VERCEL_ENV=production`). Previews sit behind
  Vercel's login instead. Local dev and CI have no firewall.
- If `ALLOWED_IPS` is missing or isn't valid JSON in this shape, everyone
  is blocked, you included, and the logs say why.
- The check is in `proxy.ts` (with `lib/server/firewall.ts`). It reads the
  visitor's IP from `x-real-ip`, which Vercel sets and visitors can't fake.
- Supabase isn't behind the firewall; see `decisions.md`.
