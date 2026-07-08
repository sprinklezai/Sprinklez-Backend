const { google } = require("googleapis");

const SALES_FOLDER_ID = process.env.GOOGLE_DRIVE_SALES_FOLDER_ID;

function getDriveClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);

  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });

  return google.drive({ version: "v3", auth });
}

async function findSalesZipFile(month = "2026_06") {
  const drive = getDriveClient();

  const fileName = `${month}_sales.zip`;

  const response = await drive.files.list({
    q: `'${SALES_FOLDER_ID}' in parents and name='${fileName}' and trashed=false`,
    fields: "files(id, name, size, modifiedTime)",
  });

  const file = response.data.files?.[0];

  if (!file) {
    throw new Error(`Sales ZIP not found in Google Drive: ${fileName}`);
  }

  return file;
}

async function downloadSalesZipFromDrive(month = "2026_06") {
  const drive = getDriveClient();
  const file = await findSalesZipFile(month);

  const response = await drive.files.get(
    {
      fileId: file.id,
      alt: "media",
    },
    {
      responseType: "arraybuffer",
    }
  );

  return Buffer.from(response.data);
}

module.exports = {
  downloadSalesZipFromDrive,
};