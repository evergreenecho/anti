module.exports = {
  active: false,
  windowOpen: false,
  currentWindowId: null,
  colorChallengeDetected: false,
  description: "Automatically solves DankPrison's Anti-Script",

  onEnable: function (client, targetClient) {
    this.packetHandlers = {
      open_window: (data) => {
        this.windowOpen = true;
        this.currentWindowId = data.windowId;
        try {
          const titleData = JSON.parse(data.windowTitle);
          const containsColorChallenge = titleData.text && titleData.text.includes("Color Challenge");
          this.colorChallengeDetected = containsColorChallenge;
        } catch (e) {
          console.log('Error parsing windowTitle:', e);
        }
      },
      close_window: () => {
        this.windowOpen = false;
        this.currentWindowId = null;
        this.colorChallengeDetected = false;
      },
      window_items: (data) => {
        if (this.colorChallengeDetected && data.windowId === this.currentWindowId) {
          const itemsWithNbtData = data.items.filter(item => item.itemCount !== undefined);

          let foundIndex = -1;
          let answer = '';

          itemsWithNbtData.forEach((item, index) => {
            const { nbtData } = item;
            if (nbtData && nbtData.value && nbtData.value.display) {
              const displayData = nbtData.value.display;
              const nameField = displayData.value.Name;

              if (nameField && nameField.type === 'string') {
                let itemName = nameField.value;
                itemName = itemName.replace(/§./g, '');

                if (itemName.includes("Click the")) {
                  const colorMatch = itemName.match(/Click the (.+) Wool/);
                  answer = colorMatch ? `${colorMatch[1]} Wool` : '';
                }

                if (answer && itemName.trim() === answer) {
                  foundIndex = index;
                  return;
                }
              }
            }
          });

          if (foundIndex !== -1) {
            const randomDelay = Math.random() * (5000 - 1500) + 1500;
            setTimeout(() => {
              this.sendClickPacket(targetClient, foundIndex);
            }, randomDelay);
          } else {
            console.log('captcha failed sorry');
          }
        }
      }
    };

    this.packetListener = (data, meta) => {
      if (!this.active) return;
      const handler = this.packetHandlers[meta.name];
      if (handler) handler(data, meta);
    };

    targetClient.on('packet', this.packetListener);
  },

  onDisable: function (client, targetClient) {
    if (this.packetListener) {
      targetClient.removeListener('packet', this.packetListener);
      this.packetListener = null;
    }
  },

  sendClickPacket: function (client, slotIndex) {
    const packet = {
      windowId: this.currentWindowId,
      slot: slotIndex,
      mouseButton: 0,
      action: 0,
      mode: 0,
      item: {
        blockId: -1,
        itemCount: undefined,
        itemDamage: undefined,
        nbtData: undefined
      }
    };

    client.write('window_click', packet);
  },

  toggle: function () {
    this.active = !this.active;
  }
};
