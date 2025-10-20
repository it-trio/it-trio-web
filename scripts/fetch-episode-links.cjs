#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const https = require("https");
const zlib = require("zlib");
let puppeteer = null;

// Try to load puppeteer (optional dependency)
try {
  puppeteer = require("puppeteer");
} catch (e) {
  // Puppeteer not installed
}

/**
 * Script to automatically fetch and update episode links from various platforms
 *
 * This script fetches episode-specific links from Spotify, Apple Podcasts, Amazon Music,
 * and YouTube using their respective APIs/web scraping. It matches episodes by title and
 * episode number, then automatically updates the episode JSON files.
 *
 * Setup:
 * 1. Create a .env file in the project root with:
 *    SPOTIFY_CLIENT_ID=your_spotify_client_id
 *    SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
 *    YOUTUBE_API_KEY=your_youtube_api_key
 *
 * 2. Get Spotify credentials from: https://developer.spotify.com/dashboard
 * 3. Get YouTube API key from: https://console.cloud.google.com/apis/credentials
 * 4. Amazon Music uses Puppeteer (browser automation) - requires: pnpm add -D puppeteer
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
const AMAZON_MUSIC_SHOW_ID = "fdfe7e3f-4ddb-4717-9501-414e5dabcf3b";
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

// Helper function to make HTTPS requests with redirect and compression support
function httpsRequest(url, options = {}, redirectCount = 0) {
  const maxRedirects = 5;

  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      // Handle redirects
      if (
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        if (redirectCount >= maxRedirects) {
          reject(new Error(`Too many redirects (${maxRedirects})`));
          return;
        }

        // Follow redirect
        const redirectUrl = res.headers.location;
        console.log(`  → Following redirect to: ${redirectUrl}`);

        // Recursively follow redirect
        httpsRequest(redirectUrl, options, redirectCount + 1)
          .then(resolve)
          .catch(reject);
        return;
      }

      // Handle compression
      let stream = res;
      const encoding = res.headers["content-encoding"];

      if (encoding === "gzip") {
        stream = res.pipe(zlib.createGunzip());
      } else if (encoding === "deflate") {
        stream = res.pipe(zlib.createInflate());
      } else if (encoding === "br") {
        stream = res.pipe(zlib.createBrotliDecompress());
      }

      let data = "";
      stream.on("data", (chunk) => (data += chunk));
      stream.on("end", () => {
        try {
          resolve({
            statusCode: res.statusCode,
            data: JSON.parse(data),
            headers: res.headers,
          });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data, headers: res.headers });
        }
      });
      stream.on("error", reject);
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
  console.log("🍎 Fetching Apple Podcast episodes (Japanese region)...");

  try {
    // Use country=jp to fetch from Japanese iTunes Store
    const url = `https://itunes.apple.com/lookup?id=${APPLE_PODCAST_ID}&entity=podcastEpisode&limit=200&country=jp`;
    const response = await httpsRequest(url);

    if (response.statusCode !== 200) {
      console.error("Apple Podcasts API error:", response.data);
      return [];
    }

    const episodes = response.data.results.slice(1); // First result is the show info
    console.log(
      `✓ Found ${episodes.length} episodes on Apple Podcasts (Japan)`,
    );
    return episodes;
  } catch (error) {
    console.error("Error fetching Apple Podcast episodes:", error.message);
    return [];
  }
}

// Amazon Music API functions (browser automation with Puppeteer)
async function fetchAmazonMusicEpisodes() {
  console.log("📦 Fetching Amazon Music episodes (browser automation)...");

  if (!puppeteer) {
    console.log("⚠️  Puppeteer not installed. Skipping Amazon Music.");
    console.log("   Install with: pnpm add -D puppeteer");
    return [];
  }

  let browser = null;

  try {
    const url = `https://music.amazon.co.jp/podcasts/${AMAZON_MUSIC_SHOW_ID}`;
    console.log(`  Launching headless browser...`);

    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });

    const page = await browser.newPage();

    // Set viewport and user agent
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    );

    console.log(`  Navigating to: ${url}`);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    console.log(`  Waiting for content to load...`);

    // Wait for episode list to be rendered
    // Amazon Music typically loads episodes in a container
    await page
      .waitForSelector('a[href*="/episodes/"]', {
        timeout: 15000,
      })
      .catch(() => {
        console.log("  Could not find episode links on page");
      });

    // Additional wait to ensure dynamic content is fully loaded
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Extract episode links
    const episodes = await page.evaluate((showId) => {
      const episodeLinks = [];
      const links = document.querySelectorAll('a[href*="/episodes/"]');

      links.forEach((link) => {
        const href = link.getAttribute("href");
        if (href && href.includes(`/podcasts/${showId}/episodes/`)) {
          // Extract episode ID from href
          const match = href.match(/\/episodes\/([a-zA-Z0-9-]+)/);
          if (match) {
            const episodeId = match[1];

            // Try to find title in parent container or aria-label
            let titleText = "";

            // Check aria-label first (often contains the title)
            if (link.getAttribute("aria-label")) {
              titleText = link.getAttribute("aria-label");
            }

            // If no aria-label, look for common text patterns
            if (!titleText) {
              // Find the parent container and look for text nodes
              let current = link;
              for (let i = 0; i < 3; i++) {
                if (current.parentElement) {
                  current = current.parentElement;

                  // Look for elements with substantial text
                  const textElements = current.querySelectorAll(
                    "div, span, p, h1, h2, h3, h4",
                  );
                  for (const el of textElements) {
                    const text = el.textContent?.trim();
                    // Look for text that looks like a title (has length, not just numbers/dates)
                    if (
                      text &&
                      text.length > 5 &&
                      text.length < 200 &&
                      /[^\d\s]/.test(text)
                    ) {
                      titleText = text;
                      break;
                    }
                  }

                  if (titleText) break;
                }
              }
            }

            // Fallback: get text from the link itself
            if (!titleText && link.textContent) {
              titleText = link.textContent.trim();
            }

            // Clean up the title
            if (titleText) {
              titleText = titleText.replace(/\s+/g, " ").trim();
            }

            episodeLinks.push({
              id: episodeId,
              name: titleText || `Episode ${episodeId}`,
              url: href.startsWith("http")
                ? href
                : `https://music.amazon.co.jp${href}`,
            });
          }
        }
      });

      // Remove duplicates based on episode ID
      const unique = [];
      const seen = new Set();
      for (const episode of episodeLinks) {
        if (!seen.has(episode.id)) {
          seen.add(episode.id);
          unique.push(episode);
        }
      }

      return unique;
    }, AMAZON_MUSIC_SHOW_ID);

    // Debug: log first few episodes to help with troubleshooting
    if (episodes.length > 0 && process.env.DEBUG) {
      console.log("  First 3 episodes found:");
      episodes.slice(0, 3).forEach((ep) => {
        console.log(
          `    - ${ep.name.substring(0, 60)}... (${ep.id.substring(0, 8)}...)`,
        );
      });
    }

    if (episodes.length > 0) {
      console.log(`✓ Found ${episodes.length} episodes on Amazon Music`);
    } else {
      console.log("⚠️  Could not extract episodes from Amazon Music.");
      console.log(
        "   The page might require authentication or have a different structure.",
      );
    }

    return episodes;
  } catch (error) {
    console.log("⚠️  Error fetching Amazon Music episodes:", error.message);
    if (error.message.includes("timeout")) {
      console.log(
        "   Page loading timed out. Amazon Music might require authentication.",
      );
    }
    return [];
  } finally {
    if (browser) {
      await browser.close();
    }
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

function matchAmazonMusicEpisode(episode, amazonMusicEpisodes) {
  const episodeTitle = normalizeTitle(episode.title);

  const match = amazonMusicEpisodes.find((am) => {
    const amTitle = normalizeTitle(am.name || "");
    return amTitle === episodeTitle || am.name?.includes(`${episode.number}:`);
  });

  if (match) {
    // Extract episode ID from URL
    if (match.url) {
      return match.url;
    } else if (match["@id"]) {
      return match["@id"];
    }
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
  const amazonMusicEpisodes = await fetchAmazonMusicEpisodes();
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

    // Match Amazon Music
    if (amazonMusicEpisodes.length > 0) {
      const amazonLink = matchAmazonMusicEpisode(episode, amazonMusicEpisodes);
      if (amazonLink) {
        links.amazonMusicEpisodeLink = amazonLink;
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
      if (links.amazonMusicEpisodeLink) platforms.push("Amazon");
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

    // Automatically update episode files with fetched links
    console.log("\n📝 Updating episode files...\n");
    updateEpisodeFiles(results);
  } else {
    console.log(
      "⚠️  No matches found. Check your API credentials and try again.\n",
    );
  }
}

// Update episode files with fetched links
function updateEpisodeFiles(linksData) {
  const files = fs.readdirSync(episodeDir);
  let updatedCount = 0;
  let skippedCount = 0;

  files.forEach((file) => {
    if (!file.endsWith(".json")) {
      return;
    }

    const filePath = path.join(episodeDir, file);
    const guid = file.replace(".json", "");

    // Skip if no links for this episode
    if (!linksData[guid]) {
      return;
    }

    try {
      const content = fs.readFileSync(filePath, "utf8");
      const episode = JSON.parse(content);
      const episodeLinks = linksData[guid];

      let updated = false;

      // Update episode links
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
        fs.writeFileSync(filePath, JSON.stringify(episode, null, 2) + "\n");
        console.log(
          `✓ Updated: Episode ${episode.number} (${guid.substring(0, 8)}...)`,
        );
        updatedCount++;
      } else {
        skippedCount++;
      }
    } catch (err) {
      console.error(`✗ Error processing ${file}:`, err.message);
    }
  });

  console.log("\n📊 Update Summary:");
  console.log(`  Updated: ${updatedCount} episodes`);
  console.log(`  Skipped: ${skippedCount} episodes\n`);
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Usage: node scripts/fetch-episode-links.cjs [OPTIONS] [EPISODE_NUMBERS]

Automatically fetch and update episode links from Spotify, Apple Podcasts, Amazon Music, and YouTube.
Episode JSON files are automatically updated with the fetched links.

Options:
  --all               Fetch links for all episodes
  --help, -h          Show this help message

Examples:
  node scripts/fetch-episode-links.cjs --all
  node scripts/fetch-episode-links.cjs 1 2 3 4 5
  node scripts/fetch-episode-links.cjs 18

Environment Variables (optional):
  SPOTIFY_CLIENT_ID       Your Spotify app client ID
  SPOTIFY_CLIENT_SECRET   Your Spotify app client secret
  YOUTUBE_API_KEY         Your YouTube Data API v3 key

Platform Support:
  ✓ Spotify          - Requires API credentials
  ✓ Apple Podcasts   - Works without credentials (public API)
  ✓ Amazon Music     - Uses Puppeteer browser automation (install: pnpm add -D puppeteer)
  ✓ YouTube          - Requires API key

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
