import Link from "next/link";
import type { Account } from "@/lib/server/session";
import { signOut } from "./actions";

export function AccountNav({ account }: { account: Account }) {
  return (
    <nav>
      <Link href="/profile">Profile</Link>
      {account.role === "admin" && (
        <>
          {" · "}
          <Link href="/admin">Players</Link>
        </>
      )}
      <form action={signOut}>
        <button type="submit">Sign out</button>
      </form>
    </nav>
  );
}
