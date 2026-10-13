import { afterEach, describe, expect, it, vi } from "vitest";
import { isUuid } from "../anonymous-user";
import { getAnonymousUserId } from "../track";

const KEY = "anonymous_user_id";
const VALID_ID = "0b9f2c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";

function memoryStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  };
}

describe("getAnonymousUserId（localStorage の匿名 ID）", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("保存済みの正しい UUID はそのまま返す", () => {
    const storage = memoryStorage({ [KEY]: VALID_ID });
    vi.stubGlobal("localStorage", storage);
    expect(getAnonymousUserId()).toBe(VALID_ID);
    expect(storage.store.get(KEY)).toBe(VALID_ID);
  });

  it.each([
    ["保存されていない", {}],
    ["空文字", { [KEY]: "" }],
    ["UUID でない値", { [KEY]: "not-a-uuid" }],
  ])("%s ときは作り直して保存する", (_label, initial: Record<string, string>) => {
    const storage = memoryStorage(initial);
    vi.stubGlobal("localStorage", storage);
    const id = getAnonymousUserId();
    expect(isUuid(id)).toBe(true);
    expect(storage.store.get(KEY)).toBe(id);
    expect(getAnonymousUserId()).toBe(id);
  });

  it("localStorage が例外を投げたら undefined", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("SecurityError");
      },
    });
    expect(getAnonymousUserId()).toBeUndefined();
  });
});
