const fs = require("fs");
const path = require("path");

// OpenAI API key should be set as environment variable
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error("Error: OPENAI_API_KEY environment variable is not set");
  process.exit(1);
}

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
 * Download audio file
 */
async function downloadAudio(audioUrl) {
  console.log("Downloading audio from:", audioUrl);

  const audioResponse = await fetch(audioUrl);
  if (!audioResponse.ok) {
    throw new Error(`Failed to download audio: ${audioResponse.statusText}`);
  }

  const audioData = await audioResponse.arrayBuffer();
  console.log("Audio downloaded successfully");
  return Buffer.from(audioData);
}

/**
 * Submit transcription request to OpenAI Whisper API
 */
async function transcribeWithWhisper(audioBuffer) {
  console.log("Submitting transcription request to OpenAI Whisper...");

  // Create form data
  const FormData = require("form-data");
  const form = new FormData();

  // Add audio file as a blob
  form.append("file", audioBuffer, {
    filename: "audio.mp3",
    contentType: "audio/mpeg",
  });
  form.append("model", "whisper-1");
  form.append("language", "ja"); // Japanese language
  form.append("response_format", "verbose_json"); // Get detailed response with timestamps
  form.append("timestamp_granularities[]", "segment"); // Get segment-level timestamps

  const response = await fetch(
    "https://api.openai.com/v1/audio/transcriptions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        ...form.getHeaders(),
      },
      body: form,
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to transcribe audio: ${response.statusText} - ${errorText}`,
    );
  }

  const data = await response.json();
  console.log("Transcription completed!");
  return data;
}

/**
 * Perform speaker diarization using a simple heuristic approach
 * This is a basic implementation that can be improved
 */
function performSpeakerDiarization(segments) {
  // Simple heuristic: assign speakers based on pause duration
  // This is a basic approach and may need refinement
  const diarizedSegments = [];
  let currentSpeaker = "A";
  const speakers = ["A", "B", "C"];
  let speakerIndex = 0;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const prevSegment = i > 0 ? segments[i - 1] : null;

    // If there's a long pause (>2 seconds), likely a speaker change
    if (prevSegment && segment.start - prevSegment.end > 2.0) {
      speakerIndex = (speakerIndex + 1) % speakers.length;
      currentSpeaker = speakers[speakerIndex];
    }

    diarizedSegments.push({
      speaker: currentSpeaker,
      text: segment.text.trim(),
      start: Math.floor(segment.start * 1000), // Convert to milliseconds
      end: Math.floor(segment.end * 1000),
    });
  }

  return diarizedSegments;
}

/**
 * Format transcription data
 */
function formatTranscription(transcriptionData) {
  const segments = transcriptionData.segments || [];

  // Perform basic speaker diarization
  const diarizedSegments = performSpeakerDiarization(segments);

  // Format segments with timestamps
  const formattedSegments = diarizedSegments.map((segment) => {
    // Convert milliseconds to timestamp format (HH:MM:SS)
    const totalSeconds = Math.floor(segment.start / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const timestamp = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

    return {
      speaker: segment.speaker,
      text: segment.text,
      timestamp: timestamp,
      start: segment.start,
      end: segment.end,
    };
  });

  return {
    segments: formattedSegments,
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

    // Download audio
    const audioBuffer = await downloadAudio(episode.url);

    // Transcribe with OpenAI Whisper
    const transcriptionData = await transcribeWithWhisper(audioBuffer);

    // Format and save transcription
    const formattedData = formatTranscription(transcriptionData);
    saveTranscription(episode.guid, formattedData);

    console.log("✓ Transcription completed successfully!");
    console.log("\nNote: Speaker diarization uses a basic heuristic approach.");
    console.log(
      "You may need to manually review and adjust speaker labels if needed.",
    );
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
})();
