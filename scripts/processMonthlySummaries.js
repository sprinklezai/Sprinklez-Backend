const { spawnSync } = require("child_process");
const path = require("path");

const months = process.argv.slice(2);

if (months.length === 0) {
  console.error("Usage: node scripts/processMonthlySummaries.js 2026_01 2026_02");
  process.exit(1);
}

const builder = path.join(__dirname, "buildSalesSummary.js");

for (const month of months) {
  if (!/^\d{4}_\d{2}$/.test(month)) {
    console.error(`Invalid month: ${month}. Expected YYYY_MM.`);
    process.exit(1);
  }

  console.log(`\nProcessing monthly summary ${month}...`);

  const result = spawnSync(process.execPath, [builder, month], {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log("\nAll requested monthly summaries completed.");
