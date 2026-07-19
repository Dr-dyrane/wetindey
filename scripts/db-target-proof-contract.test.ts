import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createDbTargetProof,
  createDbTargetProofHandler,
  DB_TARGET_PROOF_NONCE_HEADER,
  type DbTargetProofDeployment,
} from "../src/lib/security/db-target-proof";

const NOW = new Date("2026-07-19T03:00:00.000Z");
const NOW_SECONDS = Math.floor(NOW.getTime() / 1_000);
const TOKEN_SECRET = Buffer.alloc(32, 7).toString("base64url");
const TOKEN = `v1.${NOW_SECONDS - 30}.${NOW_SECONDS + 600}.${TOKEN_SECRET}`;
const nonce = (offset: number, fill: number) =>
  `v1.${NOW_SECONDS + offset}.${Buffer.alloc(32, fill).toString("base64url")}`;
const NONCE_A = nonce(-5, 11);
const NONCE_B = nonce(-4, 12);
const POOLED =
  "postgresql://proof%5Frole:credential-a@ep-blue-tree-a1b2c3-pooler.us-east-2.aws.neon.tech/wetindey%5Fprod?sslmode=require&channel_binding=require";
const UNPOOLED =
  "postgres://proof_role:credential-b@ep-blue-tree-a1b2c3.us-east-2.aws.neon.tech/wetindey_prod?channel_binding=require&sslmode=require";
const DEPLOYMENT: DbTargetProofDeployment = {
  environment: "production",
  deploymentId: "dpl_1234567890abcdefghijklmnop",
  deploymentUrl: "wetindey-proof-abc.vercel.app",
  commitSha: "a".repeat(40),
};

function proof(connectionString = POOLED, deployment = DEPLOYMENT) {
  return createDbTargetProof({
    connectionString,
    deployment,
    bearerToken: TOKEN,
    callerNonce: NONCE_A,
    now: NOW,
  });
}

function request(options: {
  authorization?: string;
  callerNonce?: string;
  body?: string;
  omitContentLength?: boolean;
} = {}): Request {
  const headers = new Headers();
  if (!options.omitContentLength) {
    headers.set("content-length", options.body === undefined ? "0" : String(Buffer.byteLength(options.body)));
  }
  if (options.authorization) headers.set("authorization", options.authorization);
  if (options.callerNonce) headers.set(DB_TARGET_PROOF_NONCE_HEADER, options.callerNonce);
  return new Request("https://proof.invalid/api/internal/db-target-proof", {
    method: "POST",
    headers,
    body: options.body,
  });
}

const environment = {
  vercelEnvironment: "production",
  databaseUrl: POOLED,
  bearerToken: TOKEN,
  deploymentId: DEPLOYMENT.deploymentId,
  deploymentUrl: DEPLOYMENT.deploymentUrl,
  commitSha: DEPLOYMENT.commitSha,
} as const;

function assertPrivateEmpty(response: Response, status: number): void {
  assert.equal(response.status, status);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store, max-age=0, must-revalidate");
  assert.equal(response.headers.get("Content-Length"), "0");
}

function atomicClaim() {
  const claimed = new Set<string>();
  return async (tokenKey: string): Promise<boolean> => {
    assert.match(tokenKey, /^[0-9a-f]{64}$/);
    if (claimed.has(tokenKey)) return false;
    claimed.add(tokenKey);
    return true;
  };
}

async function main(): Promise<void> {
  const pooledProof = proof();
  const unpooledProof = proof(UNPOOLED);
  assert.deepEqual(unpooledProof, pooledProof);
  assert.deepEqual(Object.keys(pooledProof), [
    "authorityHmac",
    "computeHmac",
    "databaseHmac",
    "principalHmac",
    "optionsHmac",
    "deploymentHmac",
  ]);
  for (const value of Object.values(pooledProof)) assert.match(value, /^[0-9a-f]{64}$/);

  assert.deepEqual(
    proof(POOLED.replace("credential-a", "rotated-credential")),
    pooledProof,
  );
  assert.notEqual(
    proof(POOLED.replace("us-east-2", "eu-west-1")).authorityHmac,
    pooledProof.authorityHmac,
  );
  assert.notEqual(
    proof(POOLED.replace("ep-blue-tree-a1b2c3", "ep-green-river-d4e5f6")).computeHmac,
    pooledProof.computeHmac,
  );
  assert.notEqual(
    proof(POOLED.replace("wetindey%5Fprod", "wetindey%5Fpreview")).databaseHmac,
    pooledProof.databaseHmac,
  );
  assert.notEqual(
    proof(POOLED.replace("proof%5Frole", "migration%5Frole")).principalHmac,
    pooledProof.principalHmac,
  );
  assert.notEqual(
    proof(POOLED.replace("sslmode=require", "sslmode=verify-full")).optionsHmac,
    pooledProof.optionsHmac,
  );
  assert.notEqual(
    proof(POOLED, { ...DEPLOYMENT, deploymentId: "dpl_abcdefghijklmnopqrstuvwxyz1234" })
      .deploymentHmac,
    pooledProof.deploymentHmac,
  );

  for (const connectionString of [
    "https://example.com/database",
    "postgresql://role:secret@db.example.com/database",
    `${POOLED}&password=override`,
    `${POOLED}#fragment`,
  ]) {
    assert.throws(() => proof(connectionString));
  }

  const claimToken = atomicClaim();
  const handler = createDbTargetProofHandler({ claimToken });
  const success = await handler(
    request({ authorization: `Bearer ${TOKEN}`, callerNonce: NONCE_A }),
    environment,
    NOW,
  );
  assert.equal(success.status, 200);
  assert.equal(success.headers.get("Cache-Control"), "private, no-store, max-age=0, must-revalidate");
  assert.deepEqual(await success.json(), pooledProof);

  assertPrivateEmpty(
    await createDbTargetProofHandler({ claimToken })(
      request({ authorization: `Bearer ${TOKEN}`, callerNonce: NONCE_A }),
      environment,
      NOW,
    ),
    429,
  );
  assertPrivateEmpty(
    await createDbTargetProofHandler({ claimToken })(
      request({ authorization: `Bearer ${TOKEN}`, callerNonce: NONCE_B }),
      environment,
      NOW,
    ),
    429,
  );

  let invalidClaimCalls = 0;
  const freshHandler = createDbTargetProofHandler({
    async claimToken() {
      invalidClaimCalls += 1;
      return true;
    },
  });
  for (const [badRequest, badEnvironment, status] of [
    [request(), environment, 401],
    [request({ authorization: "Bearer wrong", callerNonce: NONCE_A }), environment, 401],
    [request({ authorization: `Bearer ${TOKEN}` }), environment, 401],
    [
      request({ authorization: `Bearer ${TOKEN}`, callerNonce: nonce(-61, 14) }),
      environment,
      401,
    ],
    [
      request({ authorization: `Bearer ${TOKEN}`, callerNonce: NONCE_A, body: "ignored" }),
      environment,
      400,
    ],
    [
      request({
        authorization: `Bearer ${TOKEN}`,
        callerNonce: NONCE_A,
        omitContentLength: true,
      }),
      environment,
      400,
    ],
    [
      request({ authorization: `Bearer ${TOKEN}`, callerNonce: NONCE_A }),
      { ...environment, vercelEnvironment: "preview" },
      404,
    ],
    [
      request({ authorization: `Bearer ${TOKEN}`, callerNonce: NONCE_A }),
      { ...environment, databaseUrl: undefined },
      503,
    ],
  ] as const) {
    assertPrivateEmpty(await freshHandler(badRequest, badEnvironment, NOW), status);
  }
  assert.equal(invalidClaimCalls, 0);

  const expiredToken = `v1.${NOW_SECONDS - 700}.${NOW_SECONDS - 100}.${TOKEN_SECRET}`;
  assertPrivateEmpty(
    await freshHandler(
      request({ authorization: `Bearer ${expiredToken}`, callerNonce: NONCE_A }),
      { ...environment, bearerToken: expiredToken },
      NOW,
    ),
    503,
  );
  assert.equal(invalidClaimCalls, 0);

  const failedClaimHandler = createDbTargetProofHandler({
    async claimToken() {
      throw new Error();
    },
  });
  assertPrivateEmpty(
    await failedClaimHandler(
      request({ authorization: `Bearer ${TOKEN}`, callerNonce: NONCE_A }),
      environment,
      NOW,
    ),
    503,
  );

  const routeSource = await readFile(
    new URL("../src/app/api/internal/db-target-proof/route.ts", import.meta.url),
    "utf8",
  );
  const helperSource = await readFile(
    new URL("../src/lib/security/db-target-proof.ts", import.meta.url),
    "utf8",
  );
  assert.match(routeSource, /export async function POST/);
  assert.doesNotMatch(routeSource, /export async function (?:GET|PUT|PATCH|DELETE)/);
  assert.doesNotMatch(`${routeSource}\n${helperSource}`, /console\.|from ["'](?:pg|@\/db|\.\.\/db)/);
  assert.doesNotMatch(`${routeSource}\n${helperSource}`, /request\.(?:json|text|arrayBuffer|formData)\(/);
  assert.match(routeSource, /access: "private"/);
  assert.match(routeSource, /addRandomSuffix: false/);
  assert.match(routeSource, /allowOverwrite: false/);
  assert.match(routeSource, /listBlobs\(/);
  assert.match(routeSource, /blob\.pathname === pathname/);
  assert.doesNotMatch(routeSource, /(?:del|deleteBlob|getBlob)\(/);
  assert.match(helperSource, /hkdfSync\(/);
  assert.match(helperSource, /createHmac\("sha256"/);

  process.stdout.write("db-target-proof-contract: PASS\n");
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "contract failed"}\n`);
  process.exitCode = 1;
});
