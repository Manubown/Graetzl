import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * A-7 parity verification tests for src/lib/auth/actions.ts
 *
 * Covers the server-action layer only. The Supabase client, next/navigation,
 * next/cache, and next/headers are replaced with in-process stubs so no
 * network calls are made and no Next.js runtime is required.
 *
 * Tests are grouped by action. Each test follows Arrange-Act-Assert.
 */

// ── Next.js stubs ──────────────────────────────────────────────────────────

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// redirect() throws a special error in Next.js. We hoist the mock fn so it
// can be referenced inside vi.mock factories (which are hoisted to the top of
// the file by Vitest's transform pass).
const mockRedirect = vi.hoisted(() =>
  vi.fn((path: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), {
      digest: `NEXT_REDIRECT;replace;${path};307;`,
    });
  }),
);
vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

// headers() returns a Map-like object. We always provide a sensible origin.
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Map([["origin", "https://graetzl.at"]])),
}));

// ── Supabase server stub ───────────────────────────────────────────────────

function makeAuthMock(overrides: {
  signUpError?: { message: string; status?: number } | null;
  signInError?: { message: string } | null;
  resetError?: { message: string } | null;
  updateError?: { message: string } | null;
  signOutError?: { message: string } | null;
} = {}) {
  return {
    auth: {
      signUp: vi.fn().mockResolvedValue({
        data: {},
        error: overrides.signUpError ?? null,
      }),
      signInWithPassword: vi.fn().mockResolvedValue({
        data: {},
        error: overrides.signInError ?? null,
      }),
      resetPasswordForEmail: vi.fn().mockResolvedValue({
        data: {},
        error: overrides.resetError ?? null,
      }),
      updateUser: vi.fn().mockResolvedValue({
        data: {},
        error: overrides.updateError ?? null,
      }),
      signOut: vi.fn().mockResolvedValue({
        error: overrides.signOutError ?? null,
      }),
    },
  };
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import {
  signUpWithPassword,
  signInWithPassword,
  requestPasswordReset,
  updateOwnPassword,
  signOut,
} from "./actions";

const mockedCreateClient = vi.mocked(createClient);

beforeEach(() => {
  vi.clearAllMocks();
});

// ── helpers ────────────────────────────────────────────────────────────────

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

// ── signUpWithPassword ─────────────────────────────────────────────────────

describe("signUpWithPassword", () => {
  it("returns { ok: true } when Supabase reports no error", async () => {
    // Arrange
    const mock = makeAuthMock({ signUpError: null });
    mockedCreateClient.mockResolvedValue(mock as never);

    // Act
    const result = await signUpWithPassword(
      makeFormData({ email: "test@example.com", password: "SecurePass123!" }),
    );

    // Assert
    expect(result).toEqual({ ok: true });
    expect(mock.auth.signUp).toHaveBeenCalledOnce();
  });

  it("passes emailRedirectTo pointing to /auth/callback?next=/onboarding/handle", async () => {
    // Arrange — success path
    const mock = makeAuthMock({ signUpError: null });
    mockedCreateClient.mockResolvedValue(mock as never);

    // Act
    await signUpWithPassword(
      makeFormData({ email: "test@example.com", password: "SecurePass123!" }),
    );

    // Assert — the redirect URL must include the onboarding path so both
    // auth paths route through the same onboarding gate (A-AC4.2).
    const callArgs = mock.auth.signUp.mock.calls[0]?.[0] as {
      options: { emailRedirectTo: string };
    };
    expect(callArgs.options.emailRedirectTo).toContain("/auth/callback");
    expect(callArgs.options.emailRedirectTo).toContain("/onboarding/handle");
  });

  it("rejects a password shorter than 12 characters without calling Supabase", async () => {
    // Arrange
    const mock = makeAuthMock();
    mockedCreateClient.mockResolvedValue(mock as never);

    // Act
    const result = await signUpWithPassword(
      makeFormData({ email: "test@example.com", password: "short" }),
    );

    // Assert
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toContain("12 Zeichen");
    expect(mock.auth.signUp).not.toHaveBeenCalled();
  });

  it("rejects a password longer than 72 characters without calling Supabase", async () => {
    // Arrange
    const mock = makeAuthMock();
    mockedCreateClient.mockResolvedValue(mock as never);

    // Act
    const result = await signUpWithPassword(
      makeFormData({ email: "test@example.com", password: "A".repeat(73) }),
    );

    // Assert
    expect(result.ok).toBe(false);
    expect(mock.auth.signUp).not.toHaveBeenCalled();
  });

  it("maps 'invalid email' Supabase error to the German localised message", async () => {
    // Arrange
    const mock = makeAuthMock({
      signUpError: { message: "invalid email address format" },
    });
    mockedCreateClient.mockResolvedValue(mock as never);

    // Act
    const result = await signUpWithPassword(
      makeFormData({ email: "not-an-email", password: "SecurePass123!" }),
    );

    // Assert
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toBe(
      "Ungültige E-Mail-Adresse.",
    );
  });

  it("maps 'user already registered' to the password-reset nudge (no enumeration leak)", async () => {
    // Arrange
    const mock = makeAuthMock({
      signUpError: { message: "User already registered" },
    });
    mockedCreateClient.mockResolvedValue(mock as never);

    // Act
    const result = await signUpWithPassword(
      makeFormData({ email: "existing@example.com", password: "SecurePass123!" }),
    );

    // Assert — message must NOT say "already registered"; it nudges to reset.
    expect(result.ok).toBe(false);
    const { error } = result as { ok: false; error: string };
    expect(error).toContain("Passwort vergessen");
    expect(error.toLowerCase()).not.toContain("registered");
  });

  it("maps HTTP 429 status to the password-reset nudge", async () => {
    // Arrange
    const mock = makeAuthMock({
      signUpError: { message: "email rate limit exceeded", status: 429 },
    });
    mockedCreateClient.mockResolvedValue(mock as never);

    // Act
    const result = await signUpWithPassword(
      makeFormData({ email: "rate@example.com", password: "SecurePass123!" }),
    );

    // Assert
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toContain("Konto existiert");
  });

  it("maps HIBP breach error to the breach message", async () => {
    // Arrange
    const mock = makeAuthMock({
      signUpError: { message: "Password has been found in a data breach" },
    });
    mockedCreateClient.mockResolvedValue(mock as never);

    // Act
    const result = await signUpWithPassword(
      makeFormData({ email: "test@example.com", password: "Password123456" }),
    );

    // Assert
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toContain("Datenleck");
  });

  it("returns a generic fallback for unknown Supabase errors", async () => {
    // Arrange
    const mock = makeAuthMock({
      signUpError: { message: "some unexpected internal error" },
    });
    mockedCreateClient.mockResolvedValue(mock as never);

    // Act
    const result = await signUpWithPassword(
      makeFormData({ email: "test@example.com", password: "SecurePass123!" }),
    );

    // Assert — must not leak the raw Supabase message
    expect(result.ok).toBe(false);
    const { error } = result as { ok: false; error: string };
    expect(error).toContain("schiefgelaufen");
    expect(error).not.toContain("internal");
  });
});

// ── signInWithPassword ─────────────────────────────────────────────────────

describe("signInWithPassword", () => {
  it("calls redirect on success (success path never returns a value)", async () => {
    // Arrange
    const mock = makeAuthMock({ signInError: null });
    mockedCreateClient.mockResolvedValue(mock as never);

    // Act + Assert — success calls redirect() which throws NEXT_REDIRECT
    await expect(
      signInWithPassword(
        makeFormData({
          email: "user@example.com",
          password: "SecurePass123!",
          next: "/me",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT");
  });

  it("redirects to the sanitised `next` path on success", async () => {
    // Arrange
    const mock = makeAuthMock({ signInError: null });
    mockedCreateClient.mockResolvedValue(mock as never);

    // Act
    await signInWithPassword(
      makeFormData({
        email: "user@example.com",
        password: "SecurePass123!",
        next: "/me",
      }),
    ).catch(() => {
      /* expected NEXT_REDIRECT */
    });

    // Assert — redirect was called with the `next` path, not a hardcoded URL
    expect(mockRedirect).toHaveBeenCalledWith("/me");
  });

  it("sanitises a protocol-relative open-redirect attempt in `next`", async () => {
    // Arrange
    const mock = makeAuthMock({ signInError: null });
    mockedCreateClient.mockResolvedValue(mock as never);

    // Act
    await signInWithPassword(
      makeFormData({
        email: "user@example.com",
        password: "SecurePass123!",
        next: "//evil.com/steal",
      }),
    ).catch(() => {
      /* expected NEXT_REDIRECT */
    });

    // Assert — must NOT redirect to the external host
    expect(mockRedirect).toHaveBeenCalledWith("/");
  });

  it("sanitises a backslash open-redirect attempt in `next`", async () => {
    // Arrange
    const mock = makeAuthMock({ signInError: null });
    mockedCreateClient.mockResolvedValue(mock as never);

    // Act
    await signInWithPassword(
      makeFormData({
        email: "user@example.com",
        password: "SecurePass123!",
        next: "/\\evil.com",
      }),
    ).catch(() => {
      /* expected NEXT_REDIRECT */
    });

    // Assert
    expect(mockRedirect).toHaveBeenCalledWith("/");
  });

  it("sanitises a path containing a backslash anywhere", async () => {
    // Arrange
    const mock = makeAuthMock({ signInError: null });
    mockedCreateClient.mockResolvedValue(mock as never);

    // Act
    await signInWithPassword(
      makeFormData({
        email: "user@example.com",
        password: "SecurePass123!",
        next: "/foo\\bar",
      }),
    ).catch(() => {});

    // Assert
    expect(mockRedirect).toHaveBeenCalledWith("/");
  });

  it("returns field-agnostic error on wrong credentials (no user/password hint)", async () => {
    // Arrange
    const mock = makeAuthMock({
      signInError: { message: "Invalid login credentials" },
    });
    mockedCreateClient.mockResolvedValue(mock as never);

    // Act
    const result = await signInWithPassword(
      makeFormData({ email: "user@example.com", password: "SecurePass123!" }),
    );

    // Assert — message must be identical for wrong-email vs wrong-password
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toBe(
      "E-Mail oder Passwort ist falsch.",
    );
  });

  it("rejects a password under 12 chars without calling Supabase", async () => {
    // Arrange
    const mock = makeAuthMock();
    mockedCreateClient.mockResolvedValue(mock as never);

    // Act
    const result = await signInWithPassword(
      makeFormData({ email: "user@example.com", password: "short" }),
    );

    // Assert
    expect(result.ok).toBe(false);
    expect(mock.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("defaults to redirecting to / when `next` is missing", async () => {
    // Arrange
    const mock = makeAuthMock({ signInError: null });
    mockedCreateClient.mockResolvedValue(mock as never);

    // Act
    await signInWithPassword(
      makeFormData({ email: "user@example.com", password: "SecurePass123!" }),
    ).catch(() => {});

    // Assert
    expect(mockRedirect).toHaveBeenCalledWith("/");
  });
});

// ── requestPasswordReset ───────────────────────────────────────────────────

describe("requestPasswordReset", () => {
  it("always returns { ok: true } for a real email (anti-enumeration)", async () => {
    // Arrange
    const mock = makeAuthMock({ resetError: null });
    mockedCreateClient.mockResolvedValue(mock as never);

    // Act
    const result = await requestPasswordReset(
      makeFormData({ email: "existing@example.com" }),
    );

    // Assert
    expect(result).toEqual({ ok: true });
  });

  it("still returns { ok: true } when Supabase returns an error (anti-enumeration)", async () => {
    // Arrange — even if the email doesn't exist, Supabase may error; we ignore it
    const mock = makeAuthMock({
      resetError: { message: "User not found" },
    });
    mockedCreateClient.mockResolvedValue(mock as never);

    // Act
    const result = await requestPasswordReset(
      makeFormData({ email: "ghost@example.com" }),
    );

    // Assert
    expect(result).toEqual({ ok: true });
  });

  it("passes redirectTo pointing to /auth/reset-password (the PKCE landing)", async () => {
    // Arrange
    const mock = makeAuthMock({ resetError: null });
    mockedCreateClient.mockResolvedValue(mock as never);

    // Act
    await requestPasswordReset(makeFormData({ email: "user@example.com" }));

    // Assert — the redirectTo must be the reset-password route, not callback
    const callArgs = mock.auth.resetPasswordForEmail.mock.calls[0] as [
      string,
      { redirectTo: string },
    ];
    expect(callArgs[1].redirectTo).toContain("/auth/reset-password");
  });
});

// ── updateOwnPassword ──────────────────────────────────────────────────────

describe("updateOwnPassword", () => {
  it("calls supabase.auth.updateUser with the new password and redirects on success", async () => {
    // Arrange
    const mock = makeAuthMock({ updateError: null });
    mockedCreateClient.mockResolvedValue(mock as never);

    // Act
    await updateOwnPassword(makeFormData({ password: "NewSecure123!" })).catch(
      () => {},
    );

    // Assert
    expect(mock.auth.updateUser).toHaveBeenCalledWith({ password: "NewSecure123!" });
    expect(mockRedirect).toHaveBeenCalled();
  });

  it("rejects password under 12 chars without calling updateUser", async () => {
    // Arrange
    const mock = makeAuthMock();
    mockedCreateClient.mockResolvedValue(mock as never);

    // Act
    const result = await updateOwnPassword(makeFormData({ password: "short" }));

    // Assert
    expect(result.ok).toBe(false);
    expect(mock.auth.updateUser).not.toHaveBeenCalled();
  });

  it("returns { ok: false } with a German error message when updateUser fails", async () => {
    // Arrange
    const mock = makeAuthMock({
      updateError: { message: "token is expired or invalid" },
    });
    mockedCreateClient.mockResolvedValue(mock as never);

    // Act
    const result = await updateOwnPassword(makeFormData({ password: "NewSecure123!" }));

    // Assert
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toContain("nicht gespeichert");
  });
});

// ── signOut ────────────────────────────────────────────────────────────────

describe("signOut", () => {
  it("calls supabase.auth.signOut() and redirects to /", async () => {
    // Arrange
    const mock = makeAuthMock({ signOutError: null });
    mockedCreateClient.mockResolvedValue(mock as never);

    // Act
    await signOut().catch(() => {
      /* expected NEXT_REDIRECT */
    });

    // Assert — single sign-out path for both auth methods (A-AC4.3)
    expect(mock.auth.signOut).toHaveBeenCalledOnce();
    expect(mockRedirect).toHaveBeenCalledWith("/");
  });
});

// ── isSafePath contract (open-redirect guard) ──────────────────────────────

describe("isSafePath contract via signInWithPassword", () => {
  // These tests exercise the isSafePath function indirectly since it is not
  // exported. All valid cases must pass through; all attack vectors must fall
  // back to "/".

  const cases: Array<{ input: string; expected: string; label: string }> = [
    { input: "/me",               expected: "/me",   label: "plain relative path" },
    { input: "/me/settings",      expected: "/me/settings", label: "deep relative path" },
    { input: "//evil.tld",        expected: "/",     label: "protocol-relative URL" },
    { input: "/\\evil.tld",       expected: "/",     label: "slash-backslash bypass" },
    { input: "/path\\injected",   expected: "/",     label: "embedded backslash" },
    { input: "https://evil.tld",  expected: "/",     label: "absolute URL with scheme" },
    { input: "",                  expected: "/",     label: "empty string" },
  ];

  for (const { input, expected, label } of cases) {
    it(`maps "${label}" to "${expected}"`, async () => {
      const mock = makeAuthMock({ signInError: null });
      mockedCreateClient.mockResolvedValue(mock as never);

      await signInWithPassword(
        makeFormData({ email: "u@e.com", password: "SecurePass123!", next: input }),
      ).catch(() => {});

      expect(mockRedirect).toHaveBeenCalledWith(expected);
    });
  }
});
