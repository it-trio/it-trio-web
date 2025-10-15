const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");

// API keys should be set as environment variables
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!ASSEMBLYAI_API_KEY) {
  console.error("Error: ASSEMBLYAI_API_KEY environment variable is not set");
  process.exit(1);
}

if (!OPENAI_API_KEY) {
  console.error("Error: OPENAI_API_KEY environment variable is not set");
  process.exit(1);
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// Get episode number from command line arguments
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
 * Upload audio file to AssemblyAI
 */
async function uploadAudio(audioUrl) {
  console.log("Downloading audio from:", audioUrl);

  // First, download the audio file
  const audioResponse = await fetch(audioUrl);
  if (!audioResponse.ok) {
    throw new Error(`Failed to download audio: ${audioResponse.statusText}`);
  }

  const audioData = await audioResponse.arrayBuffer();

  // Upload to AssemblyAI
  console.log("Uploading audio to AssemblyAI...");
  const uploadResponse = await fetch("https://api.assemblyai.com/v2/upload", {
    method: "POST",
    headers: {
      authorization: ASSEMBLYAI_API_KEY,
    },
    body: audioData,
  });

  if (!uploadResponse.ok) {
    throw new Error(`Failed to upload audio: ${uploadResponse.statusText}`);
  }

  const { upload_url } = await uploadResponse.json();
  console.log("Audio uploaded successfully");
  return upload_url;
}

/**
 * Submit transcription request to AssemblyAI
 */
async function submitTranscription(audioUrl) {
  console.log("Submitting transcription request...");

  const response = await fetch("https://api.assemblyai.com/v2/transcript", {
    method: "POST",
    headers: {
      authorization: ASSEMBLYAI_API_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      audio_url: audioUrl,
      speaker_labels: true, // Enable speaker diarization
      language_code: "ja", // Japanese language
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to submit transcription: ${response.statusText}`);
  }

  const data = await response.json();
  return data.id;
}

/**
 * Wait for transcription to complete
 */
async function waitForTranscription(transcriptId) {
  console.log("Waiting for transcription to complete...");

  const maxAttempts = 20;
  const pollingInterval = 30000; // 30 seconds

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(
      `Checking transcription status (attempt ${attempt}/${maxAttempts})...`
    );

    const response = await fetch(
      `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
      {
        headers: {
          authorization: ASSEMBLYAI_API_KEY,
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `Failed to get transcription status: ${response.statusText}`
      );
    }

    const data = await response.json();

    if (data.status === "completed") {
      console.log("Transcription completed!");
      return data;
    } else if (data.status === "error") {
      throw new Error(`Transcription failed: ${data.error}`);
    }

    // If not the last attempt, wait before trying again
    if (attempt < maxAttempts) {
      console.log(
        `Status: ${data.status}, waiting ${pollingInterval / 1000} seconds...`
      );
      await new Promise((resolve) => setTimeout(resolve, pollingInterval));
    }
  }

  // If we've exhausted all attempts without completion
  throw new Error(
    `Transcription did not complete after ${maxAttempts} attempts. Please check the transcription status manually using the transcript ID: ${transcriptId}`
  );
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
    return text; // Return original text if cleanup fails
  }
}

/**
 * Format transcription data
 */
async function formatTranscription(transcriptionData) {
  const utterances = transcriptionData.utterances || [];

  const segments = [];

  for (let i = 0; i < utterances.length; i++) {
    const utterance = utterances[i];

    // Convert milliseconds to timestamp format (HH:MM:SS)
    const totalSeconds = Math.floor(utterance.start / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const timestamp = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

    // Clean up the text using OpenAI
    console.log(`Cleaning up segment ${i + 1}/${utterances.length}...`);
    const cleanedText = await cleanupJapaneseText(utterance.text);

    segments.push({
      speaker: utterance.speaker,
      text: cleanedText,
      timestamp: timestamp,
      start: utterance.start,
      end: utterance.end,
    });
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
    "../src/content/transcription"
  );

  // Create directory if it doesn't exist
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

    // Find the episode
    const episode = findEpisodeByNumber(episodeNumber);
    if (!episode) {
      console.error(`Error: Episode ${episodeNumber} not found`);
      process.exit(1);
    }

    console.log(`Found episode: ${episode.title}`);
    console.log(`Audio URL: ${episode.url}`);

    // Upload audio
    const uploadUrl = await uploadAudio(episode.url);

    // Submit transcription request
    const transcriptId = await submitTranscription(uploadUrl);
    console.log(`Transcription ID: ${transcriptId}`);

    // Wait for transcription to complete
    const transcriptionData = await waitForTranscription(transcriptId);

    // Format and save transcription
    const formattedData = await formatTranscription(transcriptionData);
    saveTranscription(episode.guid, formattedData);

    console.log("✓ Transcription completed successfully!");
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
})();
