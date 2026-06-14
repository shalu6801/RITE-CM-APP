import React, { useState } from "react";
import { auth, storeSession } from "../auth";
import { IconEye, IconEyeOff } from "./Icons";

type Mode = "pickIdentity" | "otp" | "password" | "reset";

const IDENTITIES: { id: string; kind: "email" | "phone"; label: string }[] = [
  { id: "riteeducational@gmail.com", kind: "email", label: "Email · riteeducational@gmail.com" },
  { id: "9812828132",                kind: "phone", label: "Phone · +91 98128 28132" },
  { id: "9354276055",                kind: "phone", label: "Phone · +91 93542 76055" },
];

interface Props {
  onAuthenticated: (token: string, identity: string) => void;
}

/**
 * Full-screen login experience.
 *
 *  Steps:
 *    1. pickIdentity → choose one of the 3 hardcoded identities.
 *    2. Either:
 *        • password   → enter password (after one has been set).
 *        • otp        → "Send OTP" → enter 6-digit code.
 *    3. Forgot password? → OTP flow → new password → logged in.
 */
export default function LoginPage({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<Mode>("pickIdentity");
  const [identity, setIdentity] = useState<string>("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [otpSent, setOtpSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const reset = () => {
    setOtp(""); setPassword(""); setNewPassword("");
    setInfo(""); setError(""); setOtpSent(false);
  };

  const sendOtp = async () => {
    setBusy(true); setError(""); setInfo("");
    const r = await auth.sendOtp(identity);
    setBusy(false);
    if (!r.ok) return setError(humanError(r.error));
    setOtpSent(true);
    setInfo(
      r.channel === "email" ? "OTP sent to your email." :
      r.channel === "sms"   ? "OTP sent via SMS." :
      "OTP printed to the backend terminal (console mode)."
    );
  };

  const verifyOtp = async () => {
    setBusy(true); setError("");
    const r = await auth.verifyOtp(identity, otp);
    setBusy(false);
    if (!r.ok || !r.token) return setError(humanError(r.error));
    storeSession(r.token, r.identity || identity);
    onAuthenticated(r.token, r.identity || identity);
  };

  const loginPwd = async () => {
    setBusy(true); setError("");
    const r = await auth.loginPassword(identity, password);
    setBusy(false);
    if (!r.ok || !r.token) return setError(humanError(r.error));
    storeSession(r.token, r.identity || identity);
    onAuthenticated(r.token, r.identity || identity);
  };

  const resetPwd = async () => {
    setBusy(true); setError("");
    const r = await auth.resetPassword(identity, otp, newPassword);
    setBusy(false);
    if (!r.ok || !r.token) return setError(humanError(r.error));
    storeSession(r.token, r.identity || identity);
    onAuthenticated(r.token, r.identity || identity);
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-2xl font-bold text-white shadow-pop">
            R
          </div>
          <div>
            <h1 className="text-xl font-semibold text-ink-900">RITE CM APP</h1>
            <p className="mt-1 text-sm text-ink-500">Sign in to manage candidates &amp; print documents.</p>
          </div>
        </div>

        <div className="card p-6">
          {mode === "pickIdentity" && (
            <div className="space-y-3">
              <h2 className="text-[12px] font-semibold uppercase tracking-wider text-ink-700">Choose your account</h2>
              {IDENTITIES.map((it) => (
                <button
                  key={it.id}
                  className={`flex w-full items-center justify-between rounded-xl border-2 px-4 py-3 text-left transition ${
                    identity === it.id ? "border-brand-500 bg-brand-50" : "border-ink-200 hover:border-ink-300"
                  }`}
                  onClick={() => setIdentity(it.id)}
                >
                  <span className="text-sm font-medium text-ink-800">{it.label}</span>
                  <span className="text-[11px] uppercase tracking-wider text-ink-400">{it.kind === "email" ? "Email" : "SMS"}</span>
                </button>
              ))}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  className="btn-secondary"
                  disabled={!identity}
                  onClick={() => { reset(); setMode("password"); }}
                >
                  Use password
                </button>
                <button
                  className="btn-primary"
                  disabled={!identity}
                  onClick={() => { reset(); setMode("otp"); }}
                >
                  Continue with OTP
                </button>
              </div>
            </div>
          )}

          {mode === "otp" && (
            <div className="space-y-3">
              <BackButton onClick={() => { reset(); setMode("pickIdentity"); }} />
              <h2 className="text-[12px] font-semibold uppercase tracking-wider text-ink-700">One-time password</h2>
              <p className="text-[12px] text-ink-500">
                We will send a 6-digit code to <strong className="text-ink-800">{identity}</strong>.
              </p>
              {!otpSent ? (
                <button className="btn-primary w-full" disabled={busy} onClick={sendOtp}>
                  {busy ? "Sending…" : "Send OTP"}
                </button>
              ) : (
                <>
                  <label className="field-label">Enter the 6-digit OTP</label>
                  <input
                    className="input text-center font-mono text-xl tracking-[0.4em]"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    onKeyDown={(e) => e.key === "Enter" && otp.length === 6 && verifyOtp()}
                  />
                  <button className="btn-primary w-full" disabled={busy || otp.length !== 6} onClick={verifyOtp}>
                    {busy ? "Verifying…" : "Verify & sign in"}
                  </button>
                  <div className="flex items-center justify-between text-[12px]">
                    <button className="text-ink-500 hover:underline" onClick={sendOtp} disabled={busy}>Resend OTP</button>
                    <button className="text-ink-500 hover:underline" onClick={() => { reset(); setMode("pickIdentity"); }}>Use different account</button>
                  </div>
                </>
              )}
            </div>
          )}

          {mode === "password" && (
            <div className="space-y-3">
              <BackButton onClick={() => { reset(); setMode("pickIdentity"); }} />
              <h2 className="text-[12px] font-semibold uppercase tracking-wider text-ink-700">Password sign-in</h2>
              <p className="text-[12px] text-ink-500">For <strong className="text-ink-800">{identity}</strong>.</p>
              <label className="field-label">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="input pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && password && loginPwd()}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-ink-400 hover:text-ink-700"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                </button>
              </div>
              <button className="btn-primary w-full" disabled={busy || !password} onClick={loginPwd}>
                {busy ? "Signing in…" : "Sign in"}
              </button>
              <button
                className="block w-full text-[12px] text-brand-600 hover:underline"
                onClick={() => { reset(); setMode("reset"); }}
              >
                Forgot password / Set new password?
              </button>
            </div>
          )}

          {mode === "reset" && (
            <div className="space-y-3">
              <BackButton onClick={() => { reset(); setMode("password"); }} />
              <h2 className="text-[12px] font-semibold uppercase tracking-wider text-ink-700">Set / reset password</h2>
              <p className="text-[12px] text-ink-500">For <strong className="text-ink-800">{identity}</strong>.</p>
              {!otpSent ? (
                <button className="btn-primary w-full" disabled={busy} onClick={sendOtp}>
                  {busy ? "Sending…" : "Send OTP to verify"}
                </button>
              ) : (
                <>
                  <label className="field-label">OTP</label>
                  <input
                    className="input text-center font-mono tracking-[0.3em]"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  />
                  <label className="field-label">New password (min 6 chars)</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      className="input pr-10"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-ink-400 hover:text-ink-700"
                      aria-label={showNewPassword ? "Hide password" : "Show password"}
                      tabIndex={-1}
                    >
                      {showNewPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                    </button>
                  </div>
                  <button
                    className="btn-primary w-full"
                    disabled={busy || otp.length !== 6 || newPassword.length < 6}
                    onClick={resetPwd}
                  >
                    {busy ? "Saving…" : "Set password & sign in"}
                  </button>
                </>
              )}
            </div>
          )}

          {info && <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-[12px] text-brand-700">{info}</p>}
          {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-[12px] text-rose-700">{error}</p>}
        </div>

        <p className="mt-4 text-center text-[11px] text-ink-400">
          OTPs are sent to your registered email or phone. Verification happens on the auth backend (default port 4000).
        </p>
      </div>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="text-[12px] text-ink-500 hover:text-ink-900" onClick={onClick}>
      ← Back
    </button>
  );
}

function humanError(code?: string): string {
  switch (code) {
    case "no_otp":            return "OTP not requested or expired. Please request a fresh one.";
    case "expired":           return "OTP has expired — please request a new one.";
    case "wrong_otp":         return "OTP didn't match. Try again.";
    case "too_many_attempts": return "Too many attempts. Please request a new OTP.";
    case "no_password_set":   return "No password set yet — use OTP login first, then set one.";
    case "wrong_password":    return "Incorrect password.";
    case "weak_password":     return "Password is too short (minimum 6 characters).";
    case "missing_password":  return "Please enter a password.";
    default:                  return code || "Sign-in failed.";
  }
}
