// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from "@tailwindcss/vite";

const BASE_PATH_BY_MODE = {
  prod: "/FlashComp/",
  demo: "/FlashComp/demo/",
  stg: "/FlashComp/stg/",
};

function resolveDeploymentMode(mode) {
  const normalized = String(mode || "").toLowerCase();
  if (normalized === "production") return "prod";
  if (normalized === "staging") return "stg";
  if (normalized === "demo") return "demo";
  if (["prod", "stg", "demo"].includes(normalized)) return normalized;
  return "prod";
}

export default defineConfig(({ mode }) => {
  const deployMode = resolveDeploymentMode(mode);
  const base = process.env.VITE_BASE_PATH || BASE_PATH_BY_MODE[deployMode] || BASE_PATH_BY_MODE.prod;

  return {
    base,
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
  };
});
