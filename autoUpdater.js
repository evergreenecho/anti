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

fs.ensureDirSync(tempDir);

async function checkForUpdates() {
    try {
        const { data: fileData } = await axios.get(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/package.json`);
        const remotePackageJson = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf8'));
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
        
        const extractedDirs = fs.readdirSync(extractPath).filter(file => fs.statSync(path.join(extractPath, file)).isDirectory());
        if (extractedDirs.length !== 1) {
            throw new Error('Expected exactly one top-level directory in the extracted ZIP archive.');
        }
        
        const topLevelDir = extractedDirs[0];
        const sourceDir = path.join(extractPath, topLevelDir);

        fs.copySync(sourceDir, process.cwd(), {
            filter: (src) => !src.includes(`${path.sep}.git`),
        });

        console.log('Files replaced successfully.');
    } catch (error) {
        console.error('Error replacing files:', error.message);
        throw error;
    }
}

module.exports = { checkForUpdates };
