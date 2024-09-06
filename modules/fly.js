module.exports = {
    active: false,
    description: "Fly away little bird",

    onEnable: function (client, targetClient) {
        this.packetHandlers = {
            position: (data) => {
                if (this.active) {
                    client.write('abilities', {
                        flags: 0x02,
                        flyingSpeed: 0.05,
                        walkingSpeed: 0.1
                    });
                }
            }
        };

        this.packetListener = (data, meta) => {
            if (this.active) {
                const handler = this.packetHandlers[meta.name];
                if (handler) {
                    try {
                        handler(data, meta);
                    } catch (err) {
                        console.error(`Error handling packet ${meta.name}:`, err);
                    }
                }
            }
        };

        client.on('packet', this.packetListener);
    },

    onDisable: function (client) {
        if (this.packetListener) {
            client.removeListener('packet', this.packetListener);
            this.packetListener = null;
        }
        client.write('abilities', {
            flags: 0,
            flyingSpeed: 0.05,
            walkingSpeed: 0.1
        });
    },

    toggle: function () {
        this.active = !this.active;
    }
};
