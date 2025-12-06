/*
    User Requests by AAD
*/

'use strict';

(() => {

localStorage.getItem('userReportsHidden') && localStorage.removeItem('userReportsHidden');

const pluginName = "User Requests";

function runScriptUserReports() {
    // Create style element and apply CSS
    document.head.appendChild(Object.assign(document.createElement('style'), {
      textContent: `
        #user-listener-requests,
        #user-listener-container {
          border: 0;
          color: var(--color-text);
          background: var(--color-1-transparent);
          border-radius: 14px;
          padding: 12px 0 10px 0;
          white-space: nowrap;
          overflow: hidden;
          text-align: left;
          line-height: 14px;
          font-size: 13px !important;
          width: 100px !important;
          min-height: 64px !important;
          max-height: 520px;
          opacity: 0.8;
        }

        .user {
          padding: 6px 4px 8px 4px !important;
          margin: 0 auto;
          user-select: none;
          cursor: default;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
        }

        .currentUser {
          background-color: var(--color-2);
          cursor: pointer !important;
          margin: 0 auto;
        }

        .align-text-number,
        .align-text-selection {
          text-align: center;
          display: block;
        }

        .align-text-number {
          opacity: 0.8;
        }

        .align-text-selection {
          opacity: 0.4;
        }

        .user:nth-child(n+12) {
          display: none;
        }

        @media (orientation: portrait) {
          #user-listener-requests,
          #user-listener-container {
            font-size: 14px !important;
            width: 140px !important;
            line-height: 18px;
            padding: 14px 8px 10px 8px;
            border-radius: 15px;
          }

          .user {
            padding: 4px 10px 8px 10px;
            border-radius: 8px;
          }

          #mobileTray {
            z-index: 8;
          }

          #plugin-user-requests {
            padding-top: 0;
            padding-bottom: 90px;
          }
        }

        @media (min-width: 1180px) {
          #user-listener-requests {
            position: absolute;
            top: 20px;
            right: 30px;
            z-index: 10;
          }
        }

        @media (min-width: 1180px) and (max-width: 1480px) {
          #user-listener-requests,
          #user-listener-container {
            /* Nowhere it can go */
            display: none;
          }
        }

        @media (max-width: 1480px) {
          #user-listener-requests,
          #user-listener-container {
            position: relative;
            top: auto;
            bottom: 20px;
            left: 20px;
          }
        }

        @media (orientation: landscape) and (min-width: 550px) and (max-width: 1180px) {
          #user-listener-requests,
          #user-listener-container {
            width: auto !important;
            margin: 0 30px;
            font-size: 16px;
            left: 0;
            right: 0;
          }

          @media (max-height: 532px) {
            #user-listener-requests,
            #user-listener-container {
              top: -6px;
              transform: scale(0.75);
            }
          }
        }

        @media (max-width: 960px) {
          #user-listener-requests,
          #user-listener-container {
            width: auto !important;
            margin: 0 30px;
            font-size: 16px;
            left: 0;
            right: 0;
          }
        }
      `
    }));

    let lockTuning = false;
    let myConnectionId = null; // Unique identifier for browser tab
    let myOdbc = null; // Server-assigned identifier
    let currentSelection = 'Tuning Mode';
    let pluginSocket = null;
    let heartbeatInterval = null;
    let lastUsers = [];

    // Generate unique connection ID per tab and store in sessionStorage
    function getConnectionId() {
        let id = sessionStorage.getItem('userRequests_connectionId');
        if (!id) {
            id = 'conn_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
            sessionStorage.setItem('userRequests_connectionId', id);
        }
        return id;
    }
    myConnectionId = getConnectionId();

    // Create the plugin-user-requests div
    const pluginUserRequestsDiv = document.createElement('div');
    pluginUserRequestsDiv.id = 'plugin-user-requests';

    // Create a new div for the user list
    const userListContainer = document.createElement('div');

    userListContainer.id = 'user-listener-requests';

    // Append user-listener-requests to plugin-user-requests
    if (document.getElementById('rt-container')) {
      pluginUserRequestsDiv.appendChild(userListContainer);
    }

    // Function to format duration in HH:MM
    function formatDuration(duration) {
      const hours = Math.floor(duration / 3600000);
      const minutes = Math.floor((duration % 3600000) / 60000);
      return `${hours}h ${minutes}m`;
    }

    // Function to update the user list UI
    function updateUserList(users) {
      lastUsers = users;
      userListContainer.innerHTML = '';

      // Find our entry by connectionId
      const myEntry = users.find(u => u.connectionId === myConnectionId);
      if (myEntry) {
        myOdbc = myEntry.odbc;
        // Sync local selection state with server
        if (currentSelection !== myEntry.selection) {
          currentSelection = myEntry.selection;
        }
      }

      users.forEach((user) => {
        const userElement = document.createElement('div');
        userElement.classList.add('user');

        // Check if this is the current user by connectionId
        const isCurrentUser = user.connectionId === myConnectionId;
        if (isCurrentUser) {
          userElement.classList.add('currentUser');
        }

        // Create span for user number and connection duration
        const userInfoSpan = document.createElement('span');
        userInfoSpan.classList.add('align-text-number');
        userInfoSpan.textContent = `User ${user.userNumber}`;

        const connectionDurationSpan = document.createElement('span');
        connectionDurationSpan.classList.add('connection-duration');
        connectionDurationSpan.textContent = ` (${formatDuration(user.connectionDuration)})`;

        const userSelectionSpan = document.createElement('span');
        userSelectionSpan.classList.add('align-text-selection');
        userSelectionSpan.textContent = `${user.selection}`;

        // Append spans
        userInfoSpan.appendChild(connectionDurationSpan);
        userElement.appendChild(userInfoSpan);
        userElement.appendChild(userSelectionSpan);

        // Apply click listener only for current user
        if (isCurrentUser) {
          userElement.addEventListener('click', () => {
            const userRequestListening = 'Listening Only';
            const userRequestTuning = 'Tuning Mode';
            const newSelection = currentSelection === userRequestListening ? userRequestTuning : userRequestListening;
            currentSelection = newSelection;

            // Send selection update using queued WebSocket sender
            sendWS({
              type: 'userRequests',
              action: 'updateSelection',
              connectionId: myConnectionId,
              selection: newSelection
            });

            // Handle local tuning lock
            if (newSelection === userRequestListening) {
              lockTuning = true;
              toggleTuningControls(true);
              showLockIcon();
            } else {
              lockTuning = false;
              toggleTuningControls(false);
              hideLockIcon();
            }
          });
        }

        userListContainer.appendChild(userElement);
      });
    }

    // Toggle tuning controls
    function toggleTuningControls(disabled) {
      const controls = ['scanner-down', 'scanner-up', 'search-down', 'search-up'];
      controls.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = disabled;
      });

      // Override socket.send if locking
      if (disabled && window.socket && !window.socket._userRequestsOverridden) {
        const originalSend = window.socket.send.bind(window.socket);
        window.socket.send = function(message) {
          if (lockTuning) return;
          return originalSend(message);
        };
        window.socket._userRequestsOverridden = true;
      }
    }

    // Show lock icon
    function showLockIcon() {
      const tunerName = document.querySelector('h1#tuner-name');
      if (!tunerName) return;
      hideLockIcon(); // Remove existing first
      const lockIconHTML = '<span></span><i style="margin-left: 16px; font-size: 18px;" class="fa-solid fa-lock pointer user-requests-lock" aria-label="Tuner is currently locked."></i>';
      tunerName.insertAdjacentHTML('beforeend', lockIconHTML);
    }

    // Hide lock icon
    function hideLockIcon() {
      const tunerName = document.querySelector('h1#tuner-name');
      if (!tunerName) return;
      const lockIcon = tunerName.querySelector('.user-requests-lock');
      if (lockIcon) tunerName.removeChild(lockIcon);
    }

    // Send heartbeat to register/maintain connection
    function sendHeartbeat() {
      if (pluginSocket && pluginSocket.readyState === WebSocket.OPEN) {
        pluginSocket.send(JSON.stringify({
          type: 'userRequests',
          action: 'heartbeat',
          connectionId: myConnectionId,
          odbc: myOdbc
        }));
      }
    }

    // Register with server via HTTP
    let isRegistered = false;

    function registerWithServer() {
      return fetch('/user-requests-register', {
        method: 'GET',
        headers: {
          'X-Plugin-Name': 'UserRequests',
          'X-Connection-Id': myConnectionId
        }
      })
      .then(response => response.json())
      .then(data => {
        if (data.registered) {
          isRegistered = true;
          if (data.bypassed) {
            console.log(`[${pluginName}] Registered as bypassed (local) connection`);
          } else {
            console.log(`[${pluginName}] Registered with server`);
          }
        }
      })
      .catch(error => {
        console.error(`[${pluginName}] Registration failed:`, error);
      });
    }

    // Connect to the /data_plugins WebSocket
    // Global helpers
    let sendQueue = [];
    let registrationPromise = null;

    // Wrap all websocket sends through this:
    function sendWS(message) {
      // Only send once socket is open AND registration completed
      if (
        pluginSocket &&
        pluginSocket.readyState === WebSocket.OPEN &&
        isRegistered
      ) {
        pluginSocket.send(JSON.stringify(message));
      } else {
        // Queue it for later
        sendQueue.push(message);
      }
    }

    function flushQueue() {
      if (
        pluginSocket &&
        pluginSocket.readyState === WebSocket.OPEN &&
        isRegistered
      ) {
        sendQueue.forEach(msg => {
          pluginSocket.send(JSON.stringify(msg));
        });
        sendQueue = [];
      }
    }

    function connectPluginSocket() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/data_plugins`;

      pluginSocket = new WebSocket(wsUrl);

      pluginSocket.onopen = () => {
        console.log(`[${pluginName}] Connected to data_plugins WebSocket`);

        // Mark registration as pending
        isRegistered = false;

        // Start registration & store the promise
        registrationPromise = registerWithServer()
          .then(() => {
            isRegistered = true;

            // Flush any queued messages that tried to send before ready
            flushQueue();

            // Start heartbeat after registration
            sendHeartbeat();
          })
          .catch(err => {
            console.error(`[${pluginName}] Registration failed:`, err);
          });
      };

      pluginSocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'userRequests' && data.action === 'updateUsers') {
            updateUserList(data.users || []);
          }
        } catch (e) {
          // Ignore non-JSON messages
        }
      };

      pluginSocket.onclose = () => {
        setTimeout(() => {
            console.log(`[${pluginName}] Disconnected from data_plugins WebSocket, reconnecting...`);
        }, 800);
        // Cleanup
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
          heartbeatInterval = null;
        }

        isRegistered = false;

        // Attempt reconnect
        setTimeout(connectPluginSocket, 3000);
      };

      pluginSocket.onerror = (error) => {
        console.error(`[${pluginName}] WebSocket error:`, error);
      };
    }

    // Start sending periodic heartbeats
    function startHeartbeat() {
      // Send heartbeat every interval to maintain connection
      heartbeatInterval = setInterval(() => {
        sendHeartbeat();
      }, 5000);
    }

    // Insert the container into the page
    const usersOnlineContainer = document.querySelector('#toast-container');
    if (usersOnlineContainer) {
      usersOnlineContainer.parentNode.insertBefore(pluginUserRequestsDiv, usersOnlineContainer.nextSibling);
    }

    // Initialise
    connectPluginSocket();
    startHeartbeat();

} // End of function runScriptUserReports

// Function to copy background colour
function copyBackgroundColor() {
    const wrapperOuter = document.querySelector('.wrapper-outer');
    const pluginUserRequests = document.getElementById('plugin-user-requests');

    if (wrapperOuter && pluginUserRequests) {
        const backgroundColor = getComputedStyle(wrapperOuter).backgroundColor;
        pluginUserRequests.style.backgroundColor = backgroundColor;
    }
}

const observer = new MutationObserver(copyBackgroundColor);

const wrapperOuter = document.querySelector('.wrapper-outer');
if (wrapperOuter) {
    observer.observe(wrapperOuter, {
        attributes: true,
        attributeFilter: ['style'],
    });
}

copyBackgroundColor();

window.addEventListener('DOMContentLoaded', (event) => {
    const intervalId = setInterval(() => {
        copyBackgroundColor();
    }, 1000);

    setTimeout(() => {
        clearInterval(intervalId);
    }, 10000);
});

window.addEventListener('DOMContentLoaded', (event) => {
    setTimeout(() => {
        runScriptUserReports();
    }, 400);
});

})();
