import { afterEach, describe, expect, it } from "vitest";
import { clearRegistry, getAdapter, listAdapterKinds, registerAdapter } from "./registry.js";
import type { SourceAdapter } from "./source-adapter.js";

function fakeAdapter(kind: string): SourceAdapter {
  return {
    kind,
    capabilities: { supportsMediaKinds: ["movie"], supportsIncrementalSync: false },
    testConnection: async () => ({ ok: true }),
    listLibraries: async () => [],
    fetchRecentItems: async () => [],
  };
}

afterEach(() => {
  clearRegistry();
});

describe("adapter registry", () => {
  it("registers and looks up an adapter by kind", () => {
    const adapter = fakeAdapter("fake");
    registerAdapter(adapter);

    expect(getAdapter("fake")).toBe(adapter);
    expect(listAdapterKinds()).toEqual(["fake"]);
  });

  it("returns undefined for an unregistered kind", () => {
    expect(getAdapter("nope")).toBeUndefined();
  });

  it("overwrites a previously registered adapter of the same kind", () => {
    registerAdapter(fakeAdapter("dup"));
    const second = fakeAdapter("dup");
    registerAdapter(second);

    expect(getAdapter("dup")).toBe(second);
    expect(listAdapterKinds()).toEqual(["dup"]);
  });
});
