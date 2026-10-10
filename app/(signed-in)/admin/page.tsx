import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { localisedCountries } from "@/lib/accounts/locations";
import { listPlayers } from "@/lib/server/accounts";
import { requireAdmin } from "@/lib/server/session";
import { ActionForm, Field, LocationSelect } from "../../forms";
import { createPlayerAction } from "./actions";

export default async function AdminPage() {
  await requireAdmin();
  const players = await listPlayers();
  const t = await getTranslations();
  const format = await getFormatter();

  return (
    <main className="mx-auto grid w-full max-w-5xl flex-1 content-start gap-6 px-6 py-8">
      <h1 className="text-3xl">{t("admin.title")}</h1>

      <Card>
        <CardContent>
          {players.length === 0 ? (
            <p className="text-muted-foreground">{t("admin.noPlayers")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("fields.name")}</TableHead>
                  <TableHead>{t("fields.username")}</TableHead>
                  <TableHead>{t("fields.city")}</TableHead>
                  <TableHead>{t("admin.created")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {players.map((player) => (
                  <TableRow key={player.id}>
                    <TableCell>{player.name}</TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/players/${player.id}`}
                        className="font-medium text-heading underline decoration-gold/60 underline-offset-4 hover:decoration-gold"
                      >
                        {player.username}
                      </Link>
                    </TableCell>
                    <TableCell>{player.city}</TableCell>
                    <TableCell>
                      {format.dateTime(new Date(player.createdAt), { dateStyle: "medium" })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{t("admin.newPlayer")}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ActionForm action={createPlayerAction} submitLabel={t("admin.create")}>
            <div className="grid grid-cols-2 gap-4">
              <Field
                id="new-username"
                label={t("fields.username")}
                name="username"
                required
                autoComplete="off"
                autoCapitalize="none"
              />
              <Field
                id="new-password"
                label={t("fields.password")}
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <Field id="new-name" label={t("fields.name")} name="name" required maxLength={50} />
            <LocationSelect idPrefix="new" countries={localisedCountries(await getLocale())} />
          </ActionForm>
        </CardContent>
      </Card>
    </main>
  );
}
