# Production Auth Email Recovery - 2026-07-19

## Summary

Production OTP generation and verification were healthy, but delivery temporarily used
Neon's managed email body. The visible symptoms were:

- sender displayed as `WetinDeyWetinDey`;
- managed subject `Your Sign-In Code - WetinDey`;
- no embedded WetinDey logo;
- no WetinDey-controlled body.

The incident was an external configuration activation problem, not an OTP-generation or
verification defect.

## Historical evidence reconciled

Earlier repository evidence proved that an unknown email address could reach the OTP send
path and receive a code. It did not record that `support@wetindey.live` completed
first-time verification and account creation.

This recovery therefore treated that exact claim as unproven rather than inheriting it
from the earlier send-only evidence.

## Findings

The exact Production Neon branch showed:

- Application Name `WetinDey`;
- Production webhook URL present;
- `Send OTP` selected;
- webhook switch on;
- timeout set to `5` seconds.

Before an explicit save, a fresh OTP used Neon's managed template. Production runtime
logs showed the OTP request but no webhook request.

The accepted runbook requires a `10`-second webhook timeout. The WetinDey handler reserves
bounded time for signature-key resolution, SMTP delivery, and function overhead.

## Recovery actions

1. Changed the exact Production Neon Auth webhook timeout from `5` to `10` seconds.
2. Explicitly saved the webhook configuration.
3. Required Neon's `Webhook configuration updated successfully` confirmation.
4. Preserved the exact Production URL and `Send OTP` event.
5. Overrode `AUTH_EMAIL_FROM` in Vercel Production and Preview with exactly:

   ```text
   WetinDey <auth@wetindey.live>
   ```

6. Redeployed the current reviewed Production source.
7. Removed every temporary OTP, message, and cookie artifact created by the verification
   flow.

No repository code, database schema, migration, account role, or authentication provider
was changed.

## Production evidence

### Exact support-account proof

A fresh request for the previously unknown `support@wetindey.live` address returned
`200`. The OTP was retrieved privately and submitted to Neon's existing verification
endpoint.

Verification returned `200` and created a new email-verified user. No OTP, token, user ID,
or mailbox credential is retained in this record.

This closes the prior evidence gap: the exact support address can complete first-time
email-OTP account creation.

### Branded delivery proof

After the saved Neon update and Vercel redeployment:

- OTP request returned `200`;
- signed Neon webhook returned `204`;
- external Gmail delivery arrived from `WetinDey auth@wetindey.live`;
- subject was `Your WetinDey verification code`;
- the message used WetinDey copy;
- inline `wetindey-logo.png` was present;
- content ID was `wetindey-logo@auth.wetindey.live`;
- the duplicate `WetinDeyWetinDey` sender was absent.

## Remaining product behavior

New Neon email-OTP users begin with an empty provider name. The webhook payload does not
provide a trusted profile name, and no WetinDey profile exists before first
authentication. The greeting therefore remains intentionally generic.

Do not look up a profile by recipient email merely to personalize an OTP. That would add
identity coupling and account-enumeration risk to the authentication boundary.

## Future regression rule

Treat the following as separate gates:

1. request accepted;
2. webhook invoked;
3. SMTP accepted;
4. external mailbox delivered;
5. branded sender/logo rendered;
6. OTP verified;
7. new account created.

No earlier gate proves a later one.
