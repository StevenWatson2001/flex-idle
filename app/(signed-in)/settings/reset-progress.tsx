"use client";

import { useActionState, useState } from "react";
import { RotateCcw } from "lucide-react";
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
import type { FormState } from "../../form-state";

// The Reset progress button and its confirmation. Resetting can't be
// undone, so it always asks first. On success the dialog closes and the
// card says so.
export function ResetProgress({ action }: { action: () => Promise<FormState> }) {
  const t = useTranslations("settings");
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(async () => {
    const result = await action();
    if (!result?.error) setOpen(false);
    return result;
  }, undefined);

  return (
    <div className="grid gap-4">
      <AlertDialog open={open} onOpenChange={setOpen}>
        <div>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">
              <RotateCcw aria-hidden />
              {t("resetButton")}
            </Button>
          </AlertDialogTrigger>
        </div>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("resetConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("resetConfirmBody")}</AlertDialogDescription>
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
                {t("confirmReset")}
              </Button>
            </form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {state?.message && (
        <Alert variant="success" role="status">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
