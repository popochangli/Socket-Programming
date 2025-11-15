type GlobalWithPolyfill = typeof globalThis & {
  global?: typeof globalThis;
};

const globalObject = globalThis as GlobalWithPolyfill;

if (typeof globalObject.global === "undefined") {
  globalObject.global = globalObject;
}
