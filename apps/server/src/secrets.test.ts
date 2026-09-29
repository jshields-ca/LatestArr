import { describe, expect, it } from "vitest";
import { encryptionKeyProblem } from "./secrets.js";

const VALID = "MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=";

describe("encryptionKeyProblem", () => {
  it("accepts a base64 key that decodes to 32 bytes", () => {
    expect(encryptionKeyProblem({ ENCRYPTION_KEY: VALID })).toBeNull();
  });

  it("explains a missing key and how to make one", () => {
    expect(encryptionKeyProblem({})).toMatch(/isn't set.*openssl rand -base64 32/);
    expect(encryptionKeyProblem({ ENCRYPTION_KEY: "  " })).toMatch(/isn't set/);
  });

  it("rejects a key that isn't base64", () => {
    expect(encryptionKeyProblem({ ENCRYPTION_KEY: "not a key!" })).toMatch(/isn't valid base64/);
  });

  it("rejects a key of the wrong length, and warns about keys already in use", () => {
    const problem = encryptionKeyProblem({ ENCRYPTION_KEY: "c2hvcnQ=" });
    expect(problem).toMatch(/must decode to 32 bytes, but this one decodes to 5/);
    expect(problem).toMatch(/restore the key they were saved with/);
  });
});
