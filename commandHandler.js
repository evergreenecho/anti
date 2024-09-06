class CommandHandler {
    constructor(modules, client, targetClient) {
        this.modules = modules;
        this.client = client;
        this.targetClient = targetClient;
        this.commands = [
            {
                name: "help",
                description: "Shows this message"
            }
        ];
    }

    handleCommand(message) {
        const commandPrefix = '.';
        if (!message.startsWith(commandPrefix)) return false;

        const args = message.slice(commandPrefix.length).split(' ');
        const command = args[0];
        const moduleName = args[1];

        if (command === 'help') {
            this.sendHelpMessage();
            return true;
        } else if (command === 'm' && moduleName) {
            const module = this.modules[moduleName];
            if (module) {
                const moduleArgs = args.slice(2);
                this.toggleModule(moduleName, moduleArgs);
            } else {
                this.client.write('chat', {
                    message: JSON.stringify({ text: '§cUnknown module.' })
                });
            }
            return true;
        } else {
            this.client.write('chat', {
                message: JSON.stringify({ text: '§cUnknown command or module.' })
            });
        }

        return true;
    }

    sendHelpMessage() {
        let helpMessage = '§eAvailable Commands:\n';

        this.commands.forEach(cmd => {
            helpMessage += `§b.${cmd.name}§r - ${cmd.description}\n`;
        });

        helpMessage += '\n§eAvailable Modules:\n';

        Object.keys(this.modules).forEach(module => {
            const modDescription = this.modules[module].description;
            helpMessage += `§b.m ${module}§r - ${modDescription}\n`;
        });

        this.client.write('chat', {
            message: JSON.stringify({ text: helpMessage })
        });
    }

    toggleModule(moduleName, moduleArgs) {
        const module = this.modules[moduleName];
        if (!module) {
            this.client.write('chat', {
                message: JSON.stringify({ text: '§cModule not found.' })
            });
            return;
        }

        if (module.active) {
            if (module.onDisable) {
                module.onDisable(this.client, this.targetClient);
            }
            module.active = false;
            this.client.write('chat', {
                message: JSON.stringify({ text: `§cModule ${moduleName} deactivated.` })
            });
        } else {
            if (module.onEnable) {
                module.onEnable(this.client, this.targetClient, ...moduleArgs);
            }
            module.active = true;
            this.client.write('chat', {
                message: JSON.stringify({ text: `§aModule ${moduleName} activated.` })
            });
        }
    }
}

module.exports = CommandHandler;
