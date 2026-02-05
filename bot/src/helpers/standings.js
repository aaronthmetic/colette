import { parse } from 'csv-parse';
import { getCsvFromSheets } from './googleSheets.js';

const required = ['rank', 'seed', 'participant', 'score', 'buchholz', 'pointsdifference', 'gamesplayed'];

export async function getStandingsFromCsv(sheetId, gid) {
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
        return (reject(new Error(`missing required columns: ${missingColumns.join()}`)))
      }

      const standings = rows.map(row => {
        return row.reduce((obj, value, i) => {
          obj[headers[i].split(' ').join('').toLowerCase()] = value;
          return obj;
        }, {});
      });

      resolve(standings);
    });
  })
}

// CHANGE THESE PER YEAR
export const sheetId = '1JQePUvzoWLdC3u_CRSMEJ9bCll5qPkez0ysqL8U7YWE';
export const lowerGid = 1717999594;
export const upperGid = 1458993309;