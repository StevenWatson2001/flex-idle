import { getLocale, getTranslations } from "next-intl/server";
import { Card, CardContent } from "@/components/ui/card";
import { formatLocation } from "@/lib/accounts/locations";
import { requireAccount } from "@/lib/server/session";

// The signed-in account's own profile. RLS means it can't load anyone
// else's.
export default async function ProfilePage() {
  const account = await requireAccount();
  const t = await getTranslations();
  const none = t("profile.none");

  const rows = [
    [t("fields.name"), account.name ?? none],
    [t("fields.username"), account.username],
    [t("profile.location"), formatLocation(account.country, account.city, await getLocale()) || none],
    [t("profile.role"), t(`profile.roles.${account.role}`)],
  ];

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
    </main>
  );
}
