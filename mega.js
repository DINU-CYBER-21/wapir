

// megaClient.js
import fs from 'fs';
import { Storage, File } from 'megajs';

// Credentials - real ones keep in env variables for security
const auth = {
  email: process.env.MEGA_EMAIL || 'dinuwa280@gmail.com',
  password: process.env.MEGA_PASSWORD || 'Dinuwa-#@1H',
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.246',
};

/**
 * Upload a file stream to Mega and return the shareable URL
 * @param {ReadableStream} dataStream - stream of file data
 * @param {string} filename - name to save on Mega
 * @returns {Promise<string>} - resolves to URL string
 */
export function upload(dataStream, filename) {
  return new Promise((resolve, reject) => {
    try {
      const storage = new Storage(auth);

      storage.once('ready', () => {
        const uploadStream = storage.upload({
          name: filename,
          allowUploadBuffering: true,
        });

        dataStream.pipe(uploadStream);

        uploadStream.once('complete', () => {
          uploadStream.link((err, url) => {
            if (err) {
              reject(err);
            } else {
              storage.close();
              resolve(url);
            }
          });
        });

        uploadStream.once('error', (err) => {
          reject(err);
        });
      });

      storage.once('error', (err) => {
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Download a file from Mega URL and return a Buffer of its content
 * @param {string} url - Mega file URL
 * @returns {Promise<Buffer>} - resolves to file buffer
 */
export function download(url) {
  return new Promise((resolve, reject) => {
    try {
      const file = File.fromURL(url);

      file.loadAttributes((err) => {
        if (err) return reject(err);

        file.downloadBuffer((err, buffer) => {
          if (err) reject(err);
          else resolve(buffer);
        });
      });
    } catch (err) {
      reject(err);
    }
  });
}

// Example usage:

if (process.argv[2] === 'upload') {
  // node megaClient.js upload ./localfile.txt
  const filePath = process.argv[3];
  if (!filePath) {
    console.error('Please provide a file path to upload.');
    process.exit(1);
  }
  const stream = fs.createReadStream(filePath);
  const filename = filePath.split('/').pop();

  upload(stream, filename)
    .then((url) => {
      console.log('File uploaded successfully:');
      console.log(url);
    })
    .catch((err) => {
      console.error('Upload failed:', err);
    });
} else if (process.argv[2] === 'download') {
  // node megaClient.js download 'https://mega.nz/#!xxxxxx'
  const url = process.argv[3];
  if (!url) {
    console.error('Please provide a Mega URL to download.');
    process.exit(1);
  }

  download(url)
    .then((buffer) => {
      const outFile = 'downloaded_file';
      fs.writeFileSync(outFile, buffer);
      console.log(`File downloaded and saved as "${outFile}"`);
    })
    .catch((err) => {
      console.error('Download failed:', err);
    });
} else {
  console.log(`
Usage:
  node megaClient.js upload <filePath>
  node megaClient.js download <megaURL>
`);
}
