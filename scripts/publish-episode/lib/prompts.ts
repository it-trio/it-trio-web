import fs from "node:fs";
import path from "node:path";
import {
  confirm,
  editor,
  input,
  select,
} from "@inquirer/prompts";
import configJson from "../config.json" with { type: "json" };
import { Art19Client } from "./art19-client";
import { suggestNextEpisodeNumber } from "./episode-number";
const SUPPORTED_EXTENSIONS = new Set([".mp3", ".m4a", ".wav"]);
const DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;

export interface PublisherConfig {
  seriesId: string;
  descriptionFooter: string;
  descriptionIsHtml: boolean;
  defaultTimezone: string;
  r2KeyPrefix: string;
}

export interface EpisodeInput {
  audioPath: string;
  title: string;
  description: string;
  publishAtLocal: string;
  timezone: string;
  publishAtIso: string;
  seasonId?: string;
  seasonLabel?: string;
  episodeNumber?: number;
  itunesType: "full" | "bonus" | "trailer";
}

interface SeasonChoice {
  id?: string;
  label: string;
}

function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

function parseLocalDateTime(value: string): Date | undefined {
  if (!DATETIME_PATTERN.test(value)) {
    return undefined;
  }

  const [datePart, timePart] = value.split(" ");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute)
  ) {
    return undefined;
  }

  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function zonedDateTimeToUtc(localDateTime: string, timezone: string): Date {
  const localDate = parseLocalDateTime(localDateTime);
  if (!localDate) {
    throw new Error(`Invalid datetime format: ${localDateTime}`);
  }

  const year = localDate.getFullYear();
  const month = localDate.getMonth() + 1;
  const day = localDate.getDate();
  const hour = localDate.getHours();
  const minute = localDate.getMinutes();
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const readPart = (parts: Intl.DateTimeFormatPart[], type: string): number =>
    Number(parts.find((part) => part.type === type)?.value);

  for (let offsetMinutes = -14 * 60; offsetMinutes <= 14 * 60; offsetMinutes++) {
    const candidate = new Date(utcGuess - offsetMinutes * 60_000);
    const parts = formatter.formatToParts(candidate);

    if (
      readPart(parts, "year") === year &&
      readPart(parts, "month") === month &&
      readPart(parts, "day") === day &&
      readPart(parts, "hour") === hour &&
      readPart(parts, "minute") === minute
    ) {
      return candidate;
    }
  }

  throw new Error(
    `Could not convert ${localDateTime} in ${timezone} to UTC.`,
  );
}

export function localDateTimeToIso(
  localDateTime: string,
  timezone: string,
): string {
  return zonedDateTimeToUtc(localDateTime, timezone).toISOString();
}

export function loadConfig(): PublisherConfig {
  const config = configJson as PublisherConfig;

  if (!config.seriesId || config.seriesId.includes("REPLACE_WITH")) {
    throw new Error(
      "config.json is missing a valid seriesId. Replace REPLACE_WITH_ART19_SERIES_UUID with your ART19 series UUID.",
    );
  }

  if (!config.descriptionFooter?.trim()) {
    throw new Error("config.json is missing descriptionFooter.");
  }

  if (!config.defaultTimezone?.trim()) {
    throw new Error("config.json is missing defaultTimezone.");
  }

  if (!config.r2KeyPrefix?.trim()) {
    throw new Error("config.json is missing r2KeyPrefix.");
  }

  return config;
}

function createArt19Client(): Art19Client {
  const token = process.env.ART19_TOKEN;
  const credential = process.env.ART19_CREDENTIAL;

  if (!token || !credential) {
    throw new Error(
      "Missing ART19 credentials. Copy .env.example to .env and set ART19_TOKEN and ART19_CREDENTIAL.",
    );
  }

  return new Art19Client({ token, credential });
}

async function promptDescription(): Promise<string> {
  try {
    return await editor({
      message: "Episode description (HTML allowed; editor opens):",
      waitForUserInput: false,
    });
  } catch {
    const lines: string[] = [];
    console.log(
      "Editor unavailable. Enter description lines, then submit an empty line to finish.",
    );

    while (true) {
      const line = await input({
        message:
          lines.length === 0
            ? "Episode description:"
            : "Next line (empty to finish):",
      });

      if (line.trim().length === 0 && lines.length > 0) {
        break;
      }

      if (line.trim().length > 0) {
        lines.push(line);
      }
    }

    return lines.join("\n");
  }
}

export async function promptForEpisodeInput(
  config: PublisherConfig,
): Promise<EpisodeInput> {
  const art19 = createArt19Client();

  const audioPath = await input({
    message: "Path to local audio file:",
    validate: (value) => {
      const resolved = path.resolve(value.trim());
      if (!fs.existsSync(resolved)) {
        return `File not found: ${resolved}`;
      }

      const extension = path.extname(resolved).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.has(extension)) {
        return "Unsupported extension. Use .mp3, .m4a, or .wav.";
      }

      return true;
    },
  });

  const title = await input({
    message: "Episode title:",
    validate: (value) =>
      value.trim().length > 0 ? true : "Title is required.",
  });

  const description = await promptDescription();

  const publishAtLocal = await input({
    message: "Publish at (local time, YYYY-MM-DD HH:mm):",
    validate: (value) => {
      if (!DATETIME_PATTERN.test(value.trim())) {
        return "Use format YYYY-MM-DD HH:mm.";
      }

      const parsed = parseLocalDateTime(value.trim());
      if (!parsed) {
        return "Invalid date or time.";
      }

      if (parsed.getTime() <= Date.now()) {
        return "Publish time must be in the future.";
      }

      return true;
    },
  });

  const timezone = await input({
    message: "Timezone:",
    default: config.defaultTimezone,
    validate: (value) =>
      isValidTimezone(value.trim())
        ? true
        : "Enter a valid IANA timezone (e.g. Asia/Tokyo).",
  });

  const seasons = await art19.getSeasons({ seriesId: config.seriesId });
  const seasonChoices: SeasonChoice[] = [
    { label: "None" },
    ...seasons.map((season) => ({
      id: season.id,
      label:
        season.title.trim().length > 0
          ? `Season ${season.seasonNumber}: ${season.title}`
          : `Season ${season.seasonNumber}`,
    })),
  ];

  const selectedSeasonLabel = await select({
    message: "Season:",
    choices: seasonChoices.map((choice) => ({
      name: choice.label,
      value: choice.label,
    })),
  });

  const selectedSeason = seasonChoices.find(
    (choice) => choice.label === selectedSeasonLabel,
  );

  const suggestedEpisodeNumber = suggestNextEpisodeNumber();
  const episodeNumberInput = await input({
    message:
      suggestedEpisodeNumber === undefined
        ? "Episode number (optional, for your reference only):"
        : `Episode number (suggested: ${suggestedEpisodeNumber}, optional):`,
    default:
      suggestedEpisodeNumber === undefined
        ? ""
        : String(suggestedEpisodeNumber),
  });

  let episodeNumber: number | undefined;
  if (episodeNumberInput.trim().length > 0) {
    const parsed = Number.parseInt(episodeNumberInput.trim(), 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new Error("Episode number must be a positive integer.");
    }
    episodeNumber = parsed;
  }

  const itunesType = await select({
    message: "iTunes episode type:",
    choices: [
      { name: "full", value: "full" as const },
      { name: "bonus", value: "bonus" as const },
      { name: "trailer", value: "trailer" as const },
    ],
    default: "full",
  });

  const publishAtIso = localDateTimeToIso(
    publishAtLocal.trim(),
    timezone.trim(),
  );

  return {
    audioPath: path.resolve(audioPath.trim()),
    title: title.trim(),
    description: description.trim(),
    publishAtLocal: publishAtLocal.trim(),
    timezone: timezone.trim(),
    publishAtIso,
    seasonId: selectedSeason?.id,
    seasonLabel: selectedSeason?.label,
    episodeNumber,
    itunesType,
  };
}

function formatBytes(size: number): string {
  const mb = size / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

export function renderSummary(
  inputValue: EpisodeInput,
  config: PublisherConfig,
  r2Preview?: { key: string; size: number },
): string {
  const composedDescription = `${inputValue.description}\n\n${config.descriptionFooter}`;
  const lines = [
    "",
    "--- Summary ---",
    `  Audio:    ${inputValue.audioPath}${
      r2Preview
        ? ` (${formatBytes(r2Preview.size)} -> R2 key ${r2Preview.key})`
        : ""
    }`,
    `  Title:    ${inputValue.title}`,
    `  Publish:  ${inputValue.publishAtLocal} ${inputValue.timezone} (${inputValue.publishAtIso})`,
    `  Season:   ${inputValue.seasonLabel ?? "None"}`,
    `  Episode#: ${
      inputValue.episodeNumber ?? "(not set)"
    }  (will NOT be written via API — set in dashboard after)`,
    `  Type:     ${inputValue.itunesType}`,
    "  Description preview:",
    ...composedDescription
      .split("\n")
      .slice(0, 8)
      .map((line) => `    ${line}`),
  ];

  if (composedDescription.split("\n").length > 8) {
    lines.push("    ...");
  }

  return lines.join("\n");
}

export async function confirmProceed(summary: string): Promise<boolean> {
  console.log(summary);
  return confirm({
    message: "Proceed with publish?",
    default: false,
  });
}
