import type { Metadata } from "next";
import { readModerationQueue } from "./actions";
import { ModerationConsole } from "./_components/ModerationConsole";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const metadata: Metadata = { title: "Operations", robots: { index: false, follow: false, nocache: true } };

export default async function ContributionOperationsPage() {
  const initialQueue = await readModerationQueue();
  if (initialQueue.code === "ready") return <ModerationConsole initialQueue={initialQueue.value} />;
  return <ModerationConsole initialQueue={[]} initialNotice={initialQueue.code} />;
}
