/**
 * Vite Configuration for ProLease Plugin Standalone Build
 *
 * Compiles the plugin as a standalone JS module that can be loaded dynamically
 */

import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    // Output directory for plugin build
    outDir: 'dist-plugin',

    // Library mode configuration
    lib: {
      entry: resolve(__dirname, 'src/plugins/index.ts'),
      name: 'ProLeasePlugin',
      formats: ['es', 'iife'],
      fileName: (format) => format === 'es' ? `prolease-ifrs16-plugin.js` : `prolease-ifrs16-plugin.iife.js`
    },

    // Rollup options
    rollupOptions: {
      // Don't bundle these dependencies - they should be provided by the host app
      external: [
        // Core modules that DataForge provides
        /^\.\.?\/@core\//,
      ],
      output: {
        // Use named exports only
        exports: 'named',
        // Global variables for IIFE build
        globals: {
          '../@core/types': 'DJDataForgeTypes',
          '../@core/plugin-system-consolidated': 'DJDataForgePluginSystem',
          '../@core/workbook-consolidated': 'DJDataForgeWorkbook',
          '../@core/storage-utils-consolidated': 'DJDataForgeStorage',
        },
        // Preserve module structure
        preserveModules: false,
        // Add banner with info
        banner: `/**
 * ProLease IFRS 16 Plugin for DataForge v6
 * Version: 6.0.0
 * Compiled: ${new Date().toISOString()}
 *
 * @requires DataForge v6.0.0+
 */`
      }
    },

    // Minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Keep console logs for debugging
      },
      format: {
        comments: /^!/,
      }
    },

    // Source maps
    sourcemap: true,

    // Target modern browsers
    target: 'es2020',
  },

  // Resolve configuration
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    }
  },
});
