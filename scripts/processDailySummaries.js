const { spawnSync } = require("child_process");
const path = require("path");

const dates = process.argv.slice(2);

if (dates.length === 0) {
  console.error("Usage: node scripts/processDailySummaries.js 2026_07_11 2026_07_12");
  process.exit(1);
}

const builder = path.join(__dirname, "buildDailySalesSummary.js");

for (const date of dates) {
  if (!/^\d{4}_\d{2}_\d{2}$/.test(date)) {
    console.error(`Invalid date: ${date}. Expected YYYY_MM_DD.`);
    process.exit(1);
  }

  console.log(`\nProcessing daily summary ${date}...`);

  const result = spawnSync(process.execPath, [builder, date], {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log("\nAll requested daily summaries completed.");
