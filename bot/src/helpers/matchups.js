import { parse } from 'csv-parse';
import { getCsvFromSheets } from './googleSheets.js';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.resolve('../data/matchups');
const ML_PATH = path.join(DATA_DIR, 'matchupsL.json');
const MU_PATH = path.join(DATA_DIR, 'matchupsU.json');
const CACHE_DURATION = 300000;

// CHANGE THESE PER YEAR
export const sheetId = '1JQePUvzoWLdC3u_CRSMEJ9bCll5qPkez0ysqL8U7YWE';
export const lowerGid = 182125662;
export const upperGid = 463805956;

export async function getMatchupsFromCsv(sheetId, gid) {
  const CACHE_PATH = gid === lowerGid ? ML_PATH : MU_PATH;

  try {
    const stats = await fs.stat(CACHE_PATH);
    const age = Date.now() - stats.mtimeMs;

    if (age < CACHE_DURATION) {
      const cached = await fs.readFile(CACHE_PATH, "utf-8");
      return JSON.parse(cached);
    }
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.error("Matchups cache read error:", err);
    }
  }

  // change these depending on where information is (zero-indexed)
  const seed1 = 0;
  const seed2 = 8;
  const team1 = 1;
  const team2 = 7;
  const wl1 = 2;
  const wl2 = 6;
  const score1 = 3;
  const score2 = 5;

  let csvData;

  try {
    csvData = await getCsvFromSheets(sheetId, gid);
  } catch (err) {
    throw new Error(`failed to fetch: ${err.message}`);
  }

  const parsedData = await new Promise((resolve, reject) => {
    parse(csvData, { trim: true, skip_empty_lines: true }, (err, data) => {
      if (err) {
        return reject(new Error(`csv parse error: ${err.message}`));
      }

      resolve(data);
    });
  });

  if (!Array.isArray(parsedData) || parsedData.length === 0) {
    return {};
  }

  const matchups = parsedData.reduce((obj, row) => {
    if (typeof row[0] === 'string' && row[0].startsWith('ROUND')) {
      obj.round = row[0].split(' ').at(-1);
      obj[obj.round] = []
    }
    else if (typeof row[0] === 'string' && row[0].startsWith('Seed')) {
      obj[obj.round]?.push({
        t1: {
          seed: row[seed1].split(' ').at(-1),
          team: row[team1],
          wl: row[wl1],
          score: row[score1]
        },
        t2: {
          seed: row[seed2].split(' ').at(-1),
          team: row[team2],
          wl: row[wl2],
          score: row[score2]
        },
        played: row[wl1] !== '' && row[wl2] !== ''
      });
    }
    return obj;
  }, {round: 0})

  matchups.round = Math.max(...Object.keys(matchups).filter(key => (Array.isArray(matchups[key]) && matchups[key].length !== 0)).map(Number))

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(CACHE_PATH, JSON.stringify(matchups, null, 2));

  return matchups;
}