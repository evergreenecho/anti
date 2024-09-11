module.exports = {
    active: false,
    description: "pause outgoing packets like you're lagging",

    packetModifierFn: null,
    packetBuffer: [],

    onEnable: function (client) {
        this.packetBuffer = []
        this.packetModifierFn = (data, meta) => {
            this.packetBuffer.push([meta.name, data]);
            return false;
        }
        client.packetModifiers.add(this.packetModifierFn);
    },

    onDisable: function (client, targetClient) {
        client.packetModifiers.delete(this.packetModifierFn);
        for (let packet of this.packetBuffer) {
            targetClient.write(packet[0], packet[1]);
        }
        this.packetBuffer = []
    },

    toggle: function () {
        this.active = !this.active;
    }
};