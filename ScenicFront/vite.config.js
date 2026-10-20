import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Keep the Create React App era variable name working on Vercel
  // (REACT_APP_BACKEND_URL), alongside Vite's own VITE_ prefix.
  envPrefix: ["VITE_", "REACT_APP_"],
  build: {
    // Same output folder and hashed-asset path as the CRA build, so the
    // /static/* immutable cache rule still applies, and hashed files never
    // mix with the hero images in public/assets.
    outDir: "build",
    assetsDir: "static",
  },
});
