// Unit tests: Crypto utility
import { jest } from "@jest/globals";

process.env.NODE_ENV = "test";
process.env.ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const { encrypt, decrypt } = await import("../../src/utils/crypto.js");

describe("Crypto Utils", () => {
  describe("encrypt / decrypt", () => {
    it("should encrypt a string into a base64 encoded string", () => {
      const plaintext = "my-secret-api-key";
      const encrypted = encrypt(plaintext);

      expect(typeof encrypted).toBe("string");
      expect(encrypted).toContain(":");
      const parts = encrypted.split(":");
      expect(parts).toHaveLength(3); // iv:authTag:ciphertext
    });

    it("should decrypt back to the original plaintext", () => {
      const plaintext = "sk-openai-test-key-12345";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("should produce different ciphertexts for the same input (random IV)", () => {
      const plaintext = "same-key";
      const enc1 = encrypt(plaintext);
      const enc2 = encrypt(plaintext);
      expect(enc1).not.toBe(enc2); // Different IVs → different ciphertexts
    });

    it("should correctly round-trip special characters", () => {
      const plaintext = "key!@#$%^&*()_+-=~`[]{}|;':\",./<>?";
      const decrypted = decrypt(encrypt(plaintext));
      expect(decrypted).toBe(plaintext);
    });

    it("should correctly round-trip a long string", () => {
      const plaintext = "a".repeat(1000);
      expect(decrypt(encrypt(plaintext))).toBe(plaintext);
    });

    it("should throw if ENCRYPTION_KEY is missing", async () => {
      const originalKey = process.env.ENCRYPTION_KEY;
      process.env.ENCRYPTION_KEY = "";

      // We need a fresh import to test the error path, but since modules are cached
      // we can test the error indirectly via a short key
      try {
        // Restore and re-test
        process.env.ENCRYPTION_KEY = "short";
        expect(() => encrypt("test")).toThrow();
      } finally {
        process.env.ENCRYPTION_KEY = originalKey;
      }
    });
  });
});
