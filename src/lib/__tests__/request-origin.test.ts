import { describe, expect, it } from "vitest";
import { isSameOrigin } from "../request-origin";

function request(headers: Record<string, string>): Request {
  return new Request("https://www.8fitlab.com/api/events", { method: "POST", headers });
}

describe("isSameOrigin（/api/events の Origin 検査）", () => {
  it("Origin が無ければ true", () => {
    expect(isSameOrigin(request({ host: "www.8fitlab.com" }))).toBe(true);
  });

  it("同じ host なら true", () => {
    expect(isSameOrigin(request({ host: "www.8fitlab.com", origin: "https://www.8fitlab.com" }))).toBe(true);
  });

  it("違う host なら false", () => {
    expect(isSameOrigin(request({ host: "www.8fitlab.com", origin: "https://evil.example" }))).toBe(false);
    expect(isSameOrigin(request({ host: "www.8fitlab.com", origin: "https://8fitlab.com" }))).toBe(false);
  });

  it('"null" や不正な値は例外を投げず false', () => {
    expect(() => isSameOrigin(request({ host: "www.8fitlab.com", origin: "null" }))).not.toThrow();
    expect(isSameOrigin(request({ host: "www.8fitlab.com", origin: "null" }))).toBe(false);
    expect(isSameOrigin(request({ host: "www.8fitlab.com", origin: "not a url" }))).toBe(false);
  });
});
