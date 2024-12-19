/*
    User Requests by AAD
*/

(() => {

//////////////////////////////////////////////////

let useExistingContainer = true;
let useExistingContainerAsDefault = true;
let useSmallContainer = true;
let optionHideUserReports = false;

//////////////////////////////////////////////////

if (useExistingContainer && localStorage.getItem("userReportsHidden") === null) localStorage.setItem('userReportsHidden', 'true');

function runScriptUserReports() {
// Create style element and apply CSS
if (useSmallContainer && !useExistingContainer) {
const styleSmallContainer = document.createElement('style');
styleSmallContainer.textContent = `
  @media (orientation: landscape) {
    #user-listener-requests,
    #user-listener-container {
      border: 0;
      color: var(--color-text);
      font-size: 13px !important;
      width: 100px !important;
      min-height: 84px !important;
      max-height: 520px;
      line-height: 14px !important;
      text-align: left;
      background: var(--color-1-transparent) !important;
      border-radius: 14px !important;
      padding: 14px 0px 10px 0px !important;
      white-space: nowrap;
      overflow: hidden;
    }
    .user {
      padding: 6px 4px 8px 4px !important;
      cursor: default;
      user-select: none;
      border-radius: 0px !important;
      margin: 0 auto;
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
    }
   .users-online-top {
      padding-bottom: 4px !important;
      margin-top: -6px !important;
      padding-left: 14px !important;
      color: var(--color-4);
      text-align: center;
      font-size: 18px;
      font-weight: 700;
      display: inline-block;
      vertical-align: middle;
      margin-bottom: 6px !important;
      display: flex;
      justify-content: center;
      align-items: center;
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
   }
   .users-online-icon-top {
      margin-left: 2px !important;
      color: var(--color-3);
      opacity: 0;
      text-align: center;
      font-size: 12px !important;
      display: inline-block;
      vertical-align: middle;
      margin-top: -10px !important;
      cursor: pointer;
      transition: 1s;
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
   }
   .currentUser {
     background-color: var(--color-3);
     cursor: pointer !important;
     margin: 0 auto;
   }
  }
`;
document.head.appendChild(styleSmallContainer);
}

const style = document.createElement('style');
style.textContent = `
  #user-listener-requests,
  #user-listener-container {
    border: 0;
    color: var(--color-text);
    font-size: 14px;
    width: 140px;
    min-height: 100px;
    max-height: 520px;
    line-height: 18px;
    text-align: left;
    background: var(--color-1-transparent);
    border-radius: 15px;
    padding: 14px 8px 10px 8px;
    white-space: nowrap;
    overflow: hidden;
  }
  .user {
    padding: 4px 10px 8px 10px;
    cursor: default;
    user-select: none;
    border-radius: 8px;
    margin: 0 auto;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
  }
  .currentUser {
    background-color: var(--color-3);
    cursor: pointer !important;
    margin: 0 auto;
  }
  .align-text-number {
    text-align: center;
    opacity: .5;
    display: block;
  }
  .align-text-selection {
    text-align: center;
    opacity: 1;
    display: block;
  }
 .users-online-top {
    padding-bottom: 4px;
    padding-left: 22px;
    color: var(--color-4);
    text-align: center;
    font-size: 18px;
    font-weight: 700;
    display: inline-block;
    vertical-align: middle;
    margin-bottom: 6px;
    display: flex;
    justify-content: center;
    align-items: center;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
 }

 #user-listener-requests:hover .users-online-icon-top {
   opacity: 1;
 }
 .users-online-icon-top {
    margin-left: 10px;
    color: var(--color-3);
    opacity: 0;
    text-align: center;
    font-size: 14px;
    display: inline-block;
    vertical-align: middle;
    margin-top: -18px;
    cursor: pointer;
    transition: 1s;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
 }
 .users-online-icon-top:hover {
    color: var(--color-5);
    opacity: 1;
    transition: .5s ease;
 }
 .tooltiptext-user-requests {
    transform: translateX(-32%);
    position: absolute;
    background-color: var(--color-3);
    color: var(--color-text);
    text-align: center;
    font-size: 14px;
    border-radius: 30px;
    padding: 5px 25px;
    z-index: 1000;
    opacity: 0;
    transition: opacity 0.3s ease-in-out;
 }
  @media (min-width: 1180px) {
    #user-listener-requests {
        position: absolute;
        top: 170px;
        right: 18px;
    }
  }
  @media (max-width: 1480px) { /* 1180px */
    #user-listener-requests,
    #user-listener-container {
        position: relative;
        top: auto;
        bottom: 44px;
        left: 20px;
    }
  }
  @media (min-width: 1180px) and (max-width: 1480px) {
    #user-listener-requests,
    #user-listener-container {
        position: relative;
        top: auto;
        bottom: 8px;
        left: 20px;
    }
  }
  @media (max-width: 768px) {
    #user-listener-requests,
    #user-listener-container {
        width: auto;
        left: 0;
        right: 0;
        margin-left: 30px;
        margin-right: 30px;
        font-size: 16px;
    }
  }
  .user:nth-child(n+12) {
    display: none;
  }
`;
document.head.appendChild(style);

let lockTuning = false;

// Create the plugin-user-requests div
const pluginUserRequestsDiv = document.createElement('div');
pluginUserRequestsDiv.id = 'plugin-user-requests';

// Create a new div for the user list
const userListContainer = document.createElement('div');

if (!useExistingContainer) {
    userListContainer.id = 'user-listener-requests';
} else {
    userListContainer.id = 'user-listener-container';
}

// Append user-listener-requests to plugin-user-requests
if (document.getElementById('rt-container')) {
  pluginUserRequestsDiv.appendChild(userListContainer);
}

// Load Socket.IO library
const script = document.createElement('script');
script.src = '/socket.io/socket.io.js';
script.onload = function () {
  // Socket.IO connection and event handling
  const userSocket = io();

  userSocket.on('updateUsers', (users) => {
    userListContainer.innerHTML = '';
    if (!useExistingContainer) {
        userListContainer.innerHTML = '<span class="users-online-top">ONLINE<i class="users-online-icon-top fa-solid fa-circle-question tooltip-user-requests" data-tooltip="Click for more details."></i></span>';
    }
    initUserRequestsTooltips();

    // Add user-offline elements
    const maxUsers = 6;

    for (let i = 0; i < maxUsers; i++) {
      const userOfflineElement = document.createElement('div');
      userOfflineElement.classList.add('user-offline');
      userListContainer.appendChild(userOfflineElement);
    }

    // Function to update the user list
    function updateUserList(users) {
      // Clear existing user elements
      const existingUsers = userListContainer.querySelectorAll('.user');
      existingUsers.forEach((userElement) => userElement.remove());

      // Replace user-offline elements with user elements based on the number of users
      users.forEach((user) => {
        const userElement = document.createElement('div');
        userElement.classList.add('user');

        if (user.socketId === userSocket.id) {
          userElement.classList.add('currentUser'); // Apply different style to current user
        }

        // Create a single span for user number and connection duration
        const userInfoSpan = document.createElement('span');
        userInfoSpan.classList.add('align-text-number');
        userInfoSpan.textContent = `User ${user.userNumber}`;

        const connectionDurationSpan = document.createElement('span');
        connectionDurationSpan.classList.add('connection-duration');
        connectionDurationSpan.textContent = ` (${formatDuration(user.connectionDuration)})`;

        const userSelectionSpan = document.createElement('span');
        userSelectionSpan.classList.add('align-text-selection');
        userSelectionSpan.textContent = `${user.selection}`;

        // Append the combined user info span and the user selection span
        userInfoSpan.appendChild(connectionDurationSpan); // Append connection duration to user info span
        userElement.appendChild(userInfoSpan);
        userElement.appendChild(userSelectionSpan);

        // Apply event listeners only for elements with the class 'user currentUser'
        const userRequestListening = 'Listening Only';
        const userRequestTuning = 'Tuning Mode';
        if (userElement.classList.contains('currentUser')) {
          userElement.addEventListener('click', () => {
            const newRequestSelection = user.selection === userRequestListening ? userRequestTuning : userRequestListening;
            userSocket.emit('updateSelection', { selection: newRequestSelection });

            // Prevent tuning in listener only mode
            if (newRequestSelection === userRequestListening) {
              lockTuning = true;
              // Select the elements with IDs 'scanner-down' and 'scanner-up'
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
              // 'freq-down' and 'freq-up' buttons
              socket.send = function (message) {
                if (lockTuning) {
                  return;
                }
                return originalSend.apply(this, arguments);
              };
              // Hide icon
              const tunerName = document.querySelector('h1#tuner-name');
              const lockIcon = tunerName.querySelector('.user-requests-lock');
              if (lockIcon) {
                  tunerName.removeChild(lockIcon);
              }
              // Show icon
              const lockIconHTML = '<span> </span><i class="fa-solid fa-lock pointer user-requests-lock" aria-label="Tuner is currently locked to admin."></i>';
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
              // Hide icon
              const tunerName = document.querySelector('h1#tuner-name');
              const lockIcon = tunerName.querySelector('.user-requests-lock');
              if (lockIcon) {
                  tunerName.removeChild(lockIcon);
              }
            }
          });
        }

        // Replace the first user-offline element with the new user element
        const userOfflineElement = userListContainer.querySelector('.user-offline');
        if (userOfflineElement) {
          userOfflineElement.replaceWith(userElement);
        } else {
          userListContainer.appendChild(userElement);
        }
      });
    }
    updateUserList(users);
    // Alert popup
    document.querySelector(".users-online-icon-top").addEventListener('click', function(event) {
        if (typeof pluginThemedPopup !== 'undefined') {
            alert(`<div class="popup-content" style="text-align: left"><center><strong>ONLINE USERS</strong>\n<i>Information about current users online and current tuning setting.</i></center>\n<strong>&nbsp;&nbsp;&nbsp;Tuning Mode</strong>: Click to set and alert other users that you wish to change frequency.\n<strong>Listening Only</strong>: Click to set and inform others you don't mind if they change frequency.\n\n</div>`, 'Close');
        } else {
            alert(`\t\t\t\t\t Online Users \t\t\t\t\t\n\nInformation about current users online and current tuning setting.\n\n  Tuning Mode: Set to alert other users that you wish to change frequency.\n\nListening Only: Set to inform others you don't mind if they change frequency.`);
        }
    });
  });

  // Insert userListContainer below #users-online-container or below #wrapper-outer for v1.2.4+
  if (!useExistingContainer) {
      const usersOnlineContainer = document.getElementById('wrapper-outer');
      if (usersOnlineContainer) {
        usersOnlineContainer.parentNode.insertBefore(pluginUserRequestsDiv, usersOnlineContainer.nextSibling); // Other parent is userListContainer
      }
  } else {
      const newContainer = document.getElementById('users-online-code-container');
      newContainer.appendChild(userListContainer); // Other append is pluginUserRequestsDiv
  }
};
document.body.appendChild(script);

// Force new container for mobile portrait
if (window.innerWidth < 480) {
    useExistingContainer = false;
}

if (useExistingContainer) { reuseContainer(); }

function reuseContainer() {
    style.textContent = `
      #user-listener-container {
        height: 0;
        width: 100%;
        background: transparent;
        border: 0;
        color: var(--color-text);
        font-size: 12px;
        line-height: 12px;
        text-align: left;
        border-radius: 18px;
        padding: 0;
        white-space: nowrap;
        position: absolute;
        top: 32%;
        left: 13px;
        display: flex;
        flex-wrap: wrap;
      }
      .currentUser {
        background-color: var(--color-3);
        cursor: pointer !important;
      }
      .align-text-number {
        text-align: center;
        opacity: .5;
        display: block;
        font-weight: 600;
      }
      .align-text-selection {
        text-align: center;
        opacity: 1;
        display: block;
      }
     .users-online-top {
        padding-left: 22px;
        color: var(--color-4);
        text-align: center;
        font-weight: 700;
        display: inline-block;
        vertical-align: middle;
        margin-bottom: 6px;
        display: flex;
        justify-content: center;
        align-items: center;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
     }
     #users-online-code-container:hover .users-online-icon-top {
       opacity: 1;
     }
     .users-online-icon-top {
        margin-left: 10px;
        color: var(--color-3);
        opacity: 0;
        text-align: center;
        font-size: 14px;
        display: inline-block;
        vertical-align: middle;
        margin-top: -12px;
        cursor: pointer;
        transition: 1s;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
     }
     .users-online-icon-top:hover {
        color: var(--color-5);
        opacity: 1;
        transition: .5s ease;
     }
     .tooltiptext-user-requests {
        transform: translateX(-32%);
        position: absolute;
        background-color: var(--color-3);
        color: var(--color-text);
        text-align: center;
        font-size: 14px;
        border-radius: 30px;
        padding: 5px 25px;
        z-index: 1000;
        opacity: 0;
        transition: opacity 0.3s ease-in-out;
     }

    #users-online-code-container {
        position: relative;
        overflow: hidden;
    }
    .user,
    .user-offline {
        padding: 2px;
        cursor: default;
        user-select: none;
        border-radius: 0px;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;

        width: calc(33% - 10px);
        height: 32px;
        margin-left: 2px;
        margin-bottom: 2px;
        box-sizing: border-box;
        border: 1px solid var(--color-2)
    }

    .user:not(.currentUser) {
        background: var(--color-2);
        filter: contrast(1.1) brightness(.9);
    }

    .user-offline:not(.currentUser) {
        background: var(--color-2);
        filter: contrast(1.1) brightness(.8);
        opacity: .48;
    }

    #data-pi {
        margin-bottom: 0 !important;
    }

    #ps-container #data-ps {
        display: flex !important;
        justify-content: center !important;
        align-items: center !important;
        font-size: 250% !important;
        margin-top: -4px !important;
        padding: 0 10px 0 10px !important;
    }

    @media (min-height: 861px) {
        #ps-container #data-ps {
            font-size: 275% !important;
            margin-top: -15px !important;
        }
        #user-listener-container {
          top: 35%; /* Override when height is beyond 860px */
        }
    }

    #ps-container #data-pi {
        display: block !important;
        justify-content: flex-start !important;
        align-items: flex-start !important;
    }

    #ps-container {
        padding-top: 4px !important;
    }

    .user:nth-child(n+7),
    .user-offline:nth-child(n+7) {
        display: none;
    }

    :root {
        --radius-value: 8px;
    }

    .user:nth-child(1),
    .user-offline:nth-child(1) {
        border-top-left-radius: var(--radius-value);
    }
    .user:nth-child(3),
    .user-offline:nth-child(3) {
        border-top-right-radius: var(--radius-value);
    }
    .user:nth-child(4),
    .user-offline:nth-child(4) {
        border-bottom-left-radius: var(--radius-value);
    }
    .user:nth-child(6),
    .user-offline:nth-child(6) {
        border-bottom-right-radius: var(--radius-value);
    }

    #user-listener-container .align-text-selection {
        white-space: nowrap;
        overflow: hidden;
        padding: 1px;
    }

    .connection-duration {
        color: #90EFFE;
        font-weight: 400;
    }

    #user-listener-container .align-text-number,
    #user-listener-container .align-text-selection {
        white-space: nowrap;
        overflow: hidden;
    }
    @media (max-width: 1100px) {
        #user-listener-container .align-text-number,
        #user-listener-container .align-text-selection {
            font-size: 10px;
            white-space: nowrap;
            overflow: hidden;
        }
    }
    @media (max-width: 980px) {
        #user-listener-container .align-text-number,
        #user-listener-container .align-text-selection {
            font-size: 9px;
        }
    }
    @media (max-width: 780px) {
        .connection-duration {
            display: none;
        }
    }
    `;

    // Replace #pi-code-container with #users-online-code-container
    const piCodeContainer = document.getElementById('pi-code-container');

    // Hide piCodeContainer if it exists
    if (piCodeContainer) {
        piCodeContainer.style.display = 'none';
    }

    if (piCodeContainer) {
        // Create a new div with id 'users-online-code-container' and class 'panel-33'
        usersOnlineCodeContainer = document.createElement('div'); // Previously a const
        usersOnlineCodeContainer.id = 'users-online-code-container';
        usersOnlineCodeContainer.className = 'panel-33';

        // Create an h2 element
        const h2Element = document.createElement('h2');
        h2Element.innerHTML = '<span class="users-online-top">ONLINE USERS<i class="users-online-icon-top fa-solid fa-circle-question tooltip-user-requests" data-tooltip="Click for more details."></i></span>';

        // Append the h2 element to users-online-code-container
        usersOnlineCodeContainer.appendChild(h2Element);

        // Insert users-online-code-container before piCodeContainer
        if (piCodeContainer.parentNode) {
            piCodeContainer.parentNode.insertBefore(usersOnlineCodeContainer, piCodeContainer);
        }
    }

    function waitForDataPiAndMove() {
      // Get references to the elements
      var dataPi = document.getElementById('data-pi');
      var dataPs = document.getElementById('data-ps');
      var psContainer = document.getElementById('ps-container');

      // Set psContainer className
      psContainer.className = "panel-100 m-0 hover-brighten tooltip";

      // Function to move #data-pi and add class
      function moveDataPi() {
        if (dataPi) {
          // Move #data-pi above #data-ps
          psContainer.insertBefore(dataPi, dataPs);

          console.log("Moved #data-pi successfully.");

          // Add other style changes as needed
        } else {
          console.log("#data-pi element not found.");
        }
      }

      // Use MutationObserver to monitor changes in psContainer
      var observer = new MutationObserver(function(mutationsList, observer) {
        for (var mutation of mutationsList) {
          if (mutation.type === 'childList' && mutation.target.id === 'data-pi') {
            moveDataPi();
            observer.disconnect();
            if (piCodeContainer.parentNode) { piCodeContainer.parentNode.removeChild(piCodeContainer); }
            break;
          }
        }
      });

      // Start observing changes in psContainer
      observer.observe(psContainer, { childList: true, subtree: true });

      // Initial check to move #data-pi if already present
      moveDataPi();
    }

    // Call the function to start waiting for #data-pi and then move it
    waitForDataPiAndMove();

    style.textContent += `
    #data-pi {
      font-size: 18px;
      font-weight: 700;
      color: var(--color-4);
      margin-top: 4px;
    }

    @media (min-height: 861px) {
      #data-pi {
        font-size: 24px;
        margin-top: 2px;
      }
    }
    `;
}

// Function to format duration in HH:MM
function formatDuration(duration) {
  const hours = Math.floor(duration / 3600000);
  const minutes = Math.floor((duration % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
}

// Tooltip
function initUserRequestsTooltips() {
    $('.tooltip-user-requests').hover(function(e){
        var tooltipText = $(this).data('tooltip');
        // Add a delay of 500 milliseconds before creating and appending the tooltip
        $(this).data('timeout', setTimeout(() => {
            var tooltip = $('<div class="tooltiptext-user-requests"></div>').html(tooltipText);
            if ($('.tooltiptext-user-requests').length === 0) { $('body').append(tooltip); } // Custom code

            var posX = e.pageX;
            var posY = e.pageY;

            var tooltipWidth = tooltip.outerWidth();
            var tooltipHeight = tooltip.outerHeight();
            posX -= tooltipWidth / 2;
            posY -= tooltipHeight + 10;
            tooltip.css({ top: posY, left: posX, opacity: .99 }); // Set opacity to 1
            if ((/Mobi|Android|iPhone|iPad|iPod|Opera Mini/i.test(navigator.userAgent)) && ('ontouchstart' in window || navigator.maxTouchPoints)) {
                setTimeout(() => { $('.tooltiptext').remove(); }, 10000);
                document.addEventListener('touchstart', function() { setTimeout(() => { $('.tooltiptext').remove(); }, 500); });
            }
        }, 500));
    }, function() {
        // Clear the timeout if the mouse leaves before the delay completes
        clearTimeout($(this).data('timeout'));
        $('.tooltiptext-user-requests').remove();
        setTimeout(() => { $('.tooltiptext-user-requests').remove(); }, 500); // Custom code
    }).mousemove(function(e){
        var tooltipWidth = $('.tooltiptext-user-requests').outerWidth();
        var tooltipHeight = $('.tooltiptext-user-requests').outerHeight();
        var posX = e.pageX - tooltipWidth / 2;
        var posY = e.pageY - tooltipHeight - 10;

        $('.tooltiptext-user-requests').css({ top: posY, left: posX });
    });
}

} // End of function runScriptUserReports

// Function to copy background colour for plugin outside #wrapper-outer
function copyBackgroundColorUserRequests(sourceIdUserRequests, targetIdsUserRequests) {
    const sourceElementUserRequests = document.getElementById(sourceIdUserRequests);
    if (sourceElementUserRequests) {
        const sourceStyleUserRequests = window.getComputedStyle(sourceElementUserRequests);
        const backgroundColorUserRequests = sourceStyleUserRequests.backgroundColor;

        if (backgroundColorUserRequests.includes('rgba')) {
            targetIdsUserRequests.forEach(targetIdUserRequests => {
                const targetElementUserRequests = document.getElementById(targetIdUserRequests);
                if (targetElementUserRequests) {
                    targetElementUserRequests.style.backgroundColor = backgroundColorUserRequests;
                }
            });

            // Stop checking once rgba background colour is detected and applied
            clearInterval(checkIntervalRgbaUserRequests);
        }
    }
}

// Set a timer to stop checking
setTimeout(() => {
    clearInterval(checkIntervalRgbaUserRequests);
}, 30000);

// Once the DOM is fully loaded, start checking the background colour immediately
window.addEventListener('DOMContentLoaded', (event) => {
    checkIntervalRgbaUserRequests = setInterval(() => {
        copyBackgroundColorUserRequests('wrapper-outer', ['plugin-user-requests']);
    }, 125);

    checkIntervalRgbaUserRequests = setInterval(() => {
        copyBackgroundColorUserRequests('wrapper-outer', ['plugin-user-requests']);
    }, 800);
    // Initial check in case the background colour is already rgba when DOM is loaded
    copyBackgroundColorUserRequests('wrapper-outer', ['plugin-user-requests']);
});

let runScriptUserReportsFirstRun;

// Function to toggle the visibility of User Reports
function toggleUserReportsContainer() {
  // Check the localStorage value
  const isHidden = JSON.parse(localStorage.getItem(DISPLAY_KEY_UserReports)) == true;
  if (isHidden) {
    useExistingContainer = false;
    //console.log("User Reports Inactive");
  } else {
    useExistingContainer = true;
    //console.log("User Reports Active");
  }
if (!runScriptUserReportsFirstRun) { runScriptUserReports(); }
runScriptUserReportsFirstRun = true;
}

// #################### SIDE BAR MENU SETTINGS #################### //

const DISPLAY_KEY_UserReports = 'userReportsHidden';

// ********** Display additional options in side menu **********
function AdditionalCheckboxesUserReports() {
  // Insert HTML after second element with class 'form-group checkbox'
  function insertHtmlAfterSecondCheckbox() {
    // Select all elements with class 'form-group checkbox'
    const checkboxes = document.querySelectorAll('.modal-panel-content .form-group.checkbox');
    
    // Check if there are at least two such elements
    if (checkboxes.length > 0) {
      // Create new HTML element
      const newDiv = document.createElement('div');
      newDiv.className = 'form-group checkbox';
      newDiv.innerHTML = `
                <input type="checkbox" tabindex="0" id="hide-user-reports" aria-label="Hide user reports">
                <label for="hide-user-reports" class="tooltip" data-tooltip="Enable to create a separate container on the right of screen to display online users.<br><strong>Requires a page refresh.</strong>"><i class="fa-solid fa-toggle-off m-right-10"></i> Move Online Users</label>
            `;
      
      // Insert new element after last
      const lastCheckbox = checkboxes[checkboxes.length - 1];
      lastCheckbox.insertAdjacentElement('afterend', newDiv);
    } else {
      console.warn('There are less than two elements with class "form-group checkbox".');
    }
  }
  insertHtmlAfterSecondCheckbox();
  
  var isUserReportsHidden = localStorage.getItem(DISPLAY_KEY_UserReports);
  if (isUserReportsHidden === "true") {
    $("#hide-user-reports").prop("checked", true);
  }
  
  $("#hide-user-reports").change(function() {
    var isChecked = $(this).is(":checked");
    localStorage.setItem(DISPLAY_KEY_UserReports, isChecked);
    toggleUserReportsContainer();
  });
}

// Display additional options in side menu and tooltips
if (!optionHideUserReports) {
  AdditionalCheckboxesUserReports();
}

toggleUserReportsContainer();

/*
    Themed Popups v1.1.1 by AAD
    https://github.com/AmateurAudioDude/FM-DX-Webserver-Plugin-Themed-Popups
*/

document.addEventListener('DOMContentLoaded', () => {
  // If Themed Popups plugin is not installed
  if (typeof pluginThemedPopup === 'undefined') {
    pluginThemedPopup = true;
    var styleElement = document.createElement('style');
    var cssCodeThemedPopups = `
    /* Themed Popups CSS */
    .popup {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: var(--color-2); /* Background */
        color: var(--color-main-bright); /* Text */
        padding: 20px;
        border-radius: 10px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4);
        opacity: 0;
        transition: opacity 0.3s ease-in;
        z-index: 9999;
    }

    .popup-content {
        text-align: center;
    }

    .popup button {
        margin-top: 10px;
    }

    .popup.open {
        opacity: .99;
    }
    `;
    styleElement.appendChild(document.createTextNode(cssCodeThemedPopups));
    document.head.appendChild(styleElement);
  }
});

const isClickedOutsidePopupPluginInactivityMonitor = true;

function alert(popupMessage, popupButton) {
    if (typeof popupButton === 'undefined') {
        popupButton = 'OK';
    }
    if (!popupOpened) { // Check if a popup is not already open
        popup = document.createElement('div');
        popup.classList.add('popup');
        popup.innerHTML = `<div class="popup-content">${popupMessage.replace(/\n/g, '<br>')}<button id="popup-close">${popupButton}</button></div>`;
        document.body.appendChild(popup);

        var closeButton = popup.querySelector('#popup-close');
        closeButton.addEventListener('click', closePopup);

        popup.addEventListener('click', function(event) {
            event.stopPropagation(); // Prevent event propagation
        });

        // Trigger the fade-in effect
        setTimeout(function() {
            popup.classList.add('open');
            popupOpened = true; // Set popupOpened flag to true
            blurBackground(true);
        }, 10);
    }
}

function blurBackground(status) {
    // Blur background
    if (status === true) {
      if (idModal) {
          idModal.style.display = 'block';
        setTimeout(function() {
          idModal.style.opacity = '1';
        }, 40);
      }
    } else {
      // Restore background
      if (idModal) {
        setTimeout(function() {
          idModal.style.display = 'none';
        }, 400);
          idModal.style.opacity = '0';
      }
    }
}

var popupOpened = false;
var popup;

var popupPromptOpened = false;
var idModal = document.getElementById('myModal');

// Function to close the popup
function closePopup(event) {
    event.stopPropagation(); // Prevent event propagation
    popupOpened = false; // Set popupOpened flag to false
    popup.classList.remove('open'); // Fade out
    setTimeout(function() {
        popup.remove();
        blurBackground(false);
    }, 300); // Remove after fade-out transition
    console.log("Inactivity Monitor popup closed, user active.");

    // Reset if popup is closed
    clearTimeout(popupTimeout);
    popupDisplayed = false; // Reset popup flag
    resetTimer();
}

// Event listener for ESC key to close popup
document.addEventListener('keydown', function(event) {
    if (popupOpened && (event.key === 'Escape' || event.key === 'Enter')) {
        closePopup(event);
        blurBackground(false);
    }
});

if (isClickedOutsidePopupPluginInactivityMonitor) {
  // Event listener for clicks outside the popup to close it
  document.addEventListener('click', function(event) {
      if (popupOpened && !popup.contains(event.target)) {
          closePopup(event);
          blurBackground(false);
      }
  });
}

})();
