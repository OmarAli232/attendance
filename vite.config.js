import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// في وضع التطوير (npm run dev) بيشغّل الواجهة على 5173
// وأي طلب /api بيتحوّل للسيرفر على 8080.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8080"
    }
  },
  build: {
    outDir: "dist"
  }
});
