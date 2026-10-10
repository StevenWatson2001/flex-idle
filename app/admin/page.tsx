import Link from "next/link";
import { listPlayers } from "@/lib/server/accounts";
import { requireAdmin } from "@/lib/server/session";
import { AccountNav } from "../account-nav";
import { ActionForm, Field, LocationSelect } from "../forms";
import { createPlayerAction } from "./actions";

export default async function AdminPage() {
  const account = await requireAdmin();
  const players = await listPlayers();

  return (
    <main>
      <AccountNav account={account} />
      <h1>Players</h1>
      {players.length === 0 ? (
        <p>No players yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Username</th>
              <th>City</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={player.id}>
                <td>{player.name}</td>
                <td>
                  <Link href={`/admin/players/${player.id}`}>{player.username}</Link>
                </td>
                <td>{player.city}</td>
                <td>{new Date(player.createdAt).toLocaleDateString("en-NZ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>New player</h2>
      <ActionForm action={createPlayerAction} submitLabel="Create player">
        <Field
          id="new-username"
          label="Username"
          name="username"
          required
          autoComplete="off"
          autoCapitalize="none"
        />
        <Field
          id="new-password"
          label="Password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
        <Field id="new-name" label="Name" name="name" required maxLength={50} />
        <LocationSelect idPrefix="new" />
      </ActionForm>
    </main>
  );
}
