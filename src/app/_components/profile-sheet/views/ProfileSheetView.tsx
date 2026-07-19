import React from "react";
import {
  Settings,
  Flag,
  Bookmark,
  MapPin,
  TrendingUp,
  CircleHelp,
  UserRound,
  ModalSheet,
  ListRow,
  ListGroup,
  Input,
  Button,
  Image,
} from "../imports/imports";
import type { ProfileSheetProps, useProfileSheet } from "../hooks/useProfileSheet";
import "../styles/ProfileSheet.css";

export interface ProfileSheetViewProps extends ProfileSheetProps {
  sheet: ReturnType<typeof useProfileSheet>;
}

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

export function ProfileSheetView({
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
  sheet,
}: ProfileSheetViewProps) {
  const {
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
  } = sheet;

  const showRetry =
    signIn.kind === "code" &&
    code.length === 6 &&
    (retrying || signIn.error === "auth.err_code_network");

  const displayName = user ? user.name || user.email : null;

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
        <div className="flex flex-col items-center gap-2 px-6 text-center">
          <Avatar name={displayName ?? undefined} url={profile?.avatarUrl} size={64} />
          <div className="min-w-0 max-w-full">
            <p className="truncate text-title-3 font-semibold text-text-primary">{identityName}</p>
            {identitySub && (
              <p className="break-words text-subhead text-text-secondary">{identitySub}</p>
            )}
          </div>
        </div>

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
                  onChange={(e) => {
                    const next = e.target.value.replace(/\D/g, "").slice(0, 6);
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
                    onClick={() => {
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

        {signedIn && (
          <ListGroup>
            <ListRow
              icon={<UserRound />}
              label={t("profile.manage")}
              onClick={() => {
                onClose();
                onOpenManageProfile();
              }}
            />
          </ListGroup>
        )}

        <ListGroup>
          <ListRow
            icon={<TrendingUp />}
            label={t("profile.my_reports")}
            onClick={() => {
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
          <ListRow
            icon={<MapPin />}
            label={t("profile.change_area")}
            detail={currentAreaName}
            onClick={() => {
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
              onClose();
              onOpenReportProblem();
            }}
          />
          <ListRow
            icon={<CircleHelp />}
            label={t("profile.about")}
            onClick={() => {
              onClose();
              onOpenAbout();
            }}
          />
        </ListGroup>

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
