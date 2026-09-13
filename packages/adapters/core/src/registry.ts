import type { SourceAdapter } from "./source-adapter.js";

const registry = new Map<string, SourceAdapter>();

export function registerAdapter(adapter: SourceAdapter): void {
  registry.set(adapter.kind, adapter);
}

export function getAdapter(kind: string): SourceAdapter | undefined {
  return registry.get(kind);
}

export function listAdapterKinds(): string[] {
  return [...registry.keys()];
}

/** Test-only: clears all registered adapters. */
export function clearRegistry(): void {
  registry.clear();
}
