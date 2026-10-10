"use server";

import { redirect } from "next/navigation";
import { signInWithUsername } from "@/lib/server/accounts";
import { createSessionClient } from "@/lib/server/session";
import { errorState, formText, type FormState } from "./form-state";

export async function signIn(_state: FormState, formData: FormData): Promise<FormState> {
  const result = await signInWithUsername(
    await createSessionClient(),
    formText(formData, "username"),
    formText(formData, "password"),
  );
  if (!result.ok) return errorState(result.error);
  // The home page sends each role where it belongs.
  redirect("/");
}

export async function signOut(): Promise<void> {
  await (await createSessionClient()).auth.signOut();
  redirect("/");
}
