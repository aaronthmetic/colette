import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.resolve('../data/matches');
const MATCHES_PATH = path.join(DATA_DIR, 'matches.json');

export async function saveMatches(openMatches) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(MATCHES_PATH, JSON.stringify(openMatches, null, 2), 'utf-8');
}

export async function loadMatches(openMatches) {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
  const data = await fs.readFile(MATCHES_PATH, "utf8");
  const parsed = JSON.parse(data);
  }
  catch (err) {
    if (err.code === "ENOENT") {
      await fs.writeFile(MATCHES_PATH, "[]", "utf8");
    }
    else {
      console.error("Failed to load matches:", err);
    }
  }
}