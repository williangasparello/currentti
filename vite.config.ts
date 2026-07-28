import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    host: true,
    // Dev: encaminha /api para o servidor Node (assim o frontend usa sempre /api relativo,
    // igual em produção, onde o próprio Node serve o site + a API).
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
});
