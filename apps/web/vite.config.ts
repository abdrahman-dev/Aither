import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // MapLibre v6 ships a real module worker whose bundling can fail during
  // dependency pre-bundling; serving it from source keeps dev reliable.
  optimizeDeps: {
    exclude: ["maplibre-gl"]
  },
  server: {
    port: 5173
  },
  build: {
    outDir: "dist"
  }
});
