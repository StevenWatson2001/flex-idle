import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { localisedCountries } from "@/lib/accounts/locations";
import { getPlayer } from "@/lib/server/accounts";
import { requireAdmin } from "@/lib/server/session";
import { ActionForm, Field, LocationSelect } from "../../../../forms";
import {
  renamePlayerAction,
  setPlayerPasswordAction,
  updatePlayerDetailsAction,
} from "../../actions";

export default async function EditPlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const player = await getPlayer(id);
  if (!player) notFound();
  const t = await getTranslations();

  return (
    <main className="mx-auto grid w-full max-w-3xl flex-1 content-start gap-6 px-6 py-8">
      <div>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin">
            <ArrowLeft aria-hidden />
            {t("admin.allPlayers")}
          </Link>
        </Button>
      </div>
      <h1 className="text-3xl">{t("admin.editPlayer")}</h1>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{t("admin.usernameSection")}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ActionForm
            action={renamePlayerAction.bind(null, id)}
            submitLabel={t("admin.changeUsername")}
          >
            <Field
              id="edit-username"
              label={t("fields.username")}
              name="username"
              required
              defaultValue={player.username}
              autoComplete="off"
              autoCapitalize="none"
            />
          </ActionForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{t("admin.detailsSection")}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ActionForm
            action={updatePlayerDetailsAction.bind(null, id)}
            submitLabel={t("admin.saveDetails")}
          >
            <Field
              id="edit-name"
              label={t("fields.name")}
              name="name"
              required
              maxLength={50}
              defaultValue={player.name}
            />
            <LocationSelect
              idPrefix="edit"
              countries={localisedCountries(await getLocale())}
              defaultCountry={player.country}
              defaultCity={player.city}
            />
          </ActionForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{t("admin.passwordSection")}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ActionForm
            action={setPlayerPasswordAction.bind(null, id)}
            submitLabel={t("admin.setPassword")}
          >
            <Field
              id="edit-password"
              label={t("fields.newPassword")}
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </ActionForm>
        </CardContent>
      </Card>
    </main>
  );
}
