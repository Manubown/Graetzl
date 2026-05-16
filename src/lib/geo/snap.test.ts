import { describe, it, expect } from "vitest";
import { snapTo100mGrid, haversineMeters } from "./snap";

/**
 * The GDPR contract of `snapTo100mGrid`: the snapped coordinate must
 * land within half a 100m cell diagonal (~71m) of the input, and far
 * enough away to actually obscure the original. We allow a slightly
 * looser bound (75m) for cells near Vienna's latitude.
 */
const MAX_DISPLACEMENT_M = 75;

describe("snapTo100mGrid", () => {
  it("snaps a Vienna-centre coordinate within ~75m of the input", () => {
    const input = { lat: 48.2082, lng: 16.3738 };
    const out = snapTo100mGrid(input.lat, input.lng);
    expect(haversineMeters(input, out)).toBeLessThanOrEqual(MAX_DISPLACEMENT_M);
  });

  it("snaps the NW corner of the Vienna bbox within ~75m", () => {
    const input = { lat: 48.33, lng: 16.18 };
    const out = snapTo100mGrid(input.lat, input.lng);
    expect(haversineMeters(input, out)).toBeLessThanOrEqual(MAX_DISPLACEMENT_M);
  });

  it("snaps the SE corner of the Vienna bbox within ~75m", () => {
    const input = { lat: 48.1, lng: 16.58 };
    const out = snapTo100mGrid(input.lat, input.lng);
    expect(haversineMeters(input, out)).toBeLessThanOrEqual(MAX_DISPLACEMENT_M);
  });

  it("collapses two nearby points to the same cell so neighbours collide", () => {
    const a = snapTo100mGrid(48.2082, 16.3738);
    const b = snapTo100mGrid(48.20821, 16.37381);
    expect(a).toEqual(b);
  });
});
