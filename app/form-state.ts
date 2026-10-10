import type { Messages } from "next-intl";
import { getTranslations } from "next-intl/server";

// What a form's server action returns: an error to show, or a message on
// success, already in the player's language.
export type FormState = { error?: string; message?: string } | undefined;

export type ErrorKey = keyof Messages["errors"];

// The form state for an error, translated from its key under "errors".
export async function errorState(error: ErrorKey): Promise<FormState> {
  const t = await getTranslations("errors");
  return { error: t(error) };
}

// A field's value as text. Anything else (a file, or nothing) is "".
export function formText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
