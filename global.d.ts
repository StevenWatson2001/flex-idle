import type { Language } from "@/lib/preferences";
import type en from "@/messages/en.json";

// Types next-intl's locales and message keys, so a misspelt key or locale
// fails typecheck.
declare module "next-intl" {
  interface AppConfig {
    Locale: Language;
    Messages: typeof en;
  }
}
