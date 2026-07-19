"use server";

import { db } from "@/db";
import { problemReports } from "@/db/schema";
import { auth } from "@/lib/auth";
import { parseSubmitProblemReport } from "@/lib/validation";

/**
 * File a "something is wrong" report. Writes one row to `problem_reports`, which
 * the owner reads directly at psql, there is no admin UI and no reply channel,
 * by the owner's spec, so this action's whole job is to land the row honestly.
 *
 * PUBLIC AND ANONYMOUS-FIRST, like `submitObservation`. A Server Action is a
 * public HTTP endpoint (an agent lifted these ids from the JS bundle and POSTed
 * with no cookies, LANES H14), so `parseSubmitProblemReport` is the guard, not
 * the session: ADR-003 keeps this open to signed-out callers by design, and the
 * length cap on `body` is the only thing between an unthrottled endpoint and a
 * `text` column (there is no rate limiter in this app yet, see validation.ts).
 *
 * ATTRIBUTION IS RESOLVED SERVER-SIDE AND NEVER TAKEN FROM THE PAYLOAD. `userId`
 * is read from the session here, exactly as `getMyReports` reads it, and it is
 * nullable: signed in, the report carries your
 * id; signed out, the default, it is NULL, which is the honest "filed
 * anonymously", not an error. An auth outage resolves to NULL too, and that is
 * the right trade: we do not claim to know who someone is when we could not
 * check, and we do not drop the report because a third party is down.
 *
 * The context columns (`place_id` / `item_variant_id` / `unit_id` /
 * `context_label`) are left NULL: this action has no offer in hand. The only
 * opener today is the Profile row, which is cold. When a detail-sheet entry point
 * is built it will pass that context in; the columns are already there for it.
 */
export async function submitProblemReport(data: {
  kind: "price_wrong" | "place_wrong" | "app_bug" | "other";
  body: string;
  appLocale?: "en" | "pidgin" | "yoruba";
}): Promise<void> {
  const input = parseSubmitProblemReport(data);

  const { data: session } = await auth.getSession();
  const userId = session?.user?.id ?? null;

  await db.insert(problemReports).values({
    kind: input.kind,
    body: input.body,
    userId,
    appLocale: input.appLocale ?? null,
  });
}
