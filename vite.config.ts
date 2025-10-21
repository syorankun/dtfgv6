import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@core": path.resolve(__dirname, "./src/@core"),
      "@ui": path.resolve(__dirname, "./src/@ui"),
      "@plugins": path.resolve(__dirname, "./src/@plugins"),
    },
  },
  build: {
    target: "es2020",
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["papaparse", "dayjs", "nanoid"],
          xlsx: ["xlsx"],
          charts: ["chart.js"],
        },
      },
    },
    chunkSizeWarningLimit: 1500, // 1.5 MB
  },
  server: {
    port: 5173,
    open: true,
  },
  optimizeDeps: {
    include: [
      "papaparse",
      "xlsx",
      "idb",
      "chart.js",
      "dayjs",
      "nanoid",
      "decimal.js",
      "dompurify",
    ],
  },
});
