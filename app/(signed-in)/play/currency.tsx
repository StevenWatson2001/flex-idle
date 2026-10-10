// A currency's tile in the currency bar.
export function Currency({
  icon,
  name,
  amount,
  title,
}: {
  icon: React.ReactNode;
  name: string;
  amount: string;
  title?: string;
}) {
  return (
    <div role="group" aria-label={name} className="panel-frame flex items-center gap-4 rounded-lg bg-card/85 px-5 py-4">
      <span aria-hidden className="text-gold [&_svg]:size-7">
        {icon}
      </span>
      <div>
        <p className="font-heading text-sm font-semibold tracking-wide text-heading">{name}</p>
        <p title={title} className="font-heading text-2xl font-bold tabular-nums">
          {amount}
        </p>
      </div>
    </div>
  );
}
