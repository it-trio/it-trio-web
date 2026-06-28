import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export function suggestNextEpisodeNumber(): number | undefined {
  const dir = path.resolve(moduleDir, "../../../src/content/episode");
  if (!fs.existsSync(dir)) {
    return undefined;
  }

  const numbers = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => {
      try {
        const raw = fs.readFileSync(path.join(dir, file), "utf8");
        const parsed = JSON.parse(raw) as { number?: unknown };
        return parsed.number;
      } catch {
        return undefined;
      }
    })
    .filter(
      (value): value is number =>
        typeof value === "number" && Number.isFinite(value),
    );

  if (numbers.length === 0) {
    return undefined;
  }

  return Math.max(...numbers) + 1;
}
