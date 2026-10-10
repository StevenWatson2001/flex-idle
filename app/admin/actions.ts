"use server";

import { redirect } from "next/navigation";
import {
  createPlayer,
  renamePlayer,
  setPlayerPassword,
  updatePlayerDetails,
  type Result,
} from "@/lib/server/accounts";
import { getCurrentAccount } from "@/lib/server/session";
import { formText, type FormState } from "../form-state";

// Server actions are public endpoints, so each one checks for an admin
// itself rather than trusting that the page did.
async function isAdmin(): Promise<boolean> {
  return (await getCurrentAccount())?.role === "admin";
}

const NOT_ALLOWED: FormState = { error: "Only admins can do that." };

function toFormState(result: Result, message: string): FormState {
  return result.ok ? { message } : { error: result.error };
}

export async function createPlayerAction(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!(await isAdmin())) return NOT_ALLOWED;

  const result = await createPlayer({
    username: formText(formData, "username"),
    password: formText(formData, "password"),
    name: formText(formData, "name"),
    country: formText(formData, "country"),
    city: formText(formData, "city"),
  });
  if (!result.ok) return { error: result.error };
  redirect(`/admin/players/${result.value.id}`);
}

export async function renamePlayerAction(
  id: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!(await isAdmin())) return NOT_ALLOWED;
  return toFormState(
    await renamePlayer(id, formText(formData, "username")),
    "Username changed.",
  );
}

export async function updatePlayerDetailsAction(
  id: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!(await isAdmin())) return NOT_ALLOWED;
  return toFormState(
    await updatePlayerDetails(id, {
      name: formText(formData, "name"),
      country: formText(formData, "country"),
      city: formText(formData, "city"),
    }),
    "Details saved.",
  );
}

export async function setPlayerPasswordAction(
  id: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!(await isAdmin())) return NOT_ALLOWED;
  return toFormState(
    await setPlayerPassword(id, formText(formData, "password")),
    "Password set.",
  );
}
