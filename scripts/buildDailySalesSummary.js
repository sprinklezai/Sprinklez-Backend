const fs = require("fs");
const path = require("path");
const unzipper = require("unzipper");
const { parse } = require("csv-parse");
const { spawnSync } = require("child_process");

require("dotenv").config({
  path: path.resolve(__dirname, "..", ".env"),
});

const sourceKey = process.argv[2];
const explicitZipPath = process.argv[3];

if (!/^\d{4}_\d{2}_\d{2}$/.test(String(sourceKey || ""))) {
  console.error(
    "Usage: node scripts/buildDailySalesSummary.js YYYY_MM_DD [optional-zip-path]"
  );
  console.error(
    "Example: node scripts/buildDailySalesSummary.js 2026_07_11"
  );
  process.exit(1);
}

const ROOT = path.resolve(__dirname, "..");

const SALES_ZIP = explicitZipPath
  ? path.resolve(explicitZipPath)
  : path.join(
      ROOT,
      "data",
      "sales",
      "daily-zips",
      `${sourceKey}_sales.zip`
    );

const WORKER = path.join(
  __dirname,
  "buildDailySalesSummaryWorker.js"
);

function parseDate(value) {
  if (!value) return "";

  const text = String(value).trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }

  const dmy = text.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/
  );

  if (dmy) {
    return `${dmy[3]}-${String(dmy[2]).padStart(
      2,
      "0"
    )}-${String(dmy[1]).padStart(2, "0")}`;
  }

  const parsed = new Date(text);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return `${parsed.getFullYear()}-${String(
    parsed.getMonth() + 1
  ).padStart(2, "0")}-${String(
    parsed.getDate()
  ).padStart(2, "0")}`;
}

function getField(row, ...fieldNames) {
  const entries = Object.entries(row);

  for (const fieldName of fieldNames) {
    const wanted = String(fieldName)
      .trim()
      .toLowerCase();

    const match = entries.find(
      ([key]) =>
        String(key).trim().toLowerCase() === wanted
    );

    if (match) {
      return match[1];
    }
  }

  return "";
}

function toFileKey(date) {
  return date.replace(/-/g, "_");
}

async function detectBusinessDates() {
  if (!fs.existsSync(SALES_ZIP)) {
    throw new Error(`Sales ZIP not found: ${SALES_ZIP}`);
  }

  const dates = new Set();
  let csvFiles = 0;
  let rows = 0;
  let invalidDates = 0;

  const zipStream = fs
    .createReadStream(SALES_ZIP)
    .pipe(
      unzipper.Parse({
        forceStream: true,
      })
    );

  for await (const entry of zipStream) {
    const fileName = String(entry.path || "");

    if (!fileName.toLowerCase().endsWith(".csv")) {
      entry.autodrain();
      continue;
    }

    csvFiles += 1;
    console.log(`Scanning CSV ${csvFiles}: ${fileName}`);

    const parser = entry.pipe(
      parse({
        columns: true,
        skip_empty_lines: true,
        bom: true,
        relax_quotes: true,
        relax_column_count: true,
        trim: true,
      })
    );

    for await (const row of parser) {
      rows += 1;

      const date = parseDate(
        getField(
          row,
          "Date",
          "Trans_ Date",
          "Trans. Date",
          "Transaction Date"
        )
      );

      if (!date) {
        invalidDates += 1;
        continue;
      }

      dates.add(date);
    }
  }

  return {
    dates: Array.from(dates).sort(),
    csvFiles,
    rows,
    invalidDates,
  };
}

async function main() {
  console.log("");
  console.log("==============================================");
  console.log("BUILD DAILY SALES SUMMARY — VERSION 2");
  console.log("==============================================");
  console.log(`Source ZIP: ${SALES_ZIP}`);
  console.log("");

  const detection = await detectBusinessDates();

  if (detection.dates.length === 0) {
    throw new Error(
      "No valid business dates were detected in the ZIP."
    );
  }

  console.log("");
  console.log(
    `Business dates detected (${detection.dates.length}):`
  );

  for (const date of detection.dates) {
    console.log(`- ${date}`);
  }

  console.log("");
  console.log(
    "Generating one sales-summary JSON per business date..."
  );

  const generated = [];
  const failed = [];

  for (const date of detection.dates) {
    const dateKey = toFileKey(date);

    console.log("");
    console.log("----------------------------------------------");
    console.log(`Building ${date}`);
    console.log("----------------------------------------------");

    const result = spawnSync(
      process.execPath,
      [
        WORKER,
        dateKey,
        SALES_ZIP,
      ],
      {
        cwd: ROOT,
        stdio: "inherit",
        env: process.env,
      }
    );

    if (result.status === 0) {
      generated.push(date);
    } else {
      failed.push({
        date,
        exitCode: result.status,
      });
    }
  }

  console.log("");
  console.log("==============================================");
  console.log("VERSION 2 BUILD SUMMARY");
  console.log("==============================================");
  console.log(
    `CSV files scanned: ${detection.csvFiles.toLocaleString()}`
  );
  console.log(
    `Rows scanned: ${detection.rows.toLocaleString()}`
  );
  console.log(
    `Rows with invalid dates: ${detection.invalidDates.toLocaleString()}`
  );
  console.log(
    `Business dates detected: ${detection.dates.length.toLocaleString()}`
  );
  console.log(
    `Daily files generated: ${generated.length.toLocaleString()}`
  );

  if (failed.length > 0) {
    console.log(
      `Daily files failed: ${failed.length.toLocaleString()}`
    );
    console.table(failed);
    process.exitCode = 1;
  } else {
    console.log("All daily files were generated successfully.");
  }

  console.log("==============================================");
}

main().catch((error) => {
  console.error("");
  console.error(
    "Failed to build daily sales summaries:"
  );
  console.error(error);
  process.exit(1);
});
