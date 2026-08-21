import { GuestFlow } from '@/components/guest-flow';

/**
 * The one guest route. `?room=` (from the room QR) only pre-fills the entry
 * form — never trusted beyond that, dropped once a session exists.
 */
export default function GuestPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const room = typeof searchParams.room === 'string' ? searchParams.room : undefined;
  return <GuestFlow slug={params.slug} roomParam={room} />;
}
