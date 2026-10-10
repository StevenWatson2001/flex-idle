import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LANGUAGE_NAMES, LANGUAGES, THEMES } from "@/lib/preferences";
import { requireAccount } from "@/lib/server/session";
import { signOut } from "../../actions";
import { ActionForm, SelectField } from "../../forms";
import { savePreferences } from "./actions";

export default async function SettingsPage() {
  const account = await requireAccount();
  const t = await getTranslations("settings");

  return (
    <main className="mx-auto grid w-full max-w-3xl flex-1 content-start gap-6 px-6 py-8">
      <h1 className="text-3xl">{t("title")}</h1>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{t("preferences")}</h2>
          </CardTitle>
          <CardDescription>{t("preferencesIntro")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm action={savePreferences} submitLabel={t("save")}>
            <div className="grid grid-cols-2 gap-4">
              <SelectField
                id="settings-language"
                label={t("language")}
                name="language"
                defaultValue={account.language}
                options={LANGUAGES.map((language) => ({ value: language, label: LANGUAGE_NAMES[language] }))}
              />
              <SelectField
                id="settings-theme"
                label={t("theme")}
                name="theme"
                defaultValue={account.theme}
                options={THEMES.map((theme) => ({ value: theme, label: t(`themes.${theme}`) }))}
              />
            </div>
          </ActionForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{t("account")}</h2>
          </CardTitle>
          <CardDescription>{t("signOutIntro")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={signOut}>
            <Button type="submit" variant="outline">
              {t("signOut")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
