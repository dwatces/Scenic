import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The deployed client's address, for the absolute og:image / twitter:image
// URLs link previews need. Override with VITE_SITE_URL.
const DEFAULT_SITE_URL = "https://scenic-app.vercel.app";

/** Fills %SITE_URL% in index.html. */
function siteUrl() {
  let url = DEFAULT_SITE_URL;
  return {
    name: "scenic-site-url",
    configResolved(config) {
      url = (config.env.VITE_SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, "");
    },
    transformIndexHtml: (html) => html.replaceAll("%SITE_URL%", url),
  };
}

export default defineConfig({
  plugins: [react(), siteUrl()],
  // Keep the Create React App era variable name working on Vercel
  // (REACT_APP_BACKEND_URL), alongside Vite's own VITE_ prefix.
  envPrefix: ["VITE_", "REACT_APP_"],
  build: {
    // Same output folder and hashed-asset path as the CRA build, so the
    // /static/* immutable cache rule still applies.
    outDir: "build",
    assetsDir: "static",
  },
});
