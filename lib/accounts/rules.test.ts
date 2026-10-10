import { describe, expect, it } from "vitest";
import {
  normaliseUsername,
  validateLocation,
  validateName,
  validatePassword,
  validateUsername,
} from "./rules";

describe("normaliseUsername", () => {
  it("trims and lowercases, so any capitalisation is the same account", () => {
    expect(normaliseUsername(" BoB ")).toBe("bob");
    expect(normaliseUsername("BOB")).toBe(normaliseUsername("bob"));
  });
});

describe("validateUsername", () => {
  it("accepts 3 to 20 lowercase letters, digits and underscores", () => {
    expect(validateUsername("bob")).toBeNull();
    expect(validateUsername("player_01")).toBeNull();
    expect(validateUsername("a".repeat(20))).toBeNull();
  });

  it("rejects names that are too short or too long", () => {
    expect(validateUsername("ab")).not.toBeNull();
    expect(validateUsername("a".repeat(21))).not.toBeNull();
  });

  it("rejects other characters", () => {
    expect(validateUsername("bad name")).not.toBeNull();
    expect(validateUsername("bob!")).not.toBeNull();
    expect(validateUsername("bób")).not.toBeNull();
  });
});

describe("validatePassword", () => {
  it("needs at least 8 characters", () => {
    expect(validatePassword("1234567")).not.toBeNull();
    expect(validatePassword("12345678")).toBeNull();
  });

  it("rejects passwords over 72 bytes, which Auth can't hash", () => {
    expect(validatePassword("a".repeat(72))).toBeNull();
    expect(validatePassword("a".repeat(73))).not.toBeNull();
    // "é" is two bytes in UTF-8.
    expect(validatePassword("é".repeat(37))).not.toBeNull();
  });
});

describe("validateName", () => {
  it("accepts 1 to 50 characters after trimming", () => {
    expect(validateName("Steven")).toBeNull();
    expect(validateName("x".repeat(50))).toBeNull();
  });

  it("rejects blank and overlong names", () => {
    expect(validateName("")).not.toBeNull();
    expect(validateName("   ")).not.toBeNull();
    expect(validateName("x".repeat(51))).not.toBeNull();
  });
});

describe("validateLocation", () => {
  it("accepts a city in its country", () => {
    expect(validateLocation("US", "Nashville")).toBeNull();
    expect(validateLocation("NZ", "Wellington")).toBeNull();
  });

  it("rejects a city from a different country", () => {
    expect(validateLocation("US", "Wellington")).not.toBeNull();
  });

  it("rejects an unknown country", () => {
    expect(validateLocation("FR", "Paris")).not.toBeNull();
    expect(validateLocation("", "")).not.toBeNull();
  });
});
