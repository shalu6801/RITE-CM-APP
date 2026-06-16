import React, { useState } from "react";
import { auth, storeSession } from "../auth";
import { IconEye, IconEyeOff } from "./Icons";

type Mode = "login" | "register";

interface Props {
  onAuthenticated: (token: string, identity: string) => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Full-screen login experience.
 *
 *  Modes:
 *    • login    → email + password sign in.
 *    • register → email + password sign up (creates the account, then signs in).
 */
export default function LoginPage({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const resetFields = () => {
    setPassword(""); setConfirmPassword(""); setError("");
    setShowPassword(false); setShowConfirm(false);
  };

  const switchMode = (next: Mode) => {
    resetFields();
    setMode(next);
  };

  const validEmail = EMAIL_RE.test(email.trim());
  const canSubmit =
    !busy &&
    validEmail &&
    password.length >= 6 &&
    (mode === "login" || password === confirmPassword);

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true); setError("");
    const r =
      mode === "login"
        ? await auth.login(email.trim().toLowerCase(), password)
        : await auth.register(email.trim().toLowerCase(), password);
    setBusy(false);
    if (!r.ok || !r.token) return setError(humanError(r.error));
    storeSession(r.token, r.identity || email.trim().toLowerCase());
    onAuthenticated(r.token, r.identity || email.trim().toLowerCase());
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && canSubmit) submit();
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
            <p className="mt-1 text-sm text-ink-500">
              {mode === "login"
                ? "Sign in to manage candidates & print documents."
                : "Create an account to get started."}
            </p>
          </div>
        </div>

        <div className="card p-6 space-y-3">
          <h2 className="text-[12px] font-semibold uppercase tracking-wider text-ink-700">
            {mode === "login" ? "Sign in" : "Sign up"}
          </h2>

          <label className="field-label">Email</label>
          <input
            type="email"
            className="input"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={onKey}
            autoFocus
            autoComplete="email"
          />

          <label className="field-label">Password</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              className="input pr-10"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={onKey}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
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

          {mode === "register" && (
            <>
              <label className="field-label">Confirm password</label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  className="input pr-10"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={onKey}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-ink-400 hover:text-ink-700"
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showConfirm ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                </button>
              </div>
              {confirmPassword.length > 0 && password !== confirmPassword && (
                <p className="text-[12px] text-rose-600">Passwords don't match.</p>
              )}
            </>
          )}

          <button className="btn-primary w-full" disabled={!canSubmit} onClick={submit}>
            {busy ? (mode === "login" ? "Signing in…" : "Creating account…") :
                    (mode === "login" ? "Sign in" : "Create account")}
          </button>

          <div className="pt-1 text-center text-[12px] text-ink-500">
            {mode === "login" ? (
              <>
                Don't have an account?{" "}
                <button className="text-brand-600 hover:underline" onClick={() => switchMode("register")}>
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button className="text-brand-600 hover:underline" onClick={() => switchMode("login")}>
                  Sign in
                </button>
              </>
            )}
          </div>

          {error && <p className="mt-1 rounded-lg bg-rose-50 px-3 py-2 text-[12px] text-rose-700">{error}</p>}
        </div>

        <p className="mt-4 text-center text-[11px] text-ink-400">
          Authentication runs against the auth backend (default port 4000).
        </p>
      </div>
    </div>
  );
}

function humanError(code?: string): string {
  switch (code) {
    case "invalid_email":         return "Please enter a valid email address.";
    case "missing_password":      return "Please enter a password.";
    case "weak_password":         return "Password is too short (minimum 6 characters).";
    case "email_already_exists":  return "An account with this email already exists. Try signing in.";
    case "user_not_found":        return "No account found for this email. Try signing up.";
    case "wrong_password":        return "Incorrect password.";
    case "register_failed":       return "Could not create the account. Please try again.";
    case "login_failed":          return "Could not sign in. Please try again.";
    default:                      return code || "Sign-in failed.";
  }
}
