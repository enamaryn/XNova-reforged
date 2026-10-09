import { PlayerProfile } from "../../PlayerProfile";

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PlayerProfile id={id} />;
}
