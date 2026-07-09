const { google } = require("googleapis");

const SALES_FOLDER_ID = process.env.GOOGLE_DRIVE_SALES_FOLDER_ID;

function getPrivateKey() {
  const key = process.env.GOOGLE_PRIVATE_KEY;

  if (!key) {
    throw new Error("GOOGLE_PRIVATE_KEY is missing");
  }

  return key.replace(/\\n/g, "\n");
}

function getDriveClient() {

  console.log("CLIENT EMAIL:", process.env.GOOGLE_CLIENT_EMAIL);
  console.log("FOLDER ID:", process.env.GOOGLE_DRIVE_SALES_FOLDER_ID);
  console.log("PRIVATE KEY EXISTS:", !!process.env.GOOGLE_PRIVATE_KEY);

  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;

  if (!clientEmail) {
    throw new Error("GOOGLE_CLIENT_EMAIL is missing");
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: getPrivateKey(),
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