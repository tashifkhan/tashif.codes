import { beforeEach, expect, mock, test } from "bun:test";

const pulses = [];
let instances = 0;
let throwOnTrigger = false;
mock.module("web-haptics", () => ({
  WebHaptics: class {
    constructor() { instances++; }
    trigger(pattern) {
      if (throwOnTrigger) throw new Error("Unavailable device");
      pulses.push(pattern);
      return Promise.resolve();
    }
    cancel() { pulses.push("cancel"); }
  },
}));
const storage = new Map();
let reducedMotion = false;
globalThis.window = Object.assign(new EventTarget(), {
  matchMedia: () => ({ matches: reducedMotion }),
});
globalThis.document = Object.assign(new EventTarget(), {
  visibilityState: "visible", hidden: false,
});
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
};
const { trigger, installHaptics, hapticsEnabled, setHapticsEnabled } = await import("../src/lib/haptics.ts");
installHaptics();

beforeEach(() => {
  document.visibilityState = "visible";
  document.hidden = false;
  throwOnTrigger = false;
  reducedMotion = false;
  window.dispatchEvent(new Event("pagehide"));
  setHapticsEnabled(true);
  pulses.length = 0;
});

test("overlapping handlers produce one pulse on the shared engine", () => {
  trigger("selection");
  trigger("light");
  trigger("selection");
  expect(pulses).toHaveLength(1);
  expect(instances).toBe(1);
});

test("a result takes precedence over an action and trailing click", () => {
  trigger("light");
  trigger("error");
  trigger("light");
  expect(pulses).toHaveLength(2);
  expect(pulses[1]).toHaveLength(2);
});

test("hidden pages remain silent and cancel running patterns", () => {
  trigger();
  document.hidden = true;
  document.visibilityState = "hidden";
  document.dispatchEvent(new Event("visibilitychange"));
  trigger("success");
  expect(pulses).toHaveLength(2);
  expect(pulses[1]).toBe("cancel");
});

test("turning feedback off cancels and persists the preference", () => {
  setHapticsEnabled(false);
  trigger("success");
  expect(hapticsEnabled()).toBe(false);
  expect(storage.get("site-haptics-enabled")).toBe("false");
  expect(pulses).toEqual(["cancel"]);
});

test("unsupported hardware cannot break an action", () => {
  throwOnTrigger = true;
  expect(() => trigger()).not.toThrow();
});

test("unknown patterns are ignored, including inherited object keys", () => {
  trigger("buzz");
  trigger("constructor");
  expect(pulses).toHaveLength(0);
});

test("inline outcomes use the same policy without duplicate installation", () => {
  installHaptics();
  document.dispatchEvent(new CustomEvent("site:haptic", { detail: "success" }));
  expect(pulses).toHaveLength(1);
});

test("SSR imports and calls do not require browser globals", () => {
  const saved = globalThis.document;
  delete globalThis.document;
  try { expect(() => trigger()).not.toThrow(); }
  finally { globalThis.document = saved; }
});
