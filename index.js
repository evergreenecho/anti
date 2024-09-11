const autoUpdater = require('./autoUpdater');
const fs = require('fs');
const path = require('path');
const mc = require('minecraft-protocol');
const states = mc.states;
const CommandHandler = require('./commandHandler');
const chalk = require('chalk');

autoUpdater.checkForUpdates();

const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

function validateConfig(config) {
    const requiredFields = ['host', 'version', 'username', 'auth'];

    for (const field of requiredFields) {
        const value = config[field];
        if (typeof value !== 'string' || value.trim() === '') {
            return `[CONFIG] '${field}' is required and cannot be empty.`;
        }
    }

    if (typeof config.port !== 'number' || isNaN(config.port)) {
        return "[CONFIG] 'port' must be a valid number.";
    }

    return true;
}

const validationResult = validateConfig(config);

if (validationResult !== true) {
    console.log(chalk.redBright.bold(validationResult));
    process.exit(1);
}

const srv = mc.createServer({
    'online-mode': true,
    port: config.port,
    keepAlive: false,
    motd: '§c§lDank Proxy v0.1',
    version: config.version
});

const modules = {};
const modulePath = path.join(__dirname, 'modules');

fs.readdirSync(modulePath).forEach(file => {
    if (file.endsWith('.js')) {
        const moduleName = path.basename(file, '.js');
        const module = require(path.join(modulePath, file));
        modules[moduleName] = module;
    }
});

console.log(chalk.redBright.bold('Dank Proxy v0.1\n'));
console.log(chalk.redBright.bold('Modules:'));

Object.keys(modules).forEach(moduleName => {
    console.log(chalk.redBright.bold(`- ${moduleName}`));
});

console.log(chalk.greenBright(`\nIP: localhost:${config.port}`));

let activeClient = null;
let activeTargetClient = null;
let isOnServer = false;

srv.on('login', function (client) {
    activeClient = client;
    //client->server modifiers
    client.packetModifiers = new Set();

    let endedClient = false;
    let endedTargetClient = false;

    activeTargetClient = mc.createClient({
        host: config.host,
        port: "25565",
        username: config.username,
        password: config.password,
        auth: config.auth,
        keepAlive: false,
        version: config.version
    });
    //server->client modifiers
    activeTargetClient.packetModifiers = new Set();

    client.on('end', function () {
        endedClient = true;
        isOnServer = false;
        if (!endedTargetClient) {
            activeTargetClient.end('End');
        }
    });

    client.on('error', function (err) {
        endedClient = true;
        isOnServer = false;
        console.log(err)
        if (!endedTargetClient) {
            activeTargetClient.end('Error');
        }
    });

    activeTargetClient.on('end', function () {
        endedTargetClient = true;
        isOnServer = false;
        if (!endedClient) {
            activeClient.end('End');
        }
    });

    activeTargetClient.on('error', function (err) {
        endedTargetClient = true;
        isOnServer = false;
        console.log(err)
        if (!endedClient) {
            activeClient.end('Error');
        }
    });

    const commandHandler = new CommandHandler(modules, client, activeTargetClient);

    client.on('packet', function (data, meta) {
        if (meta.name === 'chat' && commandHandler.handleCommand(data.message)) {
            return;
        }

        if (activeTargetClient.state === states.PLAY && meta.state === states.PLAY) {
            if (!endedTargetClient) {
                let isCancelled = false;
                for (let fn of client.packetModifiers.values()) {
                    let returnVal = fn(data, meta);
                    if (returnVal === false) {
                        isCancelled = true;
                        break;
                    }
                    if (returnVal) {
                        data = returnVal;
                    }
                }
                if (!isCancelled) activeTargetClient.write(meta.name, data);
            }
        }
    });

    activeTargetClient.on('packet', function (data, meta) {
        if (meta.state === states.PLAY && client.state === states.PLAY) {
            if (!endedClient) {
                let isCancelled = false;
                for (let fn of activeTargetClient.packetModifiers.values()) {
                    let returnVal = fn(data, meta);
                    if (returnVal === false) {
                        isCancelled = true;
                        break;
                    }
                    if (returnVal) {
                        data = returnVal;
                    }
                }
                if (!isCancelled) client.write(meta.name, data);

                if (meta.name === 'login') {
                    client.entityId = data.entityId;
                    isOnServer = true;
                }

                if (meta.name === 'set_compression') {
                    client.compressionThreshold = data.threshold;
                }
            }
        }
    });

    //use .once instead of .on here because proxies like bungeecord send login when switching backend servers
    activeTargetClient.once('login', function() {
        Object.values(modules).forEach(mod => {
            if (mod.onConnect) mod.onConnect(client, activeTargetClient);
        });
    })

    Object.values(modules).forEach(mod => {
        if (mod.active && mod.onEnable) mod.onEnable(client, activeTargetClient);
    });
});