import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@core": path.resolve(__dirname, "./src/@core"),
    },
  },
  build: {
    target: "es2020",
    outDir: "dist",
    sourcemap: true,
    // Configuração para file:// protocol
    rollupOptions: {
      output: {
        // Inlines assets to avoid CORS issues with file://
        inlineDynamicImports: true,
        manualChunks: undefined,
      },
    },
    chunkSizeWarningLimit: 1500, // 1.5 MB
  },
  base: "./", // Importante para file:// protocol
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
