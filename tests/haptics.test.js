import { beforeEach, expect, mock, spyOn, test } from "bun:test";

let now = 0;
spyOn(performance, "now").mockImplementation(() => now);
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
  now = 0;
  document.visibilityState = "visible";
  document.hidden = false;
  throwOnTrigger = false;
  reducedMotion = false;
  window.dispatchEvent(new Event("pagehide"));
  setHapticsEnabled(true);
  pulses.length = 0;
});

test("taps and selections produce feedback on the shared engine", () => {
  for (const kind of ["selection", "light", "medium"]) {
    trigger(kind);
    now += 100;
  }
  expect(pulses).toHaveLength(3);
  expect(instances).toBe(1);
});

test("duplicate handlers and immediate results produce only one pulse", () => {
  trigger("light");
  trigger("selection");
  now = 50;
  trigger("success");
  expect(pulses).toHaveLength(1);
});

test("later results fire once and protect against trailing clicks", () => {
  trigger("light");
  now = 100;
  trigger("success");
  now = 200;
  trigger("light");
  expect(pulses).toHaveLength(2);
  expect(pulses[1]).toHaveLength(1);
  now = 280;
  trigger("selection");
  expect(pulses).toHaveLength(3);
});

test("hidden pages remain silent and cancel running patterns", () => {
  trigger("success");
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
  expect(() => trigger("success")).not.toThrow();
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
  try { expect(() => trigger("success")).not.toThrow(); }
  finally { globalThis.document = saved; }
});
