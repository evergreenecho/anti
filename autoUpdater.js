const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const AdmZip = require('adm-zip');
const os = require('os');
const process = require('process');

const repoOwner = 'evergreenecho';
const repoName = 'anti';
const currentVersion = require('./package.json').version;

const tempDir = path.join(os.tmpdir(), 'proxy-updater');
const zipPath = path.join(tempDir, 'update.zip');
const extractPath = path.join(tempDir, 'extracted');

// Ensure the temporary directory exists
fs.ensureDirSync(tempDir);

async function checkForUpdates() {
    try {
        // Fetch the latest package.json from the repository
        const { data: remotePackageJson } = await axios.get(`https://raw.githubusercontent.com/${repoOwner}/${repoName}/main/package.json`);
        const latestVersion = remotePackageJson.version;

        if (latestVersion === currentVersion) {
            console.log('No updates available.');
            return;
        }

        console.log(`New version available: ${latestVersion}`);
        await downloadUpdate();
        await extractUpdate();
        await replaceFiles();
        console.log('Update completed successfully. Please restart the server.');
    } catch (error) {
        console.error('Error checking for updates:', error.message);
    }
}

async function downloadUpdate() {
    try {
        console.log('Downloading update...');
        // Use the repository ZIPball URL for downloading
        const zipballUrl = `https://github.com/${repoOwner}/${repoName}/archive/refs/heads/main.zip`;
        const response = await axios.get(zipballUrl, { responseType: 'arraybuffer' });
        fs.writeFileSync(zipPath, response.data);
        console.log('Download complete.');
    } catch (error) {
        console.error('Error downloading update:', error.message);
        throw error;
    }
}

async function extractUpdate() {
    try {
        console.log('Extracting update...');
        const zip = new AdmZip(zipPath);
        zip.extractAllTo(extractPath, true);
        console.log('Extraction complete.');
    } catch (error) {
        console.error('Error extracting update:', error.message);
        throw error;
    }
}

async function replaceFiles() {
    try {
        console.log('Replacing files...');
        const files = fs.readdirSync(extractPath);

        files.forEach(file => {
            const srcPath = path.join(extractPath, file);
            const destPath = path.join(process.cwd(), file);

            if (fs.existsSync(destPath)) {
                fs.removeSync(destPath);
            }

            fs.moveSync(srcPath, destPath);
        });

        console.log('Files replaced successfully.');
    } catch (error) {
        console.error('Error replacing files:', error.message);
        throw error;
    }
}

module.exports = { checkForUpdates };
