import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/core/i18n";
import { authClient } from "@/lib/auth-client";
import { getMyProfile, type MyProfile } from "@/app/_actions/actions";

export interface ProfileSheetProps {
  open: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  onChangeArea: () => void;
  onOpenMyReports: () => void;
  onOpenReportProblem: () => void;
  onOpenAbout: () => void;
  onOpenManageProfile: () => void;
  currentAreaName: string;
  user?: { name: string; email: string } | null;
  onSessionChange?: () => void | Promise<void>;
}

export type AuthErrorKey =
  | "auth.err_send"
  | "auth.err_send_network"
  | "auth.err_email_invalid"
  | "auth.err_rate_limited"
  | "auth.err_code_wrong"
  | "auth.err_code_expired"
  | "auth.err_code_attempts"
  | "auth.err_code_network"
  | "auth.err_code";

export type SignIn =
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
  if (e.code === "OTP_EXPIRED" || e.code === "OTP_NOT_FOUND") return "auth.err_code_expired";
  if (e.code === "TOO_MANY_ATTEMPTS") return "auth.err_code_attempts";
  return "auth.err_code";
}

const RESEND_COOLDOWN_MS = 60_000;
const OTP_SEND_WAIT_TIMEOUT_MS = 5_000;
const SESSION_REFRESH_DELAYS_MS = [0, 300, 800, 1_600] as const;
const SESSION_REFRESH_ATTEMPT_TIMEOUT_MS = 1_500;
const EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type OtpSendResult = Awaited<ReturnType<typeof authClient.emailOtp.sendVerificationOtp>>;
type BoundedOtpSendResult =
  | { kind: "settled"; result: OtpSendResult }
  | { kind: "timed_out" };

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

export function useProfileSheet(props: ProfileSheetProps) {
  const { open, user, onSessionChange } = props;
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
  const [sentAt, setSentAt] = useState(0);
  const [now, setNow] = useState(0);
  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const sessionChangeRef = useRef(onSessionChange);
  const sendAttemptRef = useRef(0);

  useEffect(() => {
    sessionChangeRef.current = onSessionChange;
  }, [onSessionChange]);

  useEffect(() => {
    if (open) return;
    sendAttemptRef.current += 1;
    setSignIn({ kind: "idle" });
    setCode("");
    setSentAt(0);
    setRetrying(false);
    setSignOutError(null);
  }, [open]);

  useEffect(() => {
    if (signedIn) {
      sendAttemptRef.current += 1;
      setSignIn({ kind: "idle" });
    }
  }, [signedIn]);

  useEffect(() => {
    if (signIn.kind === "email") emailRef.current?.focus();
    else if (signIn.kind === "code") codeRef.current?.focus();
  }, [signIn.kind]);

  const cooldown = sentAt ? Math.max(0, Math.ceil((sentAt + RESEND_COOLDOWN_MS - now) / 1000)) : 0;
  const cooling = cooldown > 0;

  useEffect(() => {
    if (signIn.kind !== "code" || !cooling) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [signIn.kind, cooling]);

  const verifiedStalled = signIn.kind === "verified" && signIn.stalled;

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

  const resendCode = useCallback(async () => {
    if (signIn.kind !== "code" || cooling) return;
    const address = signIn.email;
    const at = Date.now();
    setCode("");
    const attempt = ++sendAttemptRef.current;
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
        console.error("ProfileSheet: authClient.signOut failed", error);
        setSignOutError("auth.err_sign_out");
        setSigningOut(false);
        return;
      }
      setSigningOut(false);
      setSignIn({ kind: "idle" });
      void sessionChangeRef.current?.();
    } catch (err) {
      console.error("ProfileSheet: signOut threw", err);
      setSignOutError("auth.err_sign_out");
      setSigningOut(false);
    }
  }, []);

  return {
    t,
    signedIn,
    profile,
    signIn,
    setSignIn,
    email,
    setEmail,
    code,
    setCode,
    retrying,
    signingOut,
    signOutError,
    cooldown,
    cooling,
    emailRef,
    codeRef,
    sendCode,
    resendCode,
    submitCode,
    retry,
    retrySession,
    signOut,
  };
}
