const fs = require("fs");
const path = require("path");

const SALES_PATH =
    process.env.SALES_DATA_PATH ||
    "/home/u757775108/domains/sprinkleztrading.com/public_html/sales-data/monthly";

async function loadSalesZip(month = "2026_06") {

    const zipFile = path.join(
        SALES_PATH,
        `${month}_sales.zip`
    );

    if (!fs.existsSync(zipFile)) {
        throw new Error(`Sales ZIP not found: ${zipFile}`);
    }

    return fs.readFileSync(zipFile);
}

module.exports = {
    loadSalesZip
};