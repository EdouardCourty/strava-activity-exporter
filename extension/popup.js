document.addEventListener('DOMContentLoaded', async () => {
  const resultEl = document.getElementById('result');
  const errorEl = document.getElementById('error');
  const loadingEl = document.getElementById('loading');
  const splitsLoadingEl = document.getElementById('splits-loading');
  const copyBtn = document.getElementById('copy');

  let currentData = null;
  let splitsInterval = null;

  function updateDisplay() {
    // Force key order
    const ordered = {
      title: currentData.title,
      duration: currentData.duration,
      duration_seconds: currentData.duration_seconds,
      calories: currentData.calories,
      pace: currentData.pace,
      pace_seconds_per_km: currentData.pace_seconds_per_km,
      average_heart_rate: currentData.average_heart_rate,
      splits: currentData.splits
    };
    resultEl.textContent = JSON.stringify(ordered, null, 2);
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url || !tab.url.includes('strava.com/activities/')) {
      throw new Error('Please open a Strava activity page');
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractStravaData
    });

    currentData = results[0].result;

    if (currentData.error) {
      throw new Error(currentData.error);
    }

    loadingEl.style.display = 'none';
    resultEl.style.display = 'block';
    updateDisplay();
    copyBtn.style.display = 'block';

    // If no splits, show message and poll
    if (!currentData.splits || currentData.splits.length === 0) {
      splitsLoadingEl.style.display = 'block';
      
      splitsInterval = setInterval(async () => {
        try {
          const splitsResults = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: extractSplitsOnly
          });
          
          const splits = splitsResults[0].result;
          
          if (splits && splits.length > 0) {
            currentData.splits = splits;
            updateDisplay();
            splitsLoadingEl.style.display = 'none';
            clearInterval(splitsInterval);
          }
        } catch (e) {
          // Ignore polling errors
        }
      }, 1000);
    }

    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(JSON.stringify(currentData, null, 2));
      copyBtn.textContent = '✓ Copied!';
      setTimeout(() => copyBtn.textContent = '📋 Copy JSON', 2000);
    });

  } catch (err) {
    loadingEl.style.display = 'none';
    errorEl.style.display = 'block';
    errorEl.textContent = err.message;
  }
});

function extractStravaData() {
  try {
    const data = {
      title: null,
      duration: null,
      duration_seconds: null,
      calories: null,
      pace: null,
      pace_seconds_per_km: null,
      average_heart_rate: null,
      splits: []
    };

    // Extract title
    const titleEl = document.querySelector('h1.activity-name, .activity-name');
    if (titleEl) {
      data.title = titleEl.textContent.trim();
    }

    // Search for data in page scripts
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      const content = script.textContent;

      // Search for moving_time
      const movingTimeMatch = content.match(/moving_time:\s*(\d+)/);
      if (movingTimeMatch) {
        const seconds = parseInt(movingTimeMatch[1]);
        data.duration_seconds = seconds;
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        if (hours > 0) {
          data.duration = `${hours}h ${mins}min ${secs}s`;
        } else {
          data.duration = `${mins}min ${secs}s`;
        }
      }

      // Search for calories
      const caloriesMatch = content.match(/calories:\s*([\d.]+)/);
      if (caloriesMatch) {
        data.calories = parseFloat(caloriesMatch[1]);
      }

      // Search for avg_speed (m/s for running)
      const avgSpeedMatch = content.match(/avg_speed:\s*([\d.]+)/);
      if (avgSpeedMatch) {
        const speedMs = parseFloat(avgSpeedMatch[1]);
        if (speedMs > 0) {
          const paceSecondsPerKm = 1000 / speedMs;
          data.pace_seconds_per_km = Math.round(paceSecondsPerKm);
          const paceMins = Math.floor(paceSecondsPerKm / 60);
          const paceSecs = Math.round(paceSecondsPerKm % 60);
          data.pace = `${paceMins}:${paceSecs.toString().padStart(2, '0')} /km`;
        }
      }

      // Search for avg_hr (average heart rate)
      const avgHrMatch = content.match(/avg_hr:\s*([\d.]+)/);
      if (avgHrMatch) {
        data.average_heart_rate = Math.round(parseFloat(avgHrMatch[1]));
      }
    }

    // Extract splits per km from table
    const splitsTable = document.querySelector('#splits-container tbody#contents, .mile-splits tbody');
    if (splitsTable) {
      const rows = splitsTable.querySelectorAll('tr');
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 2) {
          const km = cells[0].textContent.trim().replace(',', '.');
          const paceText = cells[1].textContent.trim();
          const paceMatch = paceText.match(/([\d:]+)/);
          const elevText = cells[2] ? cells[2].textContent.trim() : null;
          const elevMatch = elevText ? elevText.match(/(-?\d+)/) : null;
          
          if (paceMatch) {
            data.splits.push({
              km: parseFloat(km) || km,
              pace: paceMatch[1] + '/km',
              elevation: elevMatch ? parseInt(elevMatch[1]) : null
            });
          }
        }
      });
    }

    // Fallback: search in DOM if scripts don't contain data
    if (!data.duration) {
      const timeEl = document.querySelector('[data-glossary-term="moving_time"] .stat-text, .moving-time .stat-text');
      if (timeEl) {
        data.duration = timeEl.textContent.trim();
      }
    }

    return data;

  } catch (err) {
    return { error: 'Extraction error: ' + err.message };
  }
}

function extractSplitsOnly() {
  const splits = [];
  const splitsTable = document.querySelector('#splits-container tbody#contents, .mile-splits tbody');
  if (splitsTable) {
    const rows = splitsTable.querySelectorAll('tr');
    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 2) {
        const km = cells[0].textContent.trim().replace(',', '.');
        const paceText = cells[1].textContent.trim();
        const paceMatch = paceText.match(/([\d:]+)/);
        const elevText = cells[2] ? cells[2].textContent.trim() : null;
        const elevMatch = elevText ? elevText.match(/(-?\d+)/) : null;
        
        if (paceMatch) {
          splits.push({
            km: parseFloat(km) || km,
            pace: paceMatch[1] + '/km',
            elevation: elevMatch ? parseInt(elevMatch[1]) : null
          });
        }
      }
    });
  }
  return splits;
}
