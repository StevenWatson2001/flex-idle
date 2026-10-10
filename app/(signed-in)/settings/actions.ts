"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { setPreferences } from "@/lib/server/accounts";
import { resetProgress as resetPlayerProgress } from "@/lib/server/db-write";
import { currentUserId, getCurrentAccount } from "@/lib/server/session";
import { errorState, formText, type FormState } from "../../form-state";

// Saves the signed-in account's language and theme. It reads only the user
// id before saving, not the cached profile, so the page re-renders with the
// new choices; the message is in the new language.
export async function savePreferences(_state: FormState, formData: FormData): Promise<FormState> {
  const userId = await currentUserId();
  if (!userId) return errorState("signedOut");

  const result = await setPreferences(userId, {
    language: formText(formData, "language"),
    theme: formText(formData, "theme"),
  });
  if (!result.ok) return errorState(result.error);

  revalidatePath("/", "layout");
  const t = await getTranslations({ locale: result.value.language, namespace: "settings" });
  return { message: t("saved") };
}

// Sets the signed-in player's Gold and stats back to zero. Admins don't
// play, so they have nothing to reset.
export async function resetProgress(): Promise<FormState> {
  const account = await getCurrentAccount();
  if (!account) return errorState("signedOut");
  if (account.role !== "player") return errorState("playersOnly");

  const result = await resetPlayerProgress(account.id);
  if (!result.ok) return errorState(result.error);

  revalidatePath("/", "layout");
  const t = await getTranslations("settings");
  return { message: t("progressReset") };
}
