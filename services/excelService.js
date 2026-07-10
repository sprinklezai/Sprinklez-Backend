const xlsx = require("xlsx");
const path = require("path");
const fs = require("fs");

const mastersDir =
  process.env.MASTERS_DATA_PATH ||
  path.join(__dirname, "..", "data", "masters");

console.log("MASTERS_DATA_PATH env:", process.env.MASTERS_DATA_PATH);
console.log("Resolved mastersDir:", mastersDir);
console.log("excelService file:", __filename);

const fileMap = {
  brands: "Brand_Master.xlsx",
  companies: "Company_Master.xlsx",
  countries: "Country_Master.xlsx",
  stores: "Store_Master.xlsx",
  employee: "Employee_Master.xlsx",
  employees: "Employee_Master.xlsx",
  users: "User_Master.xlsx",
};

function readExcel(fileName) {
  const filePath = path.join(mastersDir, fileName);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Excel file not found: ${filePath}`);
  }

  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  return xlsx.utils.sheet_to_json(sheet, {
    defval: "",
  });
}

function getData(type) {
  const normalizedType = String(type || "").trim().toLowerCase();
  const fileName = fileMap[normalizedType];

  if (!fileName) {
    throw new Error(`Invalid data type: ${type}`);
  }

  return readExcel(fileName);
}

module.exports = {
  readExcel,
  getData,
};