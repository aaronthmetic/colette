import { parse } from 'csv-parse';
import { getCsvFromSheets } from './googleSheets.js';

export async function getAbbreviationsFromCsv(sheetId, gid) {
  let csvData;

  try {
    csvData = await getCsvFromSheets(sheetId, gid);
  } catch (err) {
    throw new Error(`failed to fetch: ${err.message}`);
  }

  return new Promise((resolve, reject) => {
      parse(csvData, {}, (err, parsedData) => {
        if (err) {
          return reject(new Error(`csv parse error: ${err.message}`));
        }

        if (!Array.isArray(parsedData) || parsedData.length === 0) {
          return resolve([]);
        }

        const abbreviations = parsedData.reduce((arr, row) => {
          arr.push({name: row[0], abbr: row[1]});
          return arr;
        }, [])

        resolve(abbreviations);
      });
    })
}

export async function getAbbreviationFromTeam(name, sheetId, gid) {
    const abbreviations = await getAbbreviationsFromCsv(sheetId, gid);
    return abbreviations.filter(team => team.name === name).length ? abbreviations.filter(team => team.name === name)[0].abbr : name
}

// CHANGE THESE PER YEAR
export const sheetId = '1JQePUvzoWLdC3u_CRSMEJ9bCll5qPkez0ysqL8U7YWE';
export const abbrGid = 1034242781