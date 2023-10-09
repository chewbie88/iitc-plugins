// ==UserScript==
// @name           IITC plugin: Inventory Sheet Helper
// @author         Chewbi88, Crytix EisFrei
// @id             iitc-plugin-inventory-export@chewbi88
// @category       Info
// @version        0.2.14
// @namespace      https://github.com/IITC-CE/ingress-intel-total-conversion
// @updateURL      https://github.com/chewbie88/iitc-plugins/raw/main/inventory_sheet_helper.meta.js
// @downloadURL    https://github.com/chewbie88/iitc-plugins/raw/main/inventory_sheet_helper.user.js
// @description    Exports your inventory to the Inventroy form of the anomaly.
// @include        https://intel.ingress.com/*
// @match          https://intel.ingress.com/*
// @grant          none
// ==/UserScript==

function wrapper(plugin_info) {

    // Make sure that window.plugin exists. IITC defines it as a no-op function,
    // and other plugins assume the same.
    if (typeof window.plugin !== "function")
        window.plugin = function () {
        };
    const KEY_SETTINGS = "plugin-inventory-export";
    let settings = {
        displayMode: 'icon',
    };

    window.plugin.InventoryExport = function () {
    };

    const thisPlugin = window.plugin.InventoryExport;
    // Name of the IITC build for first-party plugins
    plugin_info.buildName = "InventoryExport";

    // Datetime-derived version of the plugin
    plugin_info.dateTimeVersion = "202310091355";

    // ID/name of the plugin
    plugin_info.pluginId = "InventoryExport";

    const translations = {
        BOOSTED_POWER_CUBE: 'Hypercube',
        CAPSULE: 'Capsule',
        DRONE: 'Drone',
        EMITTER_A: 'Resonator',
        EMP_BURSTER: 'XMP',
        EXTRA_SHIELD: 'Aegis Shield',
        FLIP_CARD: 'Virus',
        FORCE_AMP: 'Force Amp',
        HEATSINK: 'HS',
        INTEREST_CAPSULE: 'Quantum Capsule',
        KEY_CAPSULE: 'Key Capsule',
        KINETIC_CAPSULE: 'Kinetic Capsule',
        LINK_AMPLIFIER: 'LA',
        MEDIA: 'Media',
        MULTIHACK: 'Multi-Hack',
        PLAYER_POWERUP: 'Apex',
        PORTAL_LINK_KEY: 'Key',
        FRACK: 'Fracker',
        POWER_CUBE: 'PC',
        RES_SHIELD: 'Shield',
        TRANSMUTER_ATTACK: 'ITO -',
        TRANSMUTER_DEFENSE: 'ITO +',
        TURRET: 'Turret',
        ULTRA_LINK_AMP: 'Ultra-Link',
        ULTRA_STRIKE: 'US',
    };

    // Checks the subscription status
    // Parameters:
    // - callback: The callback function to be called with the result
    //   - Parameters:
    //     - err: The error object, if any
    //     - data: The subscription status data
    //       - result: A boolean indicating the subscription status
    // Returns:
    // - The result of the callback function
    function checkSubscription(callback) {
        return window.postAjax('getHasActiveSubscription', {},
            (data) => callback(null, data),
            (data) => callback(data));
    }

    // Adds an item to the count map
    // Parameters:
    // - item: The item to be added
    // - countMap: The count map object
    // - incBy: The value to increment the count by
    function addItemToCount(item, countMap, incBy) {
        if (item[2] && item[2].resource && item[2].timedPowerupResource) {
            const key = `${item[2].resource.resourceType} ${item[2].timedPowerupResource.designation}`;
            if (!countMap[key]) {
                countMap[key] = item[2].resource;
                countMap[key].count = 0;
                countMap[key].type = `Powerup ${translations[item[2].timedPowerupResource.designation] || item[2].timedPowerupResource.designation}`;
            }
            countMap[key].count += incBy;
        } else if (item[2] && item[2].resource && item[2].flipCard) {
            const key = `${item[2].resource.resourceType} ${item[2].flipCard.flipCardType}`;
            if (!countMap[key]) {
                countMap[key] = item[2].resource;
                countMap[key].count = 0;
                countMap[key].type = `${translations[item[2].resource.resourceType]} ${item[2].flipCard.flipCardType}`;
            }
            countMap[key].flipCardType = item[2].flipCard.flipCardType;
            countMap[key].count += incBy;
        } else if (item[2] && item[2].resource) {
            const key = `${item[2].resource.resourceType} ${item[2].resource.resourceRarity}`;
            if (!countMap[key]) {
                countMap[key] = item[2].resource;
                countMap[key].count = 0;
                countMap[key].type = `${translations[item[2].resource.resourceType]}`;
            }
            countMap[key].count += incBy;
        } else if (item[2] && item[2].resourceWithLevels) {
            const key = `${item[2].resourceWithLevels.resourceType} ${item[2].resourceWithLevels.level}`;
            if (!countMap[key]) {
                countMap[key] = item[2].resourceWithLevels;
                countMap[key].count = 0;
                countMap[key].resourceRarity = 'COMMON';
                countMap[key].type = `${translations[item[2].resourceWithLevels.resourceType]} ${item[2].resourceWithLevels.level}`;
            }
            countMap[key].count += incBy;
        } else if (item[2] && item[2].modResource) {
            const key = `${item[2].modResource.resourceType} ${item[2].modResource.rarity}`;
            if (!countMap[key]) {
                countMap[key] = item[2].modResource;
                countMap[key].count = 0;
                countMap[key].type = `${translations[item[2].modResource.resourceType]}`;
                countMap[key].resourceRarity = countMap[key].rarity;
            }
            countMap[key].count += incBy;
        } else {
            console.log(item);
        }
    }

    // Helper function to prepare item counts for inventory export
    // Parameters:
    // - data: The inventory data
    // Returns:
    // - An array of item counts
    function prepareItemCounts(data) {
        if (!data || !data.result) {
            return [];
        }
        const countMap = {};
        data.result.forEach((item) => {
            addItemToCount(item, countMap, 1);
            if (item[2].container) {
                item[2].container.stackableItems.forEach((item) => {
                    addItemToCount(item.exampleGameEntity, countMap, item.itemGuids.length);
                });
            }
        });
        const countList = Object.values(countMap);
        countList.sort((a, b) => {
            if (a.type === b.type) {
                return 0;
            }
            return a.type > b.type ? 1 : -1;
        });
        return countList;
    }

    // Helper function to prepare data for inventory export
    // Parameters:
    // - data: The inventory data
    function prepareData(data) {
        thisPlugin.itemCount = prepareItemCounts(data);
    }

    // Helper function to get the count of an item by type and resource rarity
    // Parameters:
    // - type: The item type
    // - resourceRarity: The resource rarity
    // Returns:
    // - The count of the item
    function getCountByItem(type, resourceRarity) {
        const item = thisPlugin.itemCount.find((item) => {
            return item.type === type && item.resourceRarity === resourceRarity
        });
        if (item) {
            return item.count;
        }
        return 0;
    }

    function getCountByItems(resourceRarityItems) {
        let count = 0;
        for ( rarity in resourceRarityItems) {
            resourceRarityItems[rarity].forEach(item => {
                count += getCountByItem(item, rarity);
            });
        };

        return count;
    }

    // Opens the export inventory dialog
    function openExportInventoryDialog() {
        dialog({
            html: `
            <div id="export-dialog">
                <p>
                    <h4>Position:</h4>
                    <select id="position-dropdown">
                        <option value="Agent">Agent</option>
                        <option value="Co-Team Lead">Co-Team Lead</option>
                        <option value="Team Lead">Team Lead</option>
                    </select>
                </p>

                <p>
                    <h4>Anomaly Experience:</h4>
                    <select id="anomaly-dropdown">
                        <option value="First Time">First Time</option>
                        <option value="2 to 4 Times">2 to 4 Times</option>
                        <option value="5+ Times">5+ Times</option>
                    </select>
                </p>

                <p>
                    <h4>Estimate Time of Arrival:</h4>
                    <input type="datetime-local" id="datetime-picker">
                </p>
                <a id="inventory-export-url" style="display:none" target="_blank" href="">Export url</a>
            </div>
        `,
            title: 'Export Inventory',
            id: 'export-dialog',
            closeCallback: function () {
                saveData();
            }
        }).dialog('option', 'buttons', {
            'Close': function () {
                $(this).dialog('close');
            },
            'Submit': function () {
                exportInventory();
                saveData();
            }
        });

        const localData = JSON.parse(localStorage[KEY_SETTINGS]);

        document.getElementById('position-dropdown').value = localData['position'] || 'Agent';
        document.getElementById('anomaly-dropdown').value  = localData['anomalyExperience'] || 'First';
        document.getElementById('datetime-picker').value   = localData['dateTime'] || getCurrentDateTime();
    }

    // Gets the current date and time as a string
    // Returns:
    // - The current date and time in the format "YYYY-MM-DDTHH:MM"
    function getCurrentDateTime() {
        var now = new Date();
        var year = now.getFullYear();
        var month = String(now.getMonth() + 1).padStart(2, '0');
        var day = String(now.getDate()).padStart(2, '0');
        var hours = String(now.getHours()).padStart(2, '0');
        var minutes = String(now.getMinutes()).padStart(2, '0');

        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    // Exports the inventory
    function exportInventory() {
        const link = 'https://docs.google.com/forms/d/e/1FAIpQLSc7IcnpgFCyy_Z6pIQJKNu7mW_i3Kx_3dwqlMLkqK24XF89ew/viewform?usp=pp_url&';
        const params = [];
        params.push(`entry.1741570144=${window.PLAYER.nickname}`);
        params.push(`entry.2072889579=${document.getElementById('position-dropdown').value}`);
        params.push(`entry.182578125=${encodeURIComponent(document.getElementById('anomaly-dropdown').value)}`);
        params.push(`entry.1255763572=${document.getElementById('datetime-picker').value}`);
        params.push(`entry.403209187=${getCountByItem('Resonator 4', 'COMMON')}`);
        params.push(`entry.529383870=${getCountByItem('Resonator 5', 'COMMON')}`);
        params.push(`entry.175447597=${getCountByItem('Resonator 6', 'COMMON')}`);
        params.push(`entry.2071143429=${getCountByItem('Resonator 7', 'COMMON')}`);
        params.push(`entry.1855198063=${getCountByItem('Resonator 8', 'COMMON')}`);
        params.push(`entry.960984521=${getCountByItem('XMP 8', 'COMMON')}`);
        params.push(`entry.830471692=${getCountByItem('US 8', 'COMMON')}`);
        params.push(`entry.330809487=${getCountByItem('Virus JARVIS', 'VERY_RARE')}`);
        params.push(`entry.986554326=${getCountByItem('Virus ADA', 'VERY_RARE')}`);
        params.push(`entry.1602400279=${getCountByItem('Aegis Shield', 'VERY_RARE') + getCountByItem('Shield', 'VERY_RARE')}`);
        params.push(`entry.2094350760=${getCountByItem('HS', 'VERY_RARE')}`);
        params.push(`entry.31918188=${getCountByItem('Multi-Hack', 'VERY_RARE')}`);
        params.push(`entry.1882812863=${getCountByItem('Ultra-Link', 'VERY_RARE')}`);
        params.push(`entry.109994253=${getCountByItems({'COMMON': ['Multi-Hack', 'HS', 'Shield'], 'RARE': ['LA']})}`);
        params.push(`entry.1282182253=${getCountByItem('Hypercube', 'VERY_RARE')}`);
        params.push(`entry.1370213016=${getCountByItem('Powerup Fracker', 'VERY_RARE')}`);
        params.push(`entry.1844471219=${getCountByItem('Capsule', 'RARE')}`);
        params.push(`entry.203549570=${getCountByItem('Key Capsule', 'VERY_RARE')}`);
        params.push(`entry.1847308850=${getCountByItem('Powerup BB_BATTLE', 'VERY_RARE')}`);
        params.push(`entry.317400317=${getCountByItems({'VERY_RARE': [
            // 'Powerup FW_ENL', // firework enl
            // 'Powerup FW_RES', // firework res
            'Powerup ENL', // Beacon enl
            'Powerup RES', // Beacon res
            'Powerup MEET', // Beacon Meetup
            'Powerup LOOK', // Beacon Target
            'Powerup NIA', // Beacon Niantic
            'Powerup BN_PEACE', // Beacon Peace
            'Powerup BN_BLM', // Beacon Black Live Matter
            'Powerup TOASTY', // Beacon Toast
            'Powerup EXO5', // Beacon Exo5
            'Powerup MAGNUSRE', // Beacon Reawakens
            'Powerup VIANOIR', // Beacon Via NoIR
            'Powerup VIALUX', // Beacon Via Lux
            'Powerup AEGISNOVA', // Beacon Aegis Nova
            'Powerup OBSIDIAN', // Beacon Obsidian
            'Powerup NEMESIS', // Beacon Nemesis
        ]})}`);

        document.getElementById('inventory-export-url').style.display = 'block';
        linkBtn.attr("href", link + params.join('&'));

        if (window.innerWidth > 800) {
            window.open(link + params.join('&'), '_blank');
        }
    };

    function saveData() {
        var position = document.getElementById('position-dropdown').value;
        var anomalyExperience = document.getElementById('anomaly-dropdown').value;
        var dateTime = document.getElementById('datetime-picker').value;

        const localData = JSON.parse(localStorage[KEY_SETTINGS]);
        localData['position'] = position;
        localData['anomalyExperience'] = anomalyExperience;
        localData['dateTime'] = dateTime;

        localStorage[KEY_SETTINGS] = JSON.stringify(localData);
    }

    // Loads the inventory data and prepares it for export
    function loadInventory() {
        try {
            const localData = JSON.parse(localStorage[KEY_SETTINGS]);
            if (localData && localData.settings) {
                settings = localData.settings;
            }
            if (localData && localData.expires > Date.now() && localData.data) {
                prepareData(localData.data);
                return;
            }
        } catch (e) {
        }

        checkSubscription((err, data) => {
            if (data && data.result === true) {
                window.postAjax('getInventory', {
                    "lastQueryTimestamp": 0
                }, (data, textStatus, jqXHR) => {
                    localData['data'] = data;
                    localData['settings'] = settings;
                    localData['expires'] = Date.now() + 10 * 60 * 1000; // request data only once per five minutes, or we might hit a rate limit
                    localStorage[KEY_SETTINGS] = JSON.stringify(localData);

                    prepareData(data);
                }, (data, textStatus, jqXHR) => {
                    console.error(data);
                });
            }
        });
    };

    // Click handler for the export button
    function onClickHandler() {
        checkSubscription((err, data) => {
            if (data && data.result === true) {
                openExportInventoryDialog();
            } else {
                dialog({
                    title: 'Warning - Missing C.O.R.E. subscription',
                    html: '<p>This plugin requires an active C.O.R.E. subscription to process the data. Please use the following link and manually fill out the inventory form.</p>' +
                        '<p><a href="https://enl.rocks/-rott" target="_blank">Inventory Form</a></p>'
                });
            }
        });
    }

    // Sets up the script by loading the inventory and adding the export button
    function setup() {
        loadInventory();

        $('<a href="#">')
            .text('Export Inventory')
            .click(onClickHandler)
            .appendTo($('#toolbox'));
    }

    // Delayed setup to avoid server errors
    function delaySetup() {
        setTimeout(setup, 1000); // delay setup and thus requesting data, or we might encounter a server error
    }

    delaySetup.info = plugin_info; //add the script info data to the function as a property

    if (window.iitcLoaded) {
        delaySetup();
    } else {
        if (!window.bootPlugins) {
            window.bootPlugins = [];
        }
        window.bootPlugins.push(delaySetup);
    }
}

// Main wrapper function
(function () {
    const plugin_info = {};
    if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) {
        plugin_info.script = {
            version: GM_info.script.version,
            name: GM_info.script.name,
            description: GM_info.script.description
        };
    }
    // Greasemonkey. It will be quite hard to debug
    if (typeof unsafeWindow != 'undefined' || typeof GM_info == 'undefined' || GM_info.scriptHandler != 'Tampermonkey') {
        // inject code into site context
        const script = document.createElement('script');
        script.appendChild(document.createTextNode('(' + wrapper + ')(' + JSON.stringify(plugin_info) + ');'));
        (document.body || document.head || document.documentElement).appendChild(script);
    } else {
        // Tampermonkey, run code directly
        wrapper(plugin_info);
    }
})();