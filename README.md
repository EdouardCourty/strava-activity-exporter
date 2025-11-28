# 🏃 Strava Activity Exporter

Chrome extension to export your Strava activities to JSON.

## Features

Automatically extracts from any Strava activity page:

- **Title** of the activity
- **Duration** of the effort
- **Calories** burned
- **Average pace**
- **Average heart rate**
- **Splits per kilometer** with pace and elevation

## Installation

### From Chrome Web Store
*(Coming soon)*

### Manually
1. Download this repository
2. Open `chrome://extensions/`
3. Enable **Developer mode**
4. Click **Load unpacked**
5. Select the `extension/` folder

## Usage

1. Open an activity on Strava (`strava.com/activities/...`)
2. Click on the extension icon
3. JSON appears automatically
4. Click **Copy JSON**

## Output example

```json
{
  "titre": "Morning run 🌅",
  "duree": "44min 7s",
  "duree_secondes": 2647,
  "calories": 500,
  "allure": "6:03 /km",
  "allure_secondes_par_km": 363,
  "cardio_moyen": 152,
  "splits": [
    { "km": 1, "allure": "5:26/km", "denivele": 3 },
    { "km": 2, "allure": "6:40/km", "denivele": 6 },
    { "km": 3, "allure": "5:39/km", "denivele": 5 }
  ]
}
```

## License

[MIT](LICENSE)

## For AI agents

See [AGENTS.md](AGENTS.md) for technical documentation aimed at code agents and developers.

---

© 2025 Edouard Courty
