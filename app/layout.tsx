import type { Metadata } from "next";
import { Cinzel, Geist, Noto_Sans_Khmer, Noto_Serif_Khmer } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { DEFAULT_THEME } from "@/lib/preferences";
import { getCurrentAccount } from "@/lib/server/session";
import { cn } from "@/lib/utils";
import "./globals.css";

// Body text in Geist, headings in Cinzel. Neither has Khmer glyphs, so the
// Noto Khmer fonts follow each in the stacks in globals.css.
const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const cinzel = Cinzel({ subsets: ["latin"], variable: "--font-cinzel" });
const khmerSans = Noto_Sans_Khmer({ subsets: ["khmer"], variable: "--font-khmer-sans" });
const khmerSerif = Noto_Serif_Khmer({ subsets: ["khmer"], variable: "--font-khmer-serif" });

export const metadata: Metadata = {
  title: "Flex Idle",
};

// The language and theme come from the signed-in account, so the server
// renders the page in them from the first byte. Visitors get the defaults.
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const theme = (await getCurrentAccount())?.theme ?? DEFAULT_THEME;

  return (
    <html
      lang={locale}
      className={cn(
        geist.variable,
        cinzel.variable,
        khmerSans.variable,
        khmerSerif.variable,
        theme === "dark" && "dark",
      )}
    >
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
