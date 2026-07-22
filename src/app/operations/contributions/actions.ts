"use server";

import { type ModerationCommand, loadModerationQueue, loadModerationReview, moderateContribution } from "@/lib/contributions/moderation-runtime";

export async function readModerationQueue() { return loadModerationQueue(); }
export async function readModerationReview(observationId: string) { return loadModerationReview(observationId); }
export async function submitModerationCommand(command: ModerationCommand) { return moderateContribution(command); }
