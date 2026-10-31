import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Saves a visit note draft and reports whether a row really changed: an update
 * blocked by row level security returns no error, just no rows. The status
 * guard stops a tab left open from overwriting a submitted note.
 */
export async function saveNoteDraft(
  supabase: SupabaseClient,
  table: "clinical_notes" | "nursing_encounters" | "physiotherapy_encounters",
  id: string,
  fields: Record<string, unknown>,
  draftState: Record<string, unknown>,
): Promise<boolean> {
  const write = (patch: Record<string, unknown>) => supabase
    .from(table)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "draft")
    .select("id");

  let { data, error } = await write({ ...fields, draft_state: draftState });
  // Migration 071 not applied yet: keep the fields that do have columns
  if (error?.message?.includes("draft_state")) ({ data, error } = await write(fields));
  return !error && !!data?.length;
}
