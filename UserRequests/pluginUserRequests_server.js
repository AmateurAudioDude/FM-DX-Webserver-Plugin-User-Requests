/*
    User Requests by AAD

    //// Server-side code ////
*/

'use strict';

const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');
const { logError, logInfo, logWarn } = require('../../server/console');
const storage = require('../../server/storage');
const { serverConfig } = require('../../server/server_config');
const WebSocket = require('ws');

const pluginName = "User Requests";

// Connection tracking, each tab/connection gets own entry
const connectionData = new Map(); // Maps connectionId -> { odbc, connectionTime, selection, lastHeartbeat, ip }
const ipAssignedNumber = new Map(); // Maps IP -> permanently assigned user number until all disconnect
let nextUserNumber = 1;
let userUpdateInterval = null;
let pluginWsClient = null;
let reconnectTimeout = null;
let debounceTimer = null;

// Maps connectionId -> IP registered via HTTP endpoint
const registeredConnections = new Map();

// Track connectionIds confirmed as bypassed, will never get a user number
const bypassedConnections = new Set();

// Define paths used for config
const rootDir = path.dirname(require.main.filename);
const configFolderPath = path.join(rootDir, 'plugins_configs');
const configFilePath = path.join(configFolderPath, 'UserRequests.json');

// Default configuration
let logConnectionTimeout = true;
let bypassedIpSubstrings = ["192.168.", "172.16.", "127.0.0.1", "::1", "::ffff:127.0.0.1"];

const defaultConfig = {
    logConnectionTimeout: true,
    bypassedIpSubstrings: ["192.168.", "172.16.", "127.0.0.1", "::1", "::ffff:127.0.0.1"]
};

// Order of keys in configuration file
const configKeyOrder = ['logConnectionTimeout', 'bypassedIpSubstrings'];

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
            logConnectionTimeout = typeof config.logConnectionTimeout === 'boolean' ? config.logConnectionTimeout : defaultConfig.logConnectionTimeout;
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

// Create HTTP endpoint, client calls once with their connectionId, mapping stored server-side
function createRegistrationEndpoint() {
    const endpointsRouter = require('../../server/endpoints');

    endpointsRouter.get('/user-requests-register', (req, res) => {
        const pluginHeader = req.get('X-Plugin-Name') || 'NoPlugin';

        if (pluginHeader !== 'UserRequests') {
            res.status(403).json({ error: 'Unauthorised' });
            return;
        }

        const connectionId = req.get('X-Connection-Id');
        if (!connectionId) {
            res.status(400).json({ error: 'Missing connectionId' });
            return;
        }

        const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.connection.remoteAddress;
        const normalizedIp = normalizeIp(clientIp);

        // Check if IP should be bypassed
        if (shouldBypassIp(normalizedIp)) {
            bypassedConnections.add(connectionId);
            res.json({ registered: true, bypassed: true });
            return;
        }

        registeredConnections.set(connectionId, normalizedIp);
        res.json({ registered: true, bypassed: false });
    });

    logInfo(`[${pluginName}] Registration endpoint created`);
}

createRegistrationEndpoint();

// Function to normalise IP addresses
function normalizeIp(ip) {
    if (!ip) return '';
    return ip.replace(/^::ffff:/, '');
}

// Function to check if IP should be bypassed
function shouldBypassIp(ip) {
    const normalizedIp = normalizeIp(ip);
    return bypassedIpSubstrings.some(substring => normalizedIp.includes(substring));
}

// Get a short and meaningful ID from connectionId
// Format is "conn_TIMESTAMP_RANDOM"
function shortId(connectionId) {
    if (!connectionId) return 'unknown';
    const parts = connectionId.split('_');
    if (parts.length >= 3) {
        return parts[2];
    }
    return connectionId.substring(0, 12);
}

// Get or assign a permanent user number for an IP
// Numbers are assigned in order of first connection and persist until all users disconnect
function getOrAssignUserNumber(ip) {
    if (!ip) return null;

    if (ipAssignedNumber.has(ip)) {
        return ipAssignedNumber.get(ip);
    }

    // Assign the next available number
    const userNumber = nextUserNumber++;
    ipAssignedNumber.set(ip, userNumber);
    return userNumber;
}

// Clean up stale connections for reconnects
// If same IP reconnects, remove old stale entries
function cleanupStaleForReconnect() {
    const now = Date.now();
    const staleThreshold = 5000; // 5 seconds without heartbeat

    for (const [connectionId, data] of connectionData.entries()) {
        if ((now - data.lastHeartbeat) > staleThreshold) {
            connectionData.delete(connectionId);
            registeredConnections.delete(connectionId);
            logInfo(`[${pluginName}] Cleaned up stale connection for reconnect: ${shortId(connectionId)}`);
        }
    }
}

// Handle client heartbeat/registration
function handleClientHeartbeat(connectionId, existingOdbc) {
    const now = Date.now();

    // Already tracked, update heartbeat
    if (connectionData.has(connectionId)) {
        const data = connectionData.get(connectionId);
        data.lastHeartbeat = now;
        return data.odbc;
    }

    const odbc = existingOdbc || randomUUID();

    // If confirmed as bypassed via HTTP endpoint, stay invisible
    if (bypassedConnections.has(connectionId)) {
        return odbc;
    }

    // Check if this connectionId has registered via HTTP endpoint
    if (!registeredConnections.has(connectionId)) {
        // Not registered yet, wait for HTTP registration
        return odbc;
    }

    // Get IP from registration
    const registeredIp = registeredConnections.get(connectionId);

    // Clean up stale connections for this IP, handles reconnects
    cleanupStaleForReconnect();

    const userNumber = getOrAssignUserNumber(registeredIp);

    connectionData.set(connectionId, {
        odbc: odbc,
        connectionTime: now,
        selection: 'Tuning Mode',
        lastHeartbeat: now,
        ip: registeredIp
    });

    if (logConnectionTimeout) logInfo(`[${pluginName}] New connection registered: User #${userNumber} (${shortId(connectionId)}) IP: ${registeredIp}`);

    // Broadcast updated user list
    broadcastUserUpdate();

    return odbc;
}

// Function to build users array for broadcasting
function buildUsersArray() {
    const now = Date.now();
    const usersArray = [];

    for (const [connectionId, userData] of connectionData.entries()) {
        // Get user number from persistent assignment (same IP = same number)
        const userNumber = userData.ip ? (ipAssignedNumber.get(userData.ip) || 1) : 1;

        usersArray.push({
            odbc: userData.odbc,
            connectionId: connectionId,
            userNumber: userNumber,
            selection: userData.selection,
            connectionDuration: now - userData.connectionTime
        });
    }

    // Sort by user number, then by connection duration
    usersArray.sort((a, b) => {
        if (a.userNumber !== b.userNumber) return a.userNumber - b.userNumber;
        return b.connectionDuration - a.connectionDuration; // Longer duration first
    });

    return usersArray;
}

// Connect to the local /data_plugins WebSocket as a client
function connectToPluginsWs() {
    const port = serverConfig.webserver?.webserverPort || 8080;
    const wsUrl = `ws://127.0.0.1:${port}/data_plugins`;

    try {
        pluginWsClient = new WebSocket(wsUrl);

        pluginWsClient.on('open', () => {
            logInfo(`[${pluginName}] Connected to /data_plugins WebSocket`);
        });

        pluginWsClient.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());

                if (message.type !== 'userRequests') return;

                // Handle client heartbeat/registration
                if (message.action === 'heartbeat' && message.connectionId) {
                    const assignedOdbc = handleClientHeartbeat(message.connectionId, message.odbc);
                    // Send back the assigned odbc if it's new
                    if (assignedOdbc !== message.odbc) {
                        broadcastUserUpdate();
                    }
                }

                // Handle selection updates from clients
                if (message.action === 'updateSelection' && message.connectionId) {
                    if (connectionData.has(message.connectionId)) {
                        const userData = connectionData.get(message.connectionId);
                        userData.selection = message.selection;
                        broadcastUserUpdate();
                    }
                }

                // Handle update requests from clients
                if (message.action === 'requestUpdate') {
                    broadcastUserUpdate();
                }
            } catch (e) {
                // Not JSON or not for this
            }
        });

        pluginWsClient.on('close', () => {
            setTimeout(() => {
                logWarn(`[${pluginName}] Disconnected from /data_plugins, reconnecting...`);
            }, 800);
            scheduleReconnect();
        });

        pluginWsClient.on('error', (err) => {
            // Don't log errors during initial connection attempts
            if (pluginWsClient.readyState !== WebSocket.CONNECTING) {
                logError(`[${pluginName}] WebSocket error: ${err.message}`);
            }
            scheduleReconnect();
        });

    } catch (error) {
        logError(`[${pluginName}] Failed to connect: ${error.message}`);
        scheduleReconnect();
    }
}

function scheduleReconnect() {
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
    }
    reconnectTimeout = setTimeout(() => {
        if (!pluginWsClient || pluginWsClient.readyState === WebSocket.CLOSED) {
            connectToPluginsWs();
        }
    }, 5000);
}

// Broadcast user updates through the /data_plugins WebSocket
function broadcastUserUpdate() {
    if (pluginWsClient && pluginWsClient.readyState === WebSocket.OPEN) {
        const message = JSON.stringify({
            type: 'userRequests',
            action: 'updateUsers',
            users: buildUsersArray()
        });

        try {
            pluginWsClient.send(message);
        } catch (error) {
            logError(`[${pluginName}] Broadcast error: ${error.message}`);
        }
    }
}

// Clean up stale connections if no heartbeat in 10 seconds
function cleanupStaleConnections() {
    const now = Date.now();
    const staleThreshold = 10000; // 10 seconds
    let removed = false;

    // Clean up tracked connections that timed out
    for (const [connectionId, data] of connectionData.entries()) {
        if (now - data.lastHeartbeat > staleThreshold) {
            connectionData.delete(connectionId);
            registeredConnections.delete(connectionId);
            if (logConnectionTimeout) logInfo(`[${pluginName}] Connection timed out: ${shortId(connectionId)} IP: ${data.ip || 'unknown'}`);
            removed = true;
        }
    }

    // Clean up stale registered connections that never became active
    for (const connectionId of registeredConnections.keys()) {
        if (!connectionData.has(connectionId)) {
            // If registered but not active for a while, clean up
            registeredConnections.delete(connectionId);
        }
    }

    // Clean up bypassed connections
    // Since bypassedConnections is a Set, another way is needed to track staleness

    // Reset user numbering only when all visible users have disconnected
    if (connectionData.size === 0 && removed) {
        ipAssignedNumber.clear();
        registeredConnections.clear();
        bypassedConnections.clear();
        nextUserNumber = 1;
        if (logConnectionTimeout) logInfo(`[${pluginName}] All users disconnected, resetting user numbers`);
    }

    if (removed) {
        broadcastUserUpdate();
    }
}

// Main sync and broadcast loop
function startUserTracking() {
    // Wait for server to fully start before connecting
    setTimeout(() => {
        connectToPluginsWs();
    }, 5000);

    // Broadcast updates and clean up stale connections every 3 seconds
    userUpdateInterval = setInterval(() => {
        cleanupStaleConnections();
        broadcastUserUpdate();
    }, 3000);

    //logInfo(`[${pluginName}] Started`);
}

// Cleanup function for graceful shutdown
function cleanup() {
    if (userUpdateInterval) {
        clearInterval(userUpdateInterval);
        userUpdateInterval = null;
    }
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
    }
    if (pluginWsClient) {
        pluginWsClient.close();
        pluginWsClient = null;
    }
    //logInfo(`[${pluginName}] Stopped`);
}

// Handle process termination
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Start tracking
startUserTracking();
