module.exports = {
    active: false,
    description: 'can make players visible even if they\'re using invisibility',

    playerEntities: new Map(),
    currentClient: null,

    onEnable: function () {
        this.active = true;
        if (this.currentClient) this.setAllMetadata();
    },

    onDisable: function () {
        this.active = false;
        if (this.currentClient) this.setAllMetadata();
    },

    toggle: function () {
        this.active = !this.active;
    },

    onConnect: function (client, targetClient) {
        this.currentClient = client;

        targetClient.on('end', () => {
            this.currentClient = null;
            this.playerEntities.clear();
        });
        targetClient.on('login', () => {
            this.playerEntities.clear();
        });
        targetClient.on('named_entity_spawn', data => {
            let obj = {
                entityId: data.entityId,
                metadataFlags: 0
            };
            this.playerEntities.set(data.entityId, obj);
        });
        targetClient.on('entity_destroy', data => {
            for (let id of data.entityIds) {
                this.playerEntities.delete(id);
            }
        });

        targetClient.packetModifiers.add((data, meta) => {
            if (meta.name !== 'entity_metadata') return;
            let obj = this.playerEntities.get(data.entityId);
            if (!obj) return;
            let isModified = false;
            for (let field of data.metadata) {
                if (field.key !== 0) continue;
                obj.metadataFlags = field.value;
                if (this.active && (field.value & 0b100000)) {
                    //set the invisible flag to 0
                    field.value &= 0b11111;
                    isModified = true;
                }
            }
            if (isModified) return data;
        });
    },

    setAllMetadata: function() {
        for (let obj of this.playerEntities.values()) {
            let newFlags = obj.metadataFlags;
            if (this.active) newFlags &= 0b11111;
            this.currentClient.write('entity_metadata', {
                entityId: obj.entityId,
                metadata: [
                    { type: 0, key: 0, value: newFlags }
                ]
            });
        }
    }
};
