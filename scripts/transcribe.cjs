const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!ELEVENLABS_API_KEY) {
  console.error("Error: ELEVENLABS_API_KEY environment variable is not set");
  process.exit(1);
}

if (!OPENAI_API_KEY) {
  console.error("Error: OPENAI_API_KEY environment variable is not set");
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

const episodeNumber = process.argv[2];

if (!episodeNumber) {
  console.error("Error: Episode number is required");
  console.error("Usage: node scripts/transcribe.cjs <episode-number>");
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
 * Transcribe audio using ElevenLabs scribe_v2 model
 */
async function transcribeAudio(audioUrl) {
  console.log("Downloading audio from:", audioUrl);

  const audioResponse = await fetch(audioUrl);
  if (!audioResponse.ok) {
    throw new Error(`Failed to download audio: ${audioResponse.statusText}`);
  }

  const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
  console.log(
    `Audio downloaded (${(audioBuffer.length / 1024 / 1024).toFixed(1)} MB)`,
  );

  console.log("Submitting transcription to ElevenLabs (scribe_v2)...");

  const formData = new FormData();
  formData.append("model_id", "scribe_v2");
  formData.append(
    "file",
    new Blob([audioBuffer], { type: "audio/mpeg" }),
    "audio.mp3",
  );
  formData.append("language_code", "ja");
  formData.append("diarize", "true");
  formData.append("timestamps_granularity", "word");
  formData.append("tag_audio_events", "false");

  const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: {
      "xi-api-key": ELEVENLABS_API_KEY,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `ElevenLabs API error (${response.status}): ${errorText}`,
    );
  }

  const data = await response.json();
  console.log("Transcription completed!");
  return data;
}

/**
 * Group word-level results into speaker segments.
 * ElevenLabs returns individual words with speaker_id; this groups
 * consecutive words from the same speaker into a single segment.
 */
function groupWordsIntoSegments(words) {
  const segments = [];
  let current = null;

  for (const word of words) {
    if (word.type !== "word") continue;

    const speakerId = word.speaker_id || "speaker_0";

    if (!current || current.speakerId !== speakerId) {
      if (current) {
        segments.push(current);
      }
      current = {
        speakerId,
        text: word.text,
        startSec: word.start,
        endSec: word.end,
      };
    } else {
      current.text += word.text;
      current.endSec = word.end;
    }
  }

  if (current) {
    segments.push(current);
  }

  return segments;
}

/**
 * Map ElevenLabs speaker_id ("speaker_0") to letter label ("A").
 */
function mapSpeakerLabel(speakerId) {
  const match = speakerId.match(/speaker_(\d+)/);
  if (match) {
    return String.fromCharCode(65 + parseInt(match[1]));
  }
  return speakerId;
}

/**
 * Clean up Japanese text using OpenAI API
 */
async function cleanupJapaneseText(text) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a Japanese text cleanup specialist. Your task is to clean up Japanese transcription text by:

1. Removing excessive spaces between Japanese characters
2. Fixing predictable typos and misrecognitions
3. Correcting misrecognized words based on context
4. Normalizing punctuation
5. Preserving the original meaning and natural flow

Return ONLY the cleaned text without any explanations or additional commentary.`,
        },
        {
          role: "user",
          content: text,
        },
      ],
      max_tokens: 1000,
      temperature: 0.1,
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.warn(`Warning: Failed to cleanup text segment: ${error.message}`);
    return text;
  }
}

/**
 * Process a batch of segments in parallel
 */
async function processBatch(segments, batchIndex, totalBatches) {
  console.log(
    `Processing batch ${batchIndex + 1}/${totalBatches} (${segments.length} segments)...`,
  );

  const promises = segments.map(async (segment) => {
    const startMs = Math.round(segment.startSec * 1000);
    const endMs = Math.round(segment.endSec * 1000);

    const totalSeconds = Math.floor(segment.startSec);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const timestamp = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

    const cleanedText = await cleanupJapaneseText(segment.text);

    return {
      speaker: mapSpeakerLabel(segment.speakerId),
      text: cleanedText,
      timestamp: timestamp,
      start: startMs,
      end: endMs,
    };
  });

  return Promise.all(promises);
}

/**
 * Format transcription data with parallel processing
 */
async function formatTranscription(transcriptionData) {
  const words = transcriptionData.words || [];
  const rawSegments = groupWordsIntoSegments(words);
  const segments = [];

  const batchSize = 5;
  const totalBatches = Math.ceil(rawSegments.length / batchSize);

  console.log(
    `Processing ${rawSegments.length} segments in ${totalBatches} batches of ${batchSize} concurrent requests...`,
  );

  for (let i = 0; i < rawSegments.length; i += batchSize) {
    const batch = rawSegments.slice(i, i + batchSize);
    const batchIndex = Math.floor(i / batchSize);

    const batchResults = await processBatch(batch, batchIndex, totalBatches);
    segments.push(...batchResults);
  }

  return {
    segments: segments,
    language: "ja",
  };
}

/**
 * Save transcription to file
 */
function saveTranscription(episodeGuid, transcriptionData) {
  const transcriptionsDir = path.join(
    __dirname,
    "../src/content/transcription",
  );

  if (!fs.existsSync(transcriptionsDir)) {
    fs.mkdirSync(transcriptionsDir, { recursive: true });
  }

  const filePath = path.join(transcriptionsDir, `${episodeGuid}.json`);
  fs.writeFileSync(filePath, JSON.stringify(transcriptionData, null, 2));

  console.log(`Transcription saved to: ${filePath}`);
}

/**
 * Main function
 */
(async () => {
  try {
    console.log(`Starting transcription for episode ${episodeNumber}`);

    const episode = findEpisodeByNumber(episodeNumber);
    if (!episode) {
      console.error(`Error: Episode ${episodeNumber} not found`);
      process.exit(1);
    }

    console.log(`Found episode: ${episode.title}`);
    console.log(`Audio URL: ${episode.url}`);

    const transcriptionData = await transcribeAudio(episode.url);

    const formattedData = await formatTranscription(transcriptionData);
    saveTranscription(episode.guid, formattedData);

    console.log("✓ Transcription completed successfully!");
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
})();
