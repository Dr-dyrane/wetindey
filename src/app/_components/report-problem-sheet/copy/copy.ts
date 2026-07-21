/** The four problem kinds, in the order the picker shows them. Each id is the
 *  exact enum value `submitProblemReportInput` (src/lib/validation.ts) admits, so
 *  the control cannot mint a kind the write path would reject. */
export const KIND_KEYS = [
  { id: "price_wrong", labelKey: "problem.kind_price" },
  { id: "place_wrong", labelKey: "problem.kind_place" },
  { id: "app_bug", labelKey: "problem.kind_bug" },
  { id: "other", labelKey: "problem.kind_other" },
] as const;

export type Kind = (typeof KIND_KEYS)[number]["id"];
