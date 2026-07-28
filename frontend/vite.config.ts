import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    // Fail loudly instead of silently sliding to 5174 if the port is taken —
    // a drifted port is not in the backend's CORS allowlist and surfaces as a
    // confusing "No 'Access-Control-Allow-Origin' header" error.
    strictPort: true,
  },
  build: {
    rollupOptions: {
      output: {
        // Split vendors so route chunks stay small (function form — the
        // object form is not supported by Vite 8's rolldown bundler).
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return;
          if (id.includes("framer-motion")) return "motion";
          if (id.includes("react-router") || id.includes("/react-dom/") || id.includes("/react/"))
            return "react";
          if (id.includes("@tanstack") || id.includes("axios") || id.includes("zustand"))
            return "data";
          return "vendor";
        },
      },
    },
  },
});
