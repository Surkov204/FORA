import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { env } from "node:process";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: env.FORA_API_URL || "http://localhost:5106",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
