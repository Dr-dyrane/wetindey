# Authentication Email Operations

This directory is the operational home for WetinDey authentication-email delivery,
recovery, and production evidence.

## System boundary

Authentication email delivery has two cooperating owners:

1. **Neon Auth** generates, stores, expires, rate-limits, and verifies the OTP.
2. **WetinDey** receives Neon's signed `send.otp` webhook and sends the branded message
   through Hostinger SMTP.

Hostinger is the transport, not the authentication authority. In the current deployment,
`support@wetindey.live` is the authenticated backing mailbox and reply address, while
`auth@wetindey.live` is its public sender alias:

```text
WetinDey <auth@wetindey.live>
```

The longer-term preferred topology in the full runbook is a dedicated
`auth@wetindey.live` mailbox with `support@wetindey.live` retained only as reply-to.
Do not switch the SMTP username from the current backing mailbox to the alias unless the
alias has first been converted into a real independently authenticated mailbox.

The full implementation and configuration contract remains in
[AUTH-EMAIL-DELIVERY.md](../AUTH-EMAIL-DELIVERY.md).

## Why the webhook is required

Neon's Custom SMTP setting changes sender and transport but retains Neon's managed email
body. It does not provide WetinDey's HTML, embedded logo, or copy.

The signed `send.otp` webhook preserves Neon as the OTP authority while allowing
WetinDey to control:

- sender display name;
- subject and plain-text fallback;
- mobile-first HTML;
- embedded monochrome logo;
- expiry copy derived from Neon's real expiration;
- support and security copy.

## Diagnosis sequence

Use this order. Do not infer one layer from another.

### 1. Client request

Call the existing same-origin OTP endpoint. A `200` with `{"success":true}` proves only
that Neon accepted the request. It does not prove which template was sent, mailbox
delivery, OTP verification, or account creation.

### 2. Exact Neon branch

In Neon Auth configuration for the exact branch, verify:

- Application Name is exactly `WetinDey`;
- Webhooks are enabled;
- Webhook URL is exactly
  `https://www.wetindey.live/api/webhooks/neon-auth` for Production;
- enabled events contain `Send OTP`;
- timeout is `10` seconds;
- pending changes were explicitly saved and Neon confirmed the update.

Reading populated controls before pressing Save is not proof that the configuration is
active.

### 3. Exact Vercel environment

Production and Preview must hold:

- `AUTH_SMTP_USER`;
- `AUTH_SMTP_PASSWORD`;
- `AUTH_EMAIL_FROM` exactly `WetinDey <auth@wetindey.live>`;
- optional `AUTH_EMAIL_REPLY_TO`, defaulting to `support@wetindey.live`.

Environment changes affect only a new deployment. Redeploy the current reviewed source
after changing them.

Never print, persist, or commit secret values.

### 4. Runtime handoff

Production logs should show both:

1. `POST /api/auth/email-otp/send-verification-otp` returning `200`;
2. `POST /api/webhooks/neon-auth` returning `204`.

The first proves request acceptance. The second proves the signed webhook was accepted
and Hostinger SMTP accepted the branded message for delivery.

### 5. Mailbox evidence

Use a mailbox other than the SMTP backing mailbox for final delivery evidence. A mailbox
may filter or suppress a message sent from itself to itself.

Require all of:

- sender `WetinDey <auth@wetindey.live>`;
- subject `Your WetinDey verification code`;
- WetinDey copy;
- inline `wetindey-logo.png`;
- content ID `wetindey-logo@auth.wetindey.live`;
- no duplicate sender name.

Do not record or quote the OTP.

### 6. New-account evidence

Unknown-email delivery and new-account creation are different claims.

To prove account creation:

1. send an OTP to an address not already present in Neon Auth;
2. retrieve the OTP privately;
3. submit it through the existing Neon verification endpoint;
4. require a successful verified user response;
5. remove temporary cookie jars, message files, and extracted OTPs.

Do not report a new account merely because the send endpoint returned `200`.

## Recovery procedure

When Neon sends its managed body, the sender is duplicated, or the logo is absent:

1. Confirm the deployed source still contains the signed webhook route and branded
   template.
2. Confirm the exact Neon branch and Production auth base URL belong together.
3. Set the Neon webhook URL, `Send OTP` event, and `10`-second timeout.
4. Explicitly Save and require Neon's success confirmation.
5. Pin `AUTH_EMAIL_FROM` in Vercel Production and Preview.
6. Redeploy the reviewed Production source.
7. Send a fresh OTP to an external test mailbox.
8. Require `200` request, `204` webhook, clean sender, branded subject, and inline logo.
9. Separately verify an unknown address when the incident concerns signup.

Do not patch the client around a provider/configuration failure. Do not generate or
verify OTPs inside WetinDey.

## Rollback

If the branded webhook is unhealthy:

1. disable the webhook on the exact Neon branch;
2. confirm Neon resumes managed delivery;
3. preserve the existing client send and verification flow;
4. diagnose WetinDey delivery offline;
5. reactivate only after Preview and Production evidence passes.

Rollback restores authentication availability but also restores Neon's managed template.
It is containment, not visual completion.

## Evidence records

- [2026-07-19 Production sender and webhook recovery](PRODUCTION-RECOVERY-2026-07-19.md)
