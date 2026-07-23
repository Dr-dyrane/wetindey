import assert from "node:assert/strict";
import {
  createHash,
  generateKeyPairSync,
  randomUUID,
  sign,
  type KeyObject,
} from "node:crypto";
import { inflateSync } from "node:zlib";

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
import {
  WETINDEY_EMAIL_LOGO_CID,
} from "../src/lib/auth-email-logo";

const eventId = "550e8400-e29b-41d4-a716-446655440000";
const kid = "wetindey-contract-key";
const eventTimestamp = "2026-07-18T18:00:00.000Z";
const expiresAt = "2026-07-18T18:10:00.000Z";
const issuedAtMs = Date.parse(eventTimestamp);
const webhookTimestamp = issuedAtMs.toString();
const expectedLogoSha256 =
  "1ae527ebf982dabdc6fd87b1ffa000b4de4561b8f68386b7e1cfe92f8b39f189";

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

function paethPredictor(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);

  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) {
    return left;
  }

  return upDistance <= upLeftDistance ? up : upLeft;
}

function pngCrc32(content: Buffer): number {
  let crc = 0xffffffff;

  for (const byte of content) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc =
        (crc >>> 1) ^
        (crc & 1 ? 0xedb88320 : 0);
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function assertMonochromePng(content: Buffer): void {
  assert.deepEqual(
    content.subarray(0, 8),
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  );

  let offset = 8;
  let width = 0;
  let height = 0;
  let sawIhdr = false;
  let sawIend = false;
  let idatSequenceEnded = false;
  let chunkIndex = 0;
  const compressedRows: Buffer[] = [];

  while (offset + 12 <= content.length) {
    const length = content.readUInt32BE(offset);
    const type = content.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const chunkEnd = dataEnd + 4;
    assert.ok(chunkEnd <= content.length, `${type} exceeds PNG bounds`);
    assert.equal(
      content.readUInt32BE(dataEnd),
      pngCrc32(content.subarray(offset + 4, dataEnd)),
      `${type} has an invalid CRC`,
    );
    assert.equal(
      chunkIndex === 0 ? type : "IHDR",
      "IHDR",
      "IHDR must be the first PNG chunk",
    );

    if (type === "IHDR") {
      assert.equal(sawIhdr, false, "PNG must contain one IHDR");
      assert.equal(length, 13);
      sawIhdr = true;
      width = content.readUInt32BE(dataStart);
      height = content.readUInt32BE(dataStart + 4);
      assert.equal(content[dataStart + 8], 8, "logo must be 8-bit");
      assert.equal(content[dataStart + 9], 6, "logo must be RGBA");
      assert.equal(
        content[dataStart + 10],
        0,
        "logo must use PNG compression method 0",
      );
      assert.equal(
        content[dataStart + 11],
        0,
        "logo must use PNG filter method 0",
      );
      assert.equal(content[dataStart + 12], 0, "logo cannot interlace");
    } else if (type === "IDAT") {
      assert.ok(sawIhdr, "IDAT cannot precede IHDR");
      assert.equal(
        idatSequenceEnded,
        false,
        "PNG IDAT chunks must be consecutive",
      );
      compressedRows.push(content.subarray(dataStart, dataEnd));
    } else if (type === "IEND") {
      assert.equal(length, 0);
      assert.equal(chunkEnd, content.length);
      sawIend = true;
      break;
    } else if (compressedRows.length > 0) {
      idatSequenceEnded = true;
    }

    offset = chunkEnd;
    chunkIndex += 1;
  }

  assert.ok(sawIhdr);
  assert.equal(width, 96);
  assert.equal(height, 96);
  assert.ok(sawIend);
  assert.ok(compressedRows.length > 0);

  const bytesPerPixel = 4;
  const rowLength = width * bytesPerPixel;
  const filteredRows = inflateSync(Buffer.concat(compressedRows));
  assert.equal(filteredRows.length, height * (rowLength + 1));

  let previousRow = Buffer.alloc(rowLength);
  let visiblePixels = 0;
  let darkPixels = 0;
  let lightPixels = 0;

  for (let rowIndex = 0; rowIndex < height; rowIndex += 1) {
    const rowOffset = rowIndex * (rowLength + 1);
    const filter = filteredRows[rowOffset];
    assert.ok(filter <= 4, `unsupported PNG filter ${filter}`);
    const row = Buffer.alloc(rowLength);

    for (let index = 0; index < rowLength; index += 1) {
      const encoded = filteredRows[rowOffset + 1 + index];
      const left =
        index >= bytesPerPixel ? row[index - bytesPerPixel] : 0;
      const up = previousRow[index];
      const upLeft =
        index >= bytesPerPixel
          ? previousRow[index - bytesPerPixel]
          : 0;
      let decoded = encoded;

      if (filter === 1) {
        decoded += left;
      } else if (filter === 2) {
        decoded += up;
      } else if (filter === 3) {
        decoded += Math.floor((left + up) / 2);
      } else if (filter === 4) {
        decoded += paethPredictor(left, up, upLeft);
      }

      row[index] = decoded & 0xff;
    }

    for (let index = 0; index < rowLength; index += bytesPerPixel) {
      const red = row[index];
      const green = row[index + 1];
      const blue = row[index + 2];
      const alpha = row[index + 3];
      if (alpha === 0) {
        continue;
      }

      visiblePixels += 1;
      assert.equal(red, green, "logo contains a chromatic pixel");
      assert.equal(green, blue, "logo contains a chromatic pixel");
      darkPixels += red < 64 ? 1 : 0;
      lightPixels += red > 191 ? 1 : 0;
    }

    previousRow = row;
  }

  assert.ok(visiblePixels > 0);
  assert.ok(darkPixels > 0);
  assert.ok(lightPixels > 0);
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

  // Anti-injection guards, pinned so they cannot regress green (the sweep that
  // found them noted escapeHtml was never exercised against a special
  // character, and the recipient and sender CRLF rejections had no case).

  // The recipient email validator rejects a CRLF header-injection attempt, an
  // over-length address, and a structurally invalid one.
  for (const [label, badEmail] of [
    ["CRLF header injection", "victim@example.com\r\nBcc: attacker@evil.test"],
    ["over-length", `${"a".repeat(320)}@example.com`],
    ["structurally invalid", "not-an-email"],
  ] as const) {
    const badRecipientBody = JSON.stringify({
      ...basePayload,
      user: { ...basePayload.user, email: badEmail },
    });
    await assert.rejects(
      verify(badRecipientBody),
      /Invalid webhook recipient email/,
      `recipient guard must reject ${label}`,
    );
  }

  // escapeHtml is the last backstop if the numeric OTP validator is ever
  // loosened. Render directly with an injection-shaped code and prove the
  // markup carries no raw angle bracket from it and the payload is escaped.
  const escapedRender = renderWetinDeyOtpEmail(
    { ...verified, otpCode: "<script>alert(1)</script>" },
    issuedAtMs + 1_000,
  );
  assert.doesNotMatch(
    escapedRender.html,
    /<script>alert\(1\)<\/script>/,
    "escapeHtml must neutralise an injection-shaped OTP code",
  );
  assert.match(
    escapedRender.html,
    /&lt;script&gt;alert\(1\)&lt;\/script&gt;/,
    "the injection-shaped code must appear HTML-escaped",
  );

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
  const imageTags = rendered.html.match(/<img\b[^>]*>/gi) ?? [];
  assert.equal(imageTags.length, 1);
  assert.doesNotMatch(rendered.html, /\bsrcset\s*=/i);
  assert.doesNotMatch(rendered.html, /https?:\/\//i);
  const imageSources = imageTags.map((tag) => {
    const source = tag.match(
      /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i,
    );
    assert.ok(source, "email logo requires an image source");
    return source[1] ?? source[2] ?? source[3];
  });
  assert.deepEqual(imageSources, [`cid:${WETINDEY_EMAIL_LOGO_CID}`]);
  assert.doesNotMatch(rendered.html, /<(?:picture|svg)\b/i);
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
  const attachments = providerMessage?.attachments;
  assert.ok(Array.isArray(attachments));
  assert.equal(attachments.length, 1);
  const logoAttachment = attachments[0] as Record<string, unknown>;
  assert.equal(logoAttachment.cid, WETINDEY_EMAIL_LOGO_CID);
  assert.equal(logoAttachment.contentType, "image/png");
  assert.equal(logoAttachment.contentDisposition, "inline");
  assert.ok(Buffer.isBuffer(logoAttachment.content));
  assert.match(
    WETINDEY_EMAIL_LOGO_CID,
    /^[a-z0-9._-]+@[a-z0-9.-]+$/i,
  );
  assertMonochromePng(logoAttachment.content as Buffer);
  assert.equal(
    createHash("sha256")
      .update(logoAttachment.content as Buffer)
      .digest("hex"),
    expectedLogoSha256,
  );
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

  // The sender-header CRLF guard rejects a from carrying an injected header,
  // before any transport is touched.
  await assert.rejects(
    sendWetinDeyOtpEmail(
      { ...verified, eventId: randomUUID() },
      {
        from: "WetinDey <auth@wetindey.live>\r\nBcc: attacker@evil.test",
        now: () => deliveryNow,
        transport: {
          async sendMail() {
            throw new Error("must not send with an injected sender header");
          },
        },
      },
    ),
    AuthEmailConfigurationError,
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
