"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Settings, Flag, Bookmark, MapPin, TrendingUp, CircleHelp, UserRound } from "lucide-react";
import { ModalSheet } from "@/design-system/components/ModalSheet";
import { ListRow, ListGroup } from "@/design-system/components/ListRow";
import { Input } from "@/design-system/components/Input";
import { Button } from "@/design-system/components/Button";
import { useT } from "@/core/i18n";
import { authClient } from "@/lib/auth-client";
import Image from "next/image";
import { getMyProfile, type MyProfile } from "@/app/_actions/actions";

interface ProfileSheetProps {
  open: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  /**
   * Present the location sheet. Required, not optional: this row used to carry a
   * no-op `onClick` and a hardcoded `detail="Festac"`, so it looked navigational,
   * pressed like a button, and went nowhere. A required prop is what stops that
   * being expressible again.
   */
  onChangeArea: () => void;
  /**
   * Present the "My reports" sheet. Required, not optional, for the same reason
   * `onChangeArea` is: this row spent its whole life `disabled` over a no-op
   * `onClick`, and an optional callback is exactly how it would go dead a second
   * time, silently, with the type checker satisfied.
   *
   * It is NOT gated on the session. Auth is recognition, never a gate (ADR-003),
   * and signed-out is this app's permanent default; the sheet opens either way
   * and explains itself. See MyReportsSheet.
   */
  onOpenMyReports: () => void;
  /**
   * Present the "Report a problem" sheet. Required, not optional, for the same
   * reason `onOpenMyReports` is: this row shipped `disabled` over a no-op
   * `onClick`, and an optional callback is how it would go dead again with the
   * type checker none the wiser.
   *
   * Not gated on the session either, anyone can report a problem (ADR-003). See
   * ReportProblemSheet.
   */
  onOpenReportProblem: () => void;
  /**
   * Present the About sheet, the product's account of itself, and the way to
   * Terms of service, Privacy and Support. Required, not optional, for the same
   * reason the rows above are: `about` spent its whole life `disabled` over a
   * no-op `onClick`, and an optional callback is how it goes dead again with the
   * type checker satisfied. Not gated on the session, About and its legal
   * surfaces read the same for everyone. See AboutSheet.
   */
  onOpenAbout: () => void;
  /**
   * Present the "Manage profile" sheet: the editable half of the account (name,
   * contact; email is display-only). Required, not optional, for the same reason
   * the rows above are: an optional callback is how a CTA goes dead with the type
   * checker none the wiser.
   *
   * It is the FIRST row and it renders SIGNED-IN ONLY: there is no profile to
   * manage without a session, and `updateMyProfile` refuses one anyway. This is
   * the deliberate exception to "reading is anonymous": editing your own account
   * is inherently owner-scoped, unlike My reports / Report a problem / About,
   * which stay open to everyone.
   */
  onOpenManageProfile: () => void;
  /**
   * What the location actually is, from `useLocationChrome().label`. Never the
   * literal "Festac", this row and the map pill must not be able to disagree
   * about where the user is standing.
   */
  currentAreaName: string;
  /**
   * Null while signed out, and the sheet stays fully useful that way, on
   * purpose. Auth is recognition, never a gate.
   *
   * `email` is required, not decorative. Email OTP creates users with `name: ""`
   * (better-auth email-otp routes.mjs: `createUser({ email, emailVerified: true,
   * name: "" })`), so the name is empty for everyone who signs in this way until
   * they set one. Without an email to fall back on there is nothing to render.
   *
   * There is deliberately no `reportCount` here. It used to be declared,
   * optional, and never once passed, page.tsx builds `sessionUser` as
   * `{ name, email }`, so `reportCount ?? 0` rendered "0 prices reported" to
   * every signed-in user, and TypeScript could not object because the prop was
   * optional. In an app whose subject is trust, the first thing it said after
   * recognising you was a confident false number. Re-add it when a real count
   * reaches this component, not before.
   */
  user?: { name: string; email: string } | null;
  /**
   * The session changed, someone signed in, or signed out. The page re-reads
   * it; this sheet does not own it.
   *
   * Not `onSignedIn`: sign-out changes the session too, and a name that covers
   * only half the transitions is how the other half quietly stops refetching.
   */
  onSessionChange?: () => void | Promise<void>;
}

/**
 * The sign-in flow, as three states of one block.
 *
 * EMAIL OTP, NOT MAGIC LINK, and not by preference: magic link is disabled on
 * this Neon branch (plugin_configs.magicLink.enabled = false; POST
 * /sign-in/magic-link returns 404 while /email-otp/* returns a 400 schema error,
 * i.e. mounted). Enabling it would not help, better-auth builds the verify URL
 * from the SERVER's baseURL, so the link lands on Neon's domain and sets the
 * session cookie THERE before redirecting to us, and its challenge cookie is
 * device-bound, so requesting on a laptop and opening on a phone can never work.
 *
 * OTP keeps the same promise, check your mail, come back, and is better across
 * devices: read the code on the phone, type it on the laptop. It also never
 * navigates, so the sheet survives the whole flow and none of the page's state
 * is lost.
 *
 * There is no separate sign-up. `signIn.emailOtp` creates the user if the email
 * is unknown, which is exactly the recognition-not-registration model.
 *
 * `error` is a key, not a sentence, so a language change mid-flow re-renders the
 * failure in the new language instead of stranding one English string.
 */
type AuthErrorKey =
  | "auth.err_send"
  | "auth.err_send_network"
  | "auth.err_email_invalid"
  | "auth.err_rate_limited"
  | "auth.err_code_wrong"
  | "auth.err_code_expired"
  | "auth.err_code_attempts"
  | "auth.err_code_network"
  | "auth.err_code";

/**
 * `verified` is the state between the server accepting the code and the session
 * arriving, and leaving it out was the flow's worst bug: THE MOMENT OF SUCCESS
 * RENDERED AS THE MOMENT OF FAILURE.
 *
 * better-auth's session is `useAuthQuery($sessionSignal, "/get-session")`.
 * `signIn.emailOtp` does not set that data, it toggles a signal that triggers a
 * refetch, and the fetch keeps `data: null` while it runs. So dropping to `idle`
 * on success meant `signedIn` was still false, and the sheet snapped straight
 * back to "Sign in to WetinDey" and a primary Sign in button. The user types the
 * sixth digit, the code is accepted, and the app asks them to sign in. On the
 * Lagos connections this product is built for, that is seconds, long enough to
 * tap the button and start over.
 *
 * It normally ends by itself once the session lands. A bounded recovery loop
 * below also prevents a delayed or missed session signal from leaving this
 * state as an endless spinner.
 */
type SignIn =
  | { kind: "idle" }
  | { kind: "email"; sending: boolean; error: AuthErrorKey | null }
  | {
      kind: "code";
      email: string;
      checking: boolean;
      error: AuthErrorKey | null;
      delivery: "confirmed" | "indeterminate";
    }
  | { kind: "verified"; email: string; stalled: boolean };

/**
 * The backend's words are not the product's words.
 *
 * better-auth populates `error.message` with "Invalid OTP", "OTP expired", "Too
 * many attempts", "Too many requests", its own acronyms, English-only, and
 * untranslatable because they never pass through `t()`. The previous code
 * rendered `error.message ?? "That code didn't work."`, so the fallback almost
 * never ran and what shipped to Lagos was "Invalid OTP".
 *
 * `error.code` is the stable channel and `error.status` carries the rate
 * limiter's 429. Both are mapped; `message` is never read.
 */
type FetchError = { code?: string; status: number };

function thrownFetchError(value: unknown): FetchError | null {
  if (typeof value !== "object" || value === null || !("status" in value)) return null;
  if (typeof value.status !== "number") return null;

  if ("code" in value && typeof value.code === "string") {
    return { status: value.status, code: value.code };
  }

  if (
    "error" in value &&
    typeof value.error === "object" &&
    value.error !== null &&
    "code" in value.error &&
    typeof value.error.code === "string"
  ) {
    return { status: value.status, code: value.error.code };
  }

  return { status: value.status };
}

function sendErrorKey(e: FetchError): AuthErrorKey {
  if (e.status === 429) return "auth.err_rate_limited";
  if (e.code === "INVALID_EMAIL") return "auth.err_email_invalid";
  return "auth.err_send";
}

function codeErrorKey(e: FetchError): AuthErrorKey {
  if (e.status === 429) return "auth.err_rate_limited";
  if (e.code === "INVALID_OTP") return "auth.err_code_wrong";
  // OTP_NOT_FOUND is what a consumed or aged-out code returns. Same remedy as an
  // outright expiry, and "not found" would suggest the user invented it.
  if (e.code === "OTP_EXPIRED" || e.code === "OTP_NOT_FOUND") return "auth.err_code_expired";
  if (e.code === "TOO_MANY_ATTEMPTS") return "auth.err_code_attempts";
  return "auth.err_code";
}

/**
 * Long enough that it cannot trip the send limit, which is 3 per 60s: at one
 * minute apart, no rolling 60s window can ever hold three sends.
 */
const RESEND_COOLDOWN_MS = 60_000;
const OTP_SEND_WAIT_TIMEOUT_MS = 5_000;
const SESSION_REFRESH_DELAYS_MS = [0, 300, 800, 1_600] as const;
const SESSION_REFRESH_ATTEMPT_TIMEOUT_MS = 1_500;
const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type OtpSendResult = Awaited<ReturnType<typeof authClient.emailOtp.sendVerificationOtp>>;
type BoundedOtpSendResult =
  | { kind: "settled"; result: OtpSendResult }
  | { kind: "timed_out" };

/**
 * Delivery and the client promise are not one fact. Production has delivered
 * an OTP while this promise remained pending, so the UI may stop waiting
 * without calling that a failure. Handlers stay attached after the timeout so
 * a late rejection is consumed, but no late settlement can mutate UI state.
 */
function waitForOtpSend(send: Promise<OtpSendResult>): Promise<BoundedOtpSendResult> {
  return new Promise((resolve, reject) => {
    let finished = false;
    const timeout = window.setTimeout(() => {
      finished = true;
      resolve({ kind: "timed_out" });
    }, OTP_SEND_WAIT_TIMEOUT_MS);

    void send.then(
      (result) => {
        if (finished) return;
        finished = true;
        window.clearTimeout(timeout);
        resolve({ kind: "settled", result });
      },
      (error: unknown) => {
        if (finished) return;
        finished = true;
        window.clearTimeout(timeout);
        reject(error);
      }
    );
  });
}

/**
 * Mini profile, in the shape Apple Maps uses for its account sheet.
 *
 * This is the app's navigation hub. WetinDey is a map-first product, so it has
 * no tab bar and no page chrome to hang navigation off, the avatar is the one
 * persistent affordance, and everything that isn't "search the map" lives
 * behind it.
 *
 * Rows that have no destination are disabled, whatever the session says. "My
 * reports" and "Saved markets" used to be `disabled={!signedIn}` over an empty
 * `onClick`, which meant signing in ENABLED two rows that press, animate, show a
 * chevron and go nowhere, auth manufacturing exactly the dead links this file
 * disables rows to avoid. Being signed in is not a destination.
 */
export function ProfileSheet({
  open,
  onClose,
  onOpenSettings,
  onChangeArea,
  onOpenMyReports,
  onOpenReportProblem,
  onOpenAbout,
  onOpenManageProfile,
  currentAreaName,
  user,
  onSessionChange,
}: ProfileSheetProps) {
  const t = useT();
  const signedIn = Boolean(user);

  const [profile, setProfile] = useState<MyProfile | null>(null);

  useEffect(() => {
    if (open && signedIn) {
      getMyProfile().then(setProfile).catch(() => {});
    } else {
      setProfile(null);
    }
  }, [open, signedIn, user]);

  const [signIn, setSignIn] = useState<SignIn>({ kind: "idle" });
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [retrying, setRetrying] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<"auth.err_sign_out" | null>(null);
  /** When the live code was sent, and the clock the cooldown is read against. */
  const [sentAt, setSentAt] = useState(0);
  const [now, setNow] = useState(0);
  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const sessionChangeRef = useRef(onSessionChange);
  const sendAttemptRef = useRef(0);

  useEffect(() => {
    sessionChangeRef.current = onSessionChange;
  }, [onSessionChange]);

  // Dismissing abandons a half-finished sign-in: a sheet that reopens onto a
  // stale code field looks broken, and the code has a five-minute life anyway.
  // `email` deliberately survives, it is the one thing here that is expensive
  // to retype and never goes stale.
  useEffect(() => {
    if (open) return;
    sendAttemptRef.current += 1;
    setSignIn({ kind: "idle" });
    setCode("");
    setSentAt(0);
    setRetrying(false);
    setSignOutError(null);
  }, [open]);

  // Once the parent has the session, discard the transient OTP step. Without
  // this reset, signing out in the same open sheet would reveal the old
  // "verified" state instead of the normal sign-in entry point.
  useEffect(() => {
    if (signedIn) {
      sendAttemptRef.current += 1;
      setSignIn({ kind: "idle" });
    }
  }, [signedIn]);

  /**
   * Focus follows the step.
   *
   * Two `data-autofocus` attributes used to sit on these fields and neither did
   * anything. ModalSheet resolves them with
   * `querySelector("[data-autofocus], button, input, …")`, which returns the
   * first node in DOCUMENT order matching ANY branch, and the header's Close
   * button precedes every field in the panel, so Close always won. Deciding it
   * here also handles what ModalSheet structurally cannot: these steps appear
   * long after the sheet opened, so a one-shot focus on present could never
   * reach them.
   */
  useEffect(() => {
    if (signIn.kind === "email") emailRef.current?.focus();
    else if (signIn.kind === "code") codeRef.current?.focus();
  }, [signIn.kind]);

  const cooldown = sentAt ? Math.max(0, Math.ceil((sentAt + RESEND_COOLDOWN_MS - now) / 1000)) : 0;
  const cooling = cooldown > 0;

  // Ticks only while there is a countdown to draw, and stops itself: `cooling`
  // is derived from `now`, so the last tick that reaches zero flips the dep and
  // tears the interval down. This re-renders ProfileSheet, never page.tsx, so it
  // cannot touch ModalSheet's focus effect.
  useEffect(() => {
    if (signIn.kind !== "code" || !cooling) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [signIn.kind, cooling]);

  const verifiedStalled = signIn.kind === "verified" && signIn.stalled;

  // `signIn.emailOtp` has already accepted the code at this point. Re-read the
  // session a few times because the auth query signal and React state can land
  // on different turns. The loop is deliberately bounded: a provider, cookie,
  // or client-cache failure must become a recoverable control, never a spinner
  // that can run forever.
  useEffect(() => {
    if (signIn.kind !== "verified" || signedIn || signIn.stalled) return;

    let active = true;
    const timers: number[] = [];
    let refreshInFlight: Promise<void> | null = null;
    const wait = (delay: number) =>
      new Promise<void>((resolve) => {
        const timer = window.setTimeout(resolve, delay);
        timers.push(timer);
      });

    const refreshSession = async () => {
      for (const delay of SESSION_REFRESH_DELAYS_MS) {
        if (delay) await wait(delay);
        if (!active) return;
        const refresh = sessionChangeRef.current;
        if (refresh) {
          refreshInFlight ??= Promise.resolve()
            .then(refresh)
            .catch(() => undefined)
            .finally(() => {
              refreshInFlight = null;
            });
          await Promise.race([
            refreshInFlight,
            wait(SESSION_REFRESH_ATTEMPT_TIMEOUT_MS),
          ]);
        }
      }

      await wait(500);
      if (!active) return;
      setSignIn((current) =>
        current.kind === "verified" ? { ...current, stalled: true } : current
      );
    };

    void refreshSession();
    return () => {
      active = false;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [signIn.kind, signedIn, verifiedStalled]);

  const sendCode = useCallback(async () => {
    const address = email.trim();
    if (!address) return;
    if (!EMAIL_ADDRESS_PATTERN.test(address) || emailRef.current?.validity.valid === false) {
      setSignIn({ kind: "email", sending: false, error: "auth.err_email_invalid" });
      emailRef.current?.focus();
      return;
    }
    setSignIn({ kind: "email", sending: true, error: null });
    const attempt = ++sendAttemptRef.current;
    const enterCodeStep = (delivery: "confirmed" | "indeterminate") => {
      if (sendAttemptRef.current !== attempt) return;
      const at = Date.now();
      setCode("");
      setSentAt(at);
      setNow(at);
      setSignIn({
        kind: "code",
        email: address,
        checking: false,
        error: null,
        delivery,
      });
    };

    try {
      const outcome = await waitForOtpSend(
        authClient.emailOtp.sendVerificationOtp({
          email: address,
          type: "sign-in",
        })
      );
      if (sendAttemptRef.current !== attempt) return;
      if (outcome.kind === "timed_out") {
        enterCodeStep("indeterminate");
        return;
      }
      const { error } = outcome.result;
      if (error) {
        setSignIn({ kind: "email", sending: false, error: sendErrorKey(error) });
        return;
      }
      enterCodeStep("confirmed");
    } catch (err) {
      if (sendAttemptRef.current !== attempt) return;
      console.error("ProfileSheet: could not send the sign-in code", err);
      const providerError = thrownFetchError(err);
      setSignIn({
        kind: "email",
        sending: false,
        error: providerError ? sendErrorKey(providerError) : "auth.err_send_network",
      });
    }
  }, [email]);

  /**
   * A real resend.
   *
   * The only way to get a second code used to be "Use a different email", which
   * works, `email` survives, so you land on a filled field and press Send again
   *, but nobody whose code expired goes looking for a control that offers them
   * a DIFFERENT address. It was a resend hidden behind a label describing
   * something else. The code lives 300s and mail lands in spam; that needs a
   * control that says what it does.
   */
  const resendCode = useCallback(async () => {
    if (signIn.kind !== "code" || cooling) return;
    const address = signIn.email;
    const at = Date.now();
    setCode("");
    const attempt = ++sendAttemptRef.current;
    // Optimistic: the countdown is the receipt, on the same frame as the tap.
    setSentAt(at);
    setNow(at);
    setSignIn({
      kind: "code",
      email: address,
      checking: false,
      error: null,
      delivery: signIn.delivery,
    });
    try {
      const { error } = await authClient.emailOtp.sendVerificationOtp({
        email: address,
        type: "sign-in",
      });
      if (sendAttemptRef.current !== attempt) return;
      if (error) {
        // No code is coming, so a cooldown would only be a second dead end.
        setSentAt(0);
        setSignIn((current) =>
          current.kind === "code" && current.email === address
            ? { ...current, checking: false, error: sendErrorKey(error) }
            : current
        );
        return;
      }
      setSignIn((current) =>
        current.kind === "code" && current.email === address
          ? { ...current, delivery: "confirmed" }
          : current
      );
    } catch (err) {
      if (sendAttemptRef.current !== attempt) return;
      console.error("ProfileSheet: could not resend the sign-in code", err);
      setSentAt(0);
      const providerError = thrownFetchError(err);
      setSignIn((current) =>
        current.kind === "code" && current.email === address
          ? {
              ...current,
              checking: false,
              error: providerError ? sendErrorKey(providerError) : "auth.err_send_network",
            }
          : current
      );
    }
  }, [signIn, cooling]);

  const submitCode = useCallback(
    async (otp: string) => {
      if (signIn.kind !== "code") return;
      sendAttemptRef.current += 1;
      setSignIn({ ...signIn, checking: true, error: null });
      try {
        const { error } = await authClient.signIn.emailOtp({ email: signIn.email, otp });
        if (error) {
          setCode("");
          setSignIn({ ...signIn, checking: false, error: codeErrorKey(error) });
          codeRef.current?.focus();
          return;
        }
        // NOT `idle`, see the `verified` note on SignIn. The session has not
        // arrived, and `idle` renders the sign-in CTA at the exact instant the
        // sign-in succeeded.
        setSignIn({ kind: "verified", email: signIn.email, stalled: false });
        setCode("");
      } catch (err) {
        console.error("ProfileSheet: could not verify the sign-in code", err);
        const providerError = thrownFetchError(err);
        if (providerError) {
          setCode("");
          setSignIn({ ...signIn, checking: false, error: codeErrorKey(providerError) });
          codeRef.current?.focus();
          return;
        }
        // The code is NOT cleared here, unlike the rejected-code path above: the
        // network failed, the six digits are probably right, and making someone
        // retype them to recover from our outage is a punishment. `showRetry`
        // turns this exact state into a button, without one, auto-submit cannot
        // re-fire (the value is already six long) and the step is a dead end.
        setSignIn({ ...signIn, checking: false, error: "auth.err_code_network" });
      }
    },
    [signIn]
  );

  const retry = useCallback(async () => {
    setRetrying(true);
    await submitCode(code);
    setRetrying(false);
  }, [submitCode, code]);

  const retrySession = useCallback(() => {
    setSignIn((current) =>
      current.kind === "verified" ? { ...current, stalled: false } : current
    );
  }, []);

  const signOut = useCallback(async () => {
    setSigningOut(true);
    setSignOutError(null);
    try {
      const { error } = await authClient.signOut();
      if (error) {
        setSignOutError("auth.err_sign_out");
        return;
      }
      onSessionChange?.();
    } catch (err) {
      console.error("ProfileSheet: could not sign out", err);
      setSignOutError("auth.err_sign_out");
    } finally {
      setSigningOut(false);
    }
  }, [onSessionChange]);

  const showRetry =
    signIn.kind === "code" &&
    code.length === 6 &&
    (retrying || signIn.error === "auth.err_code_network");

  /**
   * The name is `||`, never `??`. Email OTP mints users with `name: ""`, and
   * `??` only catches null and undefined, so a nullish fallback renders a blank
   * row and an initial-less avatar for a signed-in user, i.e. identical to
   * signed out. The one visible proof that sign-in worked would be the thing
   * that disappears.
   */
  const displayName = user ? user.name || user.email : null;

  /**
   * The identity block follows the step. It used to read "Sign in to WetinDey /
   * Save markets and track your reports" through all three states, so the code
   * step announced a sign-in that had already started while an OTP field sat
   * under it.
   *
   * The subtitle is where "Sent to {email}" belongs, it was a separate line
   * below the field, restating the flow's own position. Moved, not added: this
   * is a line of copy removed. And it is the one fact a user cannot recover for
   * themselves at that moment (did it go to the typo, or the real address?),
   * which is what makes "Use a different email" legible underneath it.
   *
   * Signed in, the subtitle is the email, and nothing at all when the name is
   * empty, which is everyone who arrived by OTP, because the title is already
   * showing that same email.
   */
  let identityName: string;
  let identitySub: string | null;
  if (user) {
    identityName = user.name || user.email;
    identitySub = user.name ? user.email : null;
  } else if (signIn.kind === "code") {
    if (signIn.delivery === "indeterminate") {
      identityName = signIn.email;
      identitySub = null;
    } else {
      identityName = t("auth.check_mail");
      identitySub = t("auth.sent_to", { email: signIn.email });
    }
  } else if (signIn.kind === "verified") {
    identityName = t("auth.code_accepted");
    identitySub = signIn.email;
  } else {
    identityName = t("profile.signed_out_name");
    /**
     * NO SUBTITLE, and its absence is the honest answer rather than a gap.
     *
     * Apple does ask for the benefit of an account in the sign-in view. The line
     * that was here, "Save markets and track your reports", named the only two
     * rows in this sheet that are permanently disabled, in every session state,
     * because neither has a destination yet. Signing in did not enable them and
     * could not: being signed in is not a destination, which is the rule that
     * disables them in the first place.
     *
     * So the app was promising, to someone deciding whether to hand over their
     * email, the two things it certainly would not do. That is the same defect as
     * the `reportCount` this file already deleted for rendering a confident "0
     * prices reported", a false claim at the moment of recognition, in a product
     * whose subject is trust.
     *
     * Restore a subtitle when signing in buys the user something real. The
     * candidate is contributor recognition (sources.auth_user_id), which is not
     * built. Until then this says nothing, because there is nothing true to say.
     */
    identitySub = null;
  }

  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title={signedIn ? t("profile.title_signed_in") : t("profile.title_signed_out")}
      size="form"
    >
      <div className="space-y-6 py-3">
        {/* Identity, a centered vertical stack: avatar over name over email, the
            shape Apple Maps uses for its account sheet. The three sign-in states
            (prompt / check-mail / verified) flow through the same `identityName` /
            `identitySub` below, so they centre cleanly with no extra branch. */}
        <div className="flex flex-col items-center gap-2 px-6 text-center">
          <Avatar name={displayName ?? undefined} url={profile?.avatarUrl} size={64} />
          <div className="min-w-0 max-w-full">
            <p className="truncate text-title-3 font-semibold text-text-primary">{identityName}</p>
            {identitySub && (
              /* Wraps rather than truncates: this carries the email address, and
                 an ellipsis through the domain would hide the exact character
                 the line exists to let someone check. */
              <p className="break-words text-subhead text-text-secondary">{identitySub}</p>
            )}
          </div>
        </div>

        {/* Sign in. Three states of one block, it never leaves the sheet.
            Keyed on the step so each one settles in rather than teleporting. */}
        {!signedIn && (
          <div
            key={signIn.kind}
            className="mx-4 space-y-3 animate-in fade-in slide-in-from-bottom-1 duration-standard ease-spring"
          >
            {signIn.kind === "idle" && (
              <Button
                variant="primary"
                size="md"
                className="w-full"
                onClick={() => setSignIn({ kind: "email", sending: false, error: null })}
              >
                {t("auth.sign_in")}
              </Button>
            )}

            {/* Verified, session in flight. The usual path stays visually quiet;
                the accessible label names the work. If the bounded refetch loop
                expires, this becomes an explicit recovery control instead of an
                unbounded spinner.

                The arc is Button's: a conic gradient behind a radial mask, so it
                reads as a ring without a stroke. Copied rather than imported
                because Button only exposes it through `isLoading`, and there is
                no button here to load. */}
            {signIn.kind === "verified" && (
              signIn.stalled ? (
                <div className="space-y-3 text-center" role="status">
                  <p className="text-subhead text-text-secondary">{t("auth.session_stalled")}</p>
                  <Button
                    variant="secondary"
                    size="md"
                    className="w-full"
                    onClick={retrySession}
                  >
                    {t("auth.refresh_session")}
                  </Button>
                </div>
              ) : (
                <div
                  className="flex min-h-tap items-center justify-center"
                  role="status"
                  aria-label={t("auth.session_refreshing")}
                >
                  <span
                    aria-hidden
                    className="h-5 w-5 animate-spin squircle-full text-text-secondary"
                    style={{
                      background:
                        "conic-gradient(from 0deg, transparent 0turn, currentColor 1turn)",
                      WebkitMask:
                        "radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px))",
                      mask: "radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px))",
                    }}
                  />
                </div>
              )
            )}

            {signIn.kind === "email" && (
              <>
                <Input
                  ref={emailRef}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (signIn.error) {
                      setSignIn({ kind: "email", sending: false, error: null });
                    }
                  }}
                  onKeyDown={(e) => e.key === "Enter" && void sendCode()}
                  placeholder={t("auth.email_label")}
                  aria-label={t("auth.email_label")}
                  aria-invalid={signIn.error ? true : undefined}
                  disabled={signIn.sending}
                  error={signIn.error ? t(signIn.error) : undefined}
                />
                <Button
                  variant="primary"
                  size="md"
                  className="w-full"
                  onClick={() => void sendCode()}
                  isLoading={signIn.sending}
                  disabled={signIn.sending || !email.trim()}
                >
                  {/* The title does not change to "Sending…". The spinner is
                      already saying it, and Apple names "loading"-class labels as
                      words that seldom add value. `isLoading` carries the state;
                      the button keeps saying what it does. */}
                  {t("auth.send_code")}
                </Button>
              </>
            )}

            {signIn.kind === "code" && (
              <>
                {/* ONE field, deliberately, not six boxes.
                    `autocomplete="one-time-code"` is the whole mechanism: it is
                    what makes iOS offer the code above the keyboard, and Apple's
                    own web guidance is a single input carrying exactly this
                    attribute. Segmented boxes have no basis in the HIG (its only
                    digit-entry component is tvOS-only), and they would break both
                    that autofill and the paste this strips whitespace for. They
                    photograph better and work worse. */}
                <Input
                  ref={codeRef}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => {
                    // Digits only: the generator is
                    // generateRandomString(6, "0-9"), so anything else is a typo
                    // or a paste with whitespace, and stripping beats rejecting.
                    const next = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setCode(next);
                    // Auto-submit at six. The length IS the commit, asking for a
                    // tap after the last digit is a step that carries no decision.
                    if (next.length === 6 && !signIn.checking) void submitCode(next);
                  }}
                  placeholder={t("auth.code_label")}
                  aria-label={t("auth.code_label")}
                  aria-invalid={signIn.error ? true : undefined}
                  disabled={signIn.checking}
                  className="tabular-nums"
                  error={signIn.error ? t(signIn.error) : undefined}
                />

                {showRetry && (
                  <Button
                    variant="secondary"
                    size="md"
                    className="w-full"
                    onClick={() => void retry()}
                    isLoading={retrying}
                    disabled={retrying}
                  >
                    {t("auth.retry")}
                  </Button>
                )}

                <div className="flex items-center gap-5">
                  <button
                    type="button"
                    onClick={() => void resendCode()}
                    disabled={cooling}
                    className="min-h-tap text-subhead text-accent active:opacity-60 disabled:text-text-tertiary"
                  >
                    {cooling ? t("auth.resend_in", { seconds: cooldown }) : t("auth.resend")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      sendAttemptRef.current += 1;
                      setSignIn({ kind: "email", sending: false, error: null });
                    }}
                    className="min-h-tap text-subhead text-accent active:opacity-60"
                  >
                    {t("auth.different_email")}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Manage profile, the FIRST row, and SIGNED-IN ONLY. Editing your own
            name and contact is inherently owner-scoped (there is nothing to
            manage without a session, and `updateMyProfile` refuses one), so unlike
            the rows below it does not render for a signed-out reader. Its own
            group so it sits apart as the account's primary action. */}
        {signedIn && (
          <ListGroup>
            <ListRow
              icon={<UserRound />}
              label={t("profile.manage")}
              onClick={() => {
                // Dismiss first, like every other row here: two stacked sheets
                // would bury this one behind the next with no way back to it.
                onClose();
                onOpenManageProfile();
              }}
            />
          </ListGroup>
        )}

        <ListGroup>
          {/* Enabled in BOTH session states, and not disabled while signed out.
              The rule above, rows with no destination are disabled, is about
              DESTINATIONS, not auth, and this row now has one. Signing out does
              not remove the destination; it changes what the destination says.
              Disabling it for a signed-out user would reproduce the exact "still
              muted" complaint that opened this work, permanently, for the app's
              default state (ADR-003: reading is anonymous, forever). */}
          <ListRow
            icon={<TrendingUp />}
            label={t("profile.my_reports")}
            onClick={() => {
              // Dismiss first, like Change area and Settings: two stacked sheets
              // would bury this one behind the next with no way back to it.
              onClose();
              onOpenMyReports();
            }}
          />
          <ListRow
            icon={<Bookmark />}
            label={t("profile.saved_markets")}
            disabled
            onClick={() => {}}
          />
          {/* The one row here that has always had somewhere to go. It is a peer
              of the map's location pill, same store, same label, so reaching
              it from the navigation hub and from the map lands on one sheet. */}
          <ListRow
            icon={<MapPin />}
            label={t("profile.change_area")}
            detail={currentAreaName}
            onClick={() => {
              // Dismiss first, like Settings below: two stacked sheets would
              // bury this one behind the next with no way back to it.
              onClose();
              onChangeArea();
            }}
          />
        </ListGroup>

        <ListGroup>
          <ListRow
            icon={<Settings />}
            label={t("profile.settings")}
            onClick={() => {
              onClose();
              onOpenSettings();
            }}
          />
          <ListRow
            icon={<Flag />}
            label={t("profile.report_problem")}
            onClick={() => {
              // Dismiss first, like Settings and Change area above: two stacked
              // sheets would bury this one with no way back to it.
              onClose();
              onOpenReportProblem();
            }}
          />
          <ListRow
            icon={<CircleHelp />}
            label={t("profile.about")}
            onClick={() => {
              // Dismiss first, like Settings and Report a problem above: two
              // stacked sheets would bury this one with no way back to it.
              onClose();
              onOpenAbout();
            }}
          />
        </ListGroup>

        {/*
          Sign out. Last, alone in its own group, where Apple puts it, and the
          only reason it needs no label above it.

          NOT red, and no confirmation. The HIG reserves the destructive red for
          actions "that can result in data destruction"; signing out of a price
          map destroys nothing, the account and every report survive, and you
          undo it by signing back in. Apple's own Settings renders Sign Out red
          because there it means erase iCloud data from this device. It does not
          mean that here. Alerts are likewise "for common, undoable actions" the
          thing to avoid, and this is the definition of one. Ceremony that isn't
          earned reads as a warning about something else.

          No icon and no chevron: it is neither a category nor a destination.
        */}
        {signedIn && (
          <div className="space-y-1.5">
            <ListGroup>
              <ListRow
                label={t("auth.sign_out")}
                chevron={false}
                disabled={signingOut}
                onClick={() => void signOut()}
              />
            </ListGroup>
            {signOutError && (
              /* ListGroup's own `footer` slot would be the obvious home, but it
                 paints text-secondary, a note, not a failure. Without this the
                 row is a tap that silently does nothing. */
              <p role="alert" className="px-4 text-footnote text-status-unavailable">
                {t(signOutError)}
              </p>
            )}
          </div>
        )}
      </div>
    </ModalSheet>
  );
}

/**
 * Avatar. Initials on a fill until there is auth and a real image.
 * Uses accent/accent-contrast rather than a literal, so it inverts with theme
 * instead of going white-on-white.
 */
export function Avatar({ name, url, size = 32 }: { name?: string; url?: string | null; size?: number }) {
  const initials = (name ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <span
      aria-hidden
      className="relative grid shrink-0 place-items-center squircle-full bg-fillPrimary text-text-primary overflow-hidden"
      style={{ width: size, height: size }}
    >
      {url ? (
        <Image
          src={url}
          alt={name ?? "Avatar"}
          fill
          sizes={`${size}px`}
          className="object-cover"
        />
      ) : initials ? (
        <span className="text-subhead font-semibold">{initials}</span>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" className="h-1/2 w-1/2" aria-hidden>
          <circle cx="12" cy="8" r="3.5" fill="currentColor" opacity="0.55" />
          <path d="M4.5 20a7.5 7.5 0 0 1 15 0" fill="currentColor" opacity="0.55" />
        </svg>
      )}
    </span>
  );
}
