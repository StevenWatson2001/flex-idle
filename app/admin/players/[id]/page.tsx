import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlayer } from "@/lib/server/accounts";
import { requireAdmin } from "@/lib/server/session";
import { AccountNav } from "../../../account-nav";
import { ActionForm, Field, LocationSelect } from "../../../forms";
import {
  renamePlayerAction,
  setPlayerPasswordAction,
  updatePlayerDetailsAction,
} from "../../actions";

export default async function EditPlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const account = await requireAdmin();
  const { id } = await params;
  const player = await getPlayer(id);
  if (!player) notFound();

  return (
    <main>
      <AccountNav account={account} />
      <p>
        <Link href="/admin">All players</Link>
      </p>
      <h1>Edit player</h1>

      <h2>Username</h2>
      <ActionForm action={renamePlayerAction.bind(null, id)} submitLabel="Change username">
        <Field
          id="edit-username"
          label="Username"
          name="username"
          required
          defaultValue={player.username}
          autoComplete="off"
          autoCapitalize="none"
        />
      </ActionForm>

      <h2>Details</h2>
      <ActionForm action={updatePlayerDetailsAction.bind(null, id)} submitLabel="Save details">
        <Field
          id="edit-name"
          label="Name"
          name="name"
          required
          maxLength={50}
          defaultValue={player.name}
        />
        <LocationSelect
          idPrefix="edit"
          defaultCountry={player.country}
          defaultCity={player.city}
        />
      </ActionForm>

      <h2>Password</h2>
      <ActionForm action={setPlayerPasswordAction.bind(null, id)} submitLabel="Set password">
        <Field
          id="edit-password"
          label="New password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </ActionForm>
    </main>
  );
}
