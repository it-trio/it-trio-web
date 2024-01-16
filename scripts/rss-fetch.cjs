const RSS_URL = "https://rss.art19.com/it-pitpa";
const fs = require("fs");
const path = require("path");
let Parser = require("rss-parser");
let parser = new Parser();

(async () => {
  let feed = await parser.parseURL(RSS_URL);

  feed.items.forEach((item) => {
    const guid = item.guid.replace("gid://art19-episode-locator/V0/", "");
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
    };

    //  ../src/content/episode 下に、{guid}.json として保存する
    const filePath = path.join(
      __dirname,
      "../src/content/episode",
      `${guid}.json`,
    );

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
