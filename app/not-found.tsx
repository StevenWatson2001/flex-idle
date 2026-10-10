import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Shown for unknown pages, and for admin pages to anyone who isn't an
// admin, so those don't reveal they exist.
export default async function NotFound() {
  const t = await getTranslations("notFound");

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle>
            <h1 className="text-2xl">{t("title")}</h1>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid justify-items-center gap-6">
          <p className="text-base">{t("message")}</p>
          <Button asChild variant="outline">
            <Link href="/">{t("home")}</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
