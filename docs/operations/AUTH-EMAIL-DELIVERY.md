# WetinDey authentication email delivery

Status: active in Production and Preview. The signed Neon `send.otp` webhook,
Hostinger SMTP delivery, exact sender, embedded logo, and first-time account flow
were re-proved on 19 July 2026. See the dedicated
[authentication email operations package](auth-email/README.md) and
[Production recovery evidence](auth-email/PRODUCTION-RECOVERY-2026-07-19.md).

## Provider audit

WetinDey uses **Managed Neon Auth**, backed by Better Auth:

- `src/lib/auth.ts` creates the managed Neon Auth server proxy.
- `src/lib/auth-client.ts` creates the same-origin Neon Auth client.
- `src/app/api/auth/[...path]/route.ts` forwards Auth requests to Neon.
- `src/app/_components/ProfileSheet.tsx` calls
  `emailOtp.sendVerificationOtp()` and `signIn.emailOtp()`.

Neon therefore generates the six-digit code, stores its verification state,
enforces its expiry and attempt limits, and verifies it. The WetinDey client
does not generate an OTP. Before this lane, Neon also sent the email through
its shared provider.

This is not Auth.js, Clerk, Supabase Auth, Stack Auth, or a self-hosted Better
Auth server. Better Auth is the engine beneath the managed Neon service; the
application cannot install a custom Better Auth email callback into that
managed server.

## Customization decision

Neon has no dashboard email-template editor. Its Custom SMTP setting changes
the sender and transport, but it does not provide full body/template control.

Neon's supported full-branding path is the blocking `send.otp` webhook:

1. Neon generates and persists the same OTP.
2. Neon signs a webhook containing that code and its real `expires_at`.
3. WetinDey verifies the detached Ed25519 JWS against the Neon Auth JWKS.
4. WetinDey sends the branded message through Hostinger Email SMTP.
5. The existing Neon verification endpoint verifies the unchanged code.

No authentication-provider migration is involved.

## Implemented boundary

`POST /api/webhooks/neon-auth`:

- reads at most 64 KiB from the request stream before rejecting it;
- requires all Neon delivery and signature headers;
- requires a fresh timestamp within five minutes;
- verifies `EdDSA`, key ID, detached-JWS bytes, event ID, and event type;
- rate-limits JWKS refreshes caused by unknown key IDs;
- accepts only a six-digit, unexpired `send.otp` payload with a recognized
  OTP type;
- derives displayed validity from the remaining time at delivery;
- does not persist or log the OTP, email, IP address, or user agent;
- uses a deterministic Message-ID and coalesces duplicate in-flight events
  within one warm process;
- returns a non-2xx status if signing, configuration, or delivery fails.

That final behavior is intentional. Once a `send.otp` webhook is subscribed,
Neon skips its default email. A false success response would strand the user
without a code.

## Before and after

| | Before | After configuration |
|---|---|---|
| OTP authority | Neon Auth | Neon Auth, unchanged |
| Verification | Neon Auth | Neon Auth, unchanged |
| Sender | Neon shared SMTP, `auth@mail.myneon.app` | `WetinDey <auth@wetindey.live>` |
| Subject/body | Neon-controlled shared template | WetinDey HTML and plain text |
| Subject | Provider-controlled | `Your WetinDey verification code` |
| Brand | Shared Neon presentation | WetinDey logo and `#16A34A` |
| Expiry copy | Provider-controlled | Remaining time from Neon's `expires_at` |
| Retry identity | Provider behavior | Deterministic Neon-event Message-ID |

The repository cannot reproduce the former managed Neon HTML, so it must not
fabricate a "before" screenshot. The deterministic branded HTML can be
rendered from `renderWetinDeyOtpEmail()` using a non-secret sample code.

## Required external configuration

Do not enable the Neon webhook until every item in this section is proven.
Neon treats `send.otp` as blocking; a broken webhook breaks sign-in.

### 1. Hostinger Email

Preferred:

1. Create a dedicated `auth@wetindey.live` mailbox.
2. Give it a strong unique mailbox password.
3. Keep `support@wetindey.live` as the reply address.

An alias is also supported by Hostinger, but it has no independent password
or API key. If `auth@wetindey.live` is an alias, authenticate SMTP with its
real backing mailbox address and mailbox password, then use the alias in the
`From` header.

Hostinger's documented SMTP settings are:

```text
Host: smtp.hostinger.com
Port 465: implicit SSL/TLS
Port 587: STARTTLS
Username: complete backing mailbox address
Password: backing mailbox password
```

Hostinger does not document a separate transactional email API key for this
mailbox flow.

### 2. Vercel

Add encrypted variables to Preview first, then Production:

| Variable | Required | Purpose |
|---|---:|---|
| `AUTH_SMTP_USER` | yes | Real Hostinger backing mailbox |
| `AUTH_SMTP_PASSWORD` | yes | Backing mailbox password |
| `AUTH_EMAIL_FROM` | yes | `WetinDey <auth@wetindey.live>` |
| `AUTH_SMTP_HOST` | no | Defaults to `smtp.hostinger.com` |
| `AUTH_SMTP_PORT` | no | Defaults to `465`; `587` is accepted |
| `AUTH_EMAIL_REPLY_TO` | no | Defaults to `support@wetindey.live` |

Never expose these as `NEXT_PUBLIC_*` values. Do not paste the mailbox
password into repository files, commits, tickets, or chat.

### 3. Neon Auth

Set the Auth Application Name to `WetinDey`. Configure the exact Preview
branch first through the Neon API:

```bash
curl -X PUT \
  "https://console.neon.tech/api/v2/projects/${NEON_PROJECT_ID}/branches/${NEON_BRANCH_ID}/auth/webhooks" \
  -H "Authorization: Bearer ${NEON_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "webhook_url": "https://YOUR_PREVIEW_HOST/api/webhooks/neon-auth",
    "enabled_events": ["send.otp"],
    "timeout_seconds": 10
  }'
```

The endpoint allows at most 1.5 seconds for a signing-key refresh and five
seconds for SMTP delivery. This leaves at least 3.5 seconds for parsing and
runtime overhead inside Neon's ten-second per-attempt timeout and Vercel's
ten-second function limit. The URL must be the final HTTPS route. Neon rejects
localhost, raw IPs, private hosts, and redirects.

After a real Preview sign-in proves one delivered code and one successful
verification, repeat the configuration for the exact Production branch with:

```text
https://www.wetindey.live/api/webhooks/neon-auth
```

### 4. Rollback

Disable the exact branch webhook:

```bash
curl -X PUT \
  "https://console.neon.tech/api/v2/projects/${NEON_PROJECT_ID}/branches/${NEON_BRANCH_ID}/auth/webhooks" \
  -H "Authorization: Bearer ${NEON_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"enabled":false}'
```

Neon then resumes its built-in delivery. Do not delete or modify the existing
client OTP flow during rollback.

## Acceptance evidence

Before Production activation:

1. Render the branded HTML with sample OTP `123456`; inspect mobile and
   desktop, light and dark email-client views.
2. Refute the signature boundary using a valid event, altered body, stale
   timestamp, wrong algorithm, key ID, event ID, event type, invalid OTP,
   expired OTP, SMS preference, and oversized request.
3. Prove the SMTP message uses the exact subject, HTML and text bodies,
   approved sender, support reply address, and deterministic Message-ID.
4. Drive one Preview sign-in end to end. The received code must verify through
   the unchanged Neon Auth endpoint.
5. Force a retry and determine whether Hostinger or the receiving mailbox
   deduplicates the deterministic Message-ID. Do not claim cross-instance
   exactly-once delivery without that proof.
6. Confirm no email address, OTP, IP address, user agent, authorization header,
   or mailbox password is written to application logs.

## Limitations and operational impact

- Managed Neon Auth and its webhook API are Beta.
- Dashboard-based templates are not available.
- Subscribing to `send.otp` disables Neon fallback delivery for that event.
- Neon makes at most three immediate attempts within a 15-second global
  budget. If all fail, sign-in fails visibly.
- Neon currently provides no webhook test event, event log, or redelivery UI.
- SMTP has no Resend-style idempotency key. The deterministic Message-ID and
  warm-instance coalescing reduce duplicates but cannot guarantee exactly-once
  delivery across concurrent serverless instances.
- Hostinger processes the recipient address and email body, including the
  OTP. Its sending limits and acceptable-use requirements apply.
- Custom SMTP configured directly in Neon remains a sender-only alternative
  using Neon's default body; branded HTML still requires this webhook.

## Primary references

- Neon: `https://neon.com/docs/auth/guides/customize-emails`
- Neon: `https://neon.com/docs/auth/guides/webhooks`
- Neon: `https://neon.com/docs/auth/guides/plugins/email-otp`
- Neon: `https://neon.com/docs/auth/production-checklist`
- Better Auth: `https://better-auth.com/docs/plugins/email-otp`
- Hostinger: `https://support.hostinger.com/en/articles/1575756-how-to-get-email-account-configuration-details-for-hostinger-email`
- Hostinger: `https://support.hostinger.com/en/articles/5240877-how-to-set-up-an-email-alias-with-hostinger-email`
- Nodemailer: `https://nodemailer.com/smtp`
- Nodemailer: `https://nodemailer.com/message`
