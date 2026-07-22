"use client";

import type { ModerationQueueItem } from "@/lib/contributions/moderation-runtime";
import { type ModerationNotice, useModerationConsole } from "./hooks/useModerationConsole";
import { ModerationConsoleView } from "./views/ModerationConsoleView";

export function ModerationConsole({ initialQueue, initialNotice }: { initialQueue: ModerationQueueItem[]; initialNotice?: ModerationNotice }) {
  return <ModerationConsoleView {...useModerationConsole(initialQueue, initialNotice)} />;
}
