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
    author: z.string().optional(),
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
    summary: z.string(),
    url: z.string(),
    episodeType: z.string(),
    // Episode-specific platform links (optional, fallback to channel links)
    spotifyEpisodeLink: z.string().optional(),
    applePodcastEpisodeLink: z.string().optional(),
    amazonMusicEpisodeLink: z.string().optional(),
    youtubeMusicEpisodeLink: z.string().optional(),
    youtubeEpisodeLink: z.string().optional(),
  }),
});

const episodeMeta = defineCollection({
  type: "data",
  schema: z.object({
    ogImagePath: z.string(),
  }),
});

const transcription = defineCollection({
  type: "data",
  schema: z.object({
    segments: z.array(
      z.object({
        speaker: z.string(),
        text: z.string(),
        timestamp: z.string(),
        start: z.number(),
        end: z.number(),
      }),
    ),
    language: z.string(),
  }),
});

export const collections = { blog, episode, episodeMeta, transcription };
