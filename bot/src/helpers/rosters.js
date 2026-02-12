import { parse } from 'csv-parse';
import { getCsvFromSheets } from './googleSheets.js';

export async function getRostersFromCsv(sheetId, gid) {

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

  return new Promise((resolve, reject) => {
      parse(csvData, { trim: true, skip_empty_lines: true }, (err, parsedData) => {
        if (err) {
          return reject(new Error(`csv parse error: ${err.message}`));
        }

        if (!Array.isArray(parsedData) || parsedData.length === 0) {
          return resolve([]);
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

        resolve(rosters);
      });
    })
}

// CHANGE THESE PER YEAR
export const sheetId = '1JQePUvzoWLdC3u_CRSMEJ9bCll5qPkez0ysqL8U7YWE';
export const rosterGid = 111307365;

const rosters = await getRostersFromCsv(sheetId,rosterGid);
console.log(rosters);