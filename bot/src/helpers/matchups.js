import { parse } from 'csv-parse';
import { getCsvFromSheets } from './googleSheets.js';

export async function getMatchupsFromCsv(sheetId, gid) {

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

  return new Promise((resolve, reject) => {
      parse(csvData, {}, (err, parsedData) => {
        if (err) {
          return reject(new Error(`csv parse error: ${err.message}`));
        }

        if (!Array.isArray(parsedData) || parsedData.length === 0) {
          return resolve([]);
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

        matchups.round = Math.max(...Object.keys(matchups).filter(key => (Array.isArray(matchups[key]) && matchups[key].length !== 0)))

        resolve(matchups);
      });
    })
}

// CHANGE THESE PER YEAR
export const sheetId = '1JQePUvzoWLdC3u_CRSMEJ9bCll5qPkez0ysqL8U7YWE';
export const lowerGid = 182125662;
export const upperGid = 463805956;