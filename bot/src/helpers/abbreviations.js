import { parse } from 'csv-parse';
import { getCsvFromSheets } from './googleSheets.js';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.resolve('../data/abbreviations');
const ABBR_PATH = path.join(DATA_DIR, 'abbreviations.json');

const CACHE_DURATION = 300000;

// CHANGE THESE PER YEAR
export const sheetId = '1JQePUvzoWLdC3u_CRSMEJ9bCll5qPkez0ysqL8U7YWE';
export const abbrGid = 1034242781

export async function getAbbreviationsFromCsv(sheetId, gid) {
  try {
    const stats = await fs.stat(ABBR_PATH);
    const age = Date.now() - stats.mtimeMs;

    if (age < CACHE_DURATION) {
      const cached = await fs.readFile(ABBR_PATH, 'utf-8');
      return JSON.parse(cached);
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error("Abbreviation cache read error:", err);
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
  });

  if (!Array.isArray(parsedData) || parsedData.length === 0) {
    return [];
  }

  const abbreviations = parsedData.reduce((arr, row) => {
    arr.push({name: row[0], abbr: row[1]});
    return arr;
  }, [])

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(ABBR_PATH, JSON.stringify(abbreviations, null, 2));

  return abbreviations;
}

export async function getAbbreviationFromTeam(name, sheetId, gid) {
    const abbreviations = await getAbbreviationsFromCsv(sheetId, gid);
    return abbreviations.filter(team => team.name === name).length ? abbreviations.filter(team => team.name === name)[0].abbr : name
}