import { headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { type Language, isLanguage, languageFromHeader } from "@/lib/preferences";
import { getCurrentAccount } from "@/lib/server/session";
import en from "@/messages/en.json";
import km from "@/messages/km.json";

// Every language's messages. `satisfies` makes typecheck fail if a
// translation is missing a key that English has.
const MESSAGES = { en, km } satisfies Record<Language, typeof en>;

// The language for this request: an explicit one (Settings passes the one
// just saved), else the signed-in account's, else the browser's.
async function requestLanguage(explicit: string | undefined): Promise<Language> {
  if (explicit && isLanguage(explicit)) return explicit;
  const account = await getCurrentAccount();
  if (account) return account.language;
  return languageFromHeader((await headers()).get("accept-language"));
}

export default getRequestConfig(async ({ locale }) => {
  const language = await requestLanguage(locale);
  return {
    locale: language,
    messages: MESSAGES[language],
    // Steven plays from New Zealand; dates show in his time zone.
    timeZone: "Pacific/Auckland",
  };
});
