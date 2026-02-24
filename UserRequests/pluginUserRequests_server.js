/*
    User Requests v1.1.0 by AAD

    //// Server-side code ////
*/

// This version supports native WebSocket

'use strict';

const pluginName = "User Requests";

const debug = false;

// Library imports
const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');

// File imports
const { logError, logInfo, logWarn } = require('../../server/console');

// Get WebSockets
let wss, pluginsWss;
let useHooks = false;

try {
    // plugins API
    const pluginsApi = require('../../server/plugins_api');

    wss = pluginsApi.getWss?.();
    pluginsWss = pluginsApi.getPluginsWss?.();

    useHooks = !!(wss && pluginsWss);

    if (useHooks) {
        logInfo(`[${pluginName}] Using plugins_api WebSocket hooks`);
    } else {
        throw new Error(`loaded plugins_api but hooks unavailable`);
    }
} catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
        logError(`[${pluginName}] Missing plugins_api, plugin is nonfunctional, update FM-DX Webserver`);
    } else {
        logError(`[${pluginName}] Unusable plugins_api (${err.message}), plugin is nonfunctional, update FM-DX Webserver`);
    }

    return; // hard stop
}

// Plugin state
const onlineUsers = new Map(); // socketId -> { userId, userNumber, socketId, selection, ip, ws }
const ipToUserNumber = new Map(); // IP -> { userNumber, lastSeen }
const connectionTimes = new Map(); // socketId -> timestamp
const pluginClients = new Set(); // WebSocket connections for plugin data
let nextUserNumber = 1;
let debounceTimer = null;

// Define paths used for config
const rootDir = path.dirname(require.main.filename);
const configFolderPath = path.join(rootDir, 'plugins_configs');
const configFilePath = path.join(configFolderPath, 'UserRequests.json');

// Default configuration
let logTuningSelection = true;
let bypassedIpSubstrings = ["127.0.0.1", "::1"];

const defaultConfig = {
    logTuningSelection: true,
    bypassedIpSubstrings: ["127.0.0.1", "::1"]
};

// Order of keys in configuration file
const configKeyOrder = ['logTuningSelection', 'bypassedIpSubstrings'];

// Function to ensure folder and file exist
function checkConfigFile() {
    if (!fs.existsSync(configFolderPath)) {
        logInfo(`[${pluginName}] Creating plugins_configs folder...`);
        fs.mkdirSync(configFolderPath, { recursive: true });
    }

    if (!fs.existsSync(configFilePath)) {
        logInfo(`[${pluginName}] Creating default UserRequests.json file...`);
        saveDefaultConfig();
    }
}

// Function to load configuration file
function loadConfigFile(isReloaded) {
    try {
        if (fs.existsSync(configFilePath)) {
            const configContent = fs.readFileSync(configFilePath, 'utf-8');
            let config = JSON.parse(configContent);

            let configModified = false;

            // Check and add missing options with default values
            for (let key in defaultConfig) {
                if (!(key in config)) {
                    logInfo(`[${pluginName}] Missing ${key} in config. Adding default value.`);
                    config[key] = defaultConfig[key];
                    configModified = true;
                }
            }

            // Ensure variables are correct types
            logTuningSelection = typeof config.logTuningSelection === 'boolean' ? config.logTuningSelection : defaultConfig.logTuningSelection;
            bypassedIpSubstrings = Array.isArray(config.bypassedIpSubstrings) ? config.bypassedIpSubstrings : defaultConfig.bypassedIpSubstrings;

            // Save the updated config if there were any modifications
            if (configModified) {
                saveUpdatedConfig(config);
            }

            logInfo(`[${pluginName}] Configuration ${isReloaded || ''}loaded successfully.`);
        } else {
            logInfo(`[${pluginName}] Configuration file not found. Creating default configuration.`);
            saveDefaultConfig();
        }
    } catch (error) {
        logInfo(`[${pluginName}] Error loading configuration file: ${error.message}. Resetting to default.`);
        saveDefaultConfig();
    }
}

// Format config with arrays on single lines
function formatConfig(config) {
    let json = JSON.stringify(config, null, 4);
    // Collapse arrays onto single lines
    json = json.replace(/\[\s+([^\[\]]+?)\s+\]/g, (match, content) => {
        const items = content.split(',').map(s => s.trim()).join(', ');
        return `[${items}]`;
    });
    return json;
}

// Function to save default configuration file
function saveDefaultConfig() {
    const formattedConfig = formatConfig(defaultConfig);
    if (!fs.existsSync(configFolderPath)) {
        fs.mkdirSync(configFolderPath, { recursive: true });
    }
    fs.writeFileSync(configFilePath, formattedConfig);
    loadConfigFile();
}

// Function to save updated configuration after modification
function saveUpdatedConfig(config) {
    const orderedConfig = {};
    configKeyOrder.forEach(key => {
        if (key in config) {
            orderedConfig[key] = config[key];
        }
    });

    const formattedConfig = formatConfig(orderedConfig);
    fs.writeFileSync(configFilePath, formattedConfig);
}

// Function to watch configuration file for changes
function watchConfigFile() {
    fs.watch(configFilePath, (eventType) => {
        if (eventType === 'change') {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                loadConfigFile('re');
            }, 800);
        }
    });
}

// Initialise configuration system
function initConfigSystem() {
    checkConfigFile();
    loadConfigFile();
    watchConfigFile();
}

initConfigSystem();

function isBypassedIp(ip) {
    return bypassedIpSubstrings.some(sub => ip.includes(sub));
}

// Prune stale IPs, but likely not needed with ws hook
setInterval(() => {
    const now = Date.now();
    const maxAge = 8 * (60 * 60 * 1000); // 8 hours

    for (const [ip, entry] of ipToUserNumber.entries()) {
        if (now - entry.lastSeen > maxAge) {
            ipToUserNumber.delete(ip);
            logInfo(`[${pluginName}] Pruned stale IP: ${ip}`);
        }
    }
}, 10 * 60 * 1000);

// Get user number by IP
function getUserNumber(clientIp) {
    const entry = ipToUserNumber.get(clientIp);
    return entry ? entry.userNumber : undefined;
}

// Normalise IP address
function normalizeIp(ip) {
    return ip
        ?.replace(/^::ffff:/, '')
        .trim();
}

// Broadcast online users to all plugin clients
function broadcastOnlineUsers() {
    const usersArray = Array.from(onlineUsers.values()).map(u => ({
        userId: u.userId,
        userNumber: u.userNumber,
        socketId: u.socketId,
        selection: u.selection,
        connectionDuration: Date.now() - connectionTimes.get(u.socketId)
    }));

    pluginClients.forEach((ws) => {
        // Each plugin client now has its own assigned main socketId
        const mainSocketId = ws._mainSocketId || null;

        const message = JSON.stringify({
            type: 'updateUsers',
            mySocketId: mainSocketId,
            users: usersArray
        });

        try {
            if (ws.readyState === 1) ws.send(message);
        } catch (err) {
            console.error('[Server] Failed to send user list to plugin client', mainSocketId, err);
        }
    });
}

function handleMainConnection(ws, request) {
    const clientIp = request.headers['x-forwarded-for']?.split(',')[0] || request.connection.remoteAddress;
    const normalizedIp = normalizeIp(clientIp);

    if (!normalizedIp) {
        logError(`[${pluginName}] IP not found in headers`);
        return;
    }

    // Check if IP should be bypassed
    const isBypassed = bypassedIpSubstrings.some(sub => {
        const regexPattern = new RegExp('^' + sub.replace(/\*/g, '.*') + '$');
        return regexPattern.test(normalizedIp); // Check if the IP matches the wildcard pattern
    });

    if (isBypassed) {
        if (debug) logInfo(`[${pluginName}] Bypassed IP detected: ${normalizedIp}`);
        return; // Skip adding user
    }

    const socketId = randomUUID();
    const userId = randomUUID();

    // Assign userNumber per IP
    let userNumber;
    const entry = ipToUserNumber.get(normalizedIp);

    if (entry) {
        // Existing IP, reuse number
        userNumber = entry.userNumber;
        entry.lastSeen = Date.now();
    } else {
        // Find lowest available userNumber
        const usedNumbers = new Set(Array.from(onlineUsers.values()).map(u => u.userNumber));
        userNumber = 1;
        while (usedNumbers.has(userNumber)) userNumber++;

        ipToUserNumber.set(normalizedIp, { userNumber, lastSeen: Date.now() });
    }

    // Add this tab to onlineUsers
    onlineUsers.set(socketId, {
        userId,
        userNumber,
        socketId,
        selection: 'Tuning Mode',
        ip: normalizedIp,
        ws: ws
    });

    connectionTimes.set(socketId, Date.now());
    ws._userRequestsSocketId = socketId;

    broadcastOnlineUsers();

    ws.on('close', () => {
        const disconnectedUser = onlineUsers.get(socketId);

        if (disconnectedUser) {
            const userNumber = disconnectedUser.userNumber;

            onlineUsers.delete(socketId);
            connectionTimes.delete(socketId);

            // Remove IP mapping only if no other tabs from this IP remain
            const anyLeft = Array.from(onlineUsers.values()).some(u => u.ip === normalizedIp);
            if (!anyLeft) ipToUserNumber.delete(normalizedIp);
        }

        broadcastOnlineUsers();
    });
}

// Handle plugin WebSocket connection
function handlePluginConnection(ws, request) {
    const clientIp = request.headers['x-forwarded-for']?.split(',')[0] || request.connection.remoteAddress;
    const normalizedIp = normalizeIp(clientIp);

    if (debug) logInfo(`[${pluginName}] Plugin client connected from ${normalizedIp}`);

    // Assign a unique ID for this plugin client
    ws._userRequestsSocketId = randomUUID();
    ws._clientIp = normalizedIp;

    // Assign which main user this plugin controls
    const mainUser = Array.from(onlineUsers.values())
        .filter(u => u.ip === normalizedIp)
        .sort((a, b) => connectionTimes.get(b.socketId) - connectionTimes.get(a.socketId))[0];

    ws._mainSocketId = mainUser ? mainUser.socketId : null;
    if (debug) logInfo(`[${pluginName}] Plugin client assigned to mainSocketId=${ws._mainSocketId}`);

    // Add to plugin clients set
    pluginClients.add(ws);

    // Immediately send current online users
    broadcastOnlineUsers();

    // Handle messages from plugin clients
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());

            if (message.type === 'updateSelection' && message.selection) {
                if (!ws._mainSocketId) return;

                const mainUserEntry = onlineUsers.get(ws._mainSocketId);
                if (mainUserEntry) {
                    mainUserEntry.selection = message.selection;
                    if (logTuningSelection) logInfo(`[${pluginName}] User #${mainUserEntry.userNumber} (${normalizedIp}) changed selection: ${mainUserEntry.selection}`);
                    broadcastOnlineUsers();
                } else {
                    logInfo(`[${pluginName}] Selection update received but main user not found for socketId ${ws._mainSocketId}`);
                }
            }
        } catch (error) {
            logError(`[${pluginName}] Failed to parse plugin message from ${normalizedIp}: ${error}`);
        }
    });

    // Handle disconnection
    ws.on('close', () => {
        pluginClients.delete(ws);
        if (debug) logInfo(`[${pluginName}] Plugin client disconnected from ${normalizedIp} (pluginSocketId=${ws._userRequestsSocketId})`);
    });
}

// Hook into WebSocket servers
if (wss) {
    wss.on('connection', handleMainConnection);
    logInfo(`[${pluginName}] Main WebSocket server hooked`);
}

if (pluginsWss) {
    pluginsWss.on('connection', handlePluginConnection);
    logInfo(`[${pluginName}] Plugins WebSocket server hooked`);
}

// Periodic update of connection durations
setInterval(() => {
    broadcastOnlineUsers();
}, 30000);

logInfo(`[${pluginName}] Server-side plugin initialised successfully`);
