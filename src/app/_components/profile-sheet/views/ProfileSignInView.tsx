import { Button, Input } from "../imports/imports";
import type { useProfileSheet } from "../hooks/useProfileSheet";

interface ProfileSignInViewProps {
  sheet: ReturnType<typeof useProfileSheet>;
}

export function ProfileSignInView({ sheet }: ProfileSignInViewProps) {
  const {
    t,
    signIn,
    setSignIn,
    email,
    setEmail,
    code,
    setCode,
    retrying,
    cooldown,
    cooling,
    emailRef,
    codeRef,
    sendCode,
    resendCode,
    submitCode,
    retry,
    retrySession,
  } = sheet;

  const showRetry =
    signIn.kind === "code" &&
    code.length === 6 &&
    (retrying || signIn.error === "auth.err_code_network");

  return (
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

      {signIn.kind === "verified" &&
        (signIn.stalled ? (
          <div className="space-y-3 text-center" role="status">
            <p className="text-subhead text-text-secondary">{t("auth.session_stalled")}</p>
            <Button variant="secondary" size="md" className="w-full" onClick={retrySession}>
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
                background: "conic-gradient(from 0deg, transparent 0turn, currentColor 1turn)",
                WebkitMask:
                  "radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px))",
                mask: "radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px))",
              }}
            />
          </div>
        ))}

      {signIn.kind === "email" && (
        <>
          <Input
            ref={emailRef}
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (signIn.error) {
                setSignIn({ kind: "email", sending: false, error: null });
              }
            }}
            onKeyDown={(event) => event.key === "Enter" && void sendCode()}
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
            {t("auth.send_code")}
          </Button>
        </>
      )}

      {signIn.kind === "code" && (
        <>
          <Input
            ref={codeRef}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => {
              const next = event.target.value.replace(/\D/g, "").slice(0, 6);
              setCode(next);
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
              onClick={() => setSignIn({ kind: "email", sending: false, error: null })}
              className="min-h-tap text-subhead text-accent active:opacity-60"
            >
              {t("auth.different_email")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
