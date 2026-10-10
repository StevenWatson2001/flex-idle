"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { FormState } from "../../../../form-state";

// The Delete button and its confirmation. Deleting can't be undone, so it
// always asks first. On success the action moves on to the player list.
export function DeletePlayer({
  username,
  action,
}: {
  username: string;
  action: (state: FormState, formData: FormData) => Promise<FormState>;
}) {
  const t = useTranslations("admin");
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">
          <Trash2 aria-hidden />
          {t("deleteButton")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t.rich("deleteConfirmTitle", {
              username,
              // Cinzel has only capitals; usernames are lowercase.
              name: (chunks) => <span className="font-sans">{chunks}</span>,
            })}
          </AlertDialogTitle>
          <AlertDialogDescription>{t("deleteConfirmBody")}</AlertDialogDescription>
        </AlertDialogHeader>
        {state?.error && (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <form action={formAction}>
            <Button type="submit" variant="destructive" disabled={pending}>
              {t("confirmDelete")}
            </Button>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
