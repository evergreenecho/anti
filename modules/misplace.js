module.exports = {
    active: false,
    description: 'pull enemies towards you',
    misplaceBlocks: 1,
    playerEntities: new Map(),
    myPosition: {
        x: 0,
        y: 0,
        z: 0
    },
    currentClient: null,

    onEnable: function (client, targetClient) {
        if (this.currentClient) this.moveAllPlayers();
    },

    onDisable: function () {
        let oldVal = this.misplaceBlocks;
        this.misplaceBlocks = 0;
        if (this.currentClient) this.moveAllPlayers();
        this.misplaceBlocks = oldVal;
    },

    toggle: function () {
        this.active = !this.active;
    },

    setMisplaceBlocks: function (value) {
        this.misplaceBlocks = value;
        if (this.active && this.currentClient) this.moveAllPlayers();
    },

    onConnect: function (client, targetClient) {
        this.currentClient = client;

        client.on('position_look', data => {
            this.myPosition = {
                x: data.x,
                y: data.y,
                z: data.z
            };
            if (this.active) this.moveAllPlayers();
        });

        targetClient.packetModifiers.add((data, meta) => {
            if (meta.name === 'named_entity_spawn') {

                if (data.playerUUID[14] === '2') {
                    return;
                }

                let obj = { 
                    entityId: data.entityId,
                    x: data.x,
                    y: data.y,
                    z: data.z,
                    yaw: data.yaw,
                    pitch: data.pitch,
                    onGround: true
                };
                this.playerEntities.set(data.entityId, obj);
                if (this.active && this.misplaceBlocks > 0) {
                    let fakePos = this.getMisplacePos(obj);
                    data.x = fakePos.x;
                    data.y = fakePos.y;
                    data.z = fakePos.z;
                    return data;
                }
            }
        });
    },

    moveAllPlayers: function () {
        for (let obj of this.playerEntities.values()) {
            this.movePlayer(obj);
        }
    },

    movePlayer: function (obj) {
        let fakePos = this.getMisplacePos(obj);
        this.currentClient.write('entity_teleport', {
            entityId: obj.entityId,
            x: fakePos.x,
            y: fakePos.y,
            z: fakePos.z,
            yaw: obj.yaw,
            pitch: obj.pitch,
            onGround: obj.onGround
        });
    },

    getMisplacePos: function (obj) {
        let otherX = obj.x / 32;
        let otherZ = obj.z / 32;
        let myX = this.myPosition.x;
        let myZ = this.myPosition.z;
        let xDiff = myX - otherX;
        let zDiff = myZ - otherZ;
        let distanceToOther = Math.hypot(xDiff, zDiff);

        if (distanceToOther > 20) return {
            x: obj.x,
            y: obj.y,
            z: obj.z
        };

        let misplaceFactor = 1;
        if (distanceToOther > 12) {
            misplaceFactor = 1 - (distanceToOther - 12) / 8;
        } else if (distanceToOther < 3) {
            misplaceFactor = distanceToOther / 3;
        }
        let misplaceBlocks = this.misplaceBlocks * misplaceFactor;

        let angleToOther = Math.atan2(zDiff, xDiff);

        return {
            x: Math.round((otherX + Math.cos(angleToOther) * misplaceBlocks) * 32),
            y: obj.y,
            z: Math.round((otherZ + Math.sin(angleToOther) * misplaceBlocks) * 32)
        };
    }
};
