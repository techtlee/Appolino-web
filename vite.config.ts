import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 5174, so it runs beside the app on 5173.
export default defineConfig({
  plugins: [react()],
  server: { port: 5174 },
});
