import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";

import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: 'https://it-trio.github.io',
  base:'/it-trio-web',
  integrations: [mdx(), sitemap()],
});
