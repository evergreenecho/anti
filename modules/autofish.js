module.exports = {
    active: false,
    description: 'fishes automatically',

    myFloat: null,
    heldSlot: 0,
    lastRodItem: null,
    shouldThrowRod: true,

    toggle: function () {
        this.active = !this.active;
    },

    onConnect: function (client, targetClient) {
        this.myFloat = null;
        this.heldSlot = 0;
        this.lastRodItem = null;
        this.shouldThrowRod = true;
        targetClient.on('login', data => {
            this.myFloat = null;
            this.heldSlot = 0;
            this.lastRodItem = null;
            this.shouldThrowRod = true;
        });
        targetClient.on('open_window', data => {
            if (this.active) this.shouldThrowRod = false;
        })
        targetClient.on('close_window', data => {
            targetClient.on('close_window', data => {
                if (this.active) {
                    this.shouldThrowRod = true;
                    // You may also need to trigger a block place event here to resume fishing
                    targetClient.write('block_place', {
                        location: { x: -1, y: -1, z: -1 },
                        direction: -1,
                        heldItem: this.myFloat?.fishedItem || this.lastRodItem, // use the last rod item
                        cursorX: 0,
                        cursorY: 0,
                        cursorZ: 0
                    });
                    targetClient.write('arm_animation', {});
                }
            });
        })
        targetClient.on('spawn_entity', data => {
            if (data.type !== 90) return; //not fishing float
            if (data.objectData.intField !== client.entityId) return;
            if (!this.lastRodItem) return; //something's wrong, float exists but we haven't fished.
            this.myFloat = {
                entityId: data.entityId,
                lastVelPacket: performance.now(),
                fishedSlot: this.heldSlot,
                fishedItem: this.lastRodItem,
                lastSpeedyPacket: performance.now()
            };
        });
        targetClient.on('entity_velocity', data => {
            if (data.entityId !== this.myFloat?.entityId) return;
            let timeSinceLast = performance.now() - this.myFloat.lastVelPacket;
            let timeSinceLastSpeedy = performance.now() - this.myFloat.lastSpeedyPacket;
            this.myFloat.lastVelPacket = performance.now();
            if (Math.abs(data.velocityY) > 500) this.myFloat.lastSpeedyPacket = performance.now();

            //if we've had recent velocity packets and this packet is calm-ish, ignore.
            //timeSinceLast will be > 1000 for 1.8 fishing when a fish is caught, since velocity packets stop once float is settled
            //if 1.21, timeSinceLast will always be < 1000 because velocity is constantly sent, however velocityY will be low while bobbing.
            if (timeSinceLast < 1000 && Math.abs(data.velocityY) < 1000) return;
            //otherwise, this filters out packets from before the float has settled.
            if (timeSinceLastSpeedy < 1000 || data.velocityX !== 0 || data.velocityZ !== 0) return;
            //velocityY check here filters out some forms of early bobbing in 1.8 fishing, doesn't affect 1.21
            if (Math.abs(data.velocityY) < 100) return;
            if (this.heldSlot !== this.myFloat.fishedSlot) return; //not holding the same item slot
            if (!this.active || !this.shouldThrowRod) return;
            //once to retract, once to fish again
            // if on dankprison and you have TMD rank, it automatically throws rod back in
            // so we only need one rod throw, change i < 2 to i < 1
            for (let i = 0; i < 2; i++) {
                targetClient.write('block_place', {
                    location: { x: -1, y: -1, z: -1 },
                    direction: -1,
                    heldItem: this.myFloat.fishedItem,
                    cursorX: 0,
                    cursorY: 0,
                    cursorZ: 0
                });
                targetClient.write('arm_animation', {});
            }
        });
        client.on('held_item_slot', data => {
            this.heldSlot = data.slot;
        });
        client.on('block_place', data => {
            //check that this is the special packet signaling a fishing rod deployment
            if (data.location.x !== -1 || data.location.y !== -1 || data.location.z !== -1) return;
            if (data.direction !== -1) return;
            if (data.heldItem?.blockId !== 346) return; //not fishing rod
            this.lastRodItem = data.heldItem;
        });
    }
};
