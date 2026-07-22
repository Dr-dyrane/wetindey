import { useCallback, useRef, useState } from "react";
import type { ContributionAdmissionInput } from "@/lib/validation";
import type { ContributionAdmissionResult } from "@/lib/contributions/runtime";

export interface Option {
  id: string;
  name: string;
}

export interface UseReportPriceSheetProps {
  itemId: string;
  variantId: string;
  variants: { id: string; itemId: string; displayName: string }[];
  onPlaceId: (value: string) => void;
  onItemId: (value: string) => void;
  onVariantId: (value: string) => void;
  onUnitId: (value: string) => void;
  onPrice: (value: string) => void;
  onAvailable: (value: "available" | "unavailable") => void;
  submitObservation: (
    data: ContributionAdmissionInput
  ) => Promise<ContributionAdmissionResult>;
}

export type ReportSubmissionState =
  | { phase: "idle" }
  | { phase: "submitting" }
  | {
      phase: "error";
      code:
        | "client_required"
        | "client_price"
        | "maintenance"
        | "invalid_input"
        | "reporting_disabled"
        | "rate_limited"
        | "idempotency_conflict"
        | "transport";
      retryAfterSeconds?: number;
    }
  | { phase: "success"; replayed: boolean };

export interface ReportSubmissionIntent {
  placeId: string;
  itemId: string;
  variantId: string;
  unitId: string;
  price: string;
  available: "available" | "unavailable";
}

export type ReportSubmissionAttempt =
  | { kind: "blocked" }
  | { kind: "error"; state: Extract<ReportSubmissionState, { phase: "error" }> }
  | { kind: "request"; request: ContributionAdmissionInput };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PLACEHOLDER_IDEMPOTENCY_KEY = "00000000-0000-4000-8000-000000000000";

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function normalizedAmount(price: string): number | null {
  const amount = Number(price);
  if (!Number.isFinite(amount) || amount < 5 || amount > 5_000_000) return null;
  return Math.round(amount * 100) / 100;
}

function fingerprint(input: ContributionAdmissionInput): string {
  return JSON.stringify({
    placeId: input.placeId,
    itemVariantId: input.itemVariantId,
    unitId: input.unitId,
    availabilityState: input.availabilityState,
    priceAmount: input.availabilityState === "available" ? input.priceAmount : null,
  });
}

function payloadFor(intent: ReportSubmissionIntent): ReportSubmissionAttempt {
  if (![intent.placeId, intent.itemId, intent.variantId, intent.unitId].every(isUuid)) {
    return { kind: "error", state: { phase: "error", code: "client_required" } };
  }

  if (intent.available === "unavailable") {
    return {
      kind: "request",
      request: {
        idempotencyKey: PLACEHOLDER_IDEMPOTENCY_KEY,
        itemVariantId: intent.variantId,
        unitId: intent.unitId,
        placeId: intent.placeId,
        availabilityState: "unavailable",
      },
    };
  }

  const priceAmount = normalizedAmount(intent.price);
  if (priceAmount === null) {
    return { kind: "error", state: { phase: "error", code: "client_price" } };
  }

  return {
    kind: "request",
    request: {
      idempotencyKey: PLACEHOLDER_IDEMPOTENCY_KEY,
      itemVariantId: intent.variantId,
      unitId: intent.unitId,
      placeId: intent.placeId,
      availabilityState: "available",
      priceAmount,
    },
  };
}

function stateFor(result: ContributionAdmissionResult): ReportSubmissionState {
  switch (result.code) {
    case "received_for_review":
      return { phase: "success", replayed: result.replayed };
    case "maintenance":
    case "invalid_input":
    case "reporting_disabled":
      return { phase: "error", code: result.code };
    case "rate_limited":
      return {
        phase: "error",
        code: "rate_limited",
        retryAfterSeconds: result.retryAfterSeconds,
      };
    case "idempotency_conflict":
      return { phase: "error", code: "idempotency_conflict" };
  }
}

/**
 * The pure ownership boundary for one pending Food report. It deliberately owns
 * no React state and no network call, which makes retry identity and in-flight
 * behaviour executable rather than inferred from source text.
 */
export function createReportSubmissionCoordinator(createUuid: () => string) {
  let inFlight = false;
  let idempotency: { intent: string; key: string } | null = null;

  return {
    start(intent: ReportSubmissionIntent): ReportSubmissionAttempt {
      if (inFlight) return { kind: "blocked" };

      const prepared = payloadFor(intent);
      if (prepared.kind !== "request") return prepared;

      const intentFingerprint = fingerprint(prepared.request);
      const key =
        idempotency?.intent === intentFingerprint
          ? idempotency.key
          : createUuid();
      idempotency = { intent: intentFingerprint, key };
      inFlight = true;

      return {
        kind: "request",
        request: { ...prepared.request, idempotencyKey: key },
      };
    },

    resolve(result: ContributionAdmissionResult): ReportSubmissionState {
      inFlight = false;
      if (result.code === "idempotency_conflict") idempotency = null;
      return stateFor(result);
    },

    transport(): Extract<ReportSubmissionState, { phase: "error" }> {
      // The request outcome is unknown. Finish the local flight but retain the
      // exact key so a retry becomes a safe server-side idempotent replay.
      inFlight = false;
      return { phase: "error", code: "transport" };
    },

    invalidate(): boolean {
      if (inFlight) return false;
      idempotency = null;
      return true;
    },

    reset(): boolean {
      return this.invalidate();
    },

    isInFlight(): boolean {
      return inFlight;
    },
  };
}

export function useReportPriceSheet({
  itemId,
  variantId,
  variants,
  onPlaceId,
  onItemId,
  onVariantId,
  onUnitId,
  onPrice,
  onAvailable,
  submitObservation,
}: UseReportPriceSheetProps) {
  const variantsForItem = variants.filter((variant) => variant.itemId === itemId);
  const [submission, setSubmission] = useState<ReportSubmissionState>({ phase: "idle" });
  // The admitted observation id (reportId) surfaced from a successful admission,
  // so an OPTIONAL evidence-media attach can bind to the pending report. This is
  // additive and never alters the coordinator's result mapping.
  const [admittedObservationId, setAdmittedObservationId] = useState<string | null>(null);
  const coordinatorRef = useRef<ReturnType<typeof createReportSubmissionCoordinator> | null>(null);
  if (coordinatorRef.current === null) {
    coordinatorRef.current = createReportSubmissionCoordinator(() => crypto.randomUUID());
  }
  const coordinator = coordinatorRef.current;

  const changeIntent = useCallback(
    (commit: () => void) => {
      if (!coordinator.invalidate()) return;
      commit();
      setSubmission((current) => (current.phase === "error" ? { phase: "idle" } : current));
    },
    [coordinator]
  );

  const selectPlace = useCallback(
    (nextPlaceId: string) => changeIntent(() => onPlaceId(nextPlaceId)),
    [changeIntent, onPlaceId]
  );
  const selectItem = useCallback(
    (nextItemId: string) =>
      changeIntent(() => {
        onItemId(nextItemId);
        if (variantId && !variants.some((variant) => variant.id === variantId && variant.itemId === nextItemId)) {
          onVariantId("");
        }
      }),
    [changeIntent, onItemId, onVariantId, variantId, variants]
  );
  const selectVariant = useCallback(
    (nextVariantId: string) => changeIntent(() => onVariantId(nextVariantId)),
    [changeIntent, onVariantId]
  );
  const selectUnit = useCallback(
    (nextUnitId: string) => changeIntent(() => onUnitId(nextUnitId)),
    [changeIntent, onUnitId]
  );
  const changePrice = useCallback(
    (nextPrice: string) => changeIntent(() => onPrice(nextPrice)),
    [changeIntent, onPrice]
  );
  const selectAvailability = useCallback(
    (nextAvailability: "available" | "unavailable") =>
      changeIntent(() => {
        onAvailable(nextAvailability);
        if (nextAvailability === "unavailable") onPrice("");
      }),
    [changeIntent, onAvailable, onPrice]
  );

  const submit = useCallback(
    async (intent: ReportSubmissionIntent) => {
      if (submission.phase === "success") return;
      const attempt = coordinator.start(intent);
      if (attempt.kind === "blocked") return;
      if (attempt.kind === "error") {
        setSubmission(attempt.state);
        return;
      }

      setSubmission({ phase: "submitting" });
      try {
        const result = await submitObservation(attempt.request);
        if (result.code === "received_for_review") {
          setAdmittedObservationId(result.observationId);
        }
        setSubmission(coordinator.resolve(result));
      } catch {
        setSubmission(coordinator.transport());
      }
    },
    [coordinator, submission.phase, submitObservation]
  );

  const reset = useCallback(() => {
    if (!coordinator.reset()) return false;
    onPrice("");
    setAdmittedObservationId(null);
    setSubmission({ phase: "idle" });
    return true;
  }, [coordinator, onPrice]);

  const dismiss = useCallback(
    (onClose: () => void) => () => {
      // A submit in flight must never trap the user behind a frozen sheet on a
      // slow network. Close it and leave the retained idempotency key intact so
      // any later replay of the identical intent stays a safe server-side no-op.
      if (coordinator.isInFlight()) {
        onClose();
        return;
      }
      if (reset()) onClose();
    },
    [coordinator, reset]
  );

  return {
    variantsForItem,
    submission,
    admittedObservationId,
    onPlaceId: selectPlace,
    onItemId: selectItem,
    onVariantId: selectVariant,
    onUnitId: selectUnit,
    onPrice: changePrice,
    onAvailable: selectAvailability,
    submit,
    reset,
    dismiss,
  };
}
