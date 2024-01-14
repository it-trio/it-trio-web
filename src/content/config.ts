import { defineCollection, z } from "astro:content";

const blog = defineCollection({
  type: "content",
  // Type-check frontmatter using a schema
  schema: z.object({
    title: z.string(),
    description: z.string(),
    // Transform string to Date object
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    heroImage: z.string().optional(),
  }),
});

const episode = defineCollection({
  type: "data",
  schema: z.object({
    guid: z.string(),
    title: z.string(),
    description: z.string(),
    number: z.number(),
    season: z.number(),
    pubDate: z.coerce.date(),
    image: z.string(),
    duration: z.string(),
    url: z.string(),
  }),
});

export const collections = { blog, episode };
