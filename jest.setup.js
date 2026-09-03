import '@testing-library/jest-dom';

// Polyfill setImmediate and clearImmediate for Pino in JSDOM
if (typeof global.setImmediate === 'undefined') {
  global.setImmediate = (fn, ...args) => setTimeout(fn, 0, ...args);
}
if (typeof global.clearImmediate === 'undefined') {
  global.clearImmediate = (id) => clearTimeout(id);
}

// Polyfill Web APIs for Next.js in JSDOM
if (typeof global.Request === 'undefined' && typeof globalThis.Request !== 'undefined') {
  global.Request = globalThis.Request;
}
if (typeof global.Response === 'undefined' && typeof globalThis.Response !== 'undefined') {
  global.Response = globalThis.Response;
}
if (typeof global.Headers === 'undefined' && typeof globalThis.Headers !== 'undefined') {
  global.Headers = globalThis.Headers;
}
if (typeof global.fetch === 'undefined' && typeof globalThis.fetch !== 'undefined') {
  global.fetch = globalThis.fetch;
}
if (typeof global.TextEncoder === 'undefined' && typeof globalThis.TextEncoder !== 'undefined') {
  global.TextEncoder = globalThis.TextEncoder;
}
if (typeof global.TextDecoder === 'undefined' && typeof globalThis.TextDecoder !== 'undefined') {
  global.TextDecoder = globalThis.TextDecoder;
}


