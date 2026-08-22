import { GuestFlow } from '@/components/guest-flow';

/**
 * The one guest route. `?room=` (from the room QR) only pre-fills the entry
 * form; `?location=`/`?spot=` (from Epic 16 location stickers) only pre-fill
 * the dining checkout — never trusted beyond that, dropped once consumed
 * (16.5 AC6: the session always wins).
 */
export default function GuestPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const asString = (value: string | string[] | undefined) =>
    typeof value === 'string' ? value : undefined;
  return (
    <GuestFlow
      slug={params.slug}
      roomParam={asString(searchParams.room)}
      locationParam={asString(searchParams.location)}
      spotParam={asString(searchParams.spot)}
    />
  );
}
