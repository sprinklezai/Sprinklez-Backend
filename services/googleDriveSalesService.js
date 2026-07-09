const { google } = require("googleapis");

function getConfig() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  const folderId = process.env.GOOGLE_DRIVE_SALES_FOLDER_ID;

  if (!clientEmail) throw new Error("GOOGLE_CLIENT_EMAIL is missing");
  if (!rawKey) throw new Error("GOOGLE_PRIVATE_KEY is missing");
  if (!folderId) throw new Error("GOOGLE_DRIVE_SALES_FOLDER_ID is missing");

  const privateKey = rawKey
    .replace(/^"(.*)"$/, "$1")
    .replace(/\\n/g, "\n")
    .trim();

  if (!privateKey.includes("BEGIN PRIVATE KEY")) {
    throw new Error("GOOGLE_PRIVATE_KEY is malformed");
  }

  return { clientEmail, privateKey, folderId };
}

async function getDriveClient() {
  const { clientEmail, privateKey } = getConfig();

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });

  await auth.authorize();

  return google.drive({ version: "v3", auth });
}

async function findSalesZipFile(month = "2026_06") {
  const { folderId } = getConfig();
  const drive = await getDriveClient();

  const fileName = `${month}_sales.zip`;

  const response = await drive.files.list({
    q: `'${folderId}' in parents and name='${fileName}' and trashed=false`,
    fields: "files(id, name, size, modifiedTime)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const file = response.data.files?.[0];

  if (!file) {
    throw new Error(`Sales ZIP not found in Google Drive: ${fileName}`);
  }

  return file;
}

async function downloadSalesZipFromDrive(month = "2026_06") {
  const drive = await getDriveClient();
  const file = await findSalesZipFile(month);

  const response = await drive.files.get(
    {
      fileId: file.id,
      alt: "media",
      supportsAllDrives: true,
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