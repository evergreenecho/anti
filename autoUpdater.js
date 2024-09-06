const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const AdmZip = require('adm-zip');
const os = require('os');
const process = require('process');

const repoOwner = 'evergreenecho';
const repoName = 'DankProxy';
const currentVersion = require('./package.json').version;

const tempDir = path.join(os.tmpdir(), 'proxy-updater');
const zipPath = path.join(tempDir, 'update.zip');
const extractPath = path.join(tempDir, 'extracted');

fs.ensureDirSync(tempDir);

async function checkForUpdates() {
    try {
        const { data } = await axios.get(`https://api.github.com/repos/${repoOwner}/${repoName}/releases/latest`);
        const latestVersion = data.tag_name;

        if (latestVersion === currentVersion) {
            console.log('No updates available.');
            return;
        }

        console.log(`New version available: ${latestVersion}`);
        await downloadUpdate(data.zipball_url);
        await extractUpdate();
        await replaceFiles();
        console.log('Update completed successfully. Please restart the server.');
    } catch (error) {
        console.error('Error checking for updates:', error.message);
    }
}

async function downloadUpdate(url) {
    try {
        console.log('Downloading update...');
        const response = await axios.get(url, { responseType: 'arraybuffer' });
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
