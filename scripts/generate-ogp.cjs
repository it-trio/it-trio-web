const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

// Get episode number from command line arguments
const episodeNumber = process.argv[2];

if (!episodeNumber) {
  console.error("Error: Episode number is required");
  console.error("Usage: node scripts/generate-ogp.cjs <episode-number>");
  process.exit(1);
}

/**
 * Find episode data by episode number
 */
function findEpisodeByNumber(number) {
  const episodesDir = path.join(__dirname, "../src/content/episode");
  const files = fs.readdirSync(episodesDir);

  for (const file of files) {
    if (file.endsWith(".json")) {
      const filePath = path.join(episodesDir, file);
      const content = fs.readFileSync(filePath, "utf8");
      const episode = JSON.parse(content);

      if (episode.number === parseInt(number)) {
        return episode;
      }
    }
  }

  return null;
}

/**
 * Check if OGP image already exists for this episode
 */
function checkOGPExists(episodeNumber) {
  const ogpPath = path.join(
    __dirname,
    "../public/episode/ogp",
    `${episodeNumber}.png`
  );
  return fs.existsSync(ogpPath);
}

/**
 * Check if episode metadata already exists
 */
function checkEpisodeMetaExists(guid) {
  const metaPath = path.join(
    __dirname,
    "../src/content/episodeMeta",
    `${guid}.json`
  );
  return fs.existsSync(metaPath);
}

/**
 * Generate OGP image by overlaying episode title on template
 */
async function generateOGPImage(episode) {
  console.log(
    `Generating OGP image for episode ${episode.number}: ${episode.title}`
  );

  // Load the base template
  const templatePath = path.join(__dirname, "../public/ogp-template.png");
  const template = sharp(templatePath);

  // Get template dimensions
  const { width, height } = await template.metadata();
  console.log(`Template dimensions: ${width}x${height}`);

  // Create SVG text overlay
  const svgText = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>
          .episode-title {
            font-family: 'Noto Sans JP', 'Hiragino Sans', 'Yu Gothic', sans-serif;
            font-size: 48px;
            font-weight: bold;
            fill: #ffffff;
            text-anchor: middle;
            dominant-baseline: middle;
          }
        </style>
      </defs>
      <text x="${width / 2}" y="${height / 2 + 50}" class="episode-title">
        ${episode.title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}
      </text>
    </svg>
  `;

  // Create SVG buffer
  const svgBuffer = Buffer.from(svgText);

  // Composite the text onto the template
  const outputBuffer = await template
    .composite([
      {
        input: svgBuffer,
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toBuffer();

  return outputBuffer;
}

/**
 * Save OGP image to public directory
 */
function saveOGPImage(imageBuffer, episodeNumber) {
  const ogpDir = path.join(__dirname, "../public/episode/ogp");

  // Create directory if it doesn't exist
  if (!fs.existsSync(ogpDir)) {
    fs.mkdirSync(ogpDir, { recursive: true });
  }

  const filePath = path.join(ogpDir, `${episodeNumber}.png`);
  fs.writeFileSync(filePath, imageBuffer);

  console.log(`OGP image saved to: ${filePath}`);
}

/**
 * Create episode metadata file
 */
function createEpisodeMeta(guid, episodeNumber) {
  const metaDir = path.join(__dirname, "../src/content/episodeMeta");

  // Create directory if it doesn't exist
  if (!fs.existsSync(metaDir)) {
    fs.mkdirSync(metaDir, { recursive: true });
  }

  const metaData = {
    ogImagePath: `/episode/ogp/${episodeNumber}.png`,
  };

  const filePath = path.join(metaDir, `${guid}.json`);
  fs.writeFileSync(filePath, JSON.stringify(metaData, null, 2));

  console.log(`Episode metadata saved to: ${filePath}`);
}

/**
 * Main function
 */
(async () => {
  try {
    console.log(`Starting OGP generation for episode ${episodeNumber}`);

    // Find the episode
    const episode = findEpisodeByNumber(episodeNumber);
    if (!episode) {
      console.error(`Error: Episode ${episodeNumber} not found`);
      process.exit(1);
    }

    console.log(`Found episode: ${episode.title}`);

    // Check if OGP already exists
    if (checkOGPExists(episodeNumber)) {
      console.log(
        `OGP image for episode ${episodeNumber} already exists, skipping...`
      );
      process.exit(0);
    }

    // Check if episode metadata already exists
    if (checkEpisodeMetaExists(episode.guid)) {
      console.log(
        `Episode metadata for ${episode.guid} already exists, skipping...`
      );
      process.exit(0);
    }

    // Generate OGP image
    const imageBuffer = await generateOGPImage(episode);

    // Save OGP image
    saveOGPImage(imageBuffer, episodeNumber);

    // Create episode metadata
    createEpisodeMeta(episode.guid, episodeNumber);

    console.log("✓ OGP generation completed successfully!");
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
})();
