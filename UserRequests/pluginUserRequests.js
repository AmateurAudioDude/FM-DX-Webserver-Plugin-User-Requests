/*
    User Requests v1.1.0 by AAD
    https://github.com/AmateurAudioDude/FM-DX-Webserver-Plugin-User-Requests
*/

'use strict';

(() => {

const pluginVersion = '1.1.0';
const pluginName = "User Requests";
const pluginHomepageUrl = "https://github.com/AmateurAudioDude/FM-DX-Webserver-Plugin-User-Requests";
const pluginUpdateUrl = "https://raw.githubusercontent.com/AmateurAudioDude/FM-DX-Webserver-Plugin-User-Requests/refs/heads/main/UserRequests/pluginUserRequests.js";
const pluginSetupOnlyNotify = true;
const CHECK_FOR_UPDATES = true;

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
    position: relative;
    top: auto;
    bottom: 8px;
    left: 20px;
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
let mySocketId = null;

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

// Connect to plugins WebSocket
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${protocol}//${window.location.host}/data_plugins`;
let pluginSocket = null;

function connectPluginSocket() {
    pluginSocket = new WebSocket(wsUrl);

    pluginSocket.onopen = () => {
        console.log(`[${pluginName}}] Connected to plugin WebSocket`);
    };

    pluginSocket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);

            if (data.type === 'updateUsers') {
                // Pass mySocketId along with users array
                updateUserList(data.users, data.mySocketId);
            }
        } catch (err) {
            console.error(`[${pluginName}}] Failed to parse plugin message`, err, event.data);
        }
    };

    pluginSocket.onclose = () => {
        console.log(`[${pluginName}}] Disconnected, reconnecting in 5 seconds...`);
        setTimeout(connectPluginSocket, 5000);
    };

    pluginSocket.onerror = (error) => {
        console.error(`[${pluginName}}] WebSocket error:`, error);
    };
}

// Send selection update to server
function sendSelectionUpdate(selection) {
    if (pluginSocket && pluginSocket.readyState === WebSocket.OPEN) {
        pluginSocket.send(JSON.stringify({
            type: 'updateSelection',
            selection: selection
        }));
    }
}

// Format duration
function formatDuration(ms) {
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `(${hours}h ${minutes}m)`;
}

// Update user list
function updateUserList(users, mySocketId) {
    userListContainer.innerHTML = '';

    // Add user-offline elements
    const maxUsers = 6;
    for (let i = 0; i < maxUsers; i++) {
        const userOfflineElement = document.createElement('div');
        userOfflineElement.classList.add('user-offline');
        userListContainer.appendChild(userOfflineElement);
    }

    // Clear existing user elements
    const existingUsers = userListContainer.querySelectorAll('.user');
    existingUsers.forEach((userElement) => userElement.remove());

    console.log(`[${pluginName}}] Processing`, users.length, 'users');

    // Replace user-offline elements with user elements based on the number of users
    users.forEach((user, index) => {
        console.log(`[${pluginName}}] Creating element for user ${index}:`, user);
        const userElement = document.createElement('div');
        userElement.classList.add('user');

        // Mark current user
        if (user.socketId === mySocketId) {
            userElement.classList.add('currentUser');
        }

        // Create user info span
        const userInfoSpan = document.createElement('span');
        userInfoSpan.classList.add('align-text-number');
        userInfoSpan.textContent = `User ${user.userNumber}`;

        const connectionDurationSpan = document.createElement('span');
        connectionDurationSpan.classList.add('connection-duration');
        connectionDurationSpan.textContent = ` ${formatDuration(user.connectionDuration)}`;

        const userSelectionSpan = document.createElement('span');
        userSelectionSpan.classList.add('align-text-selection');
        userSelectionSpan.textContent = `${user.selection}`;

        // Append elements
        userInfoSpan.appendChild(connectionDurationSpan);
        userElement.appendChild(userInfoSpan);
        userElement.appendChild(userSelectionSpan);

        // Apply event listeners only for current user
        const userRequestListening = 'Listening Only';
        const userRequestTuning = 'Tuning Mode';

        userElement.addEventListener('click', () => {
            if (user.socketId !== mySocketId) return;
            const newRequestSelection = user.selection === userRequestListening ? userRequestTuning : userRequestListening;
            sendSelectionUpdate(newRequestSelection);

            // Prevent tuning in listener only mode
            if (newRequestSelection === userRequestListening) {
                lockTuning = true;
                const elementScannerDown = document.getElementById('scanner-down');
                const elementScannerUp = document.getElementById('scanner-up');
                const elementSearchDown = document.getElementById('search-down');
                const elementSearchUp = document.getElementById('search-up');

                if (elementScannerDown && elementScannerUp) {
                    elementScannerDown.disabled = true;
                    elementScannerUp.disabled = true;
                } else if (elementSearchDown && elementSearchUp) {
                    elementSearchDown.disabled = true;
                    elementSearchUp.disabled = true;
                }

                const originalSend = socket.send;
                socket.send = function(message) {
                    if (lockTuning) return;
                    return originalSend.apply(this, arguments);
                };

                // Show lock icon
                const tunerName = document.querySelector('h1#tuner-name');
                const lockIcon = tunerName.querySelector('.user-requests-lock');
                if (lockIcon) tunerName.removeChild(lockIcon);

                const lockIconHTML = '<span></span><i style="margin-left: 16px; font-size: 18px;" class="fa-solid fa-lock pointer user-requests-lock" aria-label="Tuner is currently locked to admin."></i>';
                tunerName.insertAdjacentHTML('beforeend', lockIconHTML);
            } else {
                lockTuning = false;
                const elementScannerDown = document.getElementById('scanner-down');
                const elementScannerUp = document.getElementById('scanner-up');
                const elementSearchDown = document.getElementById('search-down');
                const elementSearchUp = document.getElementById('search-up');

                if (elementScannerDown && elementScannerUp) {
                    elementScannerDown.disabled = false;
                    elementScannerUp.disabled = false;
                } else if (elementSearchDown && elementSearchUp) {
                    elementSearchDown.disabled = false;
                    elementSearchUp.disabled = false;
                }

                // Hide lock icon
                const tunerName = document.querySelector('h1#tuner-name');
                const lockIcon = tunerName.querySelector('.user-requests-lock');
                if (lockIcon) tunerName.removeChild(lockIcon);
            }
        });

        // Replace the first user-offline element with the new user element
        const userOfflineElement = userListContainer.querySelector('.user-offline');
        if (userOfflineElement) {
            console.log(`[${pluginName}}] Replacing user-offline with user element`);
            userOfflineElement.replaceWith(userElement);
        } else {
            console.log(`[${pluginName}}] Appending user element (no user-offline found)`);
            userListContainer.appendChild(userElement);
        }
    });
}

// Insert userListContainer below #toast-container
const usersOnlineContainer = document.querySelector('#toast-container');
if (usersOnlineContainer) {
    usersOnlineContainer.parentNode.insertBefore(pluginUserRequestsDiv, usersOnlineContainer.nextSibling);
}

// Start WebSocket connection
connectPluginSocket();
}

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
    setInterval(() => {
        copyBackgroundColor();
    }, 200);

    setInterval(() => {
        copyBackgroundColor();
    }, 2000);
});

// Run the script
runScriptUserReports();

// Function for update notification in /setup
if (window.location.pathname === '/setup') {
    // Function for update notification in /setup
    function checkUpdate(e,n,t,o){if(e&&"/setup"!==location.pathname)return;let i="undefined"!=typeof pluginVersion?pluginVersion:"undefined"!=typeof plugin_version?plugin_version:"undefined"!=typeof PLUGIN_VERSION?PLUGIN_VERSION:"Unknown";async function r(){try{let e=await fetch(o);if(!e.ok)throw new Error("["+n+"] update check HTTP error! status: "+e.status);let t=(await e.text()).split("\n"),r;if(t.length>2){let e=t.find(e=>e.includes("const pluginVersion =")||e.includes("const plugin_version =")||e.includes("const PLUGIN_VERSION ="));if(e){let n=e.match(/const\s+(?:pluginVersion|plugin_version|PLUGIN_VERSION)\s*=\s*['"]([^'"]+)['"]/);n&&(r=n[1])}}return r||(r=/^\d/.test(t[0].trim())?t[0].trim():"Unknown"),r}catch(e){return console.error("["+n+"] error fetching file:",e),null}}r().then(e=>{e&&e!==i&&(console.log("["+n+"] There is a new version of this plugin available"),function(e,n,t,o){if("/setup"===location.pathname){let i=document.getElementById("plugin-settings");if(i){let r=i.textContent.trim(),l=`<a href="${o}" target="_blank">[${t}] Update available: ${e} --> ${n}</a><br>`;i.innerHTML="No plugin settings are available."===r?l:i.innerHTML+" "+l}let a=document.querySelector(".wrapper-outer #navigation .sidenav-content .fa-puzzle-piece")||document.querySelector(".wrapper-outer .sidenav-content")||document.querySelector(".sidenav-content"),d=document.createElement("span");d.style.cssText="display:block;width:12px;height:12px;border-radius:50%;background:#FE0830;margin-left:82px;margin-top:-12px",a.appendChild(d)}}(i,e,n,t))})}CHECK_FOR_UPDATES&&checkUpdate(pluginSetupOnlyNotify,pluginName,pluginHomepageUrl,pluginUpdateUrl);
}

})();
