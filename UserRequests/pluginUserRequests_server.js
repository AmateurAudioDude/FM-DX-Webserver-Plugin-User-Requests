/*
    User Requests by AAD

    //// Server-side code ////

    Requirements:
    Additional dependencies using terminal command in 'FM-DX-Webserver' directory: npm install socket.io uuid
    Insert line of code at end of '/server/index.js': module.exports = { httpServer };
*/

/////////////////////////////////// initUsersOnline ///////////////////////////////////
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const { httpServer } = require('../../server');

const io = socketIo(httpServer, {
  pingTimeout: 30000,
  pingInterval: 10000,
  cookie: false,
  allowUpgrades: false
});

const onlineUsers = new Map();
const ipToUserNumber = new Map();
const connectionTimes = new Map();
let nextUserNumber = 1;
let intervalTimeUpdateStarted = false;

const bypassedIpSubstrings = [];

/////////////////////////////////// initUsersOnlineUI ///////////////////////////////////
const { logError, logInfo, logWarn } = require('../../server/console');

// User listen request
io.on('connection', (socket) => { // Socket.IO connection handling
  const clientIpUserRequest = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
  if (clientIpUserRequest) {
    //logInfo(`User Requests plugin: IP \x1b[32mconnected\x1b[0m (${clientIpUserRequest})`);
  } else {
    logError('User Requests IP not found in headers.');
    return;
  }

  if (bypassedIpSubstrings.some(substring => clientIpUserRequest.includes(substring))) {
    emitOnlineUsers();
    return;
  }

  // Generate user UUID
  const userId = uuidv4();

  // Check if IP address already has user number assigned
  let userNumber = getUserNumber(clientIpUserRequest);

  // If no user number assigned or if it's the first user reconnecting after all disconnect, assign the next available one
  if (!userNumber || onlineUsers.size === 0) {
    // Reset the user numbering if there are no existing users
    if (onlineUsers.size === 0) {
      nextUserNumber = 1;
    } else {
      // Find the minimum userNumber available that hasn't been assigned
      const existingUserNumbers = new Set(Array.from(onlineUsers.values()).map(user => user.userNumber));
      for (let i = 1; i <= nextUserNumber; i++) {
        if (!existingUserNumbers.has(i)) {
          userNumber = i;
          break;
        }
      }
    }
    userNumber = userNumber || nextUserNumber++; // Fallback in case all numbers are taken
    ipToUserNumber.set(clientIpUserRequest, userNumber);
  }

  // Add user to onlineUsers map
  onlineUsers.set(socket.id, {
    userId,
    userNumber,
    socketId: socket.id, // Include socketId for each user
    selection: 'Tuning Mode' // Initial selection
  });

  // Code for timer
  connectionTimes.set(socket.id, Date.now()); // Store the connection start time

  // Emit updated online users list to all clients
  emitOnlineUsers();

  // Handle updateSelection event
  socket.on('updateSelection', (data) => {
    const { selection } = data;
    // Update user's selection
    onlineUsers.get(socket.id).selection = selection;
    // Broadcast updated selection to all clients
    emitOnlineUsers();
  });

  // Handle disconnect event
  socket.on('disconnect', () => {
    const disconnectedUser = onlineUsers.get(socket.id);
    //logInfo(`User Requests plugin: IP \x1b[31mdisconnected\x1b[0m (${clientIpUserRequest})`);

    // Timer code
    connectionTimes.delete(socket.id); // Remove connection start time

    // Remove user from onlineUsers map
    onlineUsers.delete(socket.id);

    // Check if any users with the same userNumber are still online
    const userNumber = disconnectedUser.userNumber;

    const isAnyUserStillOnline = Array.from(onlineUsers.values()).some(user => (
      user.userNumber === userNumber && user.socketId !== socket.id
    ));

    // If no users with the same userNumber are online, delete userNumber entry
    if (!isAnyUserStillOnline) {
      ipToUserNumber.delete(clientIpUserRequest);
    }

    // Emit updated online users list to all clients
    emitOnlineUsers();
  });

  // Function to emit online users list to all clients
  function emitOnlineUsers() {
    const usersArray = Array.from(onlineUsers.values());
    io.emit('updateUsers', usersArray.map(user => {
      const connectionTime = connectionTimes.get(user.socketId);
      const duration = Date.now() - connectionTime;
      return {
        userId: user.userId,
        userNumber: user.userNumber,
        socketId: user.socketId,
        selection: user.selection,
        connectionDuration: duration // Connection duration
      };
    }));
  }

  // Function to get the user number by IP address
  function getUserNumber(clientIpRequest) {
    return ipToUserNumber.get(clientIpRequest);
  }

  // Function to update connection durations periodically
  if (!intervalTimeUpdateStarted) {
    intervalTimeUpdateStarted = true;
    setInterval(() => {
      emitOnlineUsers();
      //console.log(`[${new Date().toLocaleString()}] [INFO] User Reports Updated`);
    }, 30000);
  }
});

//module.exports = bypassedIpSubstrings;
