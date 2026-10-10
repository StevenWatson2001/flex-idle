"use server";

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  createPlayer,
  deletePlayer,
  renamePlayer,
  setPlayerPassword,
  updatePlayerDetails,
  type Result,
} from "@/lib/server/accounts";
import { getCurrentAccount } from "@/lib/server/session";
import { errorState, formText, type FormState } from "../../form-state";

// Server actions are public endpoints, so each one checks for an admin
// itself rather than trusting that the page did.
async function isAdmin(): Promise<boolean> {
  return (await getCurrentAccount())?.role === "admin";
}

type SuccessKey = "usernameChanged" | "detailsSaved" | "passwordSet";

async function toFormState(result: Result, message: SuccessKey): Promise<FormState> {
  if (!result.ok) return errorState(result.error);
  const t = await getTranslations("admin");
  return { message: t(message) };
}

export async function createPlayerAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!(await isAdmin())) return errorState("notAllowed");

  const result = await createPlayer({
    username: formText(formData, "username"),
    password: formText(formData, "password"),
    name: formText(formData, "name"),
    country: formText(formData, "country"),
    city: formText(formData, "city"),
  });
  if (!result.ok) return errorState(result.error);
  redirect(`/admin/players/${result.value.id}`);
}

export async function renamePlayerAction(
  id: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!(await isAdmin())) return errorState("notAllowed");
  return toFormState(await renamePlayer(id, formText(formData, "username")), "usernameChanged");
}

export async function updatePlayerDetailsAction(
  id: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!(await isAdmin())) return errorState("notAllowed");
  return toFormState(
    await updatePlayerDetails(id, {
      name: formText(formData, "name"),
      country: formText(formData, "country"),
      city: formText(formData, "city"),
    }),
    "detailsSaved",
  );
}

export async function setPlayerPasswordAction(
  id: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!(await isAdmin())) return errorState("notAllowed");
  return toFormState(await setPlayerPassword(id, formText(formData, "password")), "passwordSet");
}

export async function deletePlayerAction(id: string): Promise<FormState> {
  if (!(await isAdmin())) return errorState("notAllowed");
  const result = await deletePlayer(id);
  if (!result.ok) return errorState(result.error);
  redirect("/admin");
}
