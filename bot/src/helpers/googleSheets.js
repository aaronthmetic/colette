export async function getCsvFromSheets(sheetId, gid) {
  if (!sheetId || !gid) {
    throw new Error('no sheetId or gid');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'content-type': 'text/csv;charset=UTF-8',
      },
    });

    if (!response.ok) {
      throw new Error(`http error: ${response.status}`);
    }

    const csvData = await response.text();

    if (!csvData.trim()) {
      throw new Error('empty csv');
    }

    if (csvData.startsWith('<')) {
      throw new Error('not a csv');
    }

    return csvData;
  } catch (error) {
    console.error('failed fetch:', error);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}