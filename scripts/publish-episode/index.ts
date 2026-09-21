import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import {
  Art19Client,
  EpisodeVersionProcessingError,
} from "./lib/art19-client";
import { uploadToR2 } from "./lib/r2-upload";
import {
  confirmProceed,
  loadConfig,
  promptForEpisodeInput,
  renderSummary,
} from "./lib/prompts";

const REQUIRED_ENV_VARS = [
  "ART19_TOKEN",
  "ART19_CREDENTIAL",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_PUBLIC_BASE",
] as const;

function validateEnvironment(): void {
  const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}\nCopy .env.example to .env and fill in the values.`,
    );
  }
}

function formatBytes(size: number): string {
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

async function main(): Promise<void> {
  validateEnvironment();
  const config = loadConfig();
  const input = await promptForEpisodeInput(config);

  const audioSize = fs.statSync(input.audioPath).size;
  const r2Preview = {
    key: `${config.r2KeyPrefix.replace(/\/?$/, "/")}<uuid>${path.extname(input.audioPath)}`,
    size: audioSize,
  };

  const summary = renderSummary(input, config, r2Preview);
  const proceed = await confirmProceed(summary);
  if (!proceed) {
    console.log("Aborted.");
    return;
  }

  let uploadedKey: string | undefined;

  try {
    console.log("\nUploading audio to R2...");
    const upload = await uploadToR2(input.audioPath, config.r2KeyPrefix);
    uploadedKey = upload.key;
    console.log(
      `Uploaded ${formatBytes(upload.size)} to ${upload.key}\nPublic URL: ${upload.publicUrl}`,
    );

    const art19 = new Art19Client({
      token: process.env.ART19_TOKEN!,
      credential: process.env.ART19_CREDENTIAL!,
    });

    const composedDescription = `${input.description}\n\n${config.descriptionFooter}`;

    console.log("Creating scheduled episode on ART19...");
    const episode = await art19.createEpisode({
      seriesId: config.seriesId,
      seasonId: input.seasonId,
      title: input.title,
      description: composedDescription,
      descriptionIsHtml: config.descriptionIsHtml,
      publishAtIso: input.publishAtIso,
      itunesType: input.itunesType,
    });
    console.log(`Episode created: ${episode.id}`);

    console.log("Creating episode version...");
    const version = await art19.createEpisodeVersion({
      episodeId: episode.id,
      sourceUrl: upload.publicUrl,
    });
    console.log(`Episode version created: ${version.id}`);

    console.log("Waiting for ART19 to ingest audio...");
    await art19.pollEpisodeVersion(version.id);
    console.log("Audio ingestion complete.");

    console.log("\n--- Published ---");
    console.log(`Episode ID:    ${episode.id}`);
    console.log(
      `Enclosure URL: https://rss.art19.com/episodes/${episode.id}.mp3`,
    );
    console.log(`Scheduled for: ${input.publishAtLocal} ${input.timezone}`);
    console.log(`R2 object key: ${upload.key}`);

    if (input.episodeNumber !== undefined) {
      console.log(
        `\nReminder: set iTunes season/episode number in the ART19 dashboard (episode #${input.episodeNumber}).`,
      );
    } else {
      console.log(
        "\nReminder: set iTunes season/episode number in the ART19 dashboard.",
      );
    }
  } catch (error) {
    console.error("\nPublish failed.");

    if (uploadedKey) {
      console.error(
        `R2 object was uploaded at key "${uploadedKey}" before the failure. Manual cleanup or retry may be needed.`,
      );
    }

    if (error instanceof EpisodeVersionProcessingError) {
      console.error(error.message);
      process.exit(1);
    }

    if (error instanceof Error) {
      console.error(error.message);
      process.exit(1);
    }

    console.error(String(error));
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
