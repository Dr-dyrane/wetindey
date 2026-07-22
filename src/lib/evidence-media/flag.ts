/**
 * ADR-028 default-off admission flag for evidence-media.
 *
 * The feature ships DEFAULT-OFF / fail-closed. Two independent flags, both
 * defaulting false, must be explicitly set to the string "true" to turn any
 * part of the feature on:
 *
 *   - the SERVER flag `EVIDENCE_MEDIA_ADMISSION_ENABLED` gates the admission
 *     server action; while it is false the action refuses and no upload path is
 *     reachable, so nothing is ever written durably;
 *   - the CLIENT flag `NEXT_PUBLIC_EVIDENCE_MEDIA_ENABLED` gates whether the
 *     optional upload control renders at all; while it is false the field is
 *     absent and the sheet is byte-for-byte the shipped experience.
 *
 * With both false (the default), the feature is invisible and inert in
 * production: no public projection, no real upload path. This module is pure
 * and holds only these predicates.
 */

/** Server admission gate. Defaults false; only the literal "true" enables it. */
export function isEvidenceMediaAdmissionEnabled(
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  return environment.EVIDENCE_MEDIA_ADMISSION_ENABLED === "true";
}

/** Client UI gate. Defaults false; only the literal "true" renders the field. */
export function isEvidenceMediaClientEnabled(): boolean {
  return process.env.NEXT_PUBLIC_EVIDENCE_MEDIA_ENABLED === "true";
}
