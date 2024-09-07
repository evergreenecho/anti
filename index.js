const autoUpdater = require('./autoUpdater');
const fs = require('fs');
const path = require('path');
const mc = require('minecraft-protocol');
const express = require('express');
const http = require('http');
const socketio = require('socket.io');
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

let activeClient = null;
let activeTargetClient = null;
let isOnServer = false;

srv.on('login', function (client) {
    activeClient = client;

    let endedClient = false;
    let endedTargetClient = false;

    activeTargetClient = mc.createClient({
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password,
        auth: config.auth,
        keepAlive: false,
        version: config.version
    });

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
                activeTargetClient.write(meta.name, data);
            }
        }
    });

    activeTargetClient.on('packet', function (data, meta) {
        if (meta.state === states.PLAY && client.state === states.PLAY) {
            if (!endedClient) {
                client.write(meta.name, data);

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

    Object.values(modules).forEach(mod => {
        if (mod.active && mod.onEnable) mod.onEnable(client, activeTargetClient);
    });
});

const app = express();
const server = http.createServer(app);
const io = socketio(server);

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
    if (isOnServer) {
        socket.emit('moduleList', getModuleStatuses());
    } else {
        socket.emit('moduleList', {});
    }

    socket.on('toggleModule', (moduleName) => {
        if (activeClient && activeTargetClient && isOnServer) {
            const module = modules[moduleName];
            if (module) {
                const commandHandler = new CommandHandler(modules, activeClient, activeTargetClient);
                commandHandler.toggleModule(moduleName, []);

                io.emit('moduleList', getModuleStatuses());
            } else {
                console.log('Module not found:', moduleName);
            }
        }
    });
});

function getModuleStatuses() {
    const statuses = {};
    Object.keys(modules).forEach(moduleName => {
        statuses[moduleName] = modules[moduleName].active ? 'Active' : 'Inactive';
    });
    return statuses;
}

server.listen(3000, () => {
    console.log(chalk.yellowBright.bold('\nWeb panel listening on port 3000'));
});
