const BASE_URL = 'https://ch.tetr.io/api';

export async function getUserData(username) {
  try {
    const response = await fetch(`${BASE_URL}/users/${username}/summaries/league`, {
      headers: {
        'X-Session-ID': 'colette'
      }
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      return null;
    }

    return {rank: data.data.rank, glicko: data.data.glicko, tr: data.data.glicko};
  }
  catch (error) {
    console.error('Error fetching user replays:', error);
    throw error;
  }
}