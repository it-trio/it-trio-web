#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const https = require("https");

/**
 * Script to automatically fetch episode links from various platforms
 *
 * This script fetches episode-specific links from Spotify, Apple Podcasts, and YouTube
 * using their respective APIs. It matches episodes by title and episode number.
 *
 * Setup:
 * 1. Create a .env file in the project root with:
 *    SPOTIFY_CLIENT_ID=your_spotify_client_id
 *    SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
 *    YOUTUBE_API_KEY=your_youtube_api_key
 *
 * 2. Get Spotify credentials from: https://developer.spotify.com/dashboard
 * 3. Get YouTube API key from: https://console.cloud.google.com/apis/credentials
 *
 * Usage:
 *    node scripts/fetch-episode-links.cjs [--all] [episode-number]
 *
 *    --all: Fetch links for all episodes
 *    episode-number: Fetch links for a specific episode number
 *    (no args): Interactive mode
 */

// Configuration from consts.ts
const SPOTIFY_SHOW_ID = "4swQbE6pLzOz3p1Z9Etkqc";
const APPLE_PODCAST_ID = "1644482809";
const YOUTUBE_CHANNEL_ID = "UCxXxWl8ZX8K4V7x0i4h0iXg"; // @it-trio
const YOUTUBE_PLAYLIST_ID = "PLqtv1UJuRQssCX_himpcWZLalPSeHIcR3"; // YouTube Music playlist

const episodeDir = path.join(__dirname, "../src/content/episode");

// Load environment variables from .env file if it exists
function loadEnv() {
  const envPath = path.join(__dirname, "../.env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    envContent.split("\n").forEach((line) => {
      const [key, ...valueParts] = line.split("=");
      if (key && valueParts.length > 0) {
        const value = valueParts.join("=").trim();
        process.env[key.trim()] = value;
      }
    });
  }
}

loadEnv();

// Helper function to make HTTPS requests
function httpsRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data });
        }
      });
    });
    req.on("error", reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

// Spotify API functions
async function getSpotifyAccessToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.log("⚠️  Spotify credentials not found. Skipping Spotify.");
    return null;
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const url = "https://accounts.spotify.com/api/token";

  try {
    const response = await httpsRequest(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    return response.data.access_token;
  } catch (error) {
    console.error("Error getting Spotify access token:", error.message);
    return null;
  }
}

async function fetchSpotifyEpisodes(accessToken) {
  if (!accessToken) return [];

  console.log("🎵 Fetching Spotify episodes...");
  const episodes = [];
  let url = `https://api.spotify.com/v1/shows/${SPOTIFY_SHOW_ID}/episodes?limit=50`;

  try {
    while (url) {
      const response = await httpsRequest(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.statusCode !== 200) {
        console.error("Spotify API error:", response.data);
        break;
      }

      episodes.push(...response.data.items);
      url = response.data.next;
    }

    console.log(`✓ Found ${episodes.length} episodes on Spotify`);
    return episodes;
  } catch (error) {
    console.error("Error fetching Spotify episodes:", error.message);
    return [];
  }
}

// Apple Podcasts API functions
async function fetchApplePodcastEpisodes() {
  console.log("🍎 Fetching Apple Podcast episodes...");

  try {
    const url = `https://itunes.apple.com/lookup?id=${APPLE_PODCAST_ID}&entity=podcastEpisode&limit=200`;
    const response = await httpsRequest(url);

    if (response.statusCode !== 200) {
      console.error("Apple Podcasts API error:", response.data);
      return [];
    }

    const episodes = response.data.results.slice(1); // First result is the show info
    console.log(`✓ Found ${episodes.length} episodes on Apple Podcasts`);
    return episodes;
  } catch (error) {
    console.error("Error fetching Apple Podcast episodes:", error.message);
    return [];
  }
}

// YouTube API functions
async function fetchYouTubeVideos() {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    console.log("⚠️  YouTube API key not found. Skipping YouTube.");
    return [];
  }

  console.log("📺 Fetching YouTube videos...");
  const videos = [];

  try {
    // Fetch from playlist
    let url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${YOUTUBE_PLAYLIST_ID}&maxResults=50&key=${apiKey}`;
    let nextPageToken = null;

    do {
      const requestUrl = nextPageToken
        ? `${url}&pageToken=${nextPageToken}`
        : url;
      const response = await httpsRequest(requestUrl);

      if (response.statusCode !== 200) {
        console.error("YouTube API error:", response.data);
        break;
      }

      videos.push(...response.data.items);
      nextPageToken = response.data.nextPageToken;
    } while (nextPageToken);

    console.log(`✓ Found ${videos.length} videos on YouTube`);
    return videos;
  } catch (error) {
    console.error("Error fetching YouTube videos:", error.message);
    return [];
  }
}

// Matching functions
function normalizeTitle(title) {
  // Remove episode number prefix like "18: " and normalize
  return title
    .replace(/^\d+:\s*/, "")
    .toLowerCase()
    .trim();
}

function matchSpotifyEpisode(episode, spotifyEpisodes) {
  const episodeTitle = normalizeTitle(episode.title);

  // Try to match by episode number in name
  let match = spotifyEpisodes.find((sp) => {
    const spTitle = normalizeTitle(sp.name);
    return spTitle === episodeTitle || sp.name.includes(`${episode.number}:`);
  });

  if (match) {
    return `https://open.spotify.com/episode/${match.id}`;
  }

  return null;
}

function matchApplePodcastEpisode(episode, applePodcastEpisodes) {
  const episodeTitle = normalizeTitle(episode.title);

  const match = applePodcastEpisodes.find((ap) => {
    const apTitle = normalizeTitle(ap.trackName || "");
    return (
      apTitle === episodeTitle || ap.trackName?.includes(`${episode.number}:`)
    );
  });

  if (match) {
    return match.trackViewUrl;
  }

  return null;
}

function matchYouTubeVideo(episode, youtubeVideos) {
  const episodeTitle = normalizeTitle(episode.title);

  const match = youtubeVideos.find((yt) => {
    const ytTitle = normalizeTitle(yt.snippet?.title || "");
    return (
      ytTitle === episodeTitle ||
      yt.snippet?.title?.includes(`${episode.number}:`)
    );
  });

  if (match) {
    const videoId = match.snippet?.resourceId?.videoId || match.id?.videoId;
    if (videoId) {
      return {
        youtube: `https://www.youtube.com/watch?v=${videoId}`,
        youtubeMusic: `https://music.youtube.com/watch?v=${videoId}`,
      };
    }
  }

  return null;
}

// Main processing function
async function fetchLinksForEpisodes(episodeNumbers = null) {
  // Get all episode files
  const files = fs.readdirSync(episodeDir).filter((f) => f.endsWith(".json"));

  let episodes = files.map((file) => {
    const content = fs.readFileSync(path.join(episodeDir, file), "utf8");
    return JSON.parse(content);
  });

  // Filter by episode numbers if specified
  if (episodeNumbers && episodeNumbers.length > 0) {
    episodes = episodes.filter((ep) => episodeNumbers.includes(ep.number));
  }

  episodes.sort((a, b) => a.number - b.number);

  console.log(`\n📚 Processing ${episodes.length} episodes...\n`);

  // Fetch data from all platforms
  const spotifyToken = await getSpotifyAccessToken();
  const spotifyEpisodes = await fetchSpotifyEpisodes(spotifyToken);
  const applePodcastEpisodes = await fetchApplePodcastEpisodes();
  const youtubeVideos = await fetchYouTubeVideos();

  console.log("\n🔍 Matching episodes with platform links...\n");

  const results = {};
  let matchedCount = 0;

  for (const episode of episodes) {
    const links = {};
    let hasMatch = false;

    // Match Spotify
    if (spotifyEpisodes.length > 0) {
      const spotifyLink = matchSpotifyEpisode(episode, spotifyEpisodes);
      if (spotifyLink) {
        links.spotifyEpisodeLink = spotifyLink;
        hasMatch = true;
      }
    }

    // Match Apple Podcasts
    if (applePodcastEpisodes.length > 0) {
      const appleLink = matchApplePodcastEpisode(episode, applePodcastEpisodes);
      if (appleLink) {
        links.applePodcastEpisodeLink = appleLink;
        hasMatch = true;
      }
    }

    // Match YouTube
    if (youtubeVideos.length > 0) {
      const youtubeLinks = matchYouTubeVideo(episode, youtubeVideos);
      if (youtubeLinks) {
        links.youtubeEpisodeLink = youtubeLinks.youtube;
        links.youtubeMusicEpisodeLink = youtubeLinks.youtubeMusic;
        hasMatch = true;
      }
    }

    if (hasMatch) {
      results[episode.guid] = links;
      matchedCount++;

      const platforms = [];
      if (links.spotifyEpisodeLink) platforms.push("Spotify");
      if (links.applePodcastEpisodeLink) platforms.push("Apple");
      if (links.youtubeEpisodeLink) platforms.push("YouTube");

      console.log(`✓ Episode ${episode.number}: ${platforms.join(", ")}`);
    } else {
      console.log(`✗ Episode ${episode.number}: No matches found`);
    }
  }

  console.log(
    `\n📊 Summary: Matched ${matchedCount} out of ${episodes.length} episodes\n`,
  );

  // Save results to file
  if (Object.keys(results).length > 0) {
    const outputPath = path.join(__dirname, "../episode-links-fetched.json");
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`💾 Saved results to: episode-links-fetched.json`);
    console.log(
      `\nTo apply these links, run:\n  pnpm update-episode-links episode-links-fetched.json\n`,
    );
  } else {
    console.log(
      "⚠️  No matches found. Check your API credentials and try again.\n",
    );
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Usage: node scripts/fetch-episode-links.cjs [OPTIONS] [EPISODE_NUMBERS]

Automatically fetch episode links from Spotify, Apple Podcasts, and YouTube.

Options:
  --all               Fetch links for all episodes
  --help, -h          Show this help message

Examples:
  node scripts/fetch-episode-links.cjs --all
  node scripts/fetch-episode-links.cjs 1 2 3 4 5
  node scripts/fetch-episode-links.cjs 18

Environment Variables (required):
  SPOTIFY_CLIENT_ID       Your Spotify app client ID
  SPOTIFY_CLIENT_SECRET   Your Spotify app client secret
  YOUTUBE_API_KEY         Your YouTube Data API v3 key

See EPISODE_LINKS.md for setup instructions.
    `);
    process.exit(0);
  }

  if (args.includes("--all")) {
    return { all: true, episodes: null };
  }

  // Parse episode numbers
  const episodes = args
    .filter((arg) => !arg.startsWith("--"))
    .map((arg) => parseInt(arg, 10))
    .filter((n) => !isNaN(n));

  return {
    all: episodes.length === 0,
    episodes: episodes.length > 0 ? episodes : null,
  };
}

// Main execution
async function main() {
  console.log("🚀 Episode Links Fetcher\n");

  const { all, episodes } = parseArgs();

  if (!all && (!episodes || episodes.length === 0)) {
    console.log("Please specify episode numbers or use --all");
    console.log("Run with --help for usage information\n");
    process.exit(1);
  }

  await fetchLinksForEpisodes(episodes);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
