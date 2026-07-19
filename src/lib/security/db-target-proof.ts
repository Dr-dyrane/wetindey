import {
  createHash,
  createHmac,
  hkdfSync,
  timingSafeEqual,
} from "node:crypto";

export const DB_TARGET_PROOF_TOKEN_ENV = "DB_TARGET_PROOF_TOKEN_V1";
export const DB_TARGET_PROOF_NONCE_HEADER = "x-db-target-proof-nonce";
export const DB_TARGET_PROOF_BODY_EOF_TIMEOUT_MS = 250;

const PROTOCOL = "wetindey/db-target-proof/v1";
const TOKEN_LIFETIME_SECONDS = 15 * 60;
const NONCE_LIFETIME_SECONDS = 60;
const CLOCK_SKEW_SECONDS = 5;
const BASE64URL_256_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const TOKEN_PATTERN = /^v1\.([1-9][0-9]{9})\.([1-9][0-9]{9})\.([A-Za-z0-9_-]{43})$/;
const NONCE_PATTERN = /^v1\.([1-9][0-9]{9})\.([A-Za-z0-9_-]{43})$/;
const DEPLOYMENT_ID_PATTERN = /^dpl_[A-Za-z0-9]{20,}$/;
const COMMIT_PATTERN = /^[0-9a-f]{40}$/;
const FORBIDDEN_OPTION_KEYS = new Set([
  "database",
  "dbname",
  "host",
  "hostaddr",
  "passfile",
  "password",
  "port",
  "service",
  "servicefile",
  "user",
  "username",
]);

export type DbTargetProof = Readonly<{
  authorityHmac: string;
  computeHmac: string;
  databaseHmac: string;
  principalHmac: string;
  optionsHmac: string;
  deploymentHmac: string;
}>;

export type DbTargetProofDeployment = Readonly<{
  environment: string | undefined;
  deploymentId: string | undefined;
  deploymentUrl: string | undefined;
  commitSha: string | undefined;
}>;

export type DbTargetProofEnvironment = Readonly<{
  vercelEnvironment: string | undefined;
  databaseUrl: string | undefined;
  bearerToken: string | undefined;
  deploymentId: string | undefined;
  deploymentUrl: string | undefined;
  commitSha: string | undefined;
}>;

type NormalizedDatabaseTarget = Readonly<{
  authority: string;
  compute: string;
  database: string;
  principal: string;
  options: string;
}>;

type ParsedToken = Readonly<{
  issuedAt: number;
  expiresAt: number;
  secret: Buffer;
}>;

type ParsedNonce = Readonly<{
  issuedAt: number;
  random: Buffer;
  canonical: string;
}>;

export type ClaimDbTargetProofToken = (tokenKey: string) => Promise<boolean>;

class ProofConfigurationError extends Error {}

function required(value: string | undefined): string {
  const normalized = value?.trim();
  if (!normalized) throw new ProofConfigurationError();
  return normalized;
}

function decodeIdentityComponent(value: string): string {
  let decoded: string;
  try {
    decoded = decodeURIComponent(value).normalize("NFC");
  } catch {
    throw new ProofConfigurationError();
  }
  if (!decoded || /[\u0000-\u001f\u007f]/.test(decoded)) {
    throw new ProofConfigurationError();
  }
  return decoded;
}

function decodeBase64url256(value: string): Buffer {
  if (!BASE64URL_256_PATTERN.test(value)) throw new ProofConfigurationError();
  const decoded = Buffer.from(value, "base64url");
  if (decoded.byteLength !== 32) throw new ProofConfigurationError();
  return decoded;
}

function parseToken(value: string, nowSeconds: number): ParsedToken {
  const match = TOKEN_PATTERN.exec(value);
  if (!match) throw new ProofConfigurationError();
  const issuedAt = Number(match[1]);
  const expiresAt = Number(match[2]);
  if (
    !Number.isSafeInteger(issuedAt) ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= issuedAt ||
    expiresAt - issuedAt > TOKEN_LIFETIME_SECONDS ||
    issuedAt > nowSeconds + CLOCK_SKEW_SECONDS ||
    expiresAt <= nowSeconds
  ) {
    throw new ProofConfigurationError();
  }
  return {
    issuedAt,
    expiresAt,
    secret: decodeBase64url256(match[3]),
  };
}

function parseNonce(value: string, token: ParsedToken, nowSeconds: number): ParsedNonce {
  const match = NONCE_PATTERN.exec(value);
  if (!match) throw new ProofConfigurationError();
  const issuedAt = Number(match[1]);
  if (
    !Number.isSafeInteger(issuedAt) ||
    issuedAt < token.issuedAt - CLOCK_SKEW_SECONDS ||
    issuedAt > nowSeconds + CLOCK_SKEW_SECONDS ||
    nowSeconds - issuedAt > NONCE_LIFETIME_SECONDS ||
    issuedAt >= token.expiresAt
  ) {
    throw new ProofConfigurationError();
  }
  return {
    issuedAt,
    random: decodeBase64url256(match[2]),
    canonical: value,
  };
}

function normalizedPort(value: string): string {
  if (!value) return "5432";
  if (!/^[0-9]{1,5}$/.test(value)) throw new ProofConfigurationError();
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new ProofConfigurationError();
  }
  return String(port);
}

function compareCanonicalText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function normalizeDatabaseTarget(connectionString: string): NormalizedDatabaseTarget {
  let parsed: URL;
  try {
    parsed = new URL(required(connectionString));
  } catch {
    throw new ProofConfigurationError();
  }

  if (
    (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") ||
    parsed.hash ||
    !parsed.username ||
    !parsed.password
  ) {
    throw new ProofConfigurationError();
  }

  const hostname = parsed.hostname.toLowerCase().replace(/[.]$/, "");
  const labels = hostname.split(".");
  const rawCompute = labels[0] ?? "";
  const compute = rawCompute.replace(/-pooler$/, "");
  const authorityHost = labels.slice(1).join(".");
  if (
    labels.length < 5 ||
    !/^ep-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(compute) ||
    !/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.neon\.tech$/.test(authorityHost)
  ) {
    throw new ProofConfigurationError();
  }

  const databasePath = parsed.pathname.startsWith("/") ? parsed.pathname.slice(1) : "";
  const database = decodeIdentityComponent(databasePath);
  const principal = decodeIdentityComponent(parsed.username);
  if (database.includes("/")) throw new ProofConfigurationError();

  const options = [...parsed.searchParams.entries()].map(([rawKey, rawValue]) => {
    const key = rawKey.normalize("NFC").toLowerCase();
    const value = rawValue.normalize("NFC");
    if (
      !key ||
      FORBIDDEN_OPTION_KEYS.has(key) ||
      /[\u0000-\u001f\u007f]/.test(key) ||
      /[\u0000-\u001f\u007f]/.test(value)
    ) {
      throw new ProofConfigurationError();
    }
    return [key, value] as const;
  });
  options.sort(([leftKey, leftValue], [rightKey, rightValue]) =>
    leftKey === rightKey
      ? compareCanonicalText(leftValue, rightValue)
      : compareCanonicalText(leftKey, rightKey),
  );

  return {
    authority: `postgresql://${authorityHost}:${normalizedPort(parsed.port)}`,
    compute,
    database,
    principal,
    options: JSON.stringify(options),
  };
}

function normalizeDeployment(deployment: DbTargetProofDeployment): string {
  if (deployment.environment !== "production") throw new ProofConfigurationError();
  const deploymentId = required(deployment.deploymentId);
  if (!DEPLOYMENT_ID_PATTERN.test(deploymentId)) throw new ProofConfigurationError();

  const rawUrl = required(deployment.deploymentUrl);
  let url: URL;
  try {
    url = new URL(rawUrl.includes("://") ? rawUrl : `https://${rawUrl}`);
  } catch {
    throw new ProofConfigurationError();
  }
  const deploymentHost = url.hostname.toLowerCase().replace(/[.]$/, "");
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    (url.pathname !== "/" && url.pathname !== "") ||
    url.search ||
    url.hash ||
    !/^[a-z0-9-]+\.vercel\.app$/.test(deploymentHost)
  ) {
    throw new ProofConfigurationError();
  }

  const commitSha = deployment.commitSha?.trim().toLowerCase() || "absent";
  if (commitSha !== "absent" && !COMMIT_PATTERN.test(commitSha)) {
    throw new ProofConfigurationError();
  }
  return JSON.stringify({
    environment: "production",
    deploymentId,
    deploymentHost,
    commitSha,
  });
}

function deriveKey(token: ParsedToken, nonce: ParsedNonce): Buffer {
  const salt = createHash("sha256").update(nonce.canonical, "utf8").digest();
  return Buffer.from(
    hkdfSync(
      "sha256",
      token.secret,
      salt,
      Buffer.from(`${PROTOCOL}/hmac-key`, "utf8"),
      32,
    ),
  );
}

function digest(key: Buffer, field: keyof DbTargetProof, value: string): string {
  return createHmac("sha256", key)
    .update(PROTOCOL, "utf8")
    .update("\0", "utf8")
    .update(field, "utf8")
    .update("\0", "utf8")
    .update(value, "utf8")
    .digest("hex");
}

export function createDbTargetProof(input: {
  connectionString: string;
  deployment: DbTargetProofDeployment;
  bearerToken: string;
  callerNonce: string;
  now: Date;
}): DbTargetProof {
  const nowSeconds = Math.floor(input.now.getTime() / 1_000);
  if (!Number.isSafeInteger(nowSeconds)) throw new ProofConfigurationError();
  const token = parseToken(required(input.bearerToken), nowSeconds);
  const nonce = parseNonce(required(input.callerNonce), token, nowSeconds);
  const target = normalizeDatabaseTarget(input.connectionString);
  const deployment = normalizeDeployment(input.deployment);
  const key = deriveKey(token, nonce);
  return Object.freeze({
    authorityHmac: digest(key, "authorityHmac", target.authority),
    computeHmac: digest(key, "computeHmac", target.compute),
    databaseHmac: digest(key, "databaseHmac", target.database),
    principalHmac: digest(key, "principalHmac", target.principal),
    optionsHmac: digest(key, "optionsHmac", target.options),
    deploymentHmac: digest(key, "deploymentHmac", deployment),
  });
}

function emptyResponse(status: number): Response {
  return new Response(null, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      "Content-Length": "0",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function proofResponse(proof: DbTargetProof): Response {
  return new Response(JSON.stringify(proof), {
    status: 200,
    headers: {
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      "Content-Type": "application/json; charset=utf-8",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function authorized(authorization: string | null, configuredToken: string): boolean {
  if (!authorization?.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(authorization.slice("Bearer ".length), "utf8");
  const expected = Buffer.from(configuredToken, "utf8");
  return supplied.byteLength === expected.byteLength && timingSafeEqual(supplied, expected);
}

type BodyVerification = "empty" | "present" | "unavailable";

function cancelBodyReader(reader: ReadableStreamDefaultReader<Uint8Array>): void {
  try {
    void reader.cancel().catch(() => undefined);
  } catch {
    // Cancellation is best-effort; the request still fails closed.
  }
}

async function verifyBodyIsEmpty(request: Request): Promise<BodyVerification> {
  if (request.body === null) return "empty";

  let reader: ReadableStreamDefaultReader<Uint8Array>;
  try {
    reader = request.body.getReader();
  } catch {
    return "unavailable";
  }

  type ReadOutcome =
    | { kind: "read"; result: ReadableStreamReadResult<Uint8Array> }
    | { kind: "read-error" }
    | { kind: "timeout" };
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const outcome = await Promise.race<ReadOutcome>([
    reader.read().then(
      (result) => ({ kind: "read", result }),
      () => ({ kind: "read-error" }),
    ),
    new Promise<ReadOutcome>((resolve) => {
      timeout = setTimeout(
        () => resolve({ kind: "timeout" }),
        DB_TARGET_PROOF_BODY_EOF_TIMEOUT_MS,
      );
    }),
  ]);
  if (timeout !== undefined) clearTimeout(timeout);

  if (outcome.kind !== "read") {
    cancelBodyReader(reader);
    return "unavailable";
  }
  if (!outcome.result.done) {
    cancelBodyReader(reader);
    return "present";
  }
  try {
    reader.releaseLock();
  } catch {
    cancelBodyReader(reader);
    return "unavailable";
  }
  return "empty";
}

export function createDbTargetProofHandler(options: {
  claimToken: ClaimDbTargetProofToken;
}): (
  request: Request,
  environment: DbTargetProofEnvironment,
  now?: Date,
) => Promise<Response> {
  return async (request, environment, now = new Date()) => {
    if (environment.vercelEnvironment !== "production") return emptyResponse(404);
    if (request.method !== "POST") return emptyResponse(405);
    const contentLength = request.headers.get("content-length");
    if (contentLength !== null && contentLength !== "0") return emptyResponse(400);
    if (request.headers.has("transfer-encoding")) return emptyResponse(400);

    const nowSeconds = Math.floor(now.getTime() / 1_000);
    let configuredToken: string;
    let parsedToken: ParsedToken;
    try {
      configuredToken = required(environment.bearerToken);
      parsedToken = parseToken(configuredToken, nowSeconds);
    } catch {
      return emptyResponse(503);
    }
    if (!authorized(request.headers.get("authorization"), configuredToken)) {
      return emptyResponse(401);
    }

    const callerNonce = request.headers.get(DB_TARGET_PROOF_NONCE_HEADER);
    let parsedNonce: ParsedNonce;
    try {
      parsedNonce = parseNonce(required(callerNonce ?? undefined), parsedToken, nowSeconds);
    } catch {
      return emptyResponse(401);
    }

    const bodyVerification = await verifyBodyIsEmpty(request);
    if (bodyVerification === "present") return emptyResponse(400);
    if (bodyVerification === "unavailable") return emptyResponse(503);

    const tokenKey = createHash("sha256").update(configuredToken, "utf8").digest("hex");
    let proof: DbTargetProof;
    try {
      proof = createDbTargetProof({
        connectionString: required(environment.databaseUrl),
        deployment: {
          environment: environment.vercelEnvironment,
          deploymentId: environment.deploymentId,
          deploymentUrl: environment.deploymentUrl,
          commitSha: environment.commitSha,
        },
        bearerToken: configuredToken,
        callerNonce: parsedNonce.canonical,
        now,
      });
    } catch {
      return emptyResponse(503);
    }

    try {
      if (!(await options.claimToken(tokenKey))) return emptyResponse(429);
    } catch {
      return emptyResponse(503);
    }
    return proofResponse(proof);
  };
}
