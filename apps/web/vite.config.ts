import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { realpathSync } from "node:fs";
export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      allow: [
        path.resolve(import.meta.dirname, ".."),
        realpathSync(path.resolve(import.meta.dirname, "node_modules")),
      ],
    },
  },
  build: { sourcemap: false },
});
