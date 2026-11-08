import { describe, expect, it } from "vitest";
import { readConfig } from "./config";

const valid = {
  VITE_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
};

describe("readConfig", () => {
  it("returns the URL and publishable key", () => {
    expect(readConfig(valid)).toEqual({
      supabaseUrl: "https://abcdefghijklmnopqrst.supabase.co",
      supabasePublishableKey: "sb_publishable_example",
    });
  });

  it("trims whitespace and trailing slashes", () => {
    const config = readConfig({
      VITE_SUPABASE_URL: "  https://abcdefghijklmnopqrst.supabase.co/  ",
      VITE_SUPABASE_PUBLISHABLE_KEY: " sb_publishable_example ",
    });
    expect(config.supabaseUrl).toBe("https://abcdefghijklmnopqrst.supabase.co");
    expect(config.supabasePublishableKey).toBe("sb_publishable_example");
  });

  it("names every missing value", () => {
    expect(() => readConfig({})).toThrow(
      "Missing configuration: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY",
    );
  });

  it("refuses a URL without https", () => {
    expect(() => readConfig({ ...valid, VITE_SUPABASE_URL: "http://abcdefghijklmnopqrst.supabase.co" })).toThrow(
      "must start with https://",
    );
  });

  it("refuses a URL with a path, such as the REST API URL", () => {
    expect(() =>
      readConfig({ ...valid, VITE_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co/rest/v1/" }),
    ).toThrow("must be the project URL only");
  });
});
