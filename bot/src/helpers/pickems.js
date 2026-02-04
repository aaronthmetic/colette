import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.resolve('../data/pickems');
const PICKEMS_PATH = path.join(DATA_DIR, 'strings.json');
const LEADERBOARD_PATH = path.join(DATA_DIR, 'leaderboard.json');

export async function readStrings() {
    try {
        const data = await fs.readFile(PICKEMS_PATH, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return {};
    }
}

export async function writeStrings(data) {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(PICKEMS_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

export async function writeLeaderboard(data) {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(LEADERBOARD_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

export async function readLeaderboard() {
    try {
        const data = await fs.readFile(LEADERBOARD_PATH, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return {};
    }
}

function chunkString(str, size) {
    const chunks = [];
    for (let i = 0; i < str.length; i += size) {
        chunks.push(str.slice(i, i + size));
    }
    return chunks;
}

export function convert(str, uid='') {
    // this should be adjusted for future years
    const teams = teams2026;

    const teamGuesses = String(parseInt(str.slice(0,6),16)).split('').map(char => teams[Number(char)-1] ?? 'blank');
    const scoreGuesses = chunkString(str.slice(6), 2).map(score => parseInt(score, 16));

    const roundValues = [10,20,40];

    const pickems = teamGuesses.reduce((acc, team, i) => {
        const key = String.fromCharCode(97 + i);

        acc[key] = {
            team,
            teamAScore: scoreGuesses[i * 2],
            teamBScore: scoreGuesses[i * 2 + 1],
            teamsCorrect: true ? i < 4 : false,
            pointValue: i < 4 ? roundValues[0] : i < 6 ? roundValues[1] : roundValues[2]
        };

        return acc;
    }, {});

    return { pickems, uid };
}

export function checkPickems(pickems, correct) {
    let score = 0;
    let pointDiff = 0;
    const correctMatches = []
    // this should be adjusted for future years
    const playedArray = playedArray2026;

    for (const match of playedArray) {
        const pickedTeam = pickems[match].team;
        const correctTeam = correct[match].team;

        if (pickedTeam === correctTeam) {
        score += pickems[match].pointValue;
        correctMatches.push(match);
        }
    }

    if (correctMatches.includes('a') && correctMatches.includes('b')) {
        pickems.e.teamsCorrect = true;
    }

    if (correctMatches.includes('c') && correctMatches.includes('d')) {
        pickems.f.teamsCorrect = true;
    }

    if (correctMatches.includes('e') && correctMatches.includes('f')) {
        pickems.g.teamsCorrect = true;
    }

    for (const match of playedArray) {
        const pickedAScore = pickems[match].teamAScore;
        const pickedBScore = pickems[match].teamBScore;
        const correctAScore = correct[match].teamAScore;
        const correctBScore = correct[match].teamBScore;

        if (pickems[match].teamsCorrect) {
        pointDiff += Math.abs(pickedAScore - correctAScore) + Math.abs(pickedBScore - correctBScore)
        }
    } 

    return { score, pointDiff, pickems };
}

export async function generateLeaderboard() {
    const correctPickems = correctPickems2026;

    const strings = await readStrings();

    const leaderboard = [];

    for (const [uid, str] of Object.entries(strings)) {
        try {
            const inputPickems = convert(str, uid);
            const result = checkPickems(inputPickems.pickems, correctPickems.pickems);

            leaderboard.push({
                uid,
                score: result.score,
                pointDiff: result.pointDiff,
                pickems: result.pickems
            });
        } catch (err) {
            console.error(`Failed to process pickems for uid ${uid}`, err);
        }
    }

    leaderboard.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.pointDiff - b.pointDiff;
    });

    await writeLeaderboard(leaderboard);

    return leaderboard;
}

// THIS IS WHERE YOU SET THE INPUTS

const teams2026 = [
    'ucla a',
    'ucla b',
    'ucla c',
    'ucla d',
    'ucla e',
    'ucla f',
    'ucla g',
    'ucla h'
];

const playedArray2026 = [];

const correctPickems2026 = convert('173db1230d0c201d0d1613230517112300');