import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentAccount, homePath } from "@/lib/server/session";
import { signIn } from "./actions";
import { ActionForm, Field } from "./forms";

// Admins and players sign in here; the role decides where they go next.
export default async function Home() {
  const account = await getCurrentAccount();
  if (account) redirect(homePath(account));
  const t = await getTranslations();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-12">
      <h1 className="text-5xl font-bold tracking-[0.2em]">{t("app.name")}</h1>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            <h2>{t("signIn.title")}</h2>
          </CardTitle>
          <CardDescription>{t("signIn.intro")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm action={signIn} submitLabel={t("signIn.submit")}>
            <Field
              id="sign-in-username"
              label={t("fields.username")}
              name="username"
              required
              autoComplete="username"
              autoCapitalize="none"
            />
            <Field
              id="sign-in-password"
              label={t("fields.password")}
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </ActionForm>
        </CardContent>
      </Card>
    </main>
  );
}
