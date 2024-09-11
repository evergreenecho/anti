module.exports = {
    active: false,
    description: "Prevents fall damage by marking the player as always on the ground.",
    
    onEnable: function (client, targetClient) {
        client.packetModifiers.add(this.modifyPositionPacket.bind(this, client));
    },

    onDisable: function (client, targetClient) {
        client.packetModifiers.delete(this.modifyPositionPacket.bind(this, client));
    },

    modifyPositionPacket: function (client, data, meta) {
        if (meta.name === 'position' || meta.name === 'position_look') {
            if (this.active && data.y <= (client.nofallY - 2)) {
                data.onGround = true;
            }
            if (Math.abs(data.y - client.nofallY) >= 2 || client.nofallY === undefined) {
                client.nofallY = data.y;
            }
        }
        return data;
    },

    toggle: function () {
        this.active = !this.active;
    }
};
