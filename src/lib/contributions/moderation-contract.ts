export const MODERATION_REASON_CODES = {
  approve: ["evidence_sufficient", "independent_confirmation"],
  reject: ["evidence_insufficient", "claim_conflicts", "policy_violation"],
  reverse: ["new_evidence", "decision_error"],
} as const;

export type ModerationDecision = keyof typeof MODERATION_REASON_CODES;
export type ModerationReasonCode =
  (typeof MODERATION_REASON_CODES)[ModerationDecision][number];

export type ModerationQueueItem = {
  observationId: string;
  availabilityState: "available" | "unavailable";
  priceAmountKobo: number | null;
  observedAt: string;
  submittedAt: string;
  collectionMethod: string;
  correctsPriorEvidence: boolean;
  attributed: boolean;
};

export type ModerationReviewDetail = {
  observationId: string;
  itemLabel: string;
  variantLabel: string | null;
  unitLabel: string;
  placeLabel: string;
  availabilityState: "available" | "unavailable";
  priceAmountKobo: number | null;
  observedAt: string;
  submittedAt: string;
  collectionMethod: string;
  correctsPriorEvidence: boolean;
  attributed: boolean;
  hasDecisionHistory: boolean;
  reopenedAfterReversal: boolean;
  activeDecisionId: string | null;
  canReverse: boolean;
};

export type ModerationAuditEntry = {
  action: "admission" | "approved" | "rejected" | "reversed" | "projection_updated";
  actor: "you" | "another_moderator";
  reasonCode: string | null;
  createdAt: string;
};

export type ModerationRuntimeResult<T> =
  | { code: "ready"; value: T }
  | { code: "replayed"; value: T }
  | { code: "forbidden" | "session_expired" | "conflict" | "unavailable" };

export type ModerationCommand = {
  requestId: string;
  observationId: string;
  decision: ModerationDecision;
  reasonCode: ModerationReasonCode;
  priorDecisionId: string | null;
};
