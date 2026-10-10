import { redirect } from "next/navigation";
import { getCurrentAccount } from "@/lib/server/session";
import { signIn } from "./actions";
import { ActionForm, Field } from "./forms";

// Admins and players sign in here; the role decides where they go next.
export default async function Home() {
  const account = await getCurrentAccount();
  if (account) redirect(account.role === "admin" ? "/admin" : "/profile");

  return (
    <main>
      <h1>Flex Idle</h1>
      <ActionForm action={signIn} submitLabel="Sign in">
        <Field
          id="sign-in-username"
          label="Username"
          name="username"
          required
          autoComplete="username"
          autoCapitalize="none"
        />
        <Field
          id="sign-in-password"
          label="Password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
      </ActionForm>
    </main>
  );
}
