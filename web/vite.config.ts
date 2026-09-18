import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  plugins: [react()],
  appType: "spa",
  server: {
    host: "127.0.0.1",
    port: 5174,
    strictPort: true,
    fs: { allow: [repoRoot] },
  },
});
