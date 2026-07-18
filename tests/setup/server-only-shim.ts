// In unit tests we import server modules directly (no React Server Components
// runtime), so the real `server-only` guard would throw. Vitest aliases the
// package to this empty module. See vitest.config.ts.
export {};
