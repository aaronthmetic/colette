import { parse } from 'csv-parse';
import { getCsvFromSheets } from './googleSheets.js';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.resolve('../data/standings');
const SL_PATH = path.join(DATA_DIR, 'standingsL.json');
const SU_PATH = path.join(DATA_DIR, 'standingsU.json');
const CACHE_DURATION = 300000;

// CHANGE THESE PER YEAR
export const sheetId = '1JQePUvzoWLdC3u_CRSMEJ9bCll5qPkez0ysqL8U7YWE';
export const lowerGid = 1717999594;
export const upperGid = 1458993309;

const required = ['rank', 'seed', 'participant', 'score', 'buchholz', 'pointsdifference', 'gamesplayed'];

export async function getStandingsFromCsv(sheetId, gid) {
  const CACHE_PATH = gid === lowerGid ? SL_PATH : SU_PATH;

  try {
    const stats = await fs.stat(CACHE_PATH);
    const age = Date.now() - stats.mtimeMs;

    if (age < CACHE_DURATION) {
      const cached = await fs.readFile(CACHE_PATH, "utf-8");
      return JSON.parse(cached);
    }
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.error("Standings cache read error:", err);
    }
  }

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
  })

  if (!Array.isArray(parsedData) || parsedData.length === 0) {
    return [];
  }

  const [headers, ...rows] = parsedData;

  const normalizedHeaders = headers.map(h =>
    String(h || '')
      .trim()
      .split(' ')
      .join('')
      .toLowerCase()
  );

  const missingColumns = required.filter(col => !normalizedHeaders.includes(col));
  if (missingColumns.length > 0) {
    throw new Error(`missing required columns: ${missingColumns.join()}`);
  }

  const standings = rows.map(row => {
    return row.reduce((obj, value, i) => {
      obj[headers[i].split(' ').join('').toLowerCase()] = value;
      return obj;
    }, {});
  });

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(CACHE_PATH, JSON.stringify(standings, null, 2));

  return standings;
}