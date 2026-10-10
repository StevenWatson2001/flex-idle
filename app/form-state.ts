// What a form's server action returns: an error to show, or a message on
// success.
export type FormState = { error?: string; message?: string } | undefined;

// A field's value as text. Anything else (a file, or nothing) is "".
export function formText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
