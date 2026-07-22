"use client";

import type { ModerationDecision, ModerationQueueItem } from "@/lib/contributions/moderation-contract";
import { moderationCopy } from "../copy/copy";
import { type ModerationNotice, MODERATION_REASON_CODES } from "../hooks/useModerationConsole";

type Model = {
  queue: ModerationQueueItem[];
  review: { detail: { itemLabel: string; variantLabel: string | null; unitLabel: string; placeLabel: string; availabilityState: "available" | "unavailable"; priceAmountKobo: number | null; observedAt: string; submittedAt: string; hasDecisionHistory: boolean; reopenedAfterReversal: boolean; canReverse: boolean }; audit: { action: string; actor: string; reasonCode: string | null; createdAt: string }[] } | null;
  notice: ModerationNotice;
  inFlight: boolean;
  refresh(): void;
  select(observationId: string): void;
  decide(decision: ModerationDecision, reasonCode: (typeof MODERATION_REASON_CODES)[ModerationDecision][number]): void;
};
function formatNaira(kobo: number | null) { return kobo === null ? moderationCopy.noPrice : new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(kobo / 100); }
function noticeCopy(notice: Model["notice"]) {
  const messages: Partial<Record<Model["notice"], string>> = { loading: moderationCopy.loading, unavailable: moderationCopy.unavailable, session_expired: moderationCopy.sessionExpired, forbidden: moderationCopy.forbidden, conflict: moderationCopy.conflict, recorded: moderationCopy.recorded, replayed: moderationCopy.replayed };
  return messages[notice] ?? null;
}

export function ModerationConsoleView(model: Model) {
  const notice = noticeCopy(model.notice); const detail = model.review?.detail;
  const reviewState = detail?.reopenedAfterReversal ? moderationCopy.reopened : detail?.hasDecisionHistory ? moderationCopy.historyOnRecord : moderationCopy.firstReview;
  return <main className="mx-auto min-h-screen max-w-5xl bg-background px-4 py-8 text-text-primary sm:px-6">
    <header className="mb-6 flex items-center justify-between gap-4"><div><p className="text-caption-1 text-text-secondary">Operations</p><h1 className="text-title-1 font-semibold tracking-tight">{moderationCopy.title}</h1></div><button type="button" onClick={model.refresh} disabled={model.inFlight} className="min-h-tap rounded-[16px] bg-fill-secondary px-4 text-body font-medium transition active:scale-[0.98] disabled:opacity-50">{model.notice === "loading" ? moderationCopy.refreshing : moderationCopy.retry}</button></header>
    {notice ? <p role="status" className="mb-4 text-body text-text-secondary">{notice}</p> : null}
    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      <section aria-labelledby="moderation-queue" className="rounded-[28px] bg-fill-secondary p-4"><h2 id="moderation-queue" className="mb-3 text-headline font-semibold">{moderationCopy.queue}</h2>{model.queue.length === 0 ? <p className="py-8 text-body text-text-secondary">{moderationCopy.empty}</p> : <ul className="space-y-2">{model.queue.map((item) => <li key={item.observationId}><button type="button" onClick={() => model.select(item.observationId)} disabled={model.inFlight} className="w-full rounded-[20px] bg-background px-4 py-3 text-left transition active:scale-[0.99] disabled:opacity-50"><span className="block text-body font-medium">{item.availabilityState === "available" ? moderationCopy.available : moderationCopy.notAvailable}</span><span className="block text-footnote text-text-secondary">{formatNaira(item.priceAmountKobo)} · {new Date(item.submittedAt).toLocaleString()}</span></button></li>)}</ul>}</section>
      <section aria-labelledby="moderation-detail" className="rounded-[28px] bg-fill-secondary p-5"><h2 id="moderation-detail" className="mb-4 text-headline font-semibold">{moderationCopy.details}</h2>{!detail ? <p className="py-8 text-body text-text-secondary">{moderationCopy.missingDetail}</p> : <div className="space-y-5"><div><p className="text-title-3 font-semibold">{detail.itemLabel}</p><p className="text-body text-text-secondary">{[detail.variantLabel, detail.unitLabel, detail.placeLabel].filter(Boolean).join(" · ")}</p><p className="mt-1 text-footnote text-text-secondary">{reviewState}</p></div><div className="grid gap-2 text-body sm:grid-cols-2"><p><span className="text-text-secondary">Claim</span><br />{detail.availabilityState === "available" ? moderationCopy.available : moderationCopy.notAvailable}</p><p><span className="text-text-secondary">Price</span><br />{formatNaira(detail.priceAmountKobo)}</p><p><span className="text-text-secondary">Observed</span><br />{new Date(detail.observedAt).toLocaleString()}</p><p><span className="text-text-secondary">Submitted</span><br />{new Date(detail.submittedAt).toLocaleString()}</p></div><div className="flex flex-wrap gap-2">{(["approve", "reject", "reverse"] as const).flatMap((decision) => MODERATION_REASON_CODES[decision].map((reasonCode) => <button key={`${decision}-${reasonCode}`} type="button" disabled={model.inFlight || (decision === "reverse" && !detail.canReverse)} onClick={() => model.decide(decision, reasonCode)} className="min-h-tap rounded-[16px] bg-background px-3 text-footnote font-medium transition active:scale-[0.98] disabled:opacity-40">{decision === "approve" ? moderationCopy.approve : decision === "reject" ? moderationCopy.reject : moderationCopy.reverse}: {reasonCode.replaceAll("_", " ")}</button>))}</div><div><h3 className="mb-2 text-body font-semibold">{moderationCopy.history}</h3><ol className="space-y-2 text-footnote text-text-secondary">{model.review?.audit.map((entry) => <li key={`${entry.createdAt}-${entry.action}`}>{entry.action.replaceAll("_", " ")} · {entry.actor} · {new Date(entry.createdAt).toLocaleString()}{entry.reasonCode ? ` · ${entry.reasonCode.replaceAll("_", " ")}` : ""}</li>)}</ol></div></div>}</section>
    </div>
  </main>;
}
