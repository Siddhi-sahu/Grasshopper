import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: true, // reachable from a phone on the same Wi-Fi
    proxy: { "/api": "http://localhost:3001" },
  },
  worker: { format: "es" },
});
