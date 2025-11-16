import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const parsePort = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const DEV_PORT = parsePort(process.env.VITE_DEV_PORT ?? process.env.PORT, 5173);
const PREVIEW_PORT = parsePort(
  process.env.VITE_PREVIEW_PORT ?? process.env.PREVIEW_PORT,
  4600
);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: DEV_PORT,
    strictPort: false,
  },
  preview: {
    host: "0.0.0.0",
    port: PREVIEW_PORT,
  },
});
