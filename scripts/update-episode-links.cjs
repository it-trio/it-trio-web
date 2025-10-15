#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

/**
 * Script to update episode-specific platform links in episode JSON files
 *
 * This script adds episode-specific links for Spotify, Apple Podcast, Amazon Music, and YouTube
 * to episode JSON files. If an episode link is not provided, the episode page will fall back
 * to the channel page link.
 *
 * Usage:
 * 1. Create a JSON file (e.g., episode-links.json) with the following structure:
 *    {
 *      "episode-guid-1": {
 *        "spotifyEpisodeLink": "https://open.spotify.com/episode/...",
 *        "applePodcastEpisodeLink": "https://podcasts.apple.com/...",
 *        "amazonMusicEpisodeLink": "https://music.amazon.co.jp/...",
 *        "youtubeMusicEpisodeLink": "https://music.youtube.com/...",
 *        "youtubeEpisodeLink": "https://www.youtube.com/watch?v=..."
 *      },
 *      ...
 *    }
 *
 * 2. Run: node scripts/update-episode-links.cjs episode-links.json
 *
 * Or run without arguments to add empty fields to all episodes:
 *    node scripts/update-episode-links.cjs
 */

const episodeDir = path.join(__dirname, "../src/content/episode");

function updateEpisodeLinks(linksData = {}) {
  const files = fs.readdirSync(episodeDir);
  let updatedCount = 0;
  let skippedCount = 0;

  files.forEach((file) => {
    if (!file.endsWith(".json")) {
      return;
    }

    const filePath = path.join(episodeDir, file);
    const guid = file.replace(".json", "");

    try {
      const content = fs.readFileSync(filePath, "utf8");
      const episode = JSON.parse(content);

      // Check if episode already has platform links
      const hasLinks =
        episode.spotifyEpisodeLink ||
        episode.applePodcastEpisodeLink ||
        episode.amazonMusicEpisodeLink ||
        episode.youtubeMusicEpisodeLink ||
        episode.youtubeEpisodeLink;

      // Get links for this episode from the provided data
      const episodeLinks = linksData[guid] || {};

      // Add or update episode links (only if provided in linksData)
      let updated = false;

      if (episodeLinks.spotifyEpisodeLink) {
        episode.spotifyEpisodeLink = episodeLinks.spotifyEpisodeLink;
        updated = true;
      }
      if (episodeLinks.applePodcastEpisodeLink) {
        episode.applePodcastEpisodeLink = episodeLinks.applePodcastEpisodeLink;
        updated = true;
      }
      if (episodeLinks.amazonMusicEpisodeLink) {
        episode.amazonMusicEpisodeLink = episodeLinks.amazonMusicEpisodeLink;
        updated = true;
      }
      if (episodeLinks.youtubeMusicEpisodeLink) {
        episode.youtubeMusicEpisodeLink = episodeLinks.youtubeMusicEpisodeLink;
        updated = true;
      }
      if (episodeLinks.youtubeEpisodeLink) {
        episode.youtubeEpisodeLink = episodeLinks.youtubeEpisodeLink;
        updated = true;
      }

      if (updated) {
        // Write the updated episode back to the file
        fs.writeFileSync(filePath, JSON.stringify(episode, null, 2) + "\n");
        console.log(`✓ Updated: Episode ${episode.number} (${guid})`);
        updatedCount++;
      } else if (hasLinks) {
        console.log(`- Skipped: Episode ${episode.number} already has links`);
        skippedCount++;
      } else {
        console.log(`- Skipped: Episode ${episode.number} (no links provided)`);
        skippedCount++;
      }
    } catch (err) {
      console.error(`✗ Error processing ${file}:`, err.message);
    }
  });

  console.log("\n=== Summary ===");
  console.log(`Updated: ${updatedCount} episodes`);
  console.log(`Skipped: ${skippedCount} episodes`);
}

// Main execution
const linksFilePath = process.argv[2];

if (linksFilePath) {
  // Read links from provided JSON file
  try {
    const linksData = JSON.parse(fs.readFileSync(linksFilePath, "utf8"));
    console.log(`Reading episode links from: ${linksFilePath}\n`);
    updateEpisodeLinks(linksData);
  } catch (err) {
    console.error(`Error reading links file: ${err.message}`);
    process.exit(1);
  }
} else {
  console.log("No links file provided.");
  console.log(
    "\nUsage: node scripts/update-episode-links.cjs <links-file.json>",
  );
  console.log("\nExample links file format:");
  console.log(
    JSON.stringify(
      {
        "episode-guid": {
          spotifyEpisodeLink: "https://open.spotify.com/episode/...",
          applePodcastEpisodeLink: "https://podcasts.apple.com/...",
          amazonMusicEpisodeLink: "https://music.amazon.co.jp/...",
          youtubeMusicEpisodeLink: "https://music.youtube.com/...",
          youtubeEpisodeLink: "https://www.youtube.com/watch?v=...",
        },
      },
      null,
      2,
    ),
  );
  console.log(
    "\nNote: The episode page will fall back to channel links if episode links are not provided.",
  );
}
