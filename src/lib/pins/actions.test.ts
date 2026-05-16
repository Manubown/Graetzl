import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * B-7 integration-style test for createPin.
 *
 * Uses Vitest module mocking to replace the Supabase server client and
 * next/cache / next/navigation with in-process stubs. No network calls
 * are made. The goal is to verify that:
 *
 *   1. A valid Vienna pin resolves district_id via the district_at_point
 *      RPC and writes it into the INSERT payload.
 *   2. A pin whose coordinates fall outside all district boundaries
 *      (district_at_point returns null) is stored with district_id = null.
 *   3. Validation rejects coordinates outside the Vienna bounding box.
 */

// ── Next.js stubs ──────────────────────────────────────────────────────────

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

// ── Supabase server stub factory ───────────────────────────────────────────
// We build the mock inside a factory so each test can configure
// rpc / from / insert return values independently.

function makeSupabaseMock({
  user = { id: "user-1" } as { id: string } | null,
  rpcResult = { data: 1 as number | null, error: null },
  insertResult = { data: { id: "pin-abc" }, error: null },
}: {
  user?: { id: string } | null;
  rpcResult?: { data: number | null; error: null | { message: string } };
  insertResult?: {
    data: { id: string } | null;
    error: null | { message: string };
  };
} = {}) {
  const insertSingle = vi.fn().mockResolvedValue(insertResult);
  const insertSelect = vi.fn().mockReturnValue({ single: insertSingle });
  const insertFn = vi.fn().mockReturnValue({ select: insertSelect });
  const from = vi.fn().mockReturnValue({ insert: insertFn });
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  const getUser = vi.fn().mockResolvedValue({
    data: { user },
    error: user ? null : { message: "no user" },
  });

  const client = { auth: { getUser }, rpc, from };
  return { client, rpc, from, insertFn, insertSelect, insertSingle };
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

// Import after mocks are registered.
import { createClient } from "@/lib/supabase/server";
import { createPin } from "./actions";

const mockedCreateClient = vi.mocked(createClient);

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Helpers ────────────────────────────────────────────────────────────────

function makeFormData(overrides: Record<string, string> = {}): FormData {
  const base: Record<string, string> = {
    title: "Testpin",
    body: "Ein kurzer Beschreibungstext für den Testpin.",
    category: "food_drink",
    language: "de",
    precision: "exact",
    lng: "16.3738",
    lat: "48.2082",
    ...overrides,
  };
  const fd = new FormData();
  for (const [k, v] of Object.entries(base)) fd.set(k, v);
  return fd;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("createPin — district_id resolution (B-7)", () => {
  it("resolves district_id via district_at_point and stores it on the pin", async () => {
    const { client, rpc, insertFn } = makeSupabaseMock({
      rpcResult: { data: 1, error: null },
    });
    mockedCreateClient.mockResolvedValue(client as never);

    const result = await createPin(makeFormData());

    expect(result.ok).toBe(true);

    expect(rpc).toHaveBeenCalledWith("district_at_point", {
      p_lng: 16.3738,
      p_lat: 48.2082,
    });

    const insertPayload = insertFn.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(insertPayload.district_id).toBe(1);
  });

  it("stores district_id = null when the point falls outside all district boundaries", async () => {
    const { client, insertFn } = makeSupabaseMock({
      rpcResult: { data: null, error: null },
    });
    mockedCreateClient.mockResolvedValue(client as never);

    const result = await createPin(makeFormData());

    expect(result.ok).toBe(true);

    const insertPayload = insertFn.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(insertPayload.district_id).toBeNull();
  });

  it("stores district_id = null and proceeds when the rpc call returns an error", async () => {
    const { client, insertFn } = makeSupabaseMock({
      rpcResult: { data: null, error: { message: "function not found" } },
    });
    mockedCreateClient.mockResolvedValue(client as never);

    const result = await createPin(makeFormData());

    expect(result.ok).toBe(true);

    const insertPayload = insertFn.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(insertPayload.district_id).toBeNull();
  });

  it("rejects coordinates outside the Vienna bounding box before reaching the rpc", async () => {
    const { client, rpc } = makeSupabaseMock();
    mockedCreateClient.mockResolvedValue(client as never);

    const result = await createPin(
      makeFormData({ lng: "14.0", lat: "48.2082" }),
    );

    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toMatch(
      /außerhalb von Wien/,
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns an error when the user is not authenticated", async () => {
    const { client } = makeSupabaseMock({ user: null });
    mockedCreateClient.mockResolvedValue(client as never);

    const result = await createPin(makeFormData());

    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toMatch(/anmelden/);
  });

  it("uses the snapped coordinate for district lookup when precision is approximate", async () => {
    const { client, rpc } = makeSupabaseMock({
      rpcResult: { data: 7, error: null },
    });
    mockedCreateClient.mockResolvedValue(client as never);

    await createPin(makeFormData({ precision: "approximate" }));

    const rpcCall = rpc.mock.calls[0];
    expect(rpcCall?.[0]).toBe("district_at_point");
    const { p_lng, p_lat } = rpcCall?.[1] as { p_lng: number; p_lat: number };
    expect(Number.isFinite(p_lng)).toBe(true);
    expect(Number.isFinite(p_lat)).toBe(true);
    expect(p_lng).not.toBe(16.3738);
  });
});
