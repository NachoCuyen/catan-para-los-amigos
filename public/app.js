// public/app.js
import { CatanBoard3D, PiecePreview3D } from './board3d.js';

const socket = window.io();

const RESOURCES_INFO = {
  wood: { name: 'Madera', emoji: '🌲', color: '#22c55e' },
  brick: { name: 'Ladrillo', emoji: '🧱', color: '#f97316' },
  sheep: { name: 'Oveja', emoji: '🐑', color: '#a3e635' },
  wheat: { name: 'Trigo', emoji: '🌾', color: '#facc15' },
  ore: { name: 'Piedra', emoji: '⛰️', color: '#94a3b8' }
};

const DEV_CARD_INFO = {
  knight: { name: 'Caballero', emoji: '⚔️', desc: 'Mueve al Ladrón y roba 1 recurso.' },
  vp: { name: '+1 Punto Victoria', emoji: '🏆', desc: 'Suma 1 PV automáticamente.' },
  road_building: { name: '2 Caminos', emoji: '🛤️', desc: 'Construye 2 caminos gratis.' },
  year_of_plenty: { name: 'Abundancia', emoji: '🎁', desc: 'Toma 2 recursos cualesquiera del banco.' },
  monopoly: { name: 'Monopolio', emoji: '👑', desc: 'Reclama todas las cartas de 1 tipo de recurso.' }
};

const PLAYER_COLORS = [
  { id: 'red', name: 'Rojo Carmesí', hex: '#ef4444' },
  { id: 'blue', name: 'Azul Real', hex: '#3b82f6' },
  { id: 'orange', name: 'Ámbar Dorado', hex: '#f59e0b' },
  { id: 'emerald', name: 'Verde Esmeralda', hex: '#10b981' },
  { id: 'purple', name: 'Púrpura Imperial', hex: '#a855f7' },
  { id: 'cyan', name: 'Turquesa Mar', hex: '#06b6d4' },
  { id: 'pink', name: 'Rosa Coral', hex: '#ec4899' },
  { id: 'white', name: 'Blanco Marfil', hex: '#f8fafc' }
];

const PLAYER_AVATARS = ['👑', '⚔️', '🧙‍♂️', '🏴‍☠️', '🦊', '🐉', '🛡️', '🧭', '🦁', '🦅'];

const PIECE_STYLES = [
  { id: 'medieval', name: '🏰 Medieval' },
  { id: 'imperial', name: '🏛️ Imperio Romano' },
  { id: 'nordic', name: '🛡️ Clan Vikingo' },
  { id: 'oriental', name: '⛩️ Dinastía Oriental' }
];

const THEMES_ORDER = ['dynamic', 'day', 'sunset', 'night', 'storm', 'snow'];
const THEME_NAMES = {
  dynamic: '🔄 Dinámico',
  sunrise: '🌄 Amanecer',
  day: '☀️ Día',
  sunset: '🌅 Ocaso',
  night: '🌙 Noche',
  storm: '⛈️ Tormenta',
  snow: '❄️ Nevada',
  foggy: '🌫️ Niebla',
  rain: '🌧️ Llovizna'
};
let lastAnnouncedWeatherTheme = null;

// Estado local del cliente (sessionStorage por pestaña para permitir varias pestañas y reconexión F5)
let myPlayerId = sessionStorage.getItem('catan_player_id');
if (!myPlayerId) {
  myPlayerId = `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  sessionStorage.setItem('catan_player_id', myPlayerId);
}

let myProfile = {
  colorId: localStorage.getItem('catan_color') || 'red',
  avatar: localStorage.getItem('catan_avatar') || '👑',
  pieceStyle: localStorage.getItem('catan_style') || 'medieval'
};

let currentThemeIndex = 0;
let roomState = null;
let buildMode = null;
let discardSelection = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
let bankTradeGive = 'wood';
let bankTradeGet = 'brick';
let offerGive = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
let offerWant = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
let pendingDevCardType = null;
let devSelectedRes = [];

// Inicializar motor 3D y visor 3D de piezas en vivo
const canvasContainer = document.getElementById('canvas-container');
const board3D = new CatanBoard3D(canvasContainer, handle3DSelection);
const piecePreview3D = new PiecePreview3D(board3D);

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playTone(freq = 440, duration = 0.12, type = 'sine') {
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (_) {}
}

function showToast(msg) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// =========================================================
// SELECTORES DE PERSONALIZACIÓN Y VISOR 3D EN VIVO
// =========================================================
function updateLive3DPreview() {
  const colObj = PLAYER_COLORS.find(c => c.id === myProfile.colorId) || PLAYER_COLORS[0];
  const stObj = PIECE_STYLES.find(s => s.id === myProfile.pieceStyle) || PIECE_STYLES[0];

  piecePreview3D.updatePreview(colObj.hex, stObj.id);

  const inWaitingRoom = roomState && roomState.status === 'lobby';
  const targetContainer = document.getElementById(inWaitingRoom ? 'piece-preview-lobby' : 'piece-preview-init');
  piecePreview3D.mountTo(targetContainer);

  const labelEl = document.getElementById(inWaitingRoom ? 'lobby-preview-label' : 'init-preview-label');
  if (labelEl) {
    labelEl.textContent = `${stObj.name} (${colObj.name})`;
  }
}

function renderProfilePickers(avatarContainerId, colorContainerId, styleContainerId, sendToServer = false) {
  const avEl = document.getElementById(avatarContainerId);
  const colEl = document.getElementById(colorContainerId);
  const stEl = document.getElementById(styleContainerId);

  const takenColorIds = new Set(
    (roomState?.players || [])
      .filter(p => p.id !== myPlayerId)
      .map(p => p.colorId)
  );

  if (avEl) {
    avEl.innerHTML = '';
    for (const av of PLAYER_AVATARS) {
      const chip = document.createElement('div');
      chip.className = `avatar-chip ${myProfile.avatar === av ? 'selected' : ''}`;
      chip.textContent = av;
      chip.addEventListener('click', () => {
        myProfile.avatar = av;
        localStorage.setItem('catan_avatar', av);
        renderAllPickers();
        if (sendToServer) socket.emit('update_profile', { avatar: av });
      });
      avEl.appendChild(chip);
    }
  }

  if (colEl) {
    colEl.innerHTML = '';
    for (const c of PLAYER_COLORS) {
      const isTaken = sendToServer && takenColorIds.has(c.id);
      const sw = document.createElement('div');
      sw.className = `color-swatch ${myProfile.colorId === c.id ? 'selected' : ''} ${isTaken ? 'taken' : ''}`;
      sw.style.background = c.hex;
      sw.title = isTaken ? `${c.name} (En uso por otro jugador)` : c.name;
      if (isTaken) {
        sw.textContent = '🔒';
      }
      sw.addEventListener('click', () => {
        if (isTaken) {
          showToast(`⚠️ El color ${c.name} ya está en uso por otro jugador.`);
          return;
        }
        myProfile.colorId = c.id;
        localStorage.setItem('catan_color', c.id);
        renderAllPickers();
        if (sendToServer) {
          socket.emit('update_profile', { colorId: c.id }, (res) => {
            if (res?.error) showToast(`⚠️ ${res.error}`);
          });
        }
      });
      colEl.appendChild(sw);
    }
  }

  if (stEl) {
    stEl.innerHTML = '';
    for (const st of PIECE_STYLES) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `style-chip ${myProfile.pieceStyle === st.id ? 'selected' : ''}`;
      btn.textContent = st.name;
      btn.addEventListener('click', () => {
        myProfile.pieceStyle = st.id;
        localStorage.setItem('catan_style', st.id);
        renderAllPickers();
        if (sendToServer) socket.emit('update_profile', { pieceStyle: st.id });
      });
      stEl.appendChild(btn);
    }
  }
}

function renderAllPickers() {
  renderProfilePickers('init-avatar-picker', 'init-color-picker', 'init-style-picker', false);
  renderProfilePickers('lobby-avatar-picker', 'lobby-color-picker', 'lobby-style-picker', true);
  updateLive3DPreview();
}

renderAllPickers();

// =========================================================
// EVENTOS DEL LOBBY, LINK DE INVITACIÓN Y RECONEXIÓN AUTOMÁTICA
// =========================================================
const nameInput = document.getElementById('player-name-input');
const codeInput = document.getElementById('room-code-input');
const lobbyError = document.getElementById('lobby-error');
const btnCreateRoom = document.getElementById('btn-create-room');
const btnJoinRoom = document.getElementById('btn-join-room');

nameInput.value = sessionStorage.getItem('catan_tab_username') || localStorage.getItem('catan_saved_username') || '';
nameInput.addEventListener('input', () => {
  nameInput.classList.remove('input-error');
  lobbyError.classList.add('hidden');
});

const urlParams = new URLSearchParams(window.location.search);
const invitedRoomParam = (urlParams.get('room') || '').trim().toUpperCase();
const autoJoinParam = urlParams.get('autojoin') === '1';
const urlNameParam = (urlParams.get('name') || '').trim();

if (urlNameParam.length >= 2) {
  nameInput.value = urlNameParam.slice(0, 18);
  localStorage.setItem('catan_saved_username', nameInput.value);
  sessionStorage.setItem('catan_tab_username', nameInput.value);
}

function applyInviteModeUI(code) {
  if (!code) return;
  codeInput.value = code;
  const banner = document.getElementById('invite-detected-banner');
  const codeSpan = document.getElementById('invite-banner-code');
  if (banner && codeSpan) {
    codeSpan.textContent = code;
    banner.classList.remove('hidden');
  }
  if (btnJoinRoom) {
    btnJoinRoom.textContent = `🚀 Conectarme a la Sala ${code}`;
  }
  const joinBox = document.getElementById('join-row-box');
  const hostBox = document.getElementById('host-card-box');
  if (joinBox && hostBox && joinBox.parentNode) {
    joinBox.classList.add('highlighted-invite-card');
    joinBox.parentNode.insertBefore(joinBox, hostBox);
  }
}

if (invitedRoomParam) {
  applyInviteModeUI(invitedRoomParam);
}

function showLobbyError(msg) {
  lobbyError.textContent = msg;
  lobbyError.classList.remove('hidden');
}

function getValidatedPlayerName() {
  const clean = nameInput.value.trim();
  if (clean.length < 2) {
    nameInput.classList.add('input-error');
    nameInput.focus();
    showLobbyError('⚠️ Primero escribe tu nombre arriba a la izquierda (mínimo 2 letras).');
    playTone(220, 0.18, 'sawtooth');
    return null;
  }
  localStorage.setItem('catan_saved_username', clean);
  sessionStorage.setItem('catan_tab_username', clean);
  return clean;
}

function performJoinRoom(roomCode, playerName, isSilentReconnect = false) {
  socket.emit('join_room', { roomCode, playerName, playerId: myPlayerId, profile: myProfile }, (res) => {
    if (res?.error) {
      if (!isSilentReconnect) showLobbyError(res.error);
      return;
    }
    if (res?.playerId) {
      myPlayerId = res.playerId;
      sessionStorage.setItem('catan_player_id', myPlayerId);
    }
    sessionStorage.setItem('catan_active_room', res.roomCode);
    sessionStorage.setItem('catan_tab_username', playerName);
    window.history.replaceState({}, '', `?room=${res.roomCode}`);
    if (!isSilentReconnect) playTone(580, 0.15, 'triangle');
  });
}

btnCreateRoom.addEventListener('click', () => {
  const playerName = getValidatedPlayerName();
  if (!playerName) return;
  lobbyError.classList.add('hidden');

  socket.emit('create_room', { playerName, playerId: myPlayerId, profile: myProfile }, (res) => {
    if (res?.error) return showLobbyError(res.error);
    if (res?.playerId) {
      myPlayerId = res.playerId;
      sessionStorage.setItem('catan_player_id', myPlayerId);
    }
    sessionStorage.setItem('catan_active_room', res.roomCode);
    sessionStorage.setItem('catan_tab_username', playerName);
    window.history.replaceState({}, '', `?room=${res.roomCode}`);
    playTone(520, 0.15, 'triangle');
  });
});

btnJoinRoom.addEventListener('click', () => {
  const playerName = getValidatedPlayerName();
  if (!playerName) return;

  const rawInput = codeInput.value.trim();
  if (!rawInput) {
    codeInput.focus();
    return showLobbyError('⚠️ Pega el Link completo o el Código de 4 letras que te pasó tu amigo.');
  }

  // Si pegaron un link completo (ej: https://xxxx.lhr.life/?room=ABCD o http://192.168.0.6:3000/?room=ABCD)
  if (rawInput.includes('http://') || rawInput.includes('https://') || rawInput.includes('.lhr.life') || rawInput.includes(':3000')) {
    try {
      const normalized = rawInput.startsWith('http') ? rawInput : `https://${rawInput}`;
      const parsed = new URL(normalized);
      const roomFromUrl = (parsed.searchParams.get('room') || '').trim().toUpperCase();

      // Si el link apunta al servidor de un amigo en otra PC, redirigir en esta misma ventana
      if (parsed.origin !== window.location.origin) {
        parsed.searchParams.set('name', playerName);
        if (roomFromUrl) parsed.searchParams.set('autojoin', '1');
        window.location.href = parsed.toString();
        return;
      }

      if (roomFromUrl) {
        lobbyError.classList.add('hidden');
        performJoinRoom(roomFromUrl, playerName, false);
        return;
      }
      return showLobbyError('⚠️ Ese link no incluye un código de sala (?room=XXXX). Pídele a tu amigo que cree la sala primero.');
    } catch (_) {
      return showLobbyError('⚠️ El link pegado no es válido.');
    }
  }

  const roomCode = rawInput.toUpperCase().slice(0, 6);
  lobbyError.classList.add('hidden');
  performJoinRoom(roomCode, playerName, false);
});

nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (codeInput.value.trim()) {
      btnJoinRoom.click();
    } else {
      btnCreateRoom.click();
    }
  }
});

codeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    btnJoinRoom.click();
  }
});

// Reconexión automática si el jugador recarga con F5, micro-corte de Wi-Fi, o redirección desde link de amigo
socket.on('connect', () => {
  const pill = document.getElementById('server-status-pill');
  if (pill) {
    pill.textContent = '🟢 Servidor Online Activo';
    pill.classList.remove('offline');
  }
  const activeRoom = sessionStorage.getItem('catan_active_room');
  const savedTabName = sessionStorage.getItem('catan_tab_username') || localStorage.getItem('catan_saved_username');
  if (autoJoinParam && invitedRoomParam && savedTabName) {
    performJoinRoom(invitedRoomParam, savedTabName, false);
    return;
  }
  if (activeRoom && savedTabName && (!invitedRoomParam || invitedRoomParam === activeRoom)) {
    performJoinRoom(activeRoom, savedTabName, true);
  }
});

socket.on('disconnect', () => {
  const pill = document.getElementById('server-status-pill');
  if (pill) {
    pill.textContent = '🟡 Reconectando servidor...';
    pill.classList.add('offline');
  }
});

let serverInfo = { localUrl: window.location.origin, lanUrl: null, publicUrl: null };
let selectedInviteMode = 'auto';

function getInviteUrlForMode(mode = selectedInviteMode) {
  const code = roomState?.roomCode || invitedRoomParam || '';
  let base = window.location.origin;
  if (mode === 'local') {
    base = serverInfo.localUrl || 'http://localhost:3000';
  } else if (mode === 'lan') {
    base = serverInfo.lanUrl || window.location.origin;
  } else {
    const host = window.location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') {
      base = window.location.origin;
    } else {
      base = serverInfo.publicUrl || serverInfo.lanUrl || window.location.origin;
    }
  }
  return code ? `${base}/?room=${code}` : base;
}

function updateInviteBarUI() {
  const inputEl = document.getElementById('invite-url-input');
  if (inputEl && roomState?.roomCode) {
    inputEl.value = getInviteUrlForMode(selectedInviteMode);
  }
  const autoTab = document.getElementById('tab-link-auto');
  if (autoTab) {
    autoTab.textContent = serverInfo.publicUrl
      ? '🌐 Internet (Amigos)'
      : '🌐 Link Principal';
  }
  const initPubInput = document.getElementById('init-public-url');
  if (initPubInput) {
    initPubInput.value = serverInfo.publicUrl || 'Generando link de internet...';
  }
  const initLanInput = document.getElementById('init-lan-url');
  if (initLanInput) {
    initLanInput.value = serverInfo.lanUrl || serverInfo.localUrl || window.location.origin;
  }
}

document.getElementById('btn-copy-init-public')?.addEventListener('click', (e) => {
  const url = serverInfo.publicUrl || serverInfo.lanUrl || window.location.origin;
  copyTextSafe(url).then(() => {
    showToast(`📋 Link de Internet copiado: ${url}`);
    e.currentTarget.textContent = '✅ Copiado';
    setTimeout(() => { e.currentTarget.textContent = '📋 Copiar'; }, 2000);
  });
});

document.getElementById('btn-copy-init-lan')?.addEventListener('click', (e) => {
  const url = serverInfo.lanUrl || serverInfo.localUrl || window.location.origin;
  copyTextSafe(url).then(() => {
    showToast(`📋 Link Red Wi-Fi copiado: ${url}`);
    e.currentTarget.textContent = '✅ Copiado';
    setTimeout(() => { e.currentTarget.textContent = '📋 Copiar'; }, 2000);
  });
});

fetch('/api/server-info')
  .then(r => r.json())
  .then(info => {
    serverInfo = info;
    updateInviteBarUI();
  })
  .catch(() => {});

socket.on('server_info', (info) => {
  serverInfo = info;
  updateInviteBarUI();
});

document.querySelectorAll('.invite-mode-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    selectedInviteMode = tab.dataset.mode || 'auto';
    document.querySelectorAll('.invite-mode-tab').forEach(t => {
      t.classList.toggle('active', t === tab);
    });
    updateInviteBarUI();
  });
});

document.getElementById('invite-url-input')?.addEventListener('click', (e) => {
  e.target.select();
});

function copyTextSafe(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text).catch(() => fallbackCopyText(text));
  }
  return Promise.resolve(fallbackCopyText(text));
}

function fallbackCopyText(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    document.execCommand('copy');
  } catch (_) {}
  document.body.removeChild(ta);
}

function copyInviteLink() {
  if (!roomState) return;
  const link = getInviteUrlForMode(selectedInviteMode);
  const inputEl = document.getElementById('invite-url-input');
  if (inputEl) {
    inputEl.value = link;
    inputEl.select();
  }
  copyTextSafe(link).then(() => {
    showToast(`✅ ¡Link copiado! Pásaselo a tus amigos: ${link}`);
    const copyBtn = document.getElementById('btn-copy-link');
    if (copyBtn) {
      const oldText = copyBtn.textContent;
      copyBtn.textContent = '✅ ¡Link Copiado!';
      setTimeout(() => {
        copyBtn.textContent = oldText;
      }, 2200);
    }
  });
}

document.getElementById('btn-copy-link').addEventListener('click', copyInviteLink);
document.getElementById('hud-room-badge').addEventListener('click', copyInviteLink);

// =========================================================
// SALIR DE LA SALA (VOLVER AL MENÚ PRINCIPAL)
// =========================================================
function leaveCurrentRoom() {
  const inGame = roomState && roomState.status !== 'lobby' && roomState.status !== 'finished';
  if (inGame) {
    const ok = window.confirm('¿Seguro que quieres salir de la partida?\n\nTu lugar queda guardado: puedes volver entrando con el mismo nombre y código de sala.');
    if (!ok) return;
  }

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    sessionStorage.removeItem('catan_active_room');
    // Nueva identidad para que al unirse a otra sala no choque con la anterior
    sessionStorage.removeItem('catan_player_id');
    window.location.href = window.location.origin + '/';
  };

  socket.emit('leave_room', {}, finish);
  // Por si el servidor no responde (conexión lenta), salir igual
  setTimeout(finish, 1200);
}

document.getElementById('btn-leave-lobby')?.addEventListener('click', leaveCurrentRoom);
document.getElementById('btn-leave-game')?.addEventListener('click', leaveCurrentRoom);

document.getElementById('btn-reroll-map').addEventListener('click', () => {
  socket.emit('update_settings', { regenerateBoard: true }, (res) => {
    if (res?.error) showToast(res.error);
    else showToast('🗺️ ¡Nueva isla 3D generada!');
  });
});

document.getElementById('setting-vp').addEventListener('change', (e) => {
  socket.emit('update_settings', { vpToWin: Number(e.target.value) });
});

document.getElementById('setting-timer')?.addEventListener('change', (e) => {
  socket.emit('update_settings', { turnTimerSeconds: Number(e.target.value) });
});

// Modal de Reglas Avanzadas de Partida (Casas iniciales, Ladrón amistoso, Límite descarte)
const rulesModal = document.getElementById('game-rules-modal');
document.getElementById('btn-open-rules-modal')?.addEventListener('click', () => {
  if (rulesModal) rulesModal.classList.remove('hidden');
});
document.getElementById('btn-close-rules-modal')?.addEventListener('click', () => {
  if (rulesModal) rulesModal.classList.add('hidden');
});
document.getElementById('btn-save-rules-modal')?.addEventListener('click', () => {
  if (rulesModal) rulesModal.classList.add('hidden');
});

document.getElementById('modal-setting-initial')?.addEventListener('change', (e) => {
  socket.emit('update_settings', { initialSettlements: Number(e.target.value) });
});
document.getElementById('modal-setting-discard')?.addEventListener('change', (e) => {
  socket.emit('update_settings', { discardLimit: Number(e.target.value) });
});
document.getElementById('modal-setting-friendly-robber')?.addEventListener('change', (e) => {
  socket.emit('update_settings', { friendlyRobber: e.target.checked });
});
document.getElementById('modal-setting-pity-production')?.addEventListener('change', (e) => {
  socket.emit('update_settings', { pityProduction: e.target.checked });
});
document.getElementById('modal-setting-generous-bank')?.addEventListener('change', (e) => {
  socket.emit('update_settings', { generousBank: e.target.checked });
});
document.getElementById('modal-setting-starting-bonus')?.addEventListener('change', (e) => {
  socket.emit('update_settings', { startingBonus: e.target.checked });
});

document.getElementById('setting-map-mode')?.addEventListener('change', (e) => {
  socket.emit('update_settings', { mapMode: e.target.value }, (res) => {
    if (res?.error) return showToast(res.error);
    showToast(e.target.value === 'official'
      ? '📜 Mapa Original/Oficial cargado'
      : '🎲 Mapa Aleatorio cargado');
  });
});

document.getElementById('setting-map-size')?.addEventListener('change', (e) => {
  socket.emit('update_settings', { mapSize: e.target.value }, (res) => {
    if (res?.error) return showToast(res.error);
    showToast(e.target.value === 'xl'
      ? '🌋 Tamaño de mapa cambiado a XL (30 Hexágonos)'
      : '⛵ Tamaño de mapa cambiado a Normal (19 Hexágonos)');
  });
});

document.querySelectorAll('.theme-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const theme = btn.dataset.theme;
    applyTheme(theme, true);
  });
});

document.getElementById('btn-cycle-theme')?.addEventListener('click', () => {
  const currentSetting = roomState?.settings?.theme || 'dynamic';
  let idx = THEMES_ORDER.indexOf(currentSetting);
  if (idx === -1) idx = 0;
  idx = (idx + 1) % THEMES_ORDER.length;
  const nextTheme = THEMES_ORDER[idx];
  applyTheme(nextTheme, true);
});

function applyTheme(theme, isUserAction = false) {
  const currentMode = theme === 'dynamic' ? 'dynamic' : theme;

  if (isUserAction) {
    socket.emit('update_settings', { theme: currentMode }, (res) => {
      if (res?.error) showToast(res.error);
    });
  }

  document.querySelectorAll('.theme-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.theme === currentMode);
  });

  if (currentMode === 'dynamic') {
    const activeWeather = roomState?.weather?.currentTheme || 'sunrise';
    board3D.setTheme(activeWeather, true);
    const wIcon = roomState?.weather?.icon || '🌄';
    const wName = roomState?.weather?.name || 'Amanecer';
    const cycleBtn = document.getElementById('btn-cycle-theme');
    if (cycleBtn) cycleBtn.textContent = `🔄 ${wIcon} ${wName}`;
  } else {
    board3D.setTheme(currentMode, true);
    const cycleBtn = document.getElementById('btn-cycle-theme');
    if (cycleBtn) cycleBtn.textContent = THEME_NAMES[currentMode] || '☀️ Clima';
  }
}

document.getElementById('btn-add-bot').addEventListener('click', () => {
  socket.emit('add_bot', {}, (res) => {
    if (res?.error) showToast(res.error);
  });
});

document.getElementById('btn-start-game').addEventListener('click', () => {
  socket.emit('start_game', {}, (res) => {
    if (res?.error) showToast(res.error);
  });
});

// =========================================================
// INTERACCIÓN CON EL TABLERO 3D
// =========================================================
function handle3DSelection({ type, id }) {
  if (!roomState) return;

  if (type === 'vertex') {
    if (roomState.phase === 'setup_settlement' || buildMode === 'settlement') {
      sendGameAction({ type: 'place_settlement', vertexId: id });
      buildMode = null;
    } else if (buildMode === 'city') {
      sendGameAction({ type: 'upgrade_city', vertexId: id });
      buildMode = null;
    }
  } else if (type === 'edge') {
    if (
      roomState.phase === 'setup_road' ||
      roomState.phase === 'road_building_1' ||
      roomState.phase === 'road_building_2' ||
      buildMode === 'road'
    ) {
      sendGameAction({ type: 'place_road', edgeId: id });
      buildMode = null;
    }
  } else if (type === 'hex') {
    if (roomState.phase === 'robber_move') {
      sendGameAction({ type: 'move_robber', hexId: id });
    }
  }
}

function sendGameAction(action, onSuccess) {
  socket.emit('game_action', action, (res) => {
    if (res?.error) {
      showToast(`⚠️ ${res.error}`);
      playTone(220, 0.18, 'sawtooth');
    } else {
      playTone(640, 0.12, 'triangle');
      if (onSuccess) onSuccess(res);
    }
  });
}

// =========================================================
// CONTROLES DEL HUD, REACCIONES, ESTADÍSTICAS Y REGLAS
// =========================================================
document.getElementById('btn-reset-camera').addEventListener('click', () => {
  board3D.resetCamera();
});

document.getElementById('btn-lobby-rules').addEventListener('click', () => {
  document.getElementById('costs-modal').classList.remove('hidden');
});

document.getElementById('btn-costs-help').addEventListener('click', () => {
  document.getElementById('costs-modal').classList.remove('hidden');
});

document.getElementById('btn-close-costs').addEventListener('click', () => {
  document.getElementById('costs-modal').classList.add('hidden');
});

document.getElementById('btn-open-stats')?.addEventListener('click', () => {
  renderStatsModal();
  document.getElementById('stats-modal').classList.remove('hidden');
});

document.getElementById('dice-box')?.addEventListener('click', () => {
  renderStatsModal();
  document.getElementById('stats-modal').classList.remove('hidden');
});

document.getElementById('btn-close-stats')?.addEventListener('click', () => {
  document.getElementById('stats-modal').classList.add('hidden');
});

document.querySelectorAll('.reaction-chip').forEach(btn => {
  btn.addEventListener('click', () => {
    socket.emit('send_reaction', {
      emoji: btn.dataset.emoji,
      text: btn.dataset.text
    });
  });
});

document.getElementById('btn-roll-dice').addEventListener('click', () => {
  sendGameAction({ type: 'roll_dice' });
});

document.getElementById('btn-build-road').addEventListener('click', () => {
  buildMode = buildMode === 'road' ? null : 'road';
  refreshUI();
});

document.getElementById('btn-build-settlement').addEventListener('click', () => {
  buildMode = buildMode === 'settlement' ? null : 'settlement';
  refreshUI();
});

document.getElementById('btn-build-city').addEventListener('click', () => {
  buildMode = buildMode === 'city' ? null : 'city';
  refreshUI();
});

document.getElementById('btn-buy-dev').addEventListener('click', () => {
  sendGameAction({ type: 'buy_dev_card' }, (res) => {
    if (res?.cardType && DEV_CARD_INFO[res.cardType]) {
      const info = DEV_CARD_INFO[res.cardType];
      showToast(`🃏 Obtuviste: ${info.emoji} ${info.name}`);
    }
  });
});

document.getElementById('btn-open-trade').addEventListener('click', () => {
  openTradeModal();
});

document.getElementById('btn-end-turn').addEventListener('click', () => {
  buildMode = null;
  sendGameAction({ type: 'end_turn' });
});

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

document.getElementById('chat-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;
  socket.emit('send_chat', { text });
  input.value = '';
});

// =========================================================
// SINCRONIZACIÓN DE ESTADO
// =========================================================
socket.on('room_state', (state) => {
  roomState = state;
  const me = roomState.players.find(p => p.id === myPlayerId);
  if (me) {
    myProfile.colorId = me.colorId;
    myProfile.avatar = me.avatar || '👑';
    myProfile.pieceStyle = me.pieceStyle || 'medieval';
  }
  renderAllPickers();
  refreshUI();
});

function refreshUI() {
  if (!roomState) return;

  // Sincronización continua del Clima y Atmósfera 3D (activa tanto en Lobby como In-Game)
  const activeTheme = roomState.settings?.theme || 'dynamic';
  document.querySelectorAll('.theme-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.theme === activeTheme);
    b.disabled = roomState.hostId !== myPlayerId;
  });

  if (roomState.weather) {
    if (activeTheme === 'dynamic') {
      const targetWeather = roomState.weather.currentTheme || 'sunrise';
      board3D.setTheme(targetWeather, true);

      if (roomState.status !== 'lobby' && targetWeather !== lastAnnouncedWeatherTheme) {
        const icon = roomState.weather.icon || '🌤️';
        const name = roomState.weather.name || 'Clima';
        const desc = roomState.weather.description || '';
        showToast(`${icon} Clima en Catan: ¡${name}! ${desc}`, 5000);
        if (targetWeather === 'snow') {
          playTone(784, 0.2, 'sine');
          setTimeout(() => playTone(1046, 0.25, 'sine'), 160);
          setTimeout(() => playTone(1318, 0.4, 'sine'), 320);
        }
        lastAnnouncedWeatherTheme = targetWeather;
      }

      const cycleBtn = document.getElementById('btn-cycle-theme');
      if (cycleBtn) {
        cycleBtn.textContent = `🔄 ${roomState.weather.icon || '🌄'} ${roomState.weather.name || 'Dinámico'}`;
        cycleBtn.title = `Clima Dinámico en vivo: ${roomState.weather.name} (${roomState.weather.description || ''})`;
      }
    } else {
      board3D.setTheme(activeTheme, true);
      const cycleBtn = document.getElementById('btn-cycle-theme');
      if (cycleBtn) {
        cycleBtn.textContent = THEME_NAMES[activeTheme] || '☀️ Clima';
        cycleBtn.title = `Atmósfera fija: ${THEME_NAMES[activeTheme]}`;
      }
    }
  }

  const lobbyOverlay = document.getElementById('lobby-overlay');
  const gameHud = document.getElementById('game-hud');

  if (roomState.status === 'lobby') {
    victoryShownForRoom = null;
    document.getElementById('victory-modal')?.classList.add('hidden');
    lobbyOverlay.classList.remove('hidden');
    gameHud.classList.add('hidden');
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('waiting-room-section').classList.remove('hidden');

    document.getElementById('lobby-room-code').textContent = roomState.roomCode;
    document.getElementById('lobby-player-count').textContent = roomState.players.length;
    updateInviteBarUI();

    const listEl = document.getElementById('lobby-player-list');
    listEl.innerHTML = '';
    const isHost = roomState.hostId === myPlayerId;

    const styleLabels = {
      medieval: '🏰 Medieval',
      imperial: '🏛️ Imperio Romano',
      nordic: '🛡️ Clan Vikingo',
      oriental: '⛩️ Dinastía Oriental'
    };

    roomState.players.forEach(p => {
      const row = document.createElement('div');
      row.className = 'lobby-player-item';
      row.innerHTML = `
        <div class="player-badge">
          <span style="font-size:18px">${p.avatar || '👑'}</span>
          <span class="color-dot" style="background:${p.color}" title="${p.colorName}"></span>
          <span>${p.name} <small style="color:#94a3b8">(${p.colorName})</small> ${p.id === roomState.hostId ? '⭐' : ''}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:11.5px;color:#fbbf24">${styleLabels[p.pieceStyle] || '🏰 Medieval'}</span>
          ${isHost && p.id !== myPlayerId ? `<button class="btn btn-secondary btn-sm remove-btn" data-id="${p.id}">✕</button>` : ''}
        </div>
      `;
      listEl.appendChild(row);
    });

    listEl.querySelectorAll('.remove-btn').forEach(b => {
      b.addEventListener('click', () => {
        socket.emit('remove_player', { targetId: b.dataset.id });
      });
    });

    if (roomState.settings) {
      const vpSel = document.getElementById('setting-vp');
      const timerSel = document.getElementById('setting-timer');
      const mapSel = document.getElementById('setting-map-mode');
      const mapSizeSel = document.getElementById('setting-map-size');
      const modalInitSel = document.getElementById('modal-setting-initial');
      const modalDiscSel = document.getElementById('modal-setting-discard');
      const modalFrChk = document.getElementById('modal-setting-friendly-robber');

      if (vpSel) {
        vpSel.value = String(roomState.settings.vpToWin || 10);
        vpSel.disabled = !isHost;
      }
      if (timerSel) {
        timerSel.value = String(roomState.settings.turnTimerSeconds ?? 90);
        timerSel.disabled = !isHost;
      }
      if (mapSel) {
        mapSel.value = roomState.settings.mapMode || 'random';
        mapSel.disabled = !isHost;
      }
      if (mapSizeSel) {
        mapSizeSel.value = roomState.settings.mapSize || 'normal';
        mapSizeSel.disabled = !isHost;
      }
      if (modalInitSel) {
        modalInitSel.value = String(roomState.settings.initialSettlements ?? 1);
        modalInitSel.disabled = !isHost;
      }
      if (modalDiscSel) {
        modalDiscSel.value = String(roomState.settings.discardLimit || 7);
        modalDiscSel.disabled = !isHost;
      }
      if (modalFrChk) {
        modalFrChk.checked = Boolean(roomState.settings.friendlyRobber);
        modalFrChk.disabled = !isHost;
      }
      const modalPityChk = document.getElementById('modal-setting-pity-production');
      if (modalPityChk) {
        modalPityChk.checked = Boolean(roomState.settings.pityProduction);
        modalPityChk.disabled = !isHost;
      }
      const modalGenBankChk = document.getElementById('modal-setting-generous-bank');
      if (modalGenBankChk) {
        modalGenBankChk.checked = Boolean(roomState.settings.generousBank);
        modalGenBankChk.disabled = !isHost;
      }
      const modalStartBonusChk = document.getElementById('modal-setting-starting-bonus');
      if (modalStartBonusChk) {
        modalStartBonusChk.checked = Boolean(roomState.settings.startingBonus);
        modalStartBonusChk.disabled = !isHost;
      }
      const openRulesBtn = document.getElementById('btn-open-rules-modal');
      if (openRulesBtn) {
        const titleEl = openRulesBtn.querySelector('.cta-title');
        if (titleEl) {
          titleEl.textContent = isHost ? 'Reglas Avanzadas y Modos de Juego...' : 'Ver Reglas y Modos de la Partida';
        }
      }
    }

    const isOfficialMap = roomState.settings?.mapMode === 'official';
    const rerollBtn = document.getElementById('btn-reroll-map');
    rerollBtn.disabled = !isHost || isOfficialMap;
    rerollBtn.title = isOfficialMap
      ? 'El mapa oficial siempre es igual. Cambia a modo Aleatorio para generar otra isla.'
      : 'Generar nueva isla 3D aleatoria';
    document.getElementById('btn-add-bot').disabled = !isHost || roomState.players.length >= 4;
    document.getElementById('btn-start-game').disabled = !isHost || roomState.players.length < 2;
    document.getElementById('waiting-hint').textContent = isHost
      ? (roomState.players.length < 2 ? 'Agrega un Bot IA o comparte el link con un amigo para comenzar.' : '¡Todo listo! Puedes personalizar las reglas o iniciar la partida.')
      : 'Personaliza tu emblema, color libre y arquitectura 3D mientras el anfitrión inicia...';

    updateLive3DPreview();
    board3D.updateFromState(roomState, myPlayerId, null, myProfile);
    return;
  }

  lobbyOverlay.classList.add('hidden');
  gameHud.classList.remove('hidden');
  document.getElementById('hud-room-code').textContent = roomState.roomCode;

  const me = roomState.players.find(p => p.id === myPlayerId);
  const activePlayer = roomState.players[roomState.turnIndex];
  const isMyTurn = activePlayer && activePlayer.id === myPlayerId;

  // Alerta sonora y destello dorado cuando empieza tu turno
  if (roomState.activePlayerId !== lastActivePlayerId) {
    lastActivePlayerId = roomState.activePlayerId;
    if (isMyTurn && roomState.status !== 'finished') {
      playTone(523.25, 0.12, 'triangle');
      setTimeout(() => playTone(659.25, 0.18, 'triangle'), 110);
      const flashEl = document.getElementById('turn-alert-flash');
      if (flashEl) {
        flashEl.classList.remove('hidden');
        setTimeout(() => flashEl.classList.add('hidden'), 1500);
      }
    }
  }
  document.title = isMyTurn && roomState.status !== 'finished'
    ? '🔔 ¡ES TU TURNO! — Catan 3D'
    : 'Catan 3D Online — Conquista la Isla';

  updateTurnBanner(activePlayer, isMyTurn);
  updateTurnCountdownUI();

  board3D.updateFromState(roomState, myPlayerId, buildMode);

  renderPlayersPanel();
  if (me) renderMyHand(me, isMyTurn);
  updateActionButtons(me, isMyTurn);

  if (roomState.lastDice) {
    document.getElementById('die-1').textContent = roomState.lastDice.d1;
    document.getElementById('die-2').textContent = roomState.lastDice.d2;
    document.getElementById('dice-sum').textContent = `= ${roomState.lastDice.sum}`;
    if (roomState.lastDice.rollId && roomState.lastDice.rollId !== lastSeenRollId) {
      lastSeenRollId = roomState.lastDice.rollId;
      triggerDiceRollAnimation(roomState.lastDice, roomState.board);
    }
  } else {
    document.getElementById('die-1').textContent = '?';
    document.getElementById('die-2').textContent = '?';
    document.getElementById('dice-sum').textContent = '-';
  }

  if (roomState.lastHarvest && roomState.lastHarvest.harvestId !== lastSeenHarvestId) {
    lastSeenHarvestId = roomState.lastHarvest.harvestId;
    const delayMs = roomState.lastHarvest.delayed ? 1150 : 80;
    const harvestCopy = roomState.lastHarvest;
    const boardCopy = roomState.board;
    setTimeout(() => {
      triggerHarvestCardsAnimation(harvestCopy, boardCopy);
    }, delayMs);
  }

  renderLogsAndChat();
  renderActiveTradeBanner();
  checkDiscardModal(me);
  checkStealModal(isMyTurn);
  checkVictoryModal();
  if (!document.getElementById('trade-modal')?.classList.contains('hidden')) {
    renderTradeModalContent();
  }
  if (!document.getElementById('stats-modal')?.classList.contains('hidden')) {
    renderStatsModal();
  }
}

let lastSeenRollId = null;
let lastSeenHarvestId = null;
let lastActivePlayerId = null;
let diceAnimInterval = null;
let diceAnimHideTimeout = null;
let activeReactionsByPlayer = {};

// Reloj de cuenta regresiva del turno
setInterval(() => {
  updateTurnCountdownUI();
}, 500);

function updateTurnCountdownUI() {
  const badge = document.getElementById('turn-timer-badge');
  if (!badge) return;
  if (!roomState || !roomState.turnDeadline || roomState.status === 'lobby' || roomState.status === 'finished') {
    badge.classList.add('hidden');
    return;
  }
  badge.classList.remove('hidden');
  const remSec = Math.max(0, Math.ceil((roomState.turnDeadline - Date.now()) / 1000));
  const mins = String(Math.floor(remSec / 60)).padStart(2, '0');
  const secs = String(remSec % 60).padStart(2, '0');
  badge.textContent = `⏱️ ${mins}:${secs}`;
  badge.classList.toggle('timer-low', remSec <= 15);
}

// Animación de cartas de recursos volando desde los hexágonos 3D hacia tu mano (o hacia el jugador que cosechó)
function triggerHarvestCardsAnimation(harvest, board) {
  const layer = document.getElementById('flying-cards-layer');
  if (!layer || !harvest || !Array.isArray(harvest.items)) return;

  harvest.items.forEach((item, idx) => {
    const info = RESOURCES_INFO[item.resource];
    if (!info) return;

    const startPos = board3D.getHexScreenPosition(item.hexId, board);
    let endX = window.innerWidth / 2;
    let endY = window.innerHeight - 60;

    if (item.playerId === myPlayerId) {
      const myResEl = document.getElementById('my-resources');
      if (myResEl) {
        const rect = myResEl.getBoundingClientRect();
        endX = rect.left + rect.width / 2;
        endY = rect.top + rect.height / 2;
      }
    } else {
      const pCard = document.querySelector(`[data-player-card-id="${item.playerId}"]`);
      if (pCard) {
        const rect = pCard.getBoundingClientRect();
        endX = rect.left + rect.width / 2;
        endY = rect.top + rect.height / 2;
      }
    }

    const cardEl = document.createElement('div');
    cardEl.className = 'flying-resource-card';
    cardEl.style.left = `${startPos.x + (idx % 3 - 1) * 24}px`;
    cardEl.style.top = `${startPos.y - 10}px`;
    cardEl.innerHTML = `
      <span class="frc-qty">+${item.qty}</span>
      <span class="frc-emoji">${info.emoji}</span>
      <span class="frc-name">${info.name}</span>
    `;
    layer.appendChild(cardEl);

    // Fase 1: Flotar sobre el hexágono productor para que se vea qué salió
    setTimeout(() => {
      cardEl.style.transform = `translate(-50%, -85%) scale(1.12)`;
    }, 30 + idx * 90);

    // Fase 2: Volar hacia la mano del jugador
    setTimeout(() => {
      cardEl.style.left = `${endX}px`;
      cardEl.style.top = `${endY}px`;
      cardEl.style.transform = `translate(-50%, -50%) scale(0.55)`;
      cardEl.style.opacity = '0.15';
      if (item.playerId === myPlayerId) {
        playTone(740 + idx * 60, 0.08, 'sine');
      }
    }, 780 + idx * 110);

    setTimeout(() => {
      cardEl.remove();
    }, 1550 + idx * 110);
  });
}

// Recepción de mensajes de chat en tiempo real
socket.on('chat_message', (msg) => {
  if (!msg || !roomState) return;
  if (!roomState.chat) roomState.chat = [];
  if (!roomState.chat.some(m => m.id === msg.id)) {
    roomState.chat.push(msg);
  }
  playTone(620, 0.06, 'sine');
  renderLogsAndChat();
});

// Recepción de reacciones rápidas animadas (se ven en el Chat y en la tarjeta del jugador)
socket.on('player_reaction', (data) => {
  if (!data || !data.playerId) return;
  if (roomState) {
    if (!roomState.chat) roomState.chat = [];
    if (!roomState.chat.some(m => m.id === data.id)) {
      roomState.chat.push(data);
    }
    renderLogsAndChat();
  }
  activeReactionsByPlayer[data.playerId] = {
    emoji: data.emoji,
    text: data.reactionLabel || data.text,
    expiresAt: Date.now() + 3800
  };
  playTone(580, 0.08, 'sine');
  setTimeout(() => playTone(780, 0.1, 'triangle'), 70);
  renderPlayersPanel();
  setTimeout(() => {
    if (activeReactionsByPlayer[data.playerId]?.expiresAt <= Date.now()) {
      delete activeReactionsByPlayer[data.playerId];
      renderPlayersPanel();
    }
  }, 3900);
});

function renderStatsModal() {
  if (!roomState) return;
  const stats = roomState.stats || {
    diceHistogram: { 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 },
    totalRolls: 0,
    robberCount: 0,
    producedByPlayer: {}
  };

  const pillsEl = document.getElementById('stats-summary-pills');
  const chartEl = document.getElementById('stats-dice-chart');
  const prodEl = document.getElementById('stats-production-list');
  if (!pillsEl || !chartEl || !prodEl) return;

  let mostRolledNum = '-';
  let maxCount = 0;
  for (let n = 2; n <= 12; n++) {
    const c = stats.diceHistogram[n] || 0;
    if (c > maxCount) {
      maxCount = c;
      mostRolledNum = `${n} (${c} veces)`;
    }
  }

  pillsEl.innerHTML = `
    <div class="stat-pill">🎲 Tiradas Totales: <strong>${stats.totalRolls}</strong></div>
    <div class="stat-pill">🔥 Número más repetido: <strong>${mostRolledNum}</strong></div>
    <div class="stat-pill">🥷 Veces que salió el 7: <strong>${stats.robberCount || 0}</strong></div>
  `;

  const barMax = Math.max(1, maxCount);
  chartEl.innerHTML = '';
  for (let n = 2; n <= 12; n++) {
    const count = stats.diceHistogram[n] || 0;
    const heightPct = Math.round((count / barMax) * 100);
    const col = document.createElement('div');
    col.className = 'dice-bar-col';
    const isHot = n === 6 || n === 8;
    const isSeven = n === 7;
    col.innerHTML = `
      <span class="dbc-count">${count}</span>
      <div class="dbc-track">
        <div class="dbc-fill ${isSeven ? 'fill-robber' : (isHot ? 'fill-hot' : '')}" style="height:${Math.max(count > 0 ? 12 : 3, heightPct)}%"></div>
      </div>
      <span class="dbc-num ${isHot ? 'hot-num' : ''}">${n}</span>
    `;
    chartEl.appendChild(col);
  }

  prodEl.innerHTML = '';
  roomState.players.forEach(p => {
    const pStats = stats.producedByPlayer?.[p.id] || { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0, total: 0 };
    const row = document.createElement('div');
    row.className = 'stats-prod-row';
    row.innerHTML = `
      <div class="spr-player">
        <span>${p.avatar || '👑'}</span>
        <span class="color-dot" style="background:${p.color}"></span>
        <strong>${p.name}</strong>
      </div>
      <div class="spr-resources">
        <span>🌲 ${pStats.wood || 0}</span>
        <span>🧱 ${pStats.brick || 0}</span>
        <span>🐑 ${pStats.sheep || 0}</span>
        <span>🌾 ${pStats.wheat || 0}</span>
        <span>⛰️ ${pStats.ore || 0}</span>
        <strong class="spr-total">Total: ${pStats.total || 0}</strong>
      </div>
    `;
    prodEl.appendChild(row);
  });
}

// Mapa de posiciones de los puntos (pips) en una cuadrícula 3x3 (índices 0..8)
const DIE_PIP_POSITIONS = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8]
};

function renderDieFacePips(faceEl, number) {
  if (!faceEl) return;
  faceEl.innerHTML = '';
  const activeCells = DIE_PIP_POSITIONS[number] || [4];
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement('div');
    if (activeCells.includes(i)) {
      cell.className = `die-pip ${number === 1 || number === 4 ? 'red-pip' : ''}`;
    }
    faceEl.appendChild(cell);
  }
}

function triggerDiceRollAnimation(diceData, board) {
  const overlay = document.getElementById('dice-roll-overlay');
  const label = document.getElementById('dice-roller-label');
  const die1El = document.getElementById('anim-die-1');
  const die2El = document.getElementById('anim-die-2');
  const face1El = document.getElementById('anim-die-face-1');
  const face2El = document.getElementById('anim-die-face-2');
  const badge = document.getElementById('dice-total-badge');

  if (!overlay) return;
  if (diceAnimInterval) clearInterval(diceAnimInterval);
  if (diceAnimHideTimeout) clearTimeout(diceAnimHideTimeout);

  overlay.classList.remove('hidden');
  label.textContent = `🎲 ${diceData.rollerAvatar || '👑'} ${diceData.rollerName || 'Jugador'} lanza los dados 3D al mapa...`;
  badge.textContent = 'Rodando en la isla...';
  badge.classList.remove('robber-alert');

  die1El.className = 'anim-die rolling';
  die2El.className = 'anim-die rolling';

  // Lanzar los dados 3D físicos sobre el tablero de Catan
  board3D.roll3DDice(diceData.d1, diceData.d2, board, {
    onBounce: (idx) => {
      playTone(idx === 0 ? 320 : 410, 0.06, 'triangle');
    },
    onKnock: () => {
      playTone(185, 0.05, 'square');
    },
    onLanded: () => {
      if (diceAnimInterval) {
        clearInterval(diceAnimInterval);
        diceAnimInterval = null;
      }
      die1El.className = 'anim-die landed';
      die2El.className = 'anim-die landed';
      renderDieFacePips(face1El, diceData.d1);
      renderDieFacePips(face2El, diceData.d2);

      if (diceData.sum === 7) {
        badge.textContent = `🥷 ¡SALIÓ UN 7! (${diceData.d1} + ${diceData.d2}) — ¡EL LADRÓN!`;
        badge.classList.add('robber-alert');
        playTone(190, 0.3, 'sawtooth');
      } else {
        badge.textContent = `✨ ¡SALIÓ EL ${diceData.sum}! (${diceData.d1} + ${diceData.d2})`;
        playTone(680, 0.22, 'sine');
        board3D.highlightRolledNumber(diceData.sum, board);
      }

      diceAnimHideTimeout = setTimeout(() => {
        overlay.classList.add('hidden');
      }, 4200);
    }
  });

  diceAnimInterval = setInterval(() => {
    const r1 = Math.floor(Math.random() * 6) + 1;
    const r2 = Math.floor(Math.random() * 6) + 1;
    renderDieFacePips(face1El, r1);
    renderDieFacePips(face2El, r2);
  }, 90);
}

function updateTurnBanner(activePlayer, isMyTurn) {
  const dot = document.getElementById('turn-dot');
  const title = document.getElementById('turn-title');
  const sub = document.getElementById('turn-subtitle');

  if (!activePlayer) return;
  dot.style.background = activePlayer.color;
  dot.style.boxShadow = `0 0 10px ${activePlayer.color}`;

  const isSetup = roomState.phase === 'setup_settlement' || roomState.phase === 'setup_road';
  const isSecondSetupRound = isSetup && roomState.setupStep >= roomState.players.length;
  const setupBadge = isSetup
    ? (isSecondSetupRound
        ? ' [Ronda Inicial 2/2: Orden Inverso 🔄]'
        : ' [Ronda Inicial 1/2: Orden de Ida ➡️]')
    : '';

  const who = isMyTurn
    ? `${activePlayer.avatar || '👑'} ¡Es tu turno!${setupBadge}`
    : `${activePlayer.avatar || '👑'} Turno de ${activePlayer.name}${setupBadge}`;
  title.textContent = who;

  const phaseDescriptions = {
    setup_settlement: isMyTurn
      ? (isSecondSetupRound
          ? 'Coloca tu 2° Poblado (en orden inverso el último jugador repite turno y recibe los recursos vecinos).'
          : 'Haz clic en una esfera verde del tablero 3D para fundar tu 1° Poblado inicial.')
      : (isSecondSetupRound
          ? 'Colocando su 2° Poblado inicial (orden inverso en serpiente)...'
          : 'Está eligiendo dónde fundar su 1° Poblado inicial...'),
    setup_road: isMyTurn
      ? 'Haz clic en una franja azul junto a tu poblado recién puesto para trazar tu Camino inicial.'
      : 'Está colocando su Camino inicial...',
    roll: isMyTurn
      ? 'Tira los dados para producir recursos (o juega un Caballero antes).'
      : 'Esperando lanzamiento de dados...',
    discard: '¡Salió un 7! Los jugadores que superaron el límite deben descartar la mitad.',
    robber_move: isMyTurn
      ? '🥷 Haz clic en cualquier hexágono del tablero 3D para mover al Ladrón.'
      : `${activePlayer.name} está moviendo al Ladrón...`,
    robber_steal: isMyTurn
      ? '🥷 Elige a qué jugador robarle 1 carta de recurso.'
      : `${activePlayer.name} está eligiendo a quién robarle...`,
    road_building_1: isMyTurn
      ? '🛤️ Haz clic en el tablero para colocar tu 1° camino gratis.'
      : 'Colocando caminos gratis...',
    road_building_2: isMyTurn
      ? '🛤️ Haz clic en el tablero para colocar tu 2° camino gratis.'
      : 'Colocando su 2° camino gratis...',
    main: isMyTurn
      ? (buildMode
          ? `Modo construcción activo: haz clic en las marcas brillantes del tablero 3D.`
          : 'Construye caminos, poblados, ciudades, compra desarrollo o comercia.')
      : 'Pensando sus construcciones e intercambios...',
    finished: '🏆 ¡Partida finalizada!'
  };

  sub.textContent = phaseDescriptions[roomState.phase] || '';
}

function renderPlayersPanel() {
  const panel = document.getElementById('players-panel');
  panel.innerHTML = '';
  const targetVP = roomState.settings?.vpToWin || 10;

  roomState.players.forEach((p, idx) => {
    const isTurn = idx === roomState.turnIndex && roomState.status !== 'finished';
    const hasLongestRoad = roomState.longestRoadPlayerId === p.id;
    const hasLargestArmy = roomState.largestArmyPlayerId === p.id;
    const reaction = activeReactionsByPlayer[p.id];

    const card = document.createElement('div');
    card.className = `player-card ${isTurn ? 'active-turn' : ''}`;
    card.dataset.playerCardId = p.id;
    card.style.borderLeftColor = p.color;

    card.innerHTML = `
      ${reaction ? `
        <div class="player-reaction-bubble">
          <span>${reaction.emoji}</span>
          <span>${reaction.text}</span>
        </div>
      ` : ''}
      <div class="pcard-header">
        <div class="pcard-name">
          <span>${p.avatar || '👑'}</span>
          <span>${p.name}</span>
          ${p.id === myPlayerId ? '<span style="font-size:11px;color:#38bdf8">(Tú)</span>' : ''}
          ${!p.connected && !p.isBot ? '🔌' : ''}
        </div>
        <div class="pcard-vp" title="Puntos de Victoria">⭐ ${p.totalVP}/${targetVP}</div>
      </div>
      <div class="pcard-stats">
        <span title="Cartas de Recurso">🎴 ${p.resourceCount}</span>
        <span title="Cartas de Desarrollo sin usar">🃏 ${p.devCardCount}</span>
        <span title="Caballeros jugados">⚔️ ${p.knightsPlayed}</span>
        <span title="Tramo de caminos más largo">🛤️ ${p.longestRoad}</span>
      </div>
      ${(hasLongestRoad || hasLargestArmy) ? `
        <div class="pcard-badges">
          ${hasLongestRoad ? `<span class="award-badge">🛣️ Gran Ruta (+2 PV)</span>` : ''}
          ${hasLargestArmy ? `<span class="award-badge">⚔️ Gran Ejército (+2 PV)</span>` : ''}
        </div>
      ` : ''}
    `;
    panel.appendChild(card);
  });
}

function renderMyHand(me, isMyTurn) {
  const resContainer = document.getElementById('my-resources');
  resContainer.innerHTML = '';

  for (const [key, info] of Object.entries(RESOURCES_INFO)) {
    const count = me.resources ? (me.resources[key] || 0) : 0;
    const card = document.createElement('div');
    card.className = `res-card ${count > 0 ? 'has-cards' : ''}`;
    card.style.borderColor = count > 0 ? info.color : 'rgba(255,255,255,0.12)';
    card.innerHTML = `
      <div class="res-emoji">${info.emoji}</div>
      <div class="res-count">${count}</div>
      <div class="res-name">${info.name}</div>
    `;
    resContainer.appendChild(card);
  }

  const devContainer = document.getElementById('my-dev-cards');
  devContainer.innerHTML = '';
  const unusedDevs = (me.devCards || []).filter(c => !c.used);

  const countsByType = {};
  const playableByType = {};
  for (const c of unusedDevs) {
    countsByType[c.type] = (countsByType[c.type] || 0) + 1;
    if (c.boughtTurn < roomState.turnNumber && c.type !== 'vp') {
      playableByType[c.type] = true;
    }
  }

  for (const [type, count] of Object.entries(countsByType)) {
    const info = DEV_CARD_INFO[type];
    if (!info) continue;
    const canPlay =
      isMyTurn &&
      !me.playedDevCardThisTurn &&
      playableByType[type] &&
      (roomState.phase === 'main' || (type === 'knight' && roomState.phase === 'roll'));

    const btn = document.createElement('button');
    btn.className = 'dev-card-btn';
    btn.disabled = !canPlay;
    btn.title = `${info.name}: ${info.desc}`;
    btn.innerHTML = `
      <span style="font-size:18px">${info.emoji}</span>
      <strong>${info.name} (x${count})</strong>
    `;
    btn.addEventListener('click', () => handleClickDevCard(type));
    devContainer.appendChild(btn);
  }
}

function updateActionButtons(me, isMyTurn) {
  const valid = roomState.validActions || {};
  const isMain = isMyTurn && roomState.phase === 'main';

  const btnRoll = document.getElementById('btn-roll-dice');
  const btnRoad = document.getElementById('btn-build-road');
  const btnSettle = document.getElementById('btn-build-settlement');
  const btnCity = document.getElementById('btn-build-city');
  const btnDev = document.getElementById('btn-buy-dev');
  const btnTrade = document.getElementById('btn-open-trade');
  const btnEnd = document.getElementById('btn-end-turn');

  btnRoll.disabled = !(isMyTurn && roomState.phase === 'roll');
  btnRoad.disabled = !(isMain && (valid.roadEdges || []).length > 0);
  btnSettle.disabled = !(isMain && (valid.settlementVertices || []).length > 0);
  btnCity.disabled = !(isMain && (valid.cityVertices || []).length > 0);

  const canBuyDev =
    isMain &&
    roomState.devDeckCount > 0 &&
    me?.resources &&
    me.resources.sheep >= 1 &&
    me.resources.wheat >= 1 &&
    me.resources.ore >= 1;
  btnDev.disabled = !canBuyDev;

  btnTrade.disabled = !isMain;
  btnEnd.disabled = !isMain;

  btnRoad.classList.toggle('active-mode', buildMode === 'road');
  btnSettle.classList.toggle('active-mode', buildMode === 'settlement');
  btnCity.classList.toggle('active-mode', buildMode === 'city');
}

function renderLogsAndChat() {
  const logList = document.getElementById('game-log-list');
  if (logList) {
    logList.innerHTML = '';
    for (const item of roomState.logs || []) {
      const div = document.createElement('div');
      div.className = 'log-item';
      div.innerHTML = `<span class="log-time">[${item.time}]</span> ${item.text}`;
      logList.appendChild(div);
    }
    logList.scrollTop = logList.scrollHeight;
  }

  const chatList = document.getElementById('chat-list');
  if (chatList) {
    chatList.innerHTML = '';
    if (!roomState.chat || roomState.chat.length === 0) {
      chatList.innerHTML = `<div class="chat-empty-hint">Usa las reacciones de abajo o escribe para hablar con la mesa...</div>`;
    } else {
      for (const msg of roomState.chat) {
        const div = document.createElement('div');
        div.className = `log-item chat-msg-item ${msg.isReaction ? 'chat-reaction-item' : ''}`;
        const av = msg.playerAvatar ? `<span>${msg.playerAvatar}</span> ` : '';
        const tm = msg.time ? `<span class="log-time">[${msg.time}]</span> ` : '';
        div.innerHTML = `${tm}${av}<strong style="color:${msg.playerColor || '#fbbf24'}">${msg.playerName}:</strong> <span class="chat-msg-body">${msg.text}</span>`;
        chatList.appendChild(div);
      }
      chatList.scrollTop = chatList.scrollHeight;
    }
  }
}

// =========================================================
// MODAL DE DESCARTE POR EL 7
// =========================================================
function checkDiscardModal(me) {
  const modal = document.getElementById('discard-modal');
  const required = roomState.pendingDiscards?.[myPlayerId];
  if (roomState.phase !== 'discard' || !required || !me?.resources) {
    modal.classList.add('hidden');
    return;
  }

  modal.classList.remove('hidden');
  const totalSelected = Object.values(discardSelection).reduce((a, b) => a + b, 0);
  document.getElementById('discard-instruction').textContent =
    `Debes elegir exactamente ${required} cartas para descartar (${totalSelected}/${required} seleccionadas).`;

  const grid = document.getElementById('discard-selectors');
  grid.innerHTML = '';
  for (const [res, info] of Object.entries(RESOURCES_INFO)) {
    const owned = me.resources[res] || 0;
    const sel = discardSelection[res] || 0;
    const box = document.createElement('div');
    box.className = 'counter-box';
    box.innerHTML = `
      <div style="font-size:22px">${info.emoji}</div>
      <div style="font-size:11px;color:#cbd5e1">${info.name} (${owned})</div>
      <div class="counter-controls">
        <button class="counter-btn" data-res="${res}" data-delta="-1">-</button>
        <strong>${sel}</strong>
        <button class="counter-btn" data-res="${res}" data-delta="1">+</button>
      </div>
    `;
    grid.appendChild(box);
  }

  grid.querySelectorAll('.counter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const r = btn.dataset.res;
      const d = Number(btn.dataset.delta);
      const owned = me.resources[r] || 0;
      const next = (discardSelection[r] || 0) + d;
      if (next >= 0 && next <= owned) {
        discardSelection[r] = next;
        checkDiscardModal(me);
      }
    });
  });
}

document.getElementById('btn-confirm-discard').addEventListener('click', () => {
  sendGameAction({ type: 'discard_resources', discards: discardSelection }, () => {
    discardSelection = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
  });
});

// =========================================================
// MODAL DE ELEGIR VÍCTIMA DEL LADRÓN
// =========================================================
function checkStealModal(isMyTurn) {
  const modal = document.getElementById('steal-modal');
  if (!isMyTurn || roomState.phase !== 'robber_steal') {
    modal.classList.add('hidden');
    return;
  }

  modal.classList.remove('hidden');
  const list = document.getElementById('steal-candidates-list');
  list.innerHTML = '';
  for (const victimId of roomState.stealCandidates || []) {
    const p = roomState.players.find(pl => pl.id === victimId);
    if (!p) continue;
    const btn = document.createElement('button');
    btn.className = 'btn btn-secondary btn-large';
    btn.innerHTML = `<span>${p.avatar || '👑'}</span> <span class="color-dot" style="background:${p.color}"></span> Robar 1 carta a ${p.name} (${p.resourceCount} cartas)`;
    btn.addEventListener('click', () => {
      sendGameAction({ type: 'choose_steal_victim', victimId: p.id });
    });
    list.appendChild(btn);
  }
}

// =========================================================
// MODAL DE COMERCIO
// =========================================================
document.querySelectorAll('.trade-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.trade-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.trade-tab-body').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tradetab-${btn.dataset.tradetab}`).classList.add('active');
  });
});

document.getElementById('btn-close-trade').addEventListener('click', () => {
  document.getElementById('trade-modal').classList.add('hidden');
});

function openTradeModal() {
  const modal = document.getElementById('trade-modal');
  modal.classList.remove('hidden');
  offerGive = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
  offerWant = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
  renderTradeModalContent();
}

function renderTradeModalContent() {
  const me = roomState?.players.find(p => p.id === myPlayerId);
  if (!me || !me.resources) return;
  const ratios = roomState.validActions?.tradeRatios || { wood: 4, brick: 4, sheep: 4, wheat: 4, ore: 4 };

  // =========================================================================
  // PESTAÑA 1: CAMBIAR CON JUGADORES (MESA VISUAL DE CARTAS AL TOQUE)
  // =========================================================================
  const giveGrid = document.getElementById('offer-give-grid');
  const wantGrid = document.getElementById('offer-want-grid');
  const giveTray = document.getElementById('vtt-give-tray');
  const wantTray = document.getElementById('vtt-want-tray');
  const proposeBtn = document.getElementById('btn-propose-player-trade');

  if (giveGrid && wantGrid && giveTray && wantTray) {
    giveGrid.innerHTML = '';
    wantGrid.innerHTML = '';
    giveTray.innerHTML = '';
    wantTray.innerHTML = '';

    // 1. Mostrar tus cartas disponibles para tocar y poner en la mesa
    for (const [res, info] of Object.entries(RESOURCES_INFO)) {
      const owned = me.resources[res] || 0;
      const given = offerGive[res] || 0;
      const remaining = Math.max(0, owned - given);

      const cardBtn = document.createElement('button');
      cardBtn.type = 'button';
      cardBtn.className = `hand-pick-card ${remaining > 0 ? 'can-pick' : 'empty-pick'} ${given > 0 ? 'has-given' : ''}`;
      cardBtn.disabled = remaining <= 0;
      cardBtn.innerHTML = `
        <span class="hpc-count ${remaining > 0 ? 'count-ok' : 'count-zero'}">
          ${remaining > 0 ? `Tienes ${remaining}` : (owned > 0 ? 'Todas en mesa' : 'No tienes (0)')}
        </span>
        <span class="hpc-emoji">${info.emoji}</span>
        <span class="hpc-name">${info.name}</span>
        <span class="hpc-action">${remaining > 0 ? '➕ Dar 1' : '—'}</span>
      `;
      cardBtn.addEventListener('click', () => {
        if (remaining > 0) {
          offerGive[res] = given + 1;
          playTone(520, 0.05, 'sine');
          renderTradeModalContent();
        }
      });
      giveGrid.appendChild(cardBtn);

      // 2. Botón simple para elegir qué carta quieres pedir
      const wantVal = offerWant[res] || 0;
      const wantBtn = document.createElement('button');
      wantBtn.type = 'button';
      wantBtn.className = `hand-pick-card want-pick-card ${wantVal > 0 ? 'has-wanted' : ''}`;
      wantBtn.innerHTML = `
        <span class="hpc-count count-neutral">En mano: ${owned}</span>
        <span class="hpc-emoji">${info.emoji}</span>
        <span class="hpc-name">${info.name}</span>
        <span class="hpc-action want-action">➕ Pedir 1</span>
      `;
      wantBtn.addEventListener('click', () => {
        if (wantVal < 9) {
          offerWant[res] = wantVal + 1;
          playTone(620, 0.05, 'sine');
          renderTradeModalContent();
        }
      });
      wantGrid.appendChild(wantBtn);
    }

    // 3. Renderizar las cartas físicas puestas sobre la bandeja "📤 TÚ ENTREGAS"
    let totalGiven = 0;
    for (const [res, count] of Object.entries(offerGive)) {
      const info = RESOURCES_INFO[res];
      for (let i = 0; i < count; i++) {
        totalGiven++;
        const chip = document.createElement('div');
        chip.className = 'table-card-chip give-chip';
        chip.title = 'Toca para devolver esta carta a tu mano';
        chip.innerHTML = `
          <span class="tcc-emoji">${info.emoji}</span>
          <span class="tcc-name">${info.name}</span>
          <span class="tcc-remove">✕</span>
        `;
        chip.addEventListener('click', () => {
          offerGive[res] = Math.max(0, offerGive[res] - 1);
          playTone(360, 0.05, 'sine');
          renderTradeModalContent();
        });
        giveTray.appendChild(chip);
      }
    }
    if (totalGiven === 0) {
      giveTray.innerHTML = `<div class="vtt-empty-msg">👆 Toca arriba alguna carta que tengas en tu mano para ponerla aquí</div>`;
    }

    // 4. Renderizar las cartas físicas puestas sobre la bandeja "📥 TÚ PIDES"
    let totalWanted = 0;
    for (const [res, count] of Object.entries(offerWant)) {
      const info = RESOURCES_INFO[res];
      for (let i = 0; i < count; i++) {
        totalWanted++;
        const chip = document.createElement('div');
        chip.className = 'table-card-chip want-chip';
        chip.title = 'Toca para quitar esta carta del pedido';
        chip.innerHTML = `
          <span class="tcc-emoji">${info.emoji}</span>
          <span class="tcc-name">${info.name}</span>
          <span class="tcc-remove">✕</span>
        `;
        chip.addEventListener('click', () => {
          offerWant[res] = Math.max(0, offerWant[res] - 1);
          playTone(360, 0.05, 'sine');
          renderTradeModalContent();
        });
        wantTray.appendChild(chip);
      }
    }
    if (totalWanted === 0) {
      wantTray.innerHTML = `<div class="vtt-empty-msg">👆 Toca en el paso 2 qué carta quieres recibir a cambio</div>`;
    }

    if (proposeBtn) {
      proposeBtn.disabled = !(totalGiven > 0 && totalWanted > 0);
    }
  }

  // =========================================================================
  // PESTAÑA 2: CAMBIAR CON EL BANCO (SOLO MUESTRA LO QUE REALMENTE PUEDES DAR)
  // =========================================================================
  const bankContainer = document.getElementById('bank-trade-container');
  const bankBtn = document.getElementById('btn-execute-bank-trade');
  if (bankContainer && bankBtn) {
    const tradeableResources = Object.keys(RESOURCES_INFO).filter(
      res => (me.resources[res] || 0) >= (ratios[res] || 4)
    );

    if (tradeableResources.length === 0) {
      bankBtn.disabled = true;
      const statusCards = Object.entries(RESOURCES_INFO).map(([res, info]) => {
        const owned = me.resources[res] || 0;
        const needed = ratios[res] || 4;
        return `
          <div class="bank-status-pill">
            <span style="font-size:20px">${info.emoji}</span>
            <strong>${info.name}</strong>
            <span class="bsp-progress">Tienes <b>${owned}</b> de <b>${needed}</b></span>
          </div>
        `;
      }).join('');

      bankContainer.innerHTML = `
        <div class="bank-locked-box">
          <div class="blb-title">🔒 Aún no tienes suficientes cartas repetidas para el Banco</div>
          <p class="blb-desc">
            El Banco solo cambia paquetes de <strong>4 cartas iguales por 1</strong> (o 3:1 / 2:1 si construiste en un puerto).
            Si quieres cambiar 1 por 1, usa la pestaña <strong>"🤝 Cambiar con Jugadores"</strong>.
          </p>
          <div class="bank-status-grid">${statusCards}</div>
        </div>
      `;
    } else {
      if (!tradeableResources.includes(bankTradeGive)) {
        bankTradeGive = tradeableResources[0];
      }
      if (bankTradeGet === bankTradeGive) {
        bankTradeGet = Object.keys(RESOURCES_INFO).find(r => r !== bankTradeGive) || 'brick';
      }

      const giveRatio = ratios[bankTradeGive] || 4;
      const giveInfo = RESOURCES_INFO[bankTradeGive];
      const getInfo = RESOURCES_INFO[bankTradeGet];
      bankBtn.disabled = false;
      bankBtn.textContent = `⚓ Cambiar ${giveRatio} ${giveInfo.emoji} ${giveInfo.name} por 1 ${getInfo.emoji} ${getInfo.name}`;

      bankContainer.innerHTML = `
        <div class="simple-trade-step">
          <div class="step-label">1️⃣ Elige qué paquete de cartas iguales entregas al Banco:</div>
          <div id="bank-give-cards" class="visual-hand-picker"></div>
        </div>
        <div class="simple-trade-step">
          <div class="step-label">2️⃣ Elige qué carta quieres recibir (+1):</div>
          <div id="bank-get-cards" class="visual-want-picker"></div>
        </div>
      `;

      const bGiveEl = document.getElementById('bank-give-cards');
      const bGetEl = document.getElementById('bank-get-cards');

      for (const [res, info] of Object.entries(RESOURCES_INFO)) {
        const owned = me.resources[res] || 0;
        const ratio = ratios[res] || 4;
        const canDo = owned >= ratio;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `hand-pick-card ${canDo ? 'can-pick' : 'empty-pick'} ${bankTradeGive === res ? 'selected-bank-give' : ''}`;
        btn.disabled = !canDo;
        btn.innerHTML = `
          <span class="hpc-count ${canDo ? 'count-ok' : 'count-zero'}">Tienes ${owned} (Pide ${ratio})</span>
          <span class="hpc-emoji">${info.emoji}</span>
          <span class="hpc-name">${info.name}</span>
          <span class="hpc-action">${canDo ? `📤 Dar ${ratio}` : 'No alcanza'}</span>
        `;
        btn.addEventListener('click', () => {
          bankTradeGive = res;
          if (bankTradeGet === res) {
            bankTradeGet = Object.keys(RESOURCES_INFO).find(r => r !== res);
          }
          renderTradeModalContent();
        });
        bGiveEl.appendChild(btn);

        const gBtn = document.createElement('button');
        gBtn.type = 'button';
        gBtn.className = `hand-pick-card want-pick-card ${bankTradeGet === res ? 'selected-bank-want' : ''} ${bankTradeGive === res ? 'empty-pick' : ''}`;
        gBtn.disabled = bankTradeGive === res;
        gBtn.innerHTML = `
          <span class="hpc-count count-neutral">En mano: ${owned}</span>
          <span class="hpc-emoji">${info.emoji}</span>
          <span class="hpc-name">${info.name}</span>
          <span class="hpc-action want-action">📥 Recibir +1</span>
        `;
        gBtn.addEventListener('click', () => {
          bankTradeGet = res;
          renderTradeModalContent();
        });
        bGetEl.appendChild(gBtn);
      }
    }
  }
}

document.getElementById('btn-clear-player-trade')?.addEventListener('click', () => {
  offerGive = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
  offerWant = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
  renderTradeModalContent();
});

document.getElementById('btn-execute-bank-trade').addEventListener('click', () => {
  sendGameAction({ type: 'bank_trade', giveRes: bankTradeGive, getRes: bankTradeGet }, () => {
    renderTradeModalContent();
  });
});

document.getElementById('btn-propose-player-trade').addEventListener('click', () => {
  sendGameAction({ type: 'propose_trade', give: offerGive, want: offerWant }, () => {
    document.getElementById('trade-modal').classList.add('hidden');
  });
});

function formatResourceBundle(bundle) {
  return Object.entries(bundle || {})
    .filter(([_, count]) => count > 0)
    .map(([res, count]) => `${count} ${RESOURCES_INFO[res].emoji} ${RESOURCES_INFO[res].name}`)
    .join(', ');
}

function renderActiveTradeBanner() {
  const banner = document.getElementById('trade-offer-banner');
  const offer = roomState.activeTradeOffer;
  if (!offer) {
    banner.classList.add('hidden');
    return;
  }

  banner.classList.remove('hidden');
  const giveText = formatResourceBundle(offer.give);
  const wantText = formatResourceBundle(offer.want);
  const isProposer = offer.fromPlayerId === myPlayerId;

  if (isProposer) {
    const acceptingPlayers = roomState.players.filter(
      p => p.id !== myPlayerId && offer.responses?.[p.id] === 'accepted'
    );
    banner.innerHTML = `
      <div style="font-weight:700;margin-bottom:6px">🤝 Tu oferta en la mesa:</div>
      <div style="font-size:13px;margin-bottom:10px">Ofreces <strong>${giveText}</strong> a cambio de <strong>${wantText}</strong></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        ${acceptingPlayers.length > 0
          ? acceptingPlayers.map(p => `<button class="btn btn-primary btn-sm confirm-partner-btn" data-id="${p.id}">Aceptar con ${p.name}</button>`).join('')
          : '<span style="font-size:12px;color:#94a3b8">Esperando respuestas de los demás jugadores...</span>'
        }
        <button id="btn-cancel-offer" class="btn btn-secondary btn-sm">Cancelar</button>
      </div>
    `;
    banner.querySelectorAll('.confirm-partner-btn').forEach(b => {
      b.addEventListener('click', () => {
        sendGameAction({ type: 'execute_trade', partnerId: b.dataset.id });
      });
    });
    banner.querySelector('#btn-cancel-offer')?.addEventListener('click', () => {
      sendGameAction({ type: 'cancel_trade' });
    });
  } else {
    const myResp = offer.responses?.[myPlayerId];
    banner.innerHTML = `
      <div style="font-weight:700;margin-bottom:6px">🤝 Oferta de ${offer.fromPlayerName}:</div>
      <div style="font-size:13px;margin-bottom:10px">Ofrece <strong>${giveText}</strong> y pide <strong>${wantText}</strong></div>
      <div style="display:flex;gap:8px;align-items:center">
        <button id="btn-accept-offer" class="btn btn-primary btn-sm" ${myResp === 'accepted' ? 'disabled' : ''}>✅ Aceptar</button>
        <button id="btn-reject-offer" class="btn btn-secondary btn-sm" ${myResp === 'rejected' ? 'disabled' : ''}>❌ Rechazar</button>
        ${myResp ? `<span style="font-size:12px;color:#cbd5e1">(${myResp === 'accepted' ? 'Aceptaste' : 'Rechazaste'})</span>` : ''}
      </div>
    `;
    banner.querySelector('#btn-accept-offer')?.addEventListener('click', () => {
      sendGameAction({ type: 'respond_trade', response: 'accepted' });
    });
    banner.querySelector('#btn-reject-offer')?.addEventListener('click', () => {
      sendGameAction({ type: 'respond_trade', response: 'rejected' });
    });
  }
}

// =========================================================
// JUGAR CARTAS DE DESARROLLO
// =========================================================
function handleClickDevCard(cardType) {
  if (cardType === 'knight' || cardType === 'road_building') {
    sendGameAction({ type: 'play_dev_card', cardType });
    return;
  }

  pendingDevCardType = cardType;
  devSelectedRes = [];
  const modal = document.getElementById('dev-modal');
  modal.classList.remove('hidden');
  renderDevModalOptions();
}

function renderDevModalOptions() {
  const title = document.getElementById('dev-modal-title');
  const desc = document.getElementById('dev-modal-desc');
  const container = document.getElementById('dev-modal-options');
  container.innerHTML = '';

  if (pendingDevCardType === 'year_of_plenty') {
    title.textContent = '🎁 Año de la Abundancia';
    desc.textContent = `Selecciona 2 recursos del banco (${devSelectedRes.length}/2 elegidos):`;
  } else {
    title.textContent = '👑 Monopolio';
    desc.textContent = 'Selecciona 1 recurso para reclamar todas las cartas de ese tipo de los demás jugadores:';
  }

  for (const [res, info] of Object.entries(RESOURCES_INFO)) {
    const countSelected = devSelectedRes.filter(r => r === res).length;
    const opt = document.createElement('div');
    opt.className = `bank-res-option ${countSelected > 0 ? 'selected' : ''}`;
    opt.innerHTML = `
      <div style="font-size:24px">${info.emoji}</div>
      <strong>${info.name}</strong>
      ${countSelected > 0 ? `<div style="font-size:12px;color:#fbbf24">Elegido x${countSelected}</div>` : ''}
    `;
    opt.addEventListener('click', () => {
      if (pendingDevCardType === 'monopoly') {
        devSelectedRes = [res];
      } else {
        if (devSelectedRes.length >= 2) devSelectedRes.shift();
        devSelectedRes.push(res);
      }
      renderDevModalOptions();
    });
    container.appendChild(opt);
  }
}

document.getElementById('btn-close-dev-modal').addEventListener('click', () => {
  document.getElementById('dev-modal').classList.add('hidden');
});

document.getElementById('btn-confirm-dev-card').addEventListener('click', () => {
  if (pendingDevCardType === 'year_of_plenty') {
    if (devSelectedRes.length !== 2) return showToast('Elige 2 recursos.');
    sendGameAction({
      type: 'play_dev_card',
      cardType: 'year_of_plenty',
      payload: { res1: devSelectedRes[0], res2: devSelectedRes[1] }
    }, () => {
      document.getElementById('dev-modal').classList.add('hidden');
    });
  } else if (pendingDevCardType === 'monopoly') {
    if (devSelectedRes.length !== 1) return showToast('Elige 1 recurso.');
    sendGameAction({
      type: 'play_dev_card',
      cardType: 'monopoly',
      payload: { resource: devSelectedRes[0] }
    }, () => {
      document.getElementById('dev-modal').classList.add('hidden');
    });
  }
});

// =========================================================
// MODAL DE VICTORIA
// =========================================================
let victoryShownForRoom = null;
function checkVictoryModal() {
  const modal = document.getElementById('victory-modal');
  if (roomState.status !== 'finished' || !roomState.winnerId) {
    modal.classList.add('hidden');
    return;
  }

  if (victoryShownForRoom === roomState.roomCode) return;
  victoryShownForRoom = roomState.roomCode;

  const winner = roomState.players.find(p => p.id === roomState.winnerId);
  document.getElementById('victory-title').textContent = `¡${winner ? winner.name : 'Jugador'} gana la partida!`;
  const standings = document.getElementById('victory-standings');
  standings.innerHTML = '';

  const sorted = [...roomState.players].sort((a, b) => b.totalVP - a.totalVP);
  sorted.forEach((p, idx) => {
    const row = document.createElement('div');
    row.className = 'lobby-player-item';
    row.innerHTML = `
      <div class="player-badge">
        <strong>#${idx + 1}</strong>
        <span>${p.avatar || '👑'}</span>
        <span class="color-dot" style="background:${p.color}"></span>
        <span>${p.name}</span>
      </div>
      <strong style="color:#fbbf24">${p.totalVP} Puntos de Victoria</strong>
    `;
    standings.appendChild(row);
  });

  modal.classList.remove('hidden');
}

document.getElementById('btn-rematch-room')?.addEventListener('click', () => {
  socket.emit('rematch_room', {}, (res) => {
    if (res?.error) showToast(res.error);
    else {
      document.getElementById('victory-modal').classList.add('hidden');
      showToast('🔄 ¡Revancha preparada en la misma sala!');
    }
  });
});

document.getElementById('btn-close-victory').addEventListener('click', () => {
  document.getElementById('victory-modal').classList.add('hidden');
});
