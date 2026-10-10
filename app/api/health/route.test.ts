import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { GET } from "./route";

// These tests run against the dev database named in the environment.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const expectedProject = new URL(url).hostname.split(".")[0];

describe("GET /api/health", () => {
  it("reads the health_check row and reports which project it reached", async () => {
    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: "ok",
      project: expectedProject,
    });
  });
});

describe("health_check table", () => {
  const supabase = createClient(url, publishableKey, {
    auth: { persistSession: false },
  });

  it("can't be written with the publishable key", async () => {
    const insert = await supabase
      .from("health_check")
      .insert({ id: 2, status: "ok" });
    const update = await supabase
      .from("health_check")
      .update({ status: "broken" })
      .eq("id", 1);
    const remove = await supabase.from("health_check").delete().eq("id", 1);

    expect(insert.error?.code).toBe("42501");
    expect(update.error?.code).toBe("42501");
    expect(remove.error?.code).toBe("42501");

    const { data, error } = await supabase
      .from("health_check")
      .select("id, status");
    expect(error).toBeNull();
    expect(data).toEqual([{ id: 1, status: "ok" }]);
  });
});
