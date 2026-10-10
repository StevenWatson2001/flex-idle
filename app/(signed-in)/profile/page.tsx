import { getLocale, getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatLocation } from "@/lib/accounts/locations";
import { formatAmount } from "@/lib/game/format";
import { getStats } from "@/lib/server/progress";
import { requireAccount } from "@/lib/server/session";

// The signed-in account's own profile and, for players, their stats. RLS
// means it can't load anyone else's.
export default async function ProfilePage() {
  const account = await requireAccount();
  const t = await getTranslations();
  const locale = await getLocale();
  const none = t("profile.none");

  const rows = [
    [t("fields.name"), account.name ?? none],
    [t("fields.username"), account.username],
    [t("profile.location"), formatLocation(account.country, account.city, locale) || none],
    [t("profile.role"), t(`profile.roles.${account.role}`)],
  ];

  const stats = account.role === "player" ? await getStats(account.id) : null;
  const statRows: [string, number, number][] = stats
    ? [
        [t("profile.clicks"), stats.runClicks, stats.totalClicks],
        [t("profile.goldEarned"), stats.runGoldEarned, stats.totalGoldEarned],
      ]
    : [];

  return (
    <main className="mx-auto grid w-full max-w-3xl flex-1 content-start gap-6 px-6 py-8">
      <h1 className="text-3xl">{t("profile.title")}</h1>
      <Card>
        <CardContent>
          <dl className="grid grid-cols-[10rem_1fr] gap-x-6 gap-y-4 text-base">
            {rows.map(([term, value]) => (
              <div key={term} className="contents">
                <dt className="font-heading font-semibold tracking-wide text-heading">{term}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {stats && (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 id="stats-heading">{t("profile.stats")}</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table aria-labelledby="stats-heading" className="text-base">
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <span className="sr-only">{t("profile.stat")}</span>
                  </TableHead>
                  <TableHead className="text-right">{t("profile.thisRun")}</TableHead>
                  <TableHead className="text-right">{t("profile.allTime")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statRows.map(([name, run, total]) => (
                  <TableRow key={name}>
                    <TableHead scope="row" className="font-heading font-semibold tracking-wide text-heading">
                      {name}
                    </TableHead>
                    <TableCell className="text-right tabular-nums">{formatAmount(run, locale)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatAmount(total, locale)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
