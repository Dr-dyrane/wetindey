import {
  createPublicKey,
  verify as verifySignature,
  type JsonWebKey,
  type KeyObject,
} from "node:crypto";

import nodemailer from "nodemailer";
import type { SendMailOptions } from "nodemailer";
import {
  WETINDEY_EMAIL_LOGO_CID,
  WETINDEY_EMAIL_LOGO_PNG_BASE64,
} from "@/lib/auth-email-logo";

export const WETINDEY_OTP_EMAIL_SUBJECT =
  "Your WetinDey verification code";

export const WETINDEY_SUPPORT_EMAIL = "support@wetindey.live";
const WEBHOOK_MAX_AGE_MS = 5 * 60 * 1000;
const JWKS_CACHE_TTL_MS = 5 * 60 * 1000;
const JWKS_UNKNOWN_KID_REFRESH_INTERVAL_MS = 10_000;
const JWKS_FETCH_TIMEOUT_MS = 1_500;
const SMTP_DELIVERY_TIMEOUT_MS = 5_000;
const DELIVERY_CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_BODY_BYTES = 64 * 1024;

export type NeonOtpType =
  | "sign-in"
  | "email-verification"
  | "forget-password";

export interface VerifiedNeonOtpWebhook {
  eventId: string;
  eventTimestamp: string;
  recipientEmail: string;
  otpCode: string;
  otpType: NeonOtpType;
  expiresAt: string;
  deliveryPreference?: "email" | "sms";
}

export interface WetinDeyOtpEmail {
  subject: string;
  html: string;
  text: string;
}

interface VerifyWebhookOptions {
  now?: () => number;
  resolvePublicKey?: (kid: string) => Promise<KeyObject>;
}

interface MailTransport {
  sendMail(message: SendMailOptions): Promise<unknown>;
  close?: () => void;
}

interface SendEmailOptions {
  from?: string;
  replyTo?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  transport?: MailTransport;
  deliveryTimeoutMs?: number;
  now?: () => number;
}

interface CachedJwks {
  expiresAt: number;
  keys: Map<string, KeyObject>;
}

interface DeliveryCacheEntry {
  expiresAt: number;
  promise: Promise<void>;
}

interface WebhookHandlerDependencies {
  verify?: typeof verifyNeonOtpWebhook;
  send?: typeof sendWetinDeyOtpEmail;
}

let cachedJwks: CachedJwks | null = null;
let jwksRefreshPromise: Promise<CachedJwks> | null = null;
let lastJwksRefreshAttemptAt = 0;
const deliveryCache = new Map<string, DeliveryCacheEntry>();

export class AuthEmailConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthEmailConfigurationError";
  }
}

export class AuthEmailDeliveryError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Auth email delivery failed with status ${status}`);
    this.name = "AuthEmailDeliveryError";
    this.status = status;
  }
}

export class NeonWebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NeonWebhookVerificationError";
  }
}

export class NeonWebhookKeyUnavailableError extends Error {
  constructor() {
    super("Neon webhook signing keys are temporarily unavailable");
    this.name = "NeonWebhookKeyUnavailableError";
  }
}

class WebhookBodyTooLargeError extends Error {
  constructor() {
    super("Webhook body exceeded the maximum size");
    this.name = "WebhookBodyTooLargeError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isOtpType(value: string): value is NeonOtpType {
  return (
    value === "sign-in" ||
    value === "email-verification" ||
    value === "forget-password"
  );
}

function isDeliveryPreference(
  value: string,
): value is "email" | "sms" {
  return value === "email" || value === "sms";
}

function purposeCopy(type: NeonOtpType): string {
  if (type === "email-verification") {
    return "verify your email";
  }

  if (type === "forget-password") {
    return "continue resetting your password";
  }

  return "sign in";
}

function remainingExpiryCopy(
  expiresAt: string,
  nowMs: number,
): string {
  const safeRemainingMs =
    Date.parse(expiresAt) - nowMs - SMTP_DELIVERY_TIMEOUT_MS;

  if (!Number.isFinite(safeRemainingMs) || safeRemainingMs <= 0) {
    return "Expires in less than a minute";
  }

  const minutes = Math.floor(safeRemainingMs / 60_000);
  if (minutes < 1) {
    return "Expires in less than a minute";
  }

  return `Expires in ${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}

export function renderWetinDeyOtpEmail(
  payload: Pick<
    VerifiedNeonOtpWebhook,
    "expiresAt" | "otpCode" | "otpType"
  >,
  nowMs = Date.now(),
): WetinDeyOtpEmail {
  const code = escapeHtml(payload.otpCode);
  const expiryCopy = remainingExpiryCopy(payload.expiresAt, nowMs);
  const purpose = purposeCopy(payload.otpType);
  const securityNotice =
    "If you didn't request this code, you can safely ignore this email.";

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>${WETINDEY_OTP_EMAIL_SUBJECT}</title>
    <style>
      @media only screen and (max-width: 620px) {
        .wd-shell { width: 100% !important; }
        .wd-card { border-radius: 0 !important; }
        .wd-pad { padding-left: 24px !important; padding-right: 24px !important; }
        .wd-code { font-size: 34px !important; letter-spacing: 5px !important; }
      }
      @media (prefers-color-scheme: dark) {
        .wd-page { background: #000000 !important; }
        .wd-card { background: #1c1c1c !important; }
        .wd-copy { color: #f5f5f5 !important; }
        .wd-muted { color: #a1a1a1 !important; }
        .wd-code-panel { background: #2c2c2c !important; }
        .wd-rule { background: #383838 !important; }
        .wd-link { color: #f5f5f5 !important; }
      }
    </style>
  </head>
  <body class="wd-page" style="margin:0;padding:0;background:#f5f5f5;color:#1d1d1d;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      Your WetinDey code is ${code}. ${expiryCopy}.
    </div>
    <table role="presentation" class="wd-page" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f5f5f5;">
      <tr>
        <td align="center" style="padding:28px 12px;">
          <table role="presentation" class="wd-shell" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;">
            <tr>
              <td class="wd-card" style="overflow:hidden;border-radius:28px;background:#ffffff;box-shadow:0 18px 50px rgba(0,0,0,.08);">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td class="wd-pad" style="padding:32px 32px 10px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td width="60" valign="middle">
                            <div style="width:48px;height:48px;border-radius:16px;background:#000000;box-shadow:0 8px 20px rgba(0,0,0,.14);">
                              <img src="cid:${WETINDEY_EMAIL_LOGO_CID}" width="48" height="48" alt="" style="display:block;width:48px;height:48px;border:0;">
                            </div>
                          </td>
                          <td valign="middle">
                            <div class="wd-copy" style="font-size:22px;line-height:28px;font-weight:750;letter-spacing:-.5px;color:#1d1d1d;">WetinDey</div>
                            <div class="wd-muted" style="font-size:13px;line-height:18px;color:#595959;">Know before you go.</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td class="wd-pad wd-copy" style="padding:38px 32px 20px;color:#1d1d1d;">
                      <div class="wd-muted" style="font-size:13px;line-height:18px;font-weight:650;color:#595959;text-transform:uppercase;letter-spacing:1.1px;">Verification code</div>
                      <h1 style="margin:10px 0 12px;font-size:32px;line-height:39px;font-weight:750;letter-spacing:-.8px;">How far,</h1>
                      <p style="margin:0;font-size:17px;line-height:27px;">Use this code to ${purpose} on WetinDey.</p>
                    </td>
                  </tr>
                  <tr>
                    <td class="wd-pad" style="padding:8px 32px 28px;">
                      <div class="wd-code-panel" style="border-radius:20px;background:#f5f5f5;padding:22px 12px;text-align:center;">
                        <div id="verification-code" class="wd-code wd-copy" aria-label="Verification code ${code}" style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:36px;line-height:46px;font-weight:750;letter-spacing:6px;color:#1d1d1d;">${code}</div>
                        <div id="verification-expiry" class="wd-muted" style="margin-top:8px;font-size:14px;line-height:20px;color:#595959;">${expiryCopy}</div>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td class="wd-pad wd-copy" style="padding:0 32px 34px;color:#1d1d1d;">
                      <p style="margin:0 0 8px;font-size:15px;line-height:23px;font-weight:700;">Keep this code to yourself.</p>
                      <p class="wd-muted" style="margin:0;font-size:14px;line-height:22px;color:#595959;">${securityNotice}</p>
                    </td>
                  </tr>
                  <tr>
                    <td class="wd-pad" style="padding:0 32px;">
                      <div class="wd-rule" style="height:1px;background:#e5e5e5;"></div>
                    </td>
                  </tr>
                  <tr>
                    <td class="wd-pad wd-muted" style="padding:24px 32px 32px;font-size:13px;line-height:20px;color:#595959;">
                      Need help? <a class="wd-link" href="mailto:${WETINDEY_SUPPORT_EMAIL}" style="color:#1d1d1d;font-weight:700;text-decoration:none;">${WETINDEY_SUPPORT_EMAIL}</a><br>
                      <span class="wd-muted" style="color:#595959;">WetinDey · Nearby live local information</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = `WetinDey
Know before you go.

Your verification code is:

${payload.otpCode}

Use this code to ${purpose} on WetinDey.
${expiryCopy}.

Keep this code to yourself.
${securityNotice}

Need help? ${WETINDEY_SUPPORT_EMAIL}`;

  return {
    subject: WETINDEY_OTP_EMAIL_SUBJECT,
    html,
    text,
  };
}

function parseProtectedHeader(
  protectedHeader: string,
): Record<string, unknown> {
  try {
    const decoded = Buffer.from(protectedHeader, "base64url").toString(
      "utf8",
    );
    const parsed: unknown = JSON.parse(decoded);

    if (!isRecord(parsed)) {
      throw new Error("Protected header must be an object");
    }

    return parsed;
  } catch {
    throw new NeonWebhookVerificationError(
      "Invalid webhook protected header",
    );
  }
}

function requiredHeader(headers: Headers, name: string): string {
  const value = headers.get(name);
  if (!value) {
    throw new NeonWebhookVerificationError(
      `Missing required webhook header: ${name}`,
    );
  }

  return value;
}

function authJwksUrl(): URL {
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  if (!baseUrl) {
    throw new AuthEmailConfigurationError(
      "NEON_AUTH_BASE_URL is not configured",
    );
  }

  const normalized = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const url = new URL(".well-known/jwks.json", normalized);

  if (url.protocol !== "https:") {
    throw new AuthEmailConfigurationError(
      "NEON_AUTH_BASE_URL must use HTTPS",
    );
  }

  return url;
}

function parseJwks(value: unknown): Map<string, KeyObject> {
  if (!isRecord(value) || !Array.isArray(value.keys)) {
    throw new NeonWebhookVerificationError("Invalid Neon JWKS response");
  }

  const keys = new Map<string, KeyObject>();

  for (const candidate of value.keys) {
    if (!isRecord(candidate)) {
      continue;
    }

    const kid = readString(candidate, "kid");
    const kty = readString(candidate, "kty");
    const crv = readString(candidate, "crv");
    const x = readString(candidate, "x");

    if (!kid || kty !== "OKP" || crv !== "Ed25519" || !x) {
      continue;
    }

    const jwk: JsonWebKey = {
      crv,
      kid,
      kty,
      x,
      alg: "EdDSA",
      use: "sig",
    };

    keys.set(kid, createPublicKey({ key: jwk, format: "jwk" }));
  }

  return keys;
}

async function fetchNeonJwks(): Promise<CachedJwks> {
  try {
    const response = await fetch(authJwksUrl(), {
      cache: "no-store",
      signal: AbortSignal.timeout(JWKS_FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new NeonWebhookKeyUnavailableError();
    }

    const payload: unknown = await response.json();
    const keys = parseJwks(payload);

    if (keys.size === 0) {
      throw new NeonWebhookKeyUnavailableError();
    }

    return {
      expiresAt: Date.now() + JWKS_CACHE_TTL_MS,
      keys,
    };
  } catch (error) {
    if (error instanceof NeonWebhookKeyUnavailableError) {
      throw error;
    }

    throw new NeonWebhookKeyUnavailableError();
  }
}

async function resolveNeonPublicKey(kid: string): Promise<KeyObject> {
  const now = Date.now();
  const hasFreshCache = Boolean(cachedJwks && cachedJwks.expiresAt > now);

  if (hasFreshCache && cachedJwks) {
    const cached = cachedJwks.keys.get(kid);
    if (cached) {
      return cached;
    }
  }

  if (jwksRefreshPromise) {
    const inFlight = await jwksRefreshPromise;
    const key = inFlight.keys.get(kid);
    if (!key) {
      throw new NeonWebhookVerificationError(
        "Webhook signing key was not found",
      );
    }

    return key;
  }

  if (
    now - lastJwksRefreshAttemptAt <
    JWKS_UNKNOWN_KID_REFRESH_INTERVAL_MS
  ) {
    if (hasFreshCache) {
      throw new NeonWebhookVerificationError(
        "Webhook signing key was not found",
      );
    }

    throw new NeonWebhookKeyUnavailableError();
  }

  lastJwksRefreshAttemptAt = now;
  const refresh = fetchNeonJwks();
  jwksRefreshPromise = refresh;

  try {
    cachedJwks = await refresh;
  } finally {
    if (jwksRefreshPromise === refresh) {
      jwksRefreshPromise = null;
    }
  }

  const refreshed = cachedJwks.keys.get(kid);

  if (!refreshed) {
    throw new NeonWebhookVerificationError(
      "Webhook signing key was not found",
    );
  }

  return refreshed;
}

function parseOtpPayload(
  rawBody: string,
  eventIdHeader: string,
  eventTypeHeader: string,
  nowMs: number,
): VerifiedNeonOtpWebhook {
  let value: unknown;

  try {
    value = JSON.parse(rawBody);
  } catch {
    throw new NeonWebhookVerificationError("Invalid webhook JSON");
  }

  if (!isRecord(value)) {
    throw new NeonWebhookVerificationError(
      "Webhook payload must be an object",
    );
  }

  const eventId = readString(value, "event_id");
  const eventType = readString(value, "event_type");
  const eventTimestamp = readString(value, "timestamp");
  const user = value.user;
  const eventData = value.event_data;

  if (
    !eventId ||
    eventId !== eventIdHeader ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      eventId,
    )
  ) {
    throw new NeonWebhookVerificationError("Invalid webhook event ID");
  }

  if (eventType !== "send.otp" || eventType !== eventTypeHeader) {
    throw new NeonWebhookVerificationError(
      "Unsupported webhook event type",
    );
  }

  if (!eventTimestamp || Number.isNaN(Date.parse(eventTimestamp))) {
    throw new NeonWebhookVerificationError(
      "Invalid webhook event timestamp",
    );
  }

  if (!isRecord(user) || !isRecord(eventData)) {
    throw new NeonWebhookVerificationError(
      "Invalid webhook event payload",
    );
  }

  const recipientEmail = readString(user, "email");
  const otpCode = readString(eventData, "otp_code");
  const otpType = readString(eventData, "otp_type");
  const expiresAt = readString(eventData, "expires_at");
  const deliveryPreference = readString(
    eventData,
    "delivery_preference",
  );

  if (
    !recipientEmail ||
    recipientEmail.length > 320 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)
  ) {
    throw new NeonWebhookVerificationError(
      "Invalid webhook recipient email",
    );
  }

  if (!otpCode || !/^\d{6}$/.test(otpCode)) {
    throw new NeonWebhookVerificationError("Invalid webhook OTP code");
  }

  if (!otpType || !isOtpType(otpType)) {
    throw new NeonWebhookVerificationError("Invalid webhook OTP type");
  }

  if (
    !expiresAt ||
    Number.isNaN(Date.parse(expiresAt)) ||
    Date.parse(expiresAt) <= nowMs ||
    Date.parse(expiresAt) <= Date.parse(eventTimestamp)
  ) {
    throw new NeonWebhookVerificationError(
      "Invalid webhook OTP expiration",
    );
  }

  let verifiedDeliveryPreference: "email" | "sms" | undefined;
  if (deliveryPreference) {
    if (!isDeliveryPreference(deliveryPreference)) {
      throw new NeonWebhookVerificationError(
        "Invalid webhook delivery preference",
      );
    }

    verifiedDeliveryPreference = deliveryPreference;
  }

  return {
    eventId,
    eventTimestamp,
    recipientEmail,
    otpCode,
    otpType,
    expiresAt,
    ...(verifiedDeliveryPreference
      ? { deliveryPreference: verifiedDeliveryPreference }
      : {}),
  };
}

export async function verifyNeonOtpWebhook(
  rawBody: Uint8Array,
  headers: Headers,
  options: VerifyWebhookOptions = {},
): Promise<VerifiedNeonOtpWebhook> {
  const signature = requiredHeader(headers, "x-neon-signature");
  const kid = requiredHeader(headers, "x-neon-signature-kid");
  const timestamp = requiredHeader(headers, "x-neon-timestamp");
  const eventType = requiredHeader(headers, "x-neon-event-type");
  const eventId = requiredHeader(headers, "x-neon-event-id");
  const deliveryAttempt = requiredHeader(
    headers,
    "x-neon-delivery-attempt",
  );

  if (!/^\d{13}$/.test(timestamp) || !/^[123]$/.test(deliveryAttempt)) {
    throw new NeonWebhookVerificationError(
      "Invalid webhook delivery metadata",
    );
  }

  const timestampMs = Number(timestamp);
  const now = options.now?.() ?? Date.now();

  if (
    !Number.isSafeInteger(timestampMs) ||
    Math.abs(now - timestampMs) > WEBHOOK_MAX_AGE_MS
  ) {
    throw new NeonWebhookVerificationError(
      "Webhook timestamp is outside the accepted window",
    );
  }

  const signatureParts = signature.split(".");
  if (signatureParts.length !== 3 || signatureParts[1] !== "") {
    throw new NeonWebhookVerificationError(
      "Expected a detached JWS signature",
    );
  }

  const [protectedHeader, , signatureValue] = signatureParts;
  if (!protectedHeader || !signatureValue) {
    throw new NeonWebhookVerificationError(
      "Invalid detached JWS signature",
    );
  }

  const jwsHeader = parseProtectedHeader(protectedHeader);
  if (
    readString(jwsHeader, "alg") !== "EdDSA" ||
    readString(jwsHeader, "kid") !== kid
  ) {
    throw new NeonWebhookVerificationError(
      "Webhook signature header did not match",
    );
  }

  const payloadB64 = Buffer.from(rawBody).toString("base64url");
  const signaturePayload = `${timestamp}.${payloadB64}`;
  const signaturePayloadB64 = Buffer.from(
    signaturePayload,
    "utf8",
  ).toString("base64url");
  const signingInput = Buffer.from(
    `${protectedHeader}.${signaturePayloadB64}`,
    "utf8",
  );
  const publicKey = await (
    options.resolvePublicKey ?? resolveNeonPublicKey
  )(kid);
  const valid = verifySignature(
    null,
    signingInput,
    publicKey,
    Buffer.from(signatureValue, "base64url"),
  );

  if (!valid) {
    throw new NeonWebhookVerificationError(
      "Invalid webhook signature",
    );
  }

  let decodedBody: string;
  try {
    decodedBody = new TextDecoder("utf-8", { fatal: true }).decode(rawBody);
  } catch {
    throw new NeonWebhookVerificationError(
      "Webhook body was not valid UTF-8",
    );
  }

  return parseOtpPayload(decodedBody, eventId, eventType, now);
}

function configuredValue(
  explicit: string | undefined,
  environmentName: string,
): string | undefined {
  const value = explicit ?? process.env[environmentName];
  return value?.trim() || undefined;
}

function configuredPort(explicit: number | undefined): number {
  if (explicit !== undefined) {
    return explicit;
  }

  const rawPort = process.env.AUTH_SMTP_PORT?.trim() || "465";
  if (!/^\d+$/.test(rawPort)) {
    throw new AuthEmailConfigurationError(
      "AUTH_SMTP_PORT must be a number",
    );
  }

  return Number(rawPort);
}

function createHostingerTransport(options: SendEmailOptions): MailTransport {
  const host =
    configuredValue(options.smtpHost, "AUTH_SMTP_HOST") ??
    "smtp.hostinger.com";
  const port = configuredPort(options.smtpPort);
  const user = configuredValue(options.smtpUser, "AUTH_SMTP_USER");
  const password = configuredValue(
    options.smtpPassword,
    "AUTH_SMTP_PASSWORD",
  );

  if (!user || !password) {
    throw new AuthEmailConfigurationError(
      "AUTH_SMTP_USER and AUTH_SMTP_PASSWORD must be configured",
    );
  }

  if (port !== 465 && port !== 587) {
    throw new AuthEmailConfigurationError(
      "AUTH_SMTP_PORT must be 465 or 587",
    );
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: {
      user,
      pass: password,
    },
    connectionTimeout: 3_500,
    greetingTimeout: 3_500,
    socketTimeout: 6_000,
    dnsTimeout: 2_500,
    logger: false,
    debug: false,
    tls: {
      minVersion: "TLSv1.2",
      rejectUnauthorized: true,
      servername: host,
    },
  });
}

async function deliverWithinTimeout(
  transport: MailTransport,
  message: SendMailOptions,
  timeoutMs: number,
): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    const info = await Promise.race([
      transport.sendMail(message),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          transport.close?.();
          reject(new AuthEmailDeliveryError(504));
        }, timeoutMs);
      }),
    ]);

    if (
      isRecord(info) &&
      Array.isArray(info.rejected) &&
      info.rejected.length > 0
    ) {
      throw new AuthEmailDeliveryError(502);
    }
  } catch (error) {
    if (error instanceof AuthEmailDeliveryError) {
      throw error;
    }

    throw new AuthEmailDeliveryError(502);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function pruneDeliveryCache(now: number): void {
  for (const [eventId, entry] of deliveryCache) {
    if (entry.expiresAt <= now) {
      deliveryCache.delete(eventId);
    }
  }
}

async function deliverWetinDeyOtpEmail(
  payload: VerifiedNeonOtpWebhook,
  options: SendEmailOptions,
  now: number,
): Promise<void> {
  if (payload.deliveryPreference === "sms") {
    throw new AuthEmailConfigurationError(
      "SMS OTP delivery is not configured",
    );
  }

  if (
    Date.parse(payload.expiresAt) <=
    now + SMTP_DELIVERY_TIMEOUT_MS
  ) {
    throw new NeonWebhookVerificationError(
      "OTP expires too soon for safe email delivery",
    );
  }

  const from = configuredValue(options.from, "AUTH_EMAIL_FROM");
  const replyTo =
    configuredValue(options.replyTo, "AUTH_EMAIL_REPLY_TO") ??
    WETINDEY_SUPPORT_EMAIL;

  if (!from) {
    throw new AuthEmailConfigurationError(
      "AUTH_EMAIL_FROM must be configured",
    );
  }

  if (
    from.includes("\r") ||
    from.includes("\n") ||
    replyTo.includes("\r") ||
    replyTo.includes("\n")
  ) {
    throw new AuthEmailConfigurationError(
      "Email sender configuration contains invalid characters",
    );
  }

  const message = renderWetinDeyOtpEmail(payload, now);
  const ownsTransport = !options.transport;
  const transport = options.transport ?? createHostingerTransport(options);

  try {
    await deliverWithinTimeout(
      transport,
      {
        from,
        to: payload.recipientEmail,
        replyTo,
        subject: message.subject,
        html: message.html,
        text: message.text,
        attachments: [
          {
            filename: "wetindey-logo.png",
            content: Buffer.from(
              WETINDEY_EMAIL_LOGO_PNG_BASE64,
              "base64",
            ),
            contentType: "image/png",
            cid: WETINDEY_EMAIL_LOGO_CID,
            contentDisposition: "inline",
          },
        ],
        messageId: `<${payload.eventId}@auth.wetindey.live>`,
        headers: {
          "X-WetinDey-Message": "authentication",
        },
      },
      options.deliveryTimeoutMs ?? SMTP_DELIVERY_TIMEOUT_MS,
    );
  } finally {
    if (ownsTransport) {
      transport.close?.();
    }
  }
}

export async function sendWetinDeyOtpEmail(
  payload: VerifiedNeonOtpWebhook,
  options: SendEmailOptions = {},
): Promise<void> {
  const now = options.now?.() ?? Date.now();
  pruneDeliveryCache(now);

  const existing = deliveryCache.get(payload.eventId);
  if (existing && existing.expiresAt > now) {
    return existing.promise;
  }

  const promise = deliverWetinDeyOtpEmail(payload, options, now);
  deliveryCache.set(payload.eventId, {
    expiresAt: now + DELIVERY_CACHE_TTL_MS,
    promise,
  });

  try {
    await promise;
  } catch (error) {
    deliveryCache.delete(payload.eventId);
    throw error;
  }
}

async function readBoundedBody(request: Request): Promise<Uint8Array> {
  if (!request.body) {
    return new Uint8Array();
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    totalBytes += value.byteLength;
    if (totalBytes > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new WebhookBodyTooLargeError();
    }

    chunks.push(value);
  }

  return Buffer.concat(
    chunks.map((chunk) => Buffer.from(chunk)),
    totalBytes,
  );
}

function emptyResponse(status: number): Response {
  return new Response(null, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function handleNeonOtpWebhookRequest(
  request: Request,
  dependencies: WebhookHandlerDependencies = {},
): Promise<Response> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return emptyResponse(415);
  }

  const contentLengthHeader = request.headers.get("content-length");
  if (
    contentLengthHeader &&
    (!/^\d+$/.test(contentLengthHeader) ||
      Number(contentLengthHeader) > MAX_BODY_BYTES)
  ) {
    return emptyResponse(
      /^\d+$/.test(contentLengthHeader) ? 413 : 400,
    );
  }

  let rawBody: Uint8Array;
  try {
    rawBody = await readBoundedBody(request);
  } catch (error) {
    if (error instanceof WebhookBodyTooLargeError) {
      return emptyResponse(413);
    }

    return emptyResponse(400);
  }

  if (rawBody.byteLength === 0) {
    return emptyResponse(400);
  }

  try {
    const verify = dependencies.verify ?? verifyNeonOtpWebhook;
    const send = dependencies.send ?? sendWetinDeyOtpEmail;
    const payload = await verify(rawBody, request.headers);
    await send(payload);

    return emptyResponse(204);
  } catch (error) {
    if (error instanceof NeonWebhookVerificationError) {
      return emptyResponse(401);
    }

    if (
      error instanceof NeonWebhookKeyUnavailableError ||
      error instanceof AuthEmailConfigurationError
    ) {
      return emptyResponse(503);
    }

    if (error instanceof AuthEmailDeliveryError) {
      return emptyResponse(error.status);
    }

    return emptyResponse(502);
  }
}
