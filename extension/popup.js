document.addEventListener('DOMContentLoaded', async () => {
  const resultEl = document.getElementById('result');
  const errorEl = document.getElementById('error');
  const loadingEl = document.getElementById('loading');
  const splitsLoadingEl = document.getElementById('splits-loading');
  const copyBtn = document.getElementById('copy');

  let currentData = null;
  let splitsInterval = null;

  function updateDisplay() {
    // Forcer l'ordre des clés
    const ordered = {
      titre: currentData.titre,
      duree: currentData.duree,
      duree_secondes: currentData.duree_secondes,
      calories: currentData.calories,
      allure: currentData.allure,
      allure_secondes_par_km: currentData.allure_secondes_par_km,
      cardio_moyen: currentData.cardio_moyen,
      splits: currentData.splits
    };
    resultEl.textContent = JSON.stringify(ordered, null, 2);
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url || !tab.url.includes('strava.com/activities/')) {
      throw new Error('Veuillez ouvrir une page d\'activité Strava');
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

    // Si pas de splits, afficher le message et polling
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
          // Ignorer les erreurs de polling
        }
      }, 1000);
    }

    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(JSON.stringify(currentData, null, 2));
      copyBtn.textContent = '✓ Copié !';
      setTimeout(() => copyBtn.textContent = '📋 Copier le JSON', 2000);
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
      titre: null,
      duree: null,
      duree_secondes: null,
      calories: null,
      allure: null,
      allure_secondes_par_km: null,
      cardio_moyen: null,
      splits: []
    };

    // Extraire le titre
    const titleEl = document.querySelector('h1.activity-name, .activity-name');
    if (titleEl) {
      data.titre = titleEl.textContent.trim();
    }

    // Chercher les données dans les scripts de la page
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      const content = script.textContent;

      // Chercher moving_time
      const movingTimeMatch = content.match(/moving_time:\s*(\d+)/);
      if (movingTimeMatch) {
        const seconds = parseInt(movingTimeMatch[1]);
        data.duree_secondes = seconds;
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        if (hours > 0) {
          data.duree = `${hours}h ${mins}min ${secs}s`;
        } else {
          data.duree = `${mins}min ${secs}s`;
        }
      }

      // Chercher calories
      const caloriesMatch = content.match(/calories:\s*([\d.]+)/);
      if (caloriesMatch) {
        data.calories = parseFloat(caloriesMatch[1]);
      }

      // Chercher avg_speed (m/s pour la course)
      const avgSpeedMatch = content.match(/avg_speed:\s*([\d.]+)/);
      if (avgSpeedMatch) {
        const speedMs = parseFloat(avgSpeedMatch[1]);
        if (speedMs > 0) {
          const paceSecondsPerKm = 1000 / speedMs;
          data.allure_secondes_par_km = Math.round(paceSecondsPerKm);
          const paceMins = Math.floor(paceSecondsPerKm / 60);
          const paceSecs = Math.round(paceSecondsPerKm % 60);
          data.allure = `${paceMins}:${paceSecs.toString().padStart(2, '0')} /km`;
        }
      }

      // Chercher avg_hr (fréquence cardiaque moyenne)
      const avgHrMatch = content.match(/avg_hr:\s*([\d.]+)/);
      if (avgHrMatch) {
        data.cardio_moyen = Math.round(parseFloat(avgHrMatch[1]));
      }
    }

    // Extraire les splits par km depuis le tableau
    const splitsTable = document.querySelector('#splits-container tbody#contents, .mile-splits tbody');
    if (splitsTable) {
      const rows = splitsTable.querySelectorAll('tr');
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 2) {
          const km = cells[0].textContent.trim().replace(',', '.');
          const allureText = cells[1].textContent.trim();
          const allureMatch = allureText.match(/([\d:]+)/);
          const elevText = cells[2] ? cells[2].textContent.trim() : null;
          const elevMatch = elevText ? elevText.match(/(-?\d+)/) : null;
          
          if (allureMatch) {
            data.splits.push({
              km: parseFloat(km) || km,
              allure: allureMatch[1] + '/km',
              denivele: elevMatch ? parseInt(elevMatch[1]) : null
            });
          }
        }
      });
    }

    // Fallback: chercher dans le DOM si les scripts ne contiennent pas les données
    if (!data.duree) {
      const timeEl = document.querySelector('[data-glossary-term="moving_time"] .stat-text, .moving-time .stat-text');
      if (timeEl) {
        data.duree = timeEl.textContent.trim();
      }
    }

    return data;

  } catch (err) {
    return { error: 'Erreur lors de l\'extraction: ' + err.message };
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
        const allureText = cells[1].textContent.trim();
        const allureMatch = allureText.match(/([\d:]+)/);
        const elevText = cells[2] ? cells[2].textContent.trim() : null;
        const elevMatch = elevText ? elevText.match(/(-?\d+)/) : null;
        
        if (allureMatch) {
          splits.push({
            km: parseFloat(km) || km,
            allure: allureMatch[1] + '/km',
            denivele: elevMatch ? parseInt(elevMatch[1]) : null
          });
        }
      }
    });
  }
  return splits;
}
