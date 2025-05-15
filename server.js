const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const { v4: uuidV4 } = require('uuid');

app.use(express.static('public'));

let users = [];

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('new-user', (username) => {
    users.push({ id: socket.id, username });
    io.emit('user-connected', users.map(u => u.username));
  });
  
  socket.on('chat-message', (message) => {
    const user = users.find(u => u.id === socket.id);
    if (user) {
      io.emit('chat-message', { username: user.username, message });
    }
  });
  
  socket.on('start-call', () => {
    socket.broadcast.emit('call-started');
  });
  
  socket.on('join-call', () => {
    socket.broadcast.emit('user-joined-call', socket.id);
  });
  
  socket.on('end-call', () => {
    socket.broadcast.emit('call-ended');
  });
  
  socket.on('get-current-users', () => {
    users.forEach(user => {
      if (user.id !== socket.id) {
        socket.emit('user-joined-call', user.id);
      }
    });
  });
  
  socket.on('disconnect', () => {
    users = users.filter(u => u.id !== socket.id);
    io.emit('user-disconnected', users.map(u => u.username));
    console.log('User disconnected:', socket.id);
  });
});

// Clear all data every 24 hours
setInterval(() => {
  users = [];
  console.log('Cleared all user data (24-hour reset)');
}, 24 * 60 * 60 * 1000);

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});