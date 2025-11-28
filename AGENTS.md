# Strava Activity Exporter

Chrome extension that extracts Strava activity data to JSON.

## Extracted data

- Title, duration, calories, average pace, average heart rate
- Splits per km (pace + elevation)

## Architecture

- `popup.js`: all extraction logic via `chrome.scripting.executeScript()`
- Main data is extracted from page `<script>` tags (regex on `moving_time`, `calories`, `avg_speed`, `avg_hr`)
- Splits are extracted from DOM (`#splits-container tbody#contents`) with polling since they load dynamically

## Important notes

- Splits load after the rest of the page → polling every second until available
- JSON key order is forced manually in `updateDisplay()` because `JSON.stringify` may reorder
- No `content.js`: everything goes through `executeScript` from the popup
