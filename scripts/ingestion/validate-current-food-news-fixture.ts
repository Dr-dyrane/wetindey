import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { NBS_CANDIDATES, NBS_ORIGIN_LABEL, NBS_PACKAGE_SHA256, NBS_PACKAGE_URL } from "./adapters/nbs-selected-food-price-watch";

type DevelopmentFixture = {
  fixtureVersion: string;
  environment: string;
  publicationMode: string;
  fixtureDate: string;
  items: Array<{
    sourceType: string;
    sourceCategory: string;
    sourceName: string;
    canonicalUrl: string;
    contentHash: string;
    rawContentPointer: string;
    originLabel: string;
    geographicPrecision: string;
    rawGeographicScope: string;
    rawSurveyPeriod: string;
    surveyPeriodStart: string;
    surveyPeriodEnd: string;
    rawPublishedDate: string;
    publishedAt: string;
    observedAt: null;
    fetchedAt: string;
    availability: string;
    reviewStatus: string;
    candidateArtifactIds: string[];
  }>;
  effectFirewall: Record<string, boolean | number>;
};

function containsSample(value: unknown): boolean {
  if (typeof value === "string") return /sample/i.test(value);
  if (Array.isArray(value)) return value.some(containsSample);
  if (value !== null && typeof value === "object") return Object.values(value).some(containsSample);
  return false;
}

async function main(): Promise<void> {
  const fixturePath = resolve(
    process.cwd(),
    process.argv[2] ?? "data/development-fixtures/current-food-news/2026-07-18.provenance.json"
  );
  const fixture = JSON.parse(await readFile(fixturePath, "utf8")) as DevelopmentFixture;
  const candidateArtifactIds = NBS_CANDIDATES.map((candidate) => candidate.candidateArtifactId);

  if (
    fixture.fixtureVersion !== "current-food-news-provenance-v1" ||
    fixture.environment !== "development_only" ||
    fixture.publicationMode !== "review_only" ||
    fixture.fixtureDate !== "2026-07-18" ||
    fixture.items.length !== 1
  ) {
    throw new Error("Development fixture identity is incomplete");
  }
  const [item] = fixture.items;
  if (
    item.sourceType !== "public_source" ||
    item.sourceCategory !== "government_official" ||
    item.sourceName !== "National Bureau of Statistics — Selected Food Price Watch" ||
    item.canonicalUrl !== NBS_PACKAGE_URL ||
    item.rawContentPointer !== NBS_PACKAGE_URL ||
    item.contentHash !== NBS_PACKAGE_SHA256 ||
    item.originLabel !== NBS_ORIGIN_LABEL ||
    item.geographicPrecision !== "lagos_state" ||
    item.rawGeographicScope !== "Lagos" ||
    item.rawSurveyPeriod !== "May 2026" ||
    item.surveyPeriodStart !== "2026-05-01T00:00:00.000Z" ||
    item.surveyPeriodEnd !== "2026-05-31T23:59:59.999Z" ||
    item.rawPublishedDate !== "2026-06-25" ||
    item.publishedAt !== "2026-06-25T00:00:00.000Z" ||
    item.observedAt !== null ||
    item.fetchedAt !== "2026-07-18T00:42:43.000Z" ||
    item.availability !== "unknown" ||
    item.reviewStatus !== "pending_manual_review" ||
    JSON.stringify(item.candidateArtifactIds) !== JSON.stringify(candidateArtifactIds)
  ) {
    throw new Error("Development fixture misstates NBS provenance or current-state facts");
  }
  if (
    containsSample(fixture) ||
    Object.values(fixture.effectFirewall).some((value) => value !== 0 && value !== false)
  ) {
    throw new Error("Development fixture violates the Sample or publication firewall");
  }

  process.stdout.write("current-food-news provenance fixture validated\n");
}

void main();
