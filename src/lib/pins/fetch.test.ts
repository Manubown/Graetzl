import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { fetchPinsInBboxFiltered } from "./fetch";
import { VIENNA_BBOX } from "./types";

const mockedCreateClient = vi.mocked(createClient);

function makeRpcMock(data: unknown[], error: null | { message: string } = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error });
  return { client: { rpc }, rpc };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchPinsInBboxFiltered", () => {
  it("calls pins_in_bbox_filtered with p_bezirk=null when no bezirk is given", async () => {
    const { client, rpc } = makeRpcMock([]);
    mockedCreateClient.mockResolvedValue(client as never);

    await fetchPinsInBboxFiltered();

    expect(rpc).toHaveBeenCalledWith("pins_in_bbox_filtered", {
      min_lng: VIENNA_BBOX.minLng,
      min_lat: VIENNA_BBOX.minLat,
      max_lng: VIENNA_BBOX.maxLng,
      max_lat: VIENNA_BBOX.maxLat,
      p_bezirk: null,
      max_rows: 500,
    });
  });

  it("passes p_bezirk when a bezirk number is provided", async () => {
    const { client, rpc } = makeRpcMock([]);
    mockedCreateClient.mockResolvedValue(client as never);

    await fetchPinsInBboxFiltered(undefined, 6);

    expect(rpc).toHaveBeenCalledWith("pins_in_bbox_filtered", expect.objectContaining({
      p_bezirk: 6,
    }));
  });

  it("returns the RPC rows cast to Pin[]", async () => {
    const row = { id: "abc", title: "Test", district_id: 6 };
    const { client } = makeRpcMock([row]);
    mockedCreateClient.mockResolvedValue(client as never);

    const result = await fetchPinsInBboxFiltered(undefined, 6);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "abc", district_id: 6 });
  });

  it("throws when the RPC returns an error", async () => {
    const { client } = makeRpcMock([], { message: "rpc failed" });
    mockedCreateClient.mockResolvedValue(client as never);

    await expect(fetchPinsInBboxFiltered()).rejects.toMatchObject({
      message: "rpc failed",
    });
  });

  it("returns an empty array when RPC data is null", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    mockedCreateClient.mockResolvedValue({ rpc } as never);

    const result = await fetchPinsInBboxFiltered();

    expect(result).toEqual([]);
  });
});
