module.exports = {
    active: false,
    description: "Knockback? nah",

    onEnable: function (client, targetClient) {
        this.packetHandlers = {
            entity_velocity: (data) => {
                if (this.active) {
                    if (data.entityId === client.entityId) {
                        client.write('entity_velocity', { entityId: client.entityId, velocityX: 0, velocityY: data.velocityY, velocityZ: 0 });
                    }
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

        targetClient.on('packet', this.packetListener);
    },

    onDisable: function (client, targetClient) {
        if (this.packetListener) {
            targetClient.removeListener('packet', this.packetListener);
            this.packetListener = null;
        }
    },

    toggle: function () {
        this.active = !this.active;
    }
};
