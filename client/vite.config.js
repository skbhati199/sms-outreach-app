import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Forward API calls to the Node backend during development
      "/api": "http://localhost:4000",
    },
  },
  build: {
    outDir: "dist",
  },
  define: {
    // In production, use the public API URL; in dev, use relative /api (proxied)
    __API_BASE__: mode === "production"
      ? JSON.stringify("https://sms-api.infoskillstechnology.com")
      : JSON.stringify(""),
  },
}));
