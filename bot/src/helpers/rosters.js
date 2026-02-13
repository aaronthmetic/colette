import { parse } from 'csv-parse';
import { getCsvFromSheets } from './googleSheets.js';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.resolve('../data/rosters');
const ROSTERS_PATH = path.join(DATA_DIR, 'rosters.json');

const CACHE_DURATION = 300000;

// CHANGE THESE PER YEAR
export const sheetId = '1JQePUvzoWLdC3u_CRSMEJ9bCll5qPkez0ysqL8U7YWE';
export const rosterGid = 111307365;

export async function getRostersFromCsv(sheetId, gid) {
  try {
    const stats = await fs.stat(ROSTERS_PATH);
    const age = Date.now() - stats.mtimeMs;

    if (age < CACHE_DURATION) {
      const cached = await fs.readFile(ROSTERS_PATH, "utf-8");
      return JSON.parse(cached);
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error("Roster cache read error:", err);
    }
  }

  // change these depending on where information is (zero-indexed)
  const seed = 0;
  const team = 1;
  const p1 = 3;
  const p2 = 5;
  const p3 = 7;
  const p4 = 9;
  const p5 = 11;
  const s1 = 13;
  const s2 = 15;
  const s3 = 17;
  const s4 = 19;
  const s5 = 21;

  let csvData;

  try {
    csvData = await getCsvFromSheets(sheetId, gid);
  } catch (err) {
    throw new Error(`failed to fetch: ${err.message}`);
  }

  const parsedData = await new Promise((resolve, reject) => {
    parse(csvData, { trim: true, skip_empty_lines: true, from_line: 2 }, (err, data) => {
      if (err) {
        return reject(new Error(`csv parse error: ${err.message}`));
      }
      resolve(data);
    });
  });
      
  if (!Array.isArray(parsedData) || parsedData.length === 0) {
    return [];
  }

  const rosters = parsedData.reduce((arr, row) => {
    arr.push(
      {
        seed: row[seed],
        team: row[team],
        players: [row[p1], row[p2], row[p3], row[p4], row[p5]].filter(Boolean),
        subs: [row[s1], row[s2], row[s3], row[s4], row[s5]].filter(Boolean)
      }
    )
    return arr;
  }, [])

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(ROSTERS_PATH, JSON.stringify(rosters, null, 2));

  return rosters;
}