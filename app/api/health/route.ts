import { createPublicClient, projectRef } from "@/lib/supabase";

// Proves this deploy can reach its database, and says which one.
export async function GET() {
  const project = projectRef();
  const { data, error } = await createPublicClient()
    .from("health_check")
    .select("status")
    .eq("id", 1)
    .maybeSingle();

  if (error || data?.status !== "ok") {
    return Response.json({ status: "error", project }, { status: 503 });
  }
  return Response.json({ status: "ok", project });
}
