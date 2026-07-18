import assert from "node:assert/strict";
import {
  generateKeyPairSync,
  randomUUID,
  sign,
  type KeyObject,
} from "node:crypto";

import {
  AuthEmailConfigurationError,
  AuthEmailDeliveryError,
  NeonWebhookKeyUnavailableError,
  NeonWebhookVerificationError,
  WETINDEY_OTP_EMAIL_SUBJECT,
  handleNeonOtpWebhookRequest,
  renderWetinDeyOtpEmail,
  sendWetinDeyOtpEmail,
  verifyNeonOtpWebhook,
  type VerifiedNeonOtpWebhook,
} from "../src/lib/auth-email";

const eventId = "550e8400-e29b-41d4-a716-446655440000";
const kid = "wetindey-contract-key";
const eventTimestamp = "2026-07-18T18:00:00.000Z";
const expiresAt = "2026-07-18T18:10:00.000Z";
const issuedAtMs = Date.parse(eventTimestamp);
const webhookTimestamp = issuedAtMs.toString();

const basePayload = {
  event_id: eventId,
  event_type: "send.otp",
  timestamp: eventTimestamp,
  context: {
    endpoint_id: "ep-contract",
    project_name: "WetinDey",
  },
  user: {
    id: "test-user",
    email: "person@example.com",
  },
  event_data: {
    otp_code: "123456",
    otp_type: "sign-in",
    expires_at: expiresAt,
    delivery_preference: "email",
  },
};

const { privateKey, publicKey } = generateKeyPairSync("ed25519");

interface HeaderOverrides {
  alg?: string;
  protectedKid?: string;
  headerKid?: string;
  timestamp?: string;
  eventType?: string;
  eventId?: string;
  attempt?: string;
}

function signedHeaders(
  rawBody: string | Uint8Array,
  overrides: HeaderOverrides = {},
): Headers {
  const timestamp = overrides.timestamp ?? webhookTimestamp;
  const protectedHeader = Buffer.from(
    JSON.stringify({
      alg: overrides.alg ?? "EdDSA",
      kid: overrides.protectedKid ?? kid,
      typ: "JWS",
    }),
    "utf8",
  ).toString("base64url");
  const payloadB64 = Buffer.from(rawBody).toString("base64url");
  const signaturePayload = `${timestamp}.${payloadB64}`;
  const signaturePayloadB64 = Buffer.from(
    signaturePayload,
    "utf8",
  ).toString("base64url");
  const signingInput = `${protectedHeader}.${signaturePayloadB64}`;
  const signature = sign(
    null,
    Buffer.from(signingInput, "utf8"),
    privateKey,
  ).toString("base64url");

  return new Headers({
    "content-type": "application/json",
    "x-neon-signature": `${protectedHeader}..${signature}`,
    "x-neon-signature-kid": overrides.headerKid ?? kid,
    "x-neon-timestamp": timestamp,
    "x-neon-event-type": overrides.eventType ?? "send.otp",
    "x-neon-event-id": overrides.eventId ?? eventId,
    "x-neon-delivery-attempt": overrides.attempt ?? "1",
  });
}

function verify(
  rawBody: string,
  headers = signedHeaders(rawBody),
  now = issuedAtMs + 1_000,
): Promise<VerifiedNeonOtpWebhook> {
  return verifyNeonOtpWebhook(new TextEncoder().encode(rawBody), headers, {
    now: () => now,
    resolvePublicKey: async (_kid: string): Promise<KeyObject> =>
      publicKey,
  });
}

async function main(): Promise<void> {
  const rawBody = JSON.stringify(basePayload);
  const verified = await verify(rawBody);

  assert.deepEqual(verified, {
    eventId,
    eventTimestamp,
    recipientEmail: "person@example.com",
    otpCode: "123456",
    otpType: "sign-in",
    expiresAt,
    deliveryPreference: "email",
  });

  const originalFetch = globalThis.fetch;
  const originalDateNow = Date.now;
  const originalAuthBaseUrl = process.env.NEON_AUTH_BASE_URL;
  let jwksFetchCount = 0;
  let jwksNow = issuedAtMs + 1_000;
  let failJwksFetch = true;

  globalThis.fetch = async () => {
    jwksFetchCount += 1;
    if (failJwksFetch) {
      throw new Error("simulated JWKS outage");
    }

    return new Response(
      JSON.stringify({
        keys: [
          {
            ...publicKey.export({ format: "jwk" }),
            alg: "EdDSA",
            kid,
            use: "sig",
          },
        ],
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  };
  Date.now = () => jwksNow;
  process.env.NEON_AUTH_BASE_URL =
    "https://ep-contract.neonauth.us-east-1.aws.neon.tech/neondb/auth";

  try {
    const encodedBody = new TextEncoder().encode(rawBody);

    await assert.rejects(
      verifyNeonOtpWebhook(encodedBody, signedHeaders(rawBody), {
        now: () => issuedAtMs + 1_000,
      }),
      NeonWebhookKeyUnavailableError,
    );
    await assert.rejects(
      verifyNeonOtpWebhook(encodedBody, signedHeaders(rawBody), {
        now: () => issuedAtMs + 1_000,
      }),
      NeonWebhookKeyUnavailableError,
    );
    assert.equal(jwksFetchCount, 1);

    jwksNow += 10_001;
    failJwksFetch = false;
    await verifyNeonOtpWebhook(encodedBody, signedHeaders(rawBody), {
      now: () => issuedAtMs + 1_000,
    });
    assert.equal(jwksFetchCount, 2);

    jwksNow += 10_001;
    const unknownKid = "unknown-contract-key";
    const unknownKidHeaders = signedHeaders(rawBody, {
      headerKid: unknownKid,
      protectedKid: unknownKid,
    });
    await assert.rejects(
      verifyNeonOtpWebhook(encodedBody, unknownKidHeaders, {
        now: () => issuedAtMs + 1_000,
      }),
      NeonWebhookVerificationError,
    );
    await assert.rejects(
      verifyNeonOtpWebhook(encodedBody, unknownKidHeaders, {
        now: () => issuedAtMs + 1_000,
      }),
      NeonWebhookVerificationError,
    );
    assert.equal(jwksFetchCount, 3);
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalDateNow;
    if (originalAuthBaseUrl === undefined) {
      delete process.env.NEON_AUTH_BASE_URL;
    } else {
      process.env.NEON_AUTH_BASE_URL = originalAuthBaseUrl;
    }
  }

  const malformedUtf8 = new Uint8Array([0xff]);
  await assert.rejects(
    verifyNeonOtpWebhook(
      malformedUtf8,
      signedHeaders(malformedUtf8),
      {
        now: () => issuedAtMs + 1_000,
        resolvePublicKey: async () => publicKey,
      },
    ),
    /valid UTF-8/,
  );

  await assert.rejects(
    verify(
      rawBody.replace("123456", "654321"),
      signedHeaders(rawBody),
    ),
    /Invalid webhook signature/,
  );
  await assert.rejects(
    verify(
      rawBody,
      signedHeaders(rawBody),
      issuedAtMs + 6 * 60 * 1000,
    ),
    /outside the accepted window/,
  );
  await assert.rejects(
    verify(rawBody, signedHeaders(rawBody, { alg: "HS256" })),
    /signature header did not match/,
  );
  await assert.rejects(
    verify(
      rawBody,
      signedHeaders(rawBody, { headerKid: "wrong-key" }),
    ),
    /signature header did not match/,
  );
  await assert.rejects(
    verify(
      rawBody,
      signedHeaders(rawBody, {
        eventId: "6ba7b810-9dad-41d1-80b4-00c04fd430c8",
      }),
    ),
    /Invalid webhook event ID/,
  );
  await assert.rejects(
    verify(
      rawBody,
      signedHeaders(rawBody, { eventType: "user.created" }),
    ),
    /Unsupported webhook event type/,
  );
  await assert.rejects(
    verify(rawBody, signedHeaders(rawBody, { attempt: "4" })),
    /delivery metadata/,
  );

  const invalidOtpBody = JSON.stringify({
    ...basePayload,
    event_data: { ...basePayload.event_data, otp_code: "12AB56" },
  });
  await assert.rejects(verify(invalidOtpBody), /Invalid webhook OTP code/);

  const expiredBody = JSON.stringify({
    ...basePayload,
    event_data: {
      ...basePayload.event_data,
      expires_at: "2026-07-18T18:00:30.000Z",
    },
  });
  await assert.rejects(
    verify(
      expiredBody,
      signedHeaders(expiredBody),
      issuedAtMs + 60_000,
    ),
    /Invalid webhook OTP expiration/,
  );

  const rendered = renderWetinDeyOtpEmail(
    verified,
    issuedAtMs + 4 * 60 * 1000,
  );
  const paletteHexes =
    rendered.html.match(/#[0-9a-f]{3,8}\b/gi) ?? [];
  const paletteRgbValues = [
    ...rendered.html.matchAll(
      /rgba?\(([^)]+)\)/gi,
    ),
  ];
  const declaredColors = [
    ...rendered.html.matchAll(
      /(?:^|[;{"'])\s*(?:color|background(?:-color)?)\s*:\s*([^;"]+)/gi,
    ),
  ].map((match) =>
    match[1].replace(/\s*!important\s*$/i, "").trim(),
  );

  assert.equal(rendered.subject, WETINDEY_OTP_EMAIL_SUBJECT);
  assert.match(
    rendered.html,
    /id="verification-code"[^>]*>123456<\/div>/,
  );
  assert.match(
    rendered.html,
    /id="verification-expiry"[^>]*>Expires in 5 minutes<\/div>/,
  );
  assert.match(rendered.html, /#f5f5f5/i);
  assert.match(rendered.html, /#1d1d1d/i);
  assert.ok(paletteHexes.length > 0);
  for (const color of paletteHexes) {
    assert.equal(color.length, 7, `${color} is not six-digit neutral`);
    const red = color.slice(1, 3);
    const green = color.slice(3, 5);
    const blue = color.slice(5, 7);
    assert.equal(red, green, `${color} is not monochrome`);
    assert.equal(green, blue, `${color} is not monochrome`);
  }
  for (const color of paletteRgbValues) {
    const channels = color[1]
      .split(/[\s,/]+/)
      .filter(Boolean)
      .slice(0, 3)
      .map((channel) =>
        channel.endsWith("%")
          ? Number.parseFloat(channel) * 2.55
          : Number.parseFloat(channel),
      );
    assert.equal(channels.length, 3, `${color[0]} is not valid RGB`);
    assert.ok(
      channels.every(Number.isFinite),
      `${color[0]} is not valid RGB`,
    );
    assert.equal(channels[0], channels[1], `${color[0]} is not monochrome`);
    assert.equal(channels[1], channels[2], `${color[0]} is not monochrome`);
  }
  assert.doesNotMatch(rendered.html, /hsla?\(/i);
  assert.doesNotMatch(
    rendered.html,
    /\b(?:hwb|lab|lch|oklab|oklch|color|color-mix)\(/i,
  );
  assert.doesNotMatch(rendered.html, /\burl\(/i);
  assert.doesNotMatch(rendered.html, /<(?:img|picture|svg)\b/i);
  for (const color of declaredColors) {
    assert.match(
      color,
      /^(?:#[0-9a-f]{6}|rgba?\([^)]+\)|transparent)$/i,
      `${color} is not an approved neutral color declaration`,
    );
  }
  assert.doesNotMatch(
    rendered.html,
    /green|lime|olive|teal|aqua|cyan|chartreuse/i,
  );
  assert.match(rendered.html, /support@wetindey\.live/);
  assert.match(
    rendered.html,
    /If you didn't request this code, you can safely ignore this email\./,
  );
  assert.match(rendered.text, /Your verification code is:\n\n123456/);
  assert.match(rendered.text, /sign in/);
  assert.match(rendered.html, /sign in/);
  assert.match(rendered.text, /Expires in 5 minutes\./);
  assert.match(
    rendered.text,
    /If you didn't request this code, you can safely ignore this email\./,
  );
  assert.match(rendered.text, /support@wetindey\.live/);

  const verificationEmail = renderWetinDeyOtpEmail(
    { ...verified, otpType: "email-verification" },
    issuedAtMs + 4 * 60 * 1000,
  );
  const passwordResetEmail = renderWetinDeyOtpEmail(
    { ...verified, otpType: "forget-password" },
    issuedAtMs + 4 * 60 * 1000,
  );
  assert.match(verificationEmail.text, /verify your email/);
  assert.match(verificationEmail.html, /verify your email/);
  assert.match(
    passwordResetEmail.text,
    /continue resetting your password/,
  );
  assert.match(
    passwordResetEmail.html,
    /continue resetting your password/,
  );

  let providerMessage: Record<string, unknown> | undefined;
  const deliveryNow = issuedAtMs + 1_000;
  const expectedDelivery = renderWetinDeyOtpEmail(verified, deliveryNow);
  await sendWetinDeyOtpEmail(verified, {
    from: "WetinDey <auth@wetindey.live>",
    now: () => deliveryNow,
    transport: {
      async sendMail(message) {
        providerMessage = message as Record<string, unknown>;
        return { accepted: ["person@example.com"], rejected: [] };
      },
    },
  });

  assert.equal(providerMessage?.subject, WETINDEY_OTP_EMAIL_SUBJECT);
  assert.equal(providerMessage?.to, "person@example.com");
  assert.equal(
    providerMessage?.from,
    "WetinDey <auth@wetindey.live>",
  );
  assert.equal(providerMessage?.replyTo, "support@wetindey.live");
  assert.equal(providerMessage?.html, expectedDelivery.html);
  assert.equal(providerMessage?.text, expectedDelivery.text);
  assert.equal(
    providerMessage?.messageId,
    `<${eventId}@auth.wetindey.live>`,
  );

  await assert.rejects(
    sendWetinDeyOtpEmail(
      { ...verified, eventId: randomUUID(), deliveryPreference: "sms" },
      {
        from: "WetinDey <auth@wetindey.live>",
        now: () => issuedAtMs + 1_000,
        transport: {
          async sendMail() {
            throw new Error("must not send");
          },
        },
      },
    ),
    AuthEmailConfigurationError,
  );

  await assert.rejects(
    sendWetinDeyOtpEmail(
      {
        ...verified,
        eventId: randomUUID(),
        expiresAt: new Date(deliveryNow + 4_000).toISOString(),
      },
      {
        from: "WetinDey <auth@wetindey.live>",
        now: () => deliveryNow,
        transport: {
          async sendMail() {
            throw new Error("must not send a near-expiry code");
          },
        },
      },
    ),
    NeonWebhookVerificationError,
  );

  let timeoutTransportClosed = false;
  await assert.rejects(
    sendWetinDeyOtpEmail(
      { ...verified, eventId: randomUUID() },
      {
        deliveryTimeoutMs: 5,
        from: "WetinDey <auth@wetindey.live>",
        now: () => deliveryNow,
        transport: {
          async sendMail() {
            return new Promise<never>(() => undefined);
          },
          close() {
            timeoutTransportClosed = true;
          },
        },
      },
    ),
    (error: unknown) =>
      error instanceof AuthEmailDeliveryError && error.status === 504,
  );
  assert.equal(timeoutTransportClosed, true);

  const unsupportedMedia = await handleNeonOtpWebhookRequest(
    new Request("https://example.test/api/webhooks/neon-auth", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "{}",
    }),
  );
  assert.equal(unsupportedMedia.status, 415);

  const oversizedHeader = await handleNeonOtpWebhookRequest(
    new Request("https://example.test/api/webhooks/neon-auth", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(64 * 1024 + 1),
      },
      body: "{}",
    }),
  );
  assert.equal(oversizedHeader.status, 413);

  const oversizedBody = await handleNeonOtpWebhookRequest(
    new Request("https://example.test/api/webhooks/neon-auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "x".repeat(64 * 1024 + 1),
    }),
  );
  assert.equal(oversizedBody.status, 413);

  const invalidSignature = await handleNeonOtpWebhookRequest(
    new Request("https://example.test/api/webhooks/neon-auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: rawBody,
    }),
    {
      verify: async () => {
        throw new NeonWebhookVerificationError("invalid");
      },
    },
  );
  assert.equal(invalidSignature.status, 401);

  const missingConfiguration = await handleNeonOtpWebhookRequest(
    new Request("https://example.test/api/webhooks/neon-auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: rawBody,
    }),
    {
      verify: async () => verified,
      send: async () => {
        throw new AuthEmailConfigurationError("missing");
      },
    },
  );
  assert.equal(missingConfiguration.status, 503);

  const signingKeysUnavailable = await handleNeonOtpWebhookRequest(
    new Request("https://example.test/api/webhooks/neon-auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: rawBody,
    }),
    {
      verify: async () => {
        throw new NeonWebhookKeyUnavailableError();
      },
    },
  );
  assert.equal(signingKeysUnavailable.status, 503);

  const deliveryTimeout = await handleNeonOtpWebhookRequest(
    new Request("https://example.test/api/webhooks/neon-auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: rawBody,
    }),
    {
      verify: async () => verified,
      send: async () => {
        throw new AuthEmailDeliveryError(504);
      },
    },
  );
  assert.equal(deliveryTimeout.status, 504);

  const providerFailure = await handleNeonOtpWebhookRequest(
    new Request("https://example.test/api/webhooks/neon-auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: rawBody,
    }),
    {
      verify: async () => verified,
      send: async () => {
        throw new Error("provider unavailable");
      },
    },
  );
  assert.equal(providerFailure.status, 502);

  const success = await handleNeonOtpWebhookRequest(
    new Request("https://example.test/api/webhooks/neon-auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: rawBody,
    }),
    {
      verify: async () => verified,
      send: async () => undefined,
    },
  );
  assert.equal(success.status, 204);
  assert.equal(success.headers.get("Cache-Control"), "no-store");

  console.log("auth-email contracts: PASS");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
