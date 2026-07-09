const xlsx = require("xlsx");
const path = require("path");
const fs = require("fs");

const mastersDir = path.join(__dirname, "../../data/masters");

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

  return xlsx.utils.sheet_to_json(sheet);
}

function getData(type) {
  const fileName = fileMap[type];

  if (!fileName) {
    throw new Error(`Invalid data type: ${type}`);
  }

  return readExcel(fileName);
}

module.exports = {
  readExcel,
  getData,
};