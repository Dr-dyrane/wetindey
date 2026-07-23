import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const binSuffix = process.platform === "win32" ? ".cmd" : "";
const stageEnvironment = Object.freeze({
  CI: process.env.CI ?? "",
  HOME: process.env.HOME ?? repoRoot,
  LANG: "C",
  LC_ALL: "C",
  PATH: process.env.PATH ?? "",
  TZ: "UTC",
});

function localBin(name) {
  return resolve(repoRoot, "node_modules", ".bin", `${name}${binSuffix}`);
}

function nodeScript(path) {
  return { command: process.execPath, args: [path], files: [path] };
}

function tsxScript(path) {
  return { command: localBin("tsx"), args: [path], files: [path] };
}

const stages = Object.freeze({
  static: Object.freeze([
    { label: "token audit", ...nodeScript("scripts/audit-tokens.mjs") },
    {
      label: "agri pillar foundation P1 contract",
      ...tsxScript("scripts/catalog/agri-catalog-foundation-p1-contract.test.ts"),
    },
    { label: "auth email contracts", ...tsxScript("scripts/auth-email-contracts.test.ts") },
    {
      label: "contribution action contracts",
      ...tsxScript("scripts/contributions/contribution-actions-contract.test.ts"),
      ...tsxScript("scripts/actions/server-action-hardening-contract.test.ts"),
    },
    {
      label: "contribution evidence media P1 contract",
      ...tsxScript("scripts/contributions/contribution-evidence-media-p1-contract.test.ts"),
    },
    { label: "CSP policy contracts", ...tsxScript("scripts/csp-policy-contracts.test.ts") },
    { label: "CSP report contracts", ...tsxScript("scripts/csp-report-contracts.test.ts") },
    {
      label: "deletion saga P1 contract",
      ...tsxScript("scripts/deletion/deletion-saga-p1-contract.test.ts"),
    },
    { label: "iconography contracts", ...tsxScript("scripts/iconography-contracts.test.ts") },
    { label: "ingestion contracts", ...tsxScript("scripts/ingestion/ingestion-contract.test.ts") },
    { label: "live sheet inset contract", ...tsxScript("scripts/live-sheet-inset-contract.test.ts") },
    { label: "location default contract", ...tsxScript("scripts/location-default-contract.test.ts") },
    {
      label: "presence retention contract",
      ...tsxScript("scripts/presence/presence-retention-cleanup-contract.test.ts"),
    },
    {
      label: "release verification Q1 contract",
      ...tsxScript("scripts/release-verification-q1-contract.test.ts"),
    },
  ]),
  typecheck: Object.freeze([
    { label: "TypeScript", command: localBin("tsc"), args: ["--noEmit"], files: [] },
  ]),
  dependencies: Object.freeze([
    { label: "Knip", command: localBin("knip"), args: [], files: [] },
  ]),
});

function usage() {
  console.error("Usage: node scripts/quality/run-stage.mjs <stage>");
  console.error(`Stages: ${Object.keys(stages).join(", ")}`);
}

function validateStage(stageName) {
  const commands = stages[stageName];
  if (!commands) {
    usage();
    process.exitCode = 2;
    return null;
  }

  for (const command of commands) {
    if (!existsSync(command.command)) {
      throw new Error(`Required executable is missing: ${command.command}`);
    }
    for (const file of command.files) {
      const absolutePath = resolve(repoRoot, file);
      if (!existsSync(absolutePath)) {
        throw new Error(`Required stage file is missing: ${file}`);
      }
    }
  }
  return commands;
}

const stageName = process.argv[2];
if (stageName === "--help" || stageName === "-h" || stageName === undefined) {
  usage();
  process.exitCode = stageName === undefined ? 2 : 0;
} else if (stageName === "--list") {
  console.log(Object.keys(stages).join("\n"));
} else {
  try {
    const commands = validateStage(stageName);
    if (commands) {
      console.log(`[quality] ${stageName}: ${commands.length} command(s)`);
      for (const command of commands) {
        console.log(`[quality] RUN ${command.label}`);
        const result = spawnSync(command.command, command.args, {
          cwd: repoRoot,
          env: stageEnvironment,
          shell: false,
          stdio: "inherit",
        });
        if (result.error) {
          throw result.error;
        }
        if (result.status !== 0) {
          const code = result.status ?? 1;
          throw new Error(`${command.label} failed with exit code ${code}`);
        }
      }
      console.log(`[quality] ${stageName}: PASS`);
    }
  } catch (error) {
    console.error(`[quality] ${stageName}: REFUTED`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
