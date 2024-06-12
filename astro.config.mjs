import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  site: "https://it-trio-no.com",
  trailingSlash: "ignore",
  build: {
    format: "file",
  },
  integrations: [mdx(), sitemap()],
});
