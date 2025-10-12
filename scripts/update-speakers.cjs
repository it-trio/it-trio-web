#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

/**
 * Script to update speaker names in transcription JSON files
 *
 * Usage: node update-speakers.cjs "おぐらくん ちーず なべちゃん" file1.json file2.json
 *
 * This will replace:
 * - Speaker A → おぐらくん
 * - Speaker B → ちーず
 * - Speaker C → なべちゃん
 */

function updateSpeakerNames(filePath, speakerMapping) {
  try {
    console.log(`Processing: ${filePath}`);

    // Read JSON file
    const content = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(content);

    if (!data.segments || !Array.isArray(data.segments)) {
      console.log(`  ⚠️ No segments found in ${filePath}`);
      return false;
    }

    let updated = false;

    // Update speaker names in segments
    data.segments = data.segments.map((segment) => {
      if (segment.speaker && speakerMapping[segment.speaker]) {
        console.log(
          `  Updating ${segment.speaker} → ${speakerMapping[segment.speaker]}`,
        );
        segment.speaker = speakerMapping[segment.speaker];
        updated = true;
      }
      return segment;
    });

    if (updated) {
      // Write back to file with proper formatting
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
      console.log(`  ✅ Updated ${filePath}`);
      return true;
    } else {
      console.log(`  ℹ️ No speakers to update in ${filePath}`);
      return false;
    }
  } catch (error) {
    console.error(`  ❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error(
      'Usage: node update-speakers.cjs "name1 name2 name3" file1.json file2.json ...',
    );
    process.exit(1);
  }

  // First argument is the space-separated speaker names
  const speakerNamesString = args[0];
  const speakerNames = speakerNamesString.trim().split(/\s+/);

  // Create mapping from Speaker A, B, C... to actual names
  const speakerMapping = {};
  speakerNames.forEach((name, index) => {
    const letter = String.fromCharCode(65 + index); // A, B, C, D...
    speakerMapping[letter] = name;
    speakerMapping[`Speaker ${letter}`] = name;
  });

  console.log("Speaker mapping:");
  Object.entries(speakerMapping).forEach(([key, value]) => {
    console.log(`  ${key} → ${value}`);
  });
  console.log();

  // Remaining arguments are file paths
  const files = args.slice(1);

  if (files.length === 0) {
    console.log("No files to process");
    return;
  }

  let totalUpdated = 0;

  files.forEach((file) => {
    if (updateSpeakerNames(file, speakerMapping)) {
      totalUpdated++;
    }
  });

  console.log();
  console.log(`✅ Updated ${totalUpdated} out of ${files.length} files`);
}

main();
