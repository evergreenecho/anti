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

const srv = mc.createServer({
    'online-mode': false,
    port: 25566,
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

srv.on('login', function (client) {
    const addr = client.socket.remoteAddress;

    let endedClient = false;
    let endedTargetClient = false;

    client.on('end', function () {
        endedClient = true;
        if (!endedTargetClient) {
            targetClient.end('End');
        }
    });

    client.on('error', function (err) {
        endedClient = true;
        if (!endedTargetClient) {
            targetClient.end('Error');
        }
    });

    const targetClient = mc.createClient({
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password,
        auth: config.auth,
        keepAlive: false,
        version: config.version
    });

    targetClient.on('connect', () => {
        console.log(chalk.greenBright('\nConnected to:', config.host + ':' + config.port));
    });

    targetClient.on('end', function () {
        endedTargetClient = true;
        if (!endedClient) {
            client.end('End');
        }
    });

    targetClient.on('error', function (err) {
        endedTargetClient = true;
        if (!endedClient) {
            client.end('Error');
        }
    });

    const commandHandler = new CommandHandler(modules, client, targetClient);

    client.on('packet', function (data, meta) {
        if (meta.name === 'chat' && commandHandler.handleCommand(data.message)) {
            return;
        }

        if (targetClient.state === states.PLAY && meta.state === states.PLAY) {
            if (!endedTargetClient) {
                targetClient.write(meta.name, data);
            }
        }
    });

    client.on('window_click', (data) => {
        if (data.windowId === 454567) {
            const moduleName = Object.keys(modules)[data.slot];
            if (moduleName) {
                const module = modules[moduleName];
                if (module.active) {
                    if (module.onDisable) {
                        module.onDisable(client, targetClient);
                    }
                    module.active = false;
                    client.write('chat', {
                        message: JSON.stringify({ text: `§cModule ${moduleName} deactivated.` })
                    });
                } else {
                    if (module.onEnable) {
                        module.onEnable(client, targetClient);
                    }
                    module.active = true;
                    client.write('chat', {
                        message: JSON.stringify({ text: `§aModule ${moduleName} activated.` })
                    });
                }
            }
        }
    });


    targetClient.on('packet', function (data, meta) {
        if (meta.state === states.PLAY && client.state === states.PLAY) {
            if (!endedClient) {
                client.write(meta.name, data);

                if (meta.name === 'login') {
                    client.entityId = data.entityId;
                }

                if (meta.name === 'set_compression') {
                    client.compressionThreshold = data.threshold;
                }
            }
        }
    });

    Object.values(modules).forEach(mod => {
        if (mod.active && mod.onEnable) mod.onEnable(client, targetClient);
    });
});
