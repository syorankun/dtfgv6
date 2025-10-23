import { defineConfig } from "vite";
import path from "path";

/**
 * Configuração especial para build STANDALONE que funciona com file://
 *
 * Este build:
 * - Inline TODO o CSS no HTML
 * - Inline TODO o JavaScript no HTML
 * - Gera UM ÚNICO arquivo HTML que pode ser aberto diretamente
 * - NÃO requer servidor HTTP
 * - Funciona com protocolo file://
 *
 * Para usar:
 * npm run build:standalone
 *
 * Depois abra dist-standalone/index.html diretamente no navegador
 */
export default defineConfig({
  resolve: {
    alias: {
      "@core": path.resolve(__dirname, "./src/@core"),
    },
  },
  build: {
    target: "es2020",
    outDir: "dist-standalone",
    sourcemap: false, // Desabilita sourcemap para reduzir tamanho
    assetsInlineLimit: 100000000, // 100MB - inline TUDO
    cssCodeSplit: false, // Coloca todo CSS em um único arquivo
    rollupOptions: {
      output: {
        inlineDynamicImports: true, // Inline todos os imports
        manualChunks: undefined, // Sem chunks separados
        // Gera apenas um arquivo JS e um CSS
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      },
    },
    chunkSizeWarningLimit: 5000, // 5MB
    minify: 'esbuild', // Minifica para reduzir tamanho (esbuild é mais rápido)
  },
  base: "./", // Caminhos relativos
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
