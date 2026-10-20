// server/index.js
const express = require('express');
const http = require('http');
const path = require('path');
const os = require('os');
const { Server } = require('socket.io');
const engine = require('./gameEngine');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  httpCompression: true,
  perMessageDeflate: {
    threshold: 512
  }
});

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '..', 'public'), {
  etag: true,
  maxAge: 0,
  setHeaders: (res) => {
    res.set('Cache-Control', 'no-cache');
  }
}));
app.use('/vendor/three', express.static(path.join(__dirname, '..', 'node_modules', 'three'), {
  maxAge: '7d',
  immutable: true
}));

// Almacén en memoria de salas activas: roomCode -> roomState
const rooms = new Map();
// Mapa de socket.id -> { roomCode, playerId }
const socketSession = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = '';
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (rooms.has(code));
  return code;
}

function broadcastRoomState(room) {
  if (!room) return;
  const socketsInRoom = io.sockets.adapter.rooms.get(room.roomCode);
  if (!socketsInRoom) return;

  for (const sockId of socketsInRoom) {
    const sess = socketSession.get(sockId);
    const sock = io.sockets.sockets.get(sockId);
    if (sock && sess) {
      sock.emit('room_state', engine.serializeRoomForPlayer(room, sess.playerId));
    }
  }
}

function scheduleBotIfNeeded(room) {
  if (!room || room.status === 'lobby' || room.status === 'finished') return;
  const activePlayer = room.players[room.turnIndex];
  if (!activePlayer || !activePlayer.isBot) return;

  if (room._botTimeout) clearTimeout(room._botTimeout);
  room._botTimeout = setTimeout(() => {
    const changed = engine.runBotStep(room);
    if (changed) {
      broadcastRoomState(room);
      scheduleBotIfNeeded(room);
    }
  }, 850);
}

function isPlayerConnectedOnAnotherSocket(roomCode, playerId, currentSocketId) {
  for (const [sockId, sess] of socketSession.entries()) {
    if (
      sockId !== currentSocketId &&
      sess.roomCode === roomCode &&
      sess.playerId === playerId &&
      io.sockets.sockets.has(sockId)
    ) {
      return true;
    }
  }
  return false;
}

io.on('connection', (socket) => {
  const ips = getLocalIPs();
  socket.emit('server_info', {
    localUrl: `http://localhost:${PORT}`,
    lanUrl: ips[0] ? `http://${ips[0]}:${PORT}` : null,
    publicUrl: publicTunnelUrl
  });

  // Crear sala nueva
  socket.on('create_room', ({ playerName, playerId, profile }, cb) => {
    const cleanName = String(playerName || '').trim().slice(0, 18);
    if (cleanName.length < 2) {
      return cb && cb({ error: '⚠️ Debes escribir tu nombre (mínimo 2 letras) para crear una sala.' });
    }
    const pid = playerId || `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const roomCode = generateRoomCode();
    const room = engine.createRoomState(roomCode, pid, cleanName, profile || {});

    rooms.set(roomCode, room);
    socket.join(roomCode);
    socketSession.set(socket.id, { roomCode, playerId: pid });

    if (cb) cb({ ok: true, roomCode, playerId: pid });
    broadcastRoomState(room);
  });

  // Unirse a una sala existente (o reconectar)
  socket.on('join_room', ({ roomCode, playerName, playerId, profile }, cb) => {
    const cleanName = String(playerName || '').trim().slice(0, 18);
    if (cleanName.length < 2) {
      return cb && cb({ error: '⚠️ Debes escribir tu nombre (mínimo 2 letras) antes de entrar a la sala.' });
    }

    const code = (roomCode || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      return cb && cb({ error: `No existe ninguna sala activa con el código "${code}".` });
    }

    let pid = playerId || `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    let existingPlayer = room.players.find(p => p.id === pid);

    // Si alguien abre el link de invitación en una segunda pestaña del mismo navegador
    // mientras la primera pestaña sigue conectada en la sala, crearle un jugador nuevo
    if (existingPlayer && isPlayerConnectedOnAnotherSocket(code, pid, socket.id)) {
      if (room.status === 'lobby') {
        existingPlayer = null;
        pid = `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      }
    }

    // Si la partida ya empezó y el jugador entra desde otra pestaña/dispositivo con su mismo nombre
    // y su asiento estaba desconectado, recuperar su asiento automáticamente
    if (!existingPlayer && room.status !== 'lobby') {
      const disconnectedByName = room.players.find(
        p => !p.isBot && !p.connected && p.name.toLowerCase() === cleanName.toLowerCase()
      );
      if (disconnectedByName) {
        existingPlayer = disconnectedByName;
        pid = existingPlayer.id;
      }
    }

    if (existingPlayer) {
      existingPlayer.connected = true;
      existingPlayer.name = cleanName;
      engine.addLog(room, `🔌 ${existingPlayer.name} se ha conectado a la sala.`, 'system');
    } else {
      if (room.status !== 'lobby') {
        return cb && cb({ error: 'La partida ya está en curso y todos los jugadores están conectados.' });
      }
      if (room.players.length >= 4) {
        return cb && cb({ error: 'La sala está llena (máximo 4 jugadores).' });
      }

      existingPlayer = engine.createPlayerObject(pid, cleanName, room.players, false, profile || {});
      room.players.push(existingPlayer);
      engine.addLog(room, `👋 ${cleanName} se unió a la sala con el color ${existingPlayer.colorName}.`, 'system');
    }

    socket.join(code);
    socketSession.set(socket.id, { roomCode: code, playerId: pid });

    if (cb) cb({ ok: true, roomCode: code, playerId: pid });
    broadcastRoomState(room);
  });

  // Actualizar perfil de jugador (color, avatar, estilo de piezas 3D, nombre)
  socket.on('update_profile', (profileData, cb) => {
    const sess = socketSession.get(socket.id);
    if (!sess) return;
    const room = rooms.get(sess.roomCode);
    if (!room) return;
    const res = engine.updatePlayerProfile(room, sess.playerId, profileData || {});
    if (cb) cb(res);
    if (!res.error) broadcastRoomState(room);
  });

  // Actualizar configuración de la partida
  socket.on('update_settings', (settingsData, cb) => {
    const sess = socketSession.get(socket.id);
    if (!sess) return;
    const room = rooms.get(sess.roomCode);
    if (!room) return;
    const res = engine.updateRoomSettings(room, sess.playerId, settingsData || {});
    if (cb) cb(res);
    if (!res.error) broadcastRoomState(room);
  });

  // Agregar un Bot en el lobby
  socket.on('add_bot', (_, cb) => {
    const sess = socketSession.get(socket.id);
    if (!sess) return;
    const room = rooms.get(sess.roomCode);
    if (!room || room.hostId !== sess.playerId || room.status !== 'lobby') {
      return cb && cb({ error: 'Solo el anfitrión puede agregar bots en el lobby.' });
    }
    if (room.players.length >= 4) {
      return cb && cb({ error: 'Ya hay 4 jugadores en la sala.' });
    }

    const botNames = ['Lord Catan (IA)', 'Mercader del Sur (IA)', 'Capitán del Mar (IA)', 'Arquitecto Real (IA)'];
    const botStyles = ['medieval', 'imperial', 'nordic', 'oriental'];

    const botId = `bot_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
    const botName = botNames[room.players.length - 1] || `Bot ${room.players.length}`;
    const bot = engine.createPlayerObject(botId, botName, room.players, true, {
      avatar: '🤖',
      pieceStyle: botStyles[room.players.length % botStyles.length]
    });
    room.players.push(bot);
    engine.addLog(room, `🤖 Se agregó a ${botName} (${bot.colorName}) a la sala.`, 'system');

    if (cb) cb({ ok: true });
    broadcastRoomState(room);
  });

  // Quitar un jugador/bot en el lobby
  socket.on('remove_player', ({ targetId }, cb) => {
    const sess = socketSession.get(socket.id);
    if (!sess) return;
    const room = rooms.get(sess.roomCode);
    if (!room || room.hostId !== sess.playerId || room.status !== 'lobby') return;
    if (targetId === room.hostId) return;

    const idx = room.players.findIndex(p => p.id === targetId);
    if (idx !== -1) {
      const removed = room.players.splice(idx, 1)[0];
      engine.addLog(room, `❌ ${removed.name} fue retirado de la sala.`, 'system');
      broadcastRoomState(room);
    }
    if (cb) cb({ ok: true });
  });

  // Iniciar partida
  socket.on('start_game', (_, cb) => {
    const sess = socketSession.get(socket.id);
    if (!sess) return;
    const room = rooms.get(sess.roomCode);
    if (!room) return;
    if (room.hostId !== sess.playerId) {
      return cb && cb({ error: 'Solo el anfitrión puede iniciar la partida.' });
    }

    const res = engine.startGame(room);
    if (res.error) return cb && cb(res);

    if (cb) cb({ ok: true });
    broadcastRoomState(room);
    scheduleBotIfNeeded(room);
  });

  // Acciones de juego
  socket.on('game_action', (action, cb) => {
    const sess = socketSession.get(socket.id);
    if (!sess) return cb && cb({ error: 'No estás en ninguna sala.' });
    const room = rooms.get(sess.roomCode);
    if (!room) return cb && cb({ error: 'Sala no encontrada.' });

    const pid = sess.playerId;
    let res = { error: 'Acción desconocida.' };

    switch (action.type) {
      case 'place_settlement':
        res = engine.placeSettlement(room, pid, action.vertexId);
        break;
      case 'place_road':
        res = engine.placeRoad(room, pid, action.edgeId);
        break;
      case 'upgrade_city':
        res = engine.upgradeToCity(room, pid, action.vertexId);
        break;
      case 'roll_dice':
        res = engine.rollDice(room, pid);
        break;
      case 'discard_resources':
        res = engine.discardResources(room, pid, action.discards || {});
        break;
      case 'move_robber':
        res = engine.moveRobber(room, pid, action.hexId);
        break;
      case 'choose_steal_victim':
        res = engine.chooseStealVictim(room, pid, action.victimId);
        break;
      case 'buy_dev_card':
        res = engine.buyDevCard(room, pid);
        break;
      case 'play_dev_card':
        res = engine.playDevCard(room, pid, action.cardType, action.payload || {});
        break;
      case 'bank_trade':
        res = engine.bankTrade(room, pid, action.giveRes, action.getRes);
        break;
      case 'propose_trade':
        res = engine.proposePlayerTrade(room, pid, action.give || {}, action.want || {});
        break;
      case 'respond_trade':
        res = engine.respondPlayerTrade(room, pid, action.response);
        break;
      case 'execute_trade':
        res = engine.executePlayerTrade(room, pid, action.partnerId);
        break;
      case 'cancel_trade':
        res = engine.cancelPlayerTrade(room, pid);
        break;
      case 'end_turn':
        res = engine.endTurn(room, pid);
        break;
    }

    if (cb) cb(res);
    if (!res.error) {
      broadcastRoomState(room);
      scheduleBotIfNeeded(room);
    }
  });

  // Chat en tiempo real
  socket.on('send_chat', ({ text }) => {
    const sess = socketSession.get(socket.id);
    if (!sess || !text) return;
    const room = rooms.get(sess.roomCode);
    if (!room) return;
    const player = room.players.find(p => p.id === sess.playerId);
    if (!player) return;

    const cleanText = String(text).trim().slice(0, 200);
    if (!cleanText) return;

    const chatEntry = {
      id: Date.now() + Math.random(),
      playerId: player.id,
      playerName: player.name,
      playerAvatar: player.avatar || '👑',
      playerColor: player.color,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: cleanText,
      isReaction: false
    };
    room.chat.push(chatEntry);
    if (room.chat.length > 60) room.chat.shift();
    io.to(room.roomCode).emit('chat_message', chatEntry);
  });

  // Reacciones rápidas animadas (se guardan en el chat y muestran bocadillo)
  socket.on('send_reaction', ({ emoji, text }) => {
    const sess = socketSession.get(socket.id);
    if (!sess) return;
    const room = rooms.get(sess.roomCode);
    if (!room) return;
    const player = room.players.find(p => p.id === sess.playerId);
    if (!player) return;

    const cleanEmoji = String(emoji || '💬').slice(0, 8);
    const cleanText = String(text || '').trim().slice(0, 48);

    const chatEntry = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      playerId: player.id,
      playerName: player.name,
      playerAvatar: player.avatar || '👑',
      playerColor: player.color,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      emoji: cleanEmoji,
      text: `${cleanEmoji} ${cleanText}`,
      reactionLabel: cleanText,
      isReaction: true
    };

    room.chat.push(chatEntry);
    if (room.chat.length > 60) room.chat.shift();

    io.to(room.roomCode).emit('player_reaction', chatEntry);
  });

  // Salir de la sala (volver al menú principal)
  socket.on('leave_room', (_, cb) => {
    const sess = socketSession.get(socket.id);
    if (!sess) return cb && cb({ ok: true });
    socketSession.delete(socket.id);
    socket.leave(sess.roomCode);

    const room = rooms.get(sess.roomCode);
    if (!room) return cb && cb({ ok: true });

    const idx = room.players.findIndex(p => p.id === sess.playerId);
    if (idx !== -1) {
      const player = room.players[idx];
      if (room.status === 'lobby') {
        // En la sala de espera: se libera el lugar por completo
        room.players.splice(idx, 1);
        engine.addLog(room, `🚪 ${player.name} salió de la sala.`, 'system');
        if (room.hostId === player.id) {
          const nextHost = room.players.find(p => !p.isBot);
          if (nextHost) {
            room.hostId = nextHost.id;
            engine.addLog(room, `⭐ ${nextHost.name} ahora es el anfitrión de la sala.`, 'system');
          }
        }
      } else {
        // En plena partida: se conserva su asiento por si quiere volver
        player.connected = false;
        engine.addLog(room, `🚪 ${player.name} abandonó la partida (puede volver con el mismo nombre).`, 'system');
      }
    }

    const humansLeft = room.players.filter(p => !p.isBot && (room.status === 'lobby' || p.connected));
    if (humansLeft.length === 0) {
      if (room._botTimeout) clearTimeout(room._botTimeout);
      rooms.delete(room.roomCode);
    } else {
      broadcastRoomState(room);
    }

    if (cb) cb({ ok: true });
  });

  // Reiniciar partida para jugar revancha en la misma sala
  socket.on('rematch_room', (_, cb) => {
    const sess = socketSession.get(socket.id);
    if (!sess) return;
    const room = rooms.get(sess.roomCode);
    if (!room) return;

    const res = engine.resetRoomForRematch(room, sess.playerId);
    if (cb) cb(res);
    if (!res.error) broadcastRoomState(room);
  });

  socket.on('disconnect', () => {
    const sess = socketSession.get(socket.id);
    if (!sess) return;
    socketSession.delete(socket.id);

    const room = rooms.get(sess.roomCode);
    if (!room) return;
    const player = room.players.find(p => p.id === sess.playerId);
    if (player) {
      player.connected = false;
      broadcastRoomState(room);
    }
  });
});

// Reloj de turno en el servidor (Anti-AFK cuando el contador llega a 00:00)
setInterval(() => {
  for (const room of rooms.values()) {
    if (engine.handleTurnTimeout(room)) {
      broadcastRoomState(room);
      scheduleBotIfNeeded(room);
    }
  }
}, 1000);

function getLocalIPs() {
  const nets = os.networkInterfaces();
  const results = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        results.push(net.address);
      }
    }
  }
  return results;
}

let publicTunnelUrl = null;
let tunnelProcess = null;

function startPublicTunnel() {
  if (tunnelProcess) return;
  try {
    const { spawn } = require('child_process');
    tunnelProcess = spawn('ssh', [
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'ServerAliveInterval=30',
      '-R', `80:localhost:${PORT}`,
      'nokey@localhost.run'
    ], { windowsHide: true });

    const parseUrl = (data) => {
      const text = data.toString();
      const match = text.match(/https:\/\/[a-zA-Z0-9.-]+\.lhr\.life/);
      if (match && match[0] !== publicTunnelUrl) {
        publicTunnelUrl = match[0];
        console.log(`🌐 Link Público Internet (Amigos): ${publicTunnelUrl}`);
        io.emit('server_info', {
          localUrl: `http://localhost:${PORT}`,
          lanUrl: getLocalIPs()[0] ? `http://${getLocalIPs()[0]}:${PORT}` : null,
          publicUrl: publicTunnelUrl
        });
      }
    };

    tunnelProcess.stdout.on('data', parseUrl);
    tunnelProcess.stderr.on('data', parseUrl);
    tunnelProcess.on('close', () => {
      tunnelProcess = null;
      publicTunnelUrl = null;
      setTimeout(startPublicTunnel, 3500);
    });
  } catch (err) {
    console.error('No se pudo iniciar túnel público:', err.message);
  }
}

app.get('/api/server-info', (req, res) => {
  const ips = getLocalIPs();
  res.json({
    port: PORT,
    localUrl: `http://localhost:${PORT}`,
    lanUrl: ips[0] ? `http://${ips[0]}:${PORT}` : `http://localhost:${PORT}`,
    publicUrl: publicTunnelUrl
  });
});

server.listen(PORT, () => {
  const ips = getLocalIPs();
  console.log(`\n==================================================`);
  console.log(`🏝️  CATAN 3D ONLINE LISTO EN EL PUERTO ${PORT}`);
  console.log(`👉 Local:   http://localhost:${PORT}`);
  ips.forEach(ip => {
    console.log(`👉 Red LAN: http://${ip}:${PORT}`);
  });
  console.log(`==================================================\n`);
  startPublicTunnel();
});
