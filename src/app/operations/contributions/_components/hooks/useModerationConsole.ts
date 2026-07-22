"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { type ModerationAuditEntry, type ModerationDecision, type ModerationQueueItem, type ModerationReasonCode, type ModerationReviewDetail, MODERATION_REASON_CODES } from "@/lib/contributions/moderation-contract";
import { readModerationQueue, readModerationReview, submitModerationCommand } from "../../actions";

export type ModerationNotice = "idle" | "loading" | "unavailable" | "session_expired" | "forbidden" | "conflict" | "recorded" | "replayed";
type Review = { detail: ModerationReviewDetail; audit: ModerationAuditEntry[] } | null;
type CommandIdentity = { intent: string; requestId: string } | null;
function intentFor(detail: ModerationReviewDetail, decision: ModerationDecision, reasonCode: ModerationReasonCode) { return JSON.stringify([detail.observationId, decision, reasonCode, decision === "reverse" ? detail.activeDecisionId : null]); }

export class ModerationCommandCoordinator {
  private active = false;
  private identity: CommandIdentity = null;

  begin(intent: string): string | null {
    if (this.active) return null;
    if (this.identity?.intent !== intent) this.identity = { intent, requestId: crypto.randomUUID() };
    this.active = true;
    return this.identity.requestId;
  }

  finish(): void {
    this.active = false;
  }

  clear(): void {
    this.identity = null;
  }
}

export async function executeModerationCommand<T extends { code: string }>(
  coordinator: ModerationCommandCoordinator,
  intent: string,
  submit: (requestId: string) => Promise<T>
): Promise<T | null> {
  const requestId = coordinator.begin(intent);
  if (!requestId) return null;
  try {
    const result = await submit(requestId);
    if (result.code === "conflict") coordinator.clear();
    return result;
  } finally {
    coordinator.finish();
  }
}

export async function settleModerationRead<T>(read: () => Promise<T>, onResult: (result: T) => void, onFailure: () => void): Promise<void> {
  try {
    onResult(await read());
  } catch {
    onFailure();
  }
}

export function useModerationConsole(initialQueue: ModerationQueueItem[], initialNotice: ModerationNotice = "idle") {
  const [queue, setQueue] = useState(initialQueue);
  const [review, setReview] = useState<Review>(null);
  const [notice, setNotice] = useState<ModerationNotice>(initialNotice);
  const [inFlight, setInFlight] = useState(false);
  const command = useRef(new ModerationCommandCoordinator());
  const refresh = useCallback(async () => {
    if (inFlight) return;
    setNotice("loading");
    await settleModerationRead(readModerationQueue, (result) => {
      if (result.code === "ready") { setQueue(result.value); setNotice("idle"); return; }
      setNotice(result.code === "session_expired" ? "session_expired" : result.code === "forbidden" ? "forbidden" : "unavailable");
    }, () => setNotice("unavailable"));
  }, [inFlight]);
  const select = useCallback(async (observationId: string) => {
    if (inFlight) return;
    setNotice("loading");
    await settleModerationRead(() => readModerationReview(observationId), (result) => {
      if (result.code === "ready") { setReview(result.value); setNotice("idle"); return; }
      setNotice(result.code === "session_expired" ? "session_expired" : result.code === "forbidden" ? "forbidden" : "unavailable");
    }, () => setNotice("unavailable"));
  }, [inFlight]);
  const decide = useCallback(async (decision: ModerationDecision, reasonCode: ModerationReasonCode) => {
    if (!review || inFlight || (decision === "reverse" && !review.detail.canReverse)) return;
    const intent = intentFor(review.detail, decision, reasonCode);
    setInFlight(true); setNotice("loading");
    try {
      const result = await executeModerationCommand(command.current, intent, (requestId) => submitModerationCommand({ requestId, observationId: review.detail.observationId, decision, reasonCode, priorDecisionId: decision === "reverse" ? review.detail.activeDecisionId : null }));
      if (!result) return;
      if (result.code === "ready" || result.code === "replayed") { setQueue((current) => current.filter((item) => item.observationId !== review.detail.observationId)); setReview(null); setNotice(result.code === "replayed" ? "replayed" : "recorded"); return; }
      setNotice(result.code === "conflict" ? "conflict" : result.code === "session_expired" ? "session_expired" : result.code === "forbidden" ? "forbidden" : "unavailable");
    } catch {
      setNotice("unavailable");
    } finally {
      setInFlight(false);
    }
  }, [inFlight, review]);
  return useMemo(() => ({ queue, review, notice, inFlight, refresh, select, decide }), [queue, review, notice, inFlight, refresh, select, decide]);
}
export { MODERATION_REASON_CODES };
