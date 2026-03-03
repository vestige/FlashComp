// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: '/FlashComp/',
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("node_modules/firebase")) return "vendor-firebase";
          if (
            id.includes("node_modules/react") ||
            id.includes("node_modules/react-dom") ||
            id.includes("node_modules/react-router")
          ) {
            return "vendor-react";
          }
          return "vendor-misc";
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.js",
    globals: true,
    pool: "threads",
    maxWorkers: 1,
    minWorkers: 1,
  },
});
