import { formatLocation } from "@/lib/accounts/locations";
import { requireAccount } from "@/lib/server/session";
import { AccountNav } from "../account-nav";

// The signed-in account's own profile. RLS means it can't load anyone
// else's.
export default async function ProfilePage() {
  const account = await requireAccount();

  return (
    <main>
      <AccountNav account={account} />
      <h1>Profile</h1>
      <dl>
        <dt>Name</dt>
        <dd>{account.name ?? "—"}</dd>
        <dt>Username</dt>
        <dd>{account.username}</dd>
        <dt>Location</dt>
        <dd>{formatLocation(account.country, account.city) || "—"}</dd>
        <dt>Role</dt>
        <dd>{account.role}</dd>
      </dl>
    </main>
  );
}
