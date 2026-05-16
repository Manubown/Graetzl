"use client";

import { useState, useTransition, useRef, useCallback } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { signUpWithPassword, signInWithPassword } from "@/lib/auth/actions";
import { track } from "@/lib/analytics/plausible";

export type Mode = "signup" | "signin";

export interface PasswordFormProps {
  mode: Mode;
  nextPath?: string;
}

type FormStatus = "idle" | "submitting" | "success" | "error" | "rate_limited";

const RATE_LIMIT_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_LOCKOUT_MS = 60 * 1000;

function getRateLimitKey(email: string) {
  return `graetzl:signin_attempts:${email.toLowerCase()}`;
}

interface RateLimitRecord {
  attempts: { ts: number }[];
  lockedUntil: number | null;
}

function readRecord(key: string): RateLimitRecord {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return { attempts: [], lockedUntil: null };
    return JSON.parse(raw) as RateLimitRecord;
  } catch {
    return { attempts: [], lockedUntil: null };
  }
}

function writeRecord(key: string, record: RateLimitRecord): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(record));
  } catch {
    // sessionStorage unavailable — silent degradation
  }
}

function checkRateLimit(email: string): { blocked: boolean; secondsLeft: number } {
  const key = getRateLimitKey(email);
  const now = Date.now();
  const record = readRecord(key);

  if (record.lockedUntil !== null && now < record.lockedUntil) {
    return { blocked: true, secondsLeft: Math.ceil((record.lockedUntil - now) / 1000) };
  }

  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const recent = record.attempts.filter((a) => a.ts > windowStart);

  if (recent.length >= RATE_LIMIT_ATTEMPTS) {
    const lockedUntil = now + RATE_LIMIT_LOCKOUT_MS;
    writeRecord(key, { attempts: recent, lockedUntil });
    return { blocked: true, secondsLeft: Math.ceil(RATE_LIMIT_LOCKOUT_MS / 1000) };
  }

  return { blocked: false, secondsLeft: 0 };
}

function recordFailedAttempt(email: string): void {
  const key = getRateLimitKey(email);
  const now = Date.now();
  const record = readRecord(key);
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const recent = record.attempts.filter((a) => a.ts > windowStart);
  recent.push({ ts: now });
  writeRecord(key, { attempts: recent, lockedUntil: record.lockedUntil });
}

function clearRateLimit(email: string): void {
  try {
    sessionStorage.removeItem(getRateLimitKey(email));
  } catch {
    // silent
  }
}

export function PasswordForm({ mode, nextPath = "/" }: PasswordFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [pending, startTransition] = useTransition();
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const canSubmit =
    status !== "rate_limited" &&
    email.length > 0 &&
    password.length >= 12 &&
    password.length <= 72;

  function handleInputChange() {
    if (status === "error") {
      setStatus("idle");
      setErrorMsg(null);
    }
  }

  const startCountdown = useCallback((seconds: number) => {
    setSecondsLeft(seconds);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(countdownRef.current!);
          countdownRef.current = null;
          setStatus("idle");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit || pending) return;

    if (mode === "signin") {
      const { blocked, secondsLeft: secs } = checkRateLimit(email);
      if (blocked) {
        setStatus("rate_limited");
        startCountdown(secs);
        return;
      }
      track("auth_signin_attempt", { method: "password" });
    }

    setStatus("submitting");
    setErrorMsg(null);

    const formData = new FormData();
    formData.set("email", email);
    formData.set("password", password);
    if (mode === "signin") {
      formData.set("next", nextPath);
    }

    startTransition(async () => {
      if (mode === "signup") {
        const result = await signUpWithPassword(formData);
        if (result.ok) {
          track("auth_signup", { method: "password" });
          setStatus("success");
        } else {
          setStatus("error");
          setErrorMsg(result.error);
        }
      } else {
        const result = await signInWithPassword(formData);
        if (!result.ok) {
          recordFailedAttempt(email);
          track("auth_signin_failed", { method: "password", reason: "invalid_credentials" });

          const { blocked, secondsLeft: secs } = checkRateLimit(email);
          if (blocked) {
            setStatus("rate_limited");
            startCountdown(secs);
          } else {
            setStatus("error");
            setErrorMsg(result.error);
          }
        } else {
          clearRateLimit(email);
        }
      }
    });
  }

  if (mode === "signup" && status === "success") {
    return (
      <div
        role="status"
        className="rounded-lg border border-border bg-muted/50 p-4 text-center text-sm"
      >
        <p className="font-medium">Bestätige deine E-Mail</p>
        <p className="mt-1 text-muted-foreground">
          Bitte prüfe dein Postfach und klicke den Bestätigungslink.
        </p>
      </div>
    );
  }

  const isLoading = pending || status === "submitting";
  const isRateLimited = status === "rate_limited";

  const submitLabel = isRateLimited
    ? `Bitte kurz warten. (${secondsLeft}s)`
    : isLoading
      ? mode === "signup"
        ? "Wird gesendet…"
        : "Wird angemeldet…"
      : mode === "signup"
        ? "Konto erstellen"
        : "Anmelden";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${mode}-email`} className="text-sm font-medium">
          E-Mail
        </label>
        <Input
          id={`${mode}-email`}
          type="email"
          required
          autoComplete="email"
          placeholder="du@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            handleInputChange();
          }}
          disabled={isLoading || isRateLimited}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${mode}-password`} className="text-sm font-medium">
          Passwort
        </label>
        <div className="relative">
          <Input
            id={`${mode}-password`}
            type={showPassword ? "text" : "password"}
            required
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            placeholder={mode === "signup" ? "mind. 12 Zeichen" : ""}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              handleInputChange();
            }}
            disabled={isLoading || isRateLimited}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Passwort verbergen" : "Passwort anzeigen"}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[var(--accent)] dark:focus-visible:ring-[var(--primary)]"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden />
            ) : (
              <Eye className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>
      </div>

      {(status === "error" || isRateLimited) && (
        <p role="alert" className="text-sm text-primary">
          {isRateLimited ? `Bitte kurz warten. (${secondsLeft}s)` : errorMsg}
        </p>
      )}

      <Button
        type="submit"
        variant="primary"
        className="w-full"
        disabled={!canSubmit || isLoading || isRateLimited}
      >
        {submitLabel}
      </Button>
    </form>
  );
}
