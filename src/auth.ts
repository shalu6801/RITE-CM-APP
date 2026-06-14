/**
 * Tiny client for the auth backend at `VITE_AUTH_API` (default http://localhost:4000).
 * Token + identity persist to localStorage; the rest of the app is gated on
 * `getStoredToken()` being present.
 */
const API = (import.meta.env.VITE_AUTH_API || "http://localhost:4000").replace(/\/+$/, "");
const TOKEN_KEY = "rite:auth:token";
const IDENTITY_KEY = "rite:auth:identity";

export interface AuthResult {
  ok: boolean;
  token?: string;
  identity?: string;
  channel?: "email" | "sms" | "console";
  error?: string;
}

async function post(path: string, body: any): Promise<AuthResult> {
  try {
    const res = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: json.error || `HTTP ${res.status}` };
    return json as AuthResult;
  } catch (err: any) {
    return { ok: false, error: err?.message || "Network error — is the auth backend running?" };
  }
}

export const auth = {
  sendOtp:        (identity: string) => post("/api/auth/send-otp", { identity }),
  verifyOtp:      (identity: string, otp: string) => post("/api/auth/verify-otp", { identity, otp }),
  loginPassword:  (identity: string, password: string) => post("/api/auth/login-password", { identity, password }),
  resetPassword:  (identity: string, otp: string, newPassword: string) =>
                    post("/api/auth/reset-password", { identity, otp, newPassword }),
};

export function getStoredToken(): string | null   { return localStorage.getItem(TOKEN_KEY); }
export function getStoredIdentity(): string | null { return localStorage.getItem(IDENTITY_KEY); }
export function storeSession(token: string, identity: string) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(IDENTITY_KEY, identity);
}
export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(IDENTITY_KEY);
}
