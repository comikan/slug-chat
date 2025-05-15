// Generate random username
const username = `User-${Math.floor(Math.random() * 10000)}`;
let socket;
let peer;
let currentCall = null;
let localStream = null;
const peers = {};
let isMuted = false;
let isVideoOff = false;

// DOM elements
const elements = {
  messageInput: document.getElementById('messageInput'),
  sendBtn: document.getElementById('sendBtn'),
  messages: document.getElementById('messages'),
  users: document.getElementById('users'),
  startCallBtn: document.getElementById('startCallBtn'),
  callModal: document.getElementById('callModal'),
  joinCallBtn: document.getElementById('joinCallBtn'),
  declineCallBtn: document.getElementById('declineCallBtn'),
  callInterface: document.getElementById('callInterface'),
  endCallBtn: document.getElementById('endCallBtn'),
  videoContainer: document.getElementById('videoContainer'),
  muteBtn: document.getElementById('muteBtn'),
  videoBtn: document.getElementById('videoBtn')
};

// Initialize the application
function init() {
  connectToServer();
  setupEventListeners();
  displayWelcomeMessage();
}

// Socket.IO connection
function connectToServer() {
  socket = io();

  socket.on('connect', () => {
    console.log('Connected:', socket.id);
    socket.emit('new-user', username);
  });

  socket.on('user-connected', updateUserList);
  socket.on('user-disconnected', handleUserDisconnect);
  socket.on('chat-message', displayReceivedMessage);
  socket.on('call-started', showCallModal);
  socket.on('call-ended', endCall);
  socket.on('user-joined-call', handleNewCallParticipant);
}

// Set up event listeners
function setupEventListeners() {
  elements.messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });

  elements.sendBtn.addEventListener('click', sendMessage);
  elements.startCallBtn.addEventListener('click', startCall);
  elements.joinCallBtn.addEventListener('click', joinCall);
  elements.declineCallBtn.addEventListener('click', () => {
    elements.callModal.style.display = 'none';
  });
  document.querySelector('.close').addEventListener('click', () => {
    elements.callModal.style.display = 'none';
  });
  elements.endCallBtn.addEventListener('click', endCall);
  elements.muteBtn.addEventListener('click', toggleMute);
  elements.videoBtn.addEventListener('click', toggleVideo);
}

// Message functionality
function sendMessage() {
  const message = elements.messageInput.value.trim();
  if (message) {
    socket.emit('chat-message', message);
    displayMessage(username, message, true);
    elements.messageInput.value = '';
  }
}

function displayMessage(sender, text, isSent) {
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('message', isSent ? 'sent' : 'received');
  
  const infoDiv = document.createElement('div');
  infoDiv.classList.add('message-info');
  infoDiv.textContent = `${sender} • ${new Date().toLocaleTimeString()}`;
  
  const textDiv = document.createElement('div');
  textDiv.textContent = text;
  
  messageDiv.appendChild(infoDiv);
  messageDiv.appendChild(textDiv);
  elements.messages.appendChild(messageDiv);
  elements.messages.scrollTop = elements.messages.scrollHeight;
}

function displayWelcomeMessage() {
  displayMessage('System', `Welcome to Slug Chat, ${username}! Your messages will disappear after 24 hours.`, false);
}

// User list management
function updateUserList(users) {
  elements.users.innerHTML = '';
  users.forEach(user => {
    const li = document.createElement('li');
    li.textContent = user;
    elements.users.appendChild(li);
  });
}

function handleUserDisconnect(users) {
  updateUserList(users);
  const disconnectedUser = Object.keys(peers).find(id => !users.includes(id));
  if (disconnectedUser) {
    removePeer(disconnectedUser);
  }
}

function displayReceivedMessage(data) {
  displayMessage(data.username, data.message, false);
}

// Call functionality
async function startCall() {
  try {
    elements.callModal.style.display = 'none';
    currentCall = true;
    socket.emit('start-call');
    
    localStream = await navigator.mediaDevices.getUserMedia({ 
      video: true, 
      audio: true 
    });
    addVideoStream(null, localStream);
    
    peer = new Peer(socket.id);
    
    peer.on('call', call => {
      call.answer(localStream);
      call.on('stream', userVideoStream => {
        if (!peers[call.peer]) {
          addVideoStream(call.peer, userVideoStream);
        }
      });
    });
    
    elements.callInterface.classList.remove('hidden');
  } catch (err) {
    console.error('Failed to start call:', err);
    alert('Failed to access media devices. Please check permissions.');
  }
}

async function joinCall() {
  elements.callModal.style.display = 'none';
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ 
      video: true, 
      audio: true 
    });
    addVideoStream(null, localStream);
    
    peer = new Peer(socket.id);
    socket.emit('join-call');
    
    peer.on('open', () => {
      socket.emit('get-current-users');
    });
    
    elements.callInterface.classList.remove('hidden');
  } catch (err) {
    console.error('Failed to join call:', err);
    alert('Failed to access media devices. Please check permissions.');
  }
}

function handleNewCallParticipant(userId) {
  if (currentCall && userId !== socket.id) {
    connectToNewUser(userId);
  }
}

function connectToNewUser(userId) {
  if (!peers[userId]) {
    const call = peer.call(userId, localStream);
    call.on('stream', userVideoStream => {
      addVideoStream(userId, userVideoStream);
    });
    call.on('close', () => {
      removePeer(userId);
    });
    peers[userId] = call;
  }
}

function addVideoStream(userId, stream) {
  const video = document.createElement('video');
  video.id = `video-${userId || 'local'}`;
  video.autoplay = true;
  video.playsInline = true;
  video.srcObject = stream;
  elements.videoContainer.appendChild(video);
}

function removePeer(userId) {
  if (peers[userId]) {
    peers[userId].close();
    delete peers[userId];
    const video = document.getElementById(`video-${userId}`);
    if (video) video.remove();
  }
}

function endCall() {
  socket.emit('end-call');
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
  }
  Object.keys(peers).forEach(removePeer);
  elements.videoContainer.innerHTML = '';
  elements.callInterface.classList.add('hidden');
  currentCall = false;
}

function toggleMute() {
  if (localStream) {
    isMuted = !isMuted;
    localStream.getAudioTracks()[0].enabled = !isMuted;
    elements.muteBtn.classList.toggle('active', isMuted);
    elements.muteBtn.innerHTML = isMuted 
      ? '<i class="fas fa-microphone-slash"></i>' 
      : '<i class="fas fa-microphone"></i>';
  }
}

function toggleVideo() {
  if (localStream) {
    isVideoOff = !isVideoOff;
    localStream.getVideoTracks()[0].enabled = !isVideoOff;
    elements.videoBtn.classList.toggle('active', isVideoOff);
    elements.videoBtn.innerHTML = isVideoOff 
      ? '<i class="fas fa-video-slash"></i>' 
      : '<i class="fas fa-video"></i>';
  }
}

function showCallModal() {
  if (!currentCall) {
    elements.callModal.style.display = 'block';
  }
}

// Initialize the app
init();