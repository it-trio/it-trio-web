const RSS_URL = "https://rss.art19.com/it-pitpa";
const fs = require("fs");
const path = require("path");
let Parser = require("rss-parser");
let parser = new Parser();

(async () => {
  let feed = await parser.parseURL(RSS_URL);

  feed.items.forEach((item) => {
    const guid = item.guid.replace("gid://art19-episode-locator/V0/", "");

    //  ../src/content/episode 下に、{guid}.json として保存する
    const filePath = path.join(
      __dirname,
      "../src/content/episode",
      `${guid}.json`,
    );

    // Check if file already exists to preserve episode links
    let existingEpisodeLinks = {};
    if (fs.existsSync(filePath)) {
      try {
        const existingData = JSON.parse(fs.readFileSync(filePath, "utf8"));
        // Preserve episode-specific platform links if they exist
        if (existingData.spotifyEpisodeLink) {
          existingEpisodeLinks.spotifyEpisodeLink =
            existingData.spotifyEpisodeLink;
        }
        if (existingData.applePodcastEpisodeLink) {
          existingEpisodeLinks.applePodcastEpisodeLink =
            existingData.applePodcastEpisodeLink;
        }
        if (existingData.amazonMusicEpisodeLink) {
          existingEpisodeLinks.amazonMusicEpisodeLink =
            existingData.amazonMusicEpisodeLink;
        }
        if (existingData.youtubeMusicEpisodeLink) {
          existingEpisodeLinks.youtubeMusicEpisodeLink =
            existingData.youtubeMusicEpisodeLink;
        }
        if (existingData.youtubeEpisodeLink) {
          existingEpisodeLinks.youtubeEpisodeLink =
            existingData.youtubeEpisodeLink;
        }
      } catch (err) {
        // If error reading existing file, just continue without preserving links
        console.log(
          `Warning: Could not read existing file ${filePath}:`,
          err.message,
        );
      }
    }

    const json = {
      guid: guid,
      title: item.title,
      description: item.contentSnippet,
      number: Number(item.itunes.episode),
      season: Number(item.itunes.season),
      pubDate: item.isoDate,
      image: item.itunes.image,
      duration: item.itunes.duration,
      summary: item.itunes.summary,
      url: item.enclosure.url,
      episodeType: "full",
      // Preserve existing episode links
      ...existingEpisodeLinks,
    };

    // filePathにfsを使ってjsonを保存する
    fs.writeFile(filePath, JSON.stringify(json), (err) => {
      if (err) {
        console.log(err);
      } else {
        // console.log("success");
      }
    });
  });

  console.log("length: ", feed.items.length);
})();
