import { requireServerUser } from "@/lib/supabase-server";
import { loadTrackRecord } from "@/lib/track-record";
import { RecordsList } from "@/components/records/records-list";

export const revalidate = 0;

export default async function RecordsPage() {
  const { supabase, user } = await requireServerUser("/records");
  const trackRecord = await loadTrackRecord(supabase, user.id);
  return <RecordsList initialRecords={trackRecord} />;
}
