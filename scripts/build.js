// Keep optimized React builds even when the local API uses NODE_ENV=development.
process.env.NODE_ENV = "production";
const { build } = await import("vite");
await build();
