const autoUpdater = require('./autoUpdater')

autoUpdater.checkForUpdates()

const fs = require('fs');
const path = require('path');
const mc = require('minecraft-protocol');
const states = mc.states;
const CommandHandler = require('./commandHandler');

const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const srv = mc.createServer({
    'online-mode': false,
    port: 25566,
    keepAlive: false,
    motd: `\u00A7c\u00A7lDank Proxy`,
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

srv.on('login', function (client) {
    const addr = client.socket.remoteAddress;
    console.log('Incoming connection from', addr);

    let endedClient = false;
    let endedTargetClient = false;

    client.on('end', function () {
        endedClient = true;
        console.log('Connection closed by client', addr);
        if (!endedTargetClient) {
            console.log('Ending target client due to client closure');
            targetClient.end('End');
        }
    });

    client.on('error', function (err) {
        endedClient = true;
        console.log('Connection error by client', addr);
        console.log(err.stack);
        if (!endedTargetClient) {
            console.log('Ending target client due to client error');
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
        console.log('Connected to target server', config.host + ':' + config.port);
    });

    targetClient.on('end', function () {
        endedTargetClient = true;
        console.log('Connection closed by server', addr);
        if (!endedClient) {
            console.log('Ending client due to server closure');
            client.end('End');
        }
    });

    targetClient.on('error', function (err) {
        endedTargetClient = true;
        console.log('Connection error by server', addr, err);
        console.log(err.stack);
        if (!endedClient) {
            console.log('Ending client due to server error');
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
