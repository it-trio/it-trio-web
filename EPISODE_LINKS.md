# Episode Platform Links

This document explains how to add episode-specific links for Spotify, Apple Podcast, Amazon Music, and YouTube to each episode page.

## Overview

Currently, each episode page links to the channel page for each platform. With this feature, you can add episode-specific links that will be displayed instead of channel links when available.

If an episode doesn't have a specific platform link, the page will automatically fall back to displaying the channel link.

## How to Add Episode Links

### Step 1: Prepare the Episode Links File

Create a JSON file (e.g., `episode-links.json`) with the following structure:

```json
{
  "episode-guid-1": {
    "spotifyEpisodeLink": "https://open.spotify.com/episode/...",
    "applePodcastEpisodeLink": "https://podcasts.apple.com/...",
    "amazonMusicEpisodeLink": "https://music.amazon.co.jp/...",
    "youtubeMusicEpisodeLink": "https://music.youtube.com/...",
    "youtubeEpisodeLink": "https://www.youtube.com/watch?v=..."
  },
  "episode-guid-2": {
    "spotifyEpisodeLink": "https://open.spotify.com/episode/...",
    "youtubeEpisodeLink": "https://www.youtube.com/watch?v=..."
  }
}
```

**Notes:**
- The key is the episode GUID (the filename without `.json`)
- All platform link fields are optional
- You can add links for just some platforms, and the others will fall back to channel links
- See `episode-links.example.json` for a template

### Step 2: Find Episode GUIDs

Episode GUIDs are the filenames (without `.json`) in `src/content/episode/`:

```bash
ls src/content/episode/
```

### Step 3: Get Episode Links from Each Platform

#### Spotify
1. Open the episode in Spotify
2. Click "Share" → "Copy Episode Link"
3. Format: `https://open.spotify.com/episode/{episode_id}`

#### Apple Podcast
1. Open the episode in Apple Podcasts
2. Right-click → "Copy Link" or use the share button
3. Format: `https://podcasts.apple.com/jp/podcast/episode-name/id{show_id}?i={episode_id}`

#### Amazon Music
1. Open the episode in Amazon Music
2. Use the share function to get the episode link
3. Format: `https://music.amazon.co.jp/podcasts/{show_id}/episodes/{episode_id}`

#### YouTube
1. Open the episode video on YouTube
2. Copy the video URL
3. Format: `https://www.youtube.com/watch?v={video_id}`

#### YouTube Music
1. Open the episode in YouTube Music
2. Use the share function
3. Format: `https://music.youtube.com/watch?v={video_id}`

### Step 4: Run the Update Script

Once you have your `episode-links.json` file ready:

```bash
pnpm update-episode-links episode-links.json
```

Or using node directly:

```bash
node scripts/update-episode-links.cjs episode-links.json
```

The script will:
- Read each episode JSON file
- Add the provided episode links
- Skip episodes that already have links
- Show a summary of updated and skipped episodes

### Step 5: Verify the Changes

After running the script:

1. Check a few episode JSON files to verify the links were added:
   ```bash
   cat src/content/episode/EPISODE_GUID.json
   ```

2. Format the code:
   ```bash
   pnpm format
   ```

3. Start the dev server and check an episode page:
   ```bash
   pnpm start
   ```

4. Verify that clicking on the platform buttons goes to the episode-specific link

## Example Workflow

1. Get episode links for a few episodes:
   ```json
   {
     "0a775d4e-d12f-426f-8005-6c79b3c1c71b": {
       "spotifyEpisodeLink": "https://open.spotify.com/episode/ABC123",
       "youtubeEpisodeLink": "https://www.youtube.com/watch?v=XYZ789"
     }
   }
   ```

2. Save to `my-episode-links.json`

3. Run the script:
   ```bash
   pnpm update-episode-links my-episode-links.json
   ```

4. The script will update the episode JSON files with the new links

5. Build and deploy:
   ```bash
   pnpm build
   ```

## Technical Details

### Schema Changes

The episode schema in `src/content/config.ts` now includes these optional fields:
- `spotifyEpisodeLink`
- `applePodcastEpisodeLink`
- `amazonMusicEpisodeLink`
- `youtubeMusicEpisodeLink`
- `youtubeEpisodeLink`

### Component Updates

- `ListenOn.astro`: Now accepts episode-specific links and falls back to channel links
- `EpisodePost.astro`: Passes episode links to the `ListenOn` component

### Fallback Behavior

If an episode doesn't have a specific platform link, the channel link will be used instead. This is defined in `src/consts.ts`:
- `SPOTIFY_SHOW_LINK`
- `APPLE_PODCAST_SHOW_LINK`
- `AMAZON_MUSIC_SHOW_LINK`
- `YOUTUBE_MUSIC_SHOW_LINK`
- `YOUTUBE_SHOW_LINK`

## Tips

- You can gradually add episode links over time - the fallback ensures existing episodes still work
- Consider automating episode link collection if the platforms provide APIs
- When fetching RSS feeds with `pnpm fetch`, the script won't overwrite existing episode links
