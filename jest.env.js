// Initialize Node Web APIs in the Jest Global scope before JSDOM environment overrides
if (typeof global.Request === 'undefined') {
  global.Request = globalThis.Request;
}
if (typeof global.Response === 'undefined') {
  global.Response = globalThis.Response;
}
if (typeof global.Headers === 'undefined') {
  global.Headers = globalThis.Headers;
}
if (typeof global.fetch === 'undefined') {
  global.fetch = globalThis.fetch;
}
