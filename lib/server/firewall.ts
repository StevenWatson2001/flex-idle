// The live site's IP allowlist. ALLOWED_IPS holds JSON like
// [{"ip": "203.0.113.5", "label": "Steven home"}]; see docs/firewall.md.
// Anything unexpected blocks: a missing or broken list keeps everyone out
// rather than letting everyone in.

type AllowedIp = { ip: string; label: string };

function normalise(ip: string): string {
  return ip.trim().toLowerCase();
}

function parseList(json: string | undefined): AllowedIp[] | null {
  if (!json) return null;
  try {
    const list: unknown = JSON.parse(json);
    if (!Array.isArray(list)) return null;
    const valid = list.every(
      (entry) => typeof entry?.ip === "string" && typeof entry?.label === "string",
    );
    return valid ? list : null;
  } catch {
    return null;
  }
}

export function firewallAllows(ip: string | null, allowedIpsJson: string | undefined): boolean {
  const list = parseList(allowedIpsJson);
  if (!list) {
    console.error("Firewall: ALLOWED_IPS is missing or invalid, so every request is blocked.");
    return false;
  }
  if (!ip) return false;
  return list.some((entry) => normalise(entry.ip) === normalise(ip));
}
