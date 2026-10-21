// server/gameEngine.js
// Motor completo de reglas de Catan con colores únicos garantizados, personalización y reglas oficiales

const RESOURCES = ['wood', 'brick', 'sheep', 'wheat', 'ore'];

const RESOURCE_NAMES_ES = {
  wood: 'Madera',
  brick: 'Ladrillo',
  sheep: 'Oveja',
  wheat: 'Trigo',
  ore: 'Piedra'
};

const COSTS = {
  road: { wood: 1, brick: 1 },
  settlement: { wood: 1, brick: 1, sheep: 1, wheat: 1 },
  city: { wheat: 2, ore: 3 },
  devCard: { sheep: 1, wheat: 1, ore: 1 }
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
  { id: 'medieval', name: 'Medieval Clásico' },
  { id: 'imperial', name: 'Imperio Romano' },
  { id: 'nordic', name: 'Clan Vikingo' },
  { id: 'oriental', name: 'Dinastía Oriental' }
];

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Devuelve un color libre garantizado dentro de la sala
 */
function getUniqueColorForRoom(existingPlayers, preferredColorId = null, excludePlayerId = null) {
  const takenIds = new Set(
    existingPlayers
      .filter(p => p.id !== excludePlayerId)
      .map(p => p.colorId)
  );

  if (preferredColorId && !takenIds.has(preferredColorId)) {
    const found = PLAYER_COLORS.find(c => c.id === preferredColorId);
    if (found) return found;
  }

  for (const col of PLAYER_COLORS) {
    if (!takenIds.has(col.id)) return col;
  }
  return PLAYER_COLORS[0];
}

/**
 * Disposición oficial del "Tablero para Principiantes" del reglamento de Catan (19 hexágonos).
 * Filas de arriba hacia abajo, hexágonos de izquierda a derecha.
 */
const OFFICIAL_LAYOUT_ROWS = [
  [['ore', 10], ['sheep', 2], ['wood', 9]],
  [['wheat', 12], ['brick', 6], ['sheep', 4], ['brick', 10]],
  [['wheat', 9], ['wood', 11], ['desert', null], ['wood', 3], ['ore', 8]],
  [['wood', 8], ['ore', 3], ['wheat', 4], ['sheep', 5]],
  [['brick', 5], ['wheat', 6], ['sheep', 11]]
];

/**
 * Disposición oficial del mapa XL (Extensión 5-6 jugadores, 30 hexágonos).
 * 6 filas: 3 - 4 - 5 - 6 - 5 - 4 - 3 = 30 hexágonos (o 3-4-5-6-5-4-3 hexágonos estándar).
 */
const OFFICIAL_LAYOUT_ROWS_XL = [
  [['wood', 8], ['wheat', 4], ['sheep', 3]],
  [['wood', 9], ['brick', 5], ['sheep', 6], ['wheat', 11]],
  [['ore', 10], ['wheat', 9], ['wood', 11], ['brick', 4], ['sheep', 8]],
  [['desert', null], ['brick', 3], ['ore', 6], ['desert', null], ['wood', 12], ['ore', 5]],
  [['sheep', 2], ['wood', 4], ['wheat', 10], ['sheep', 5], ['brick', 9]],
  [['wheat', 8], ['ore', 10], ['wood', 3], ['wheat', 6]],
  [['sheep', 12], ['brick', 11], ['ore', 2]]
];

// Puertos oficiales estándar (9 puertos)
const OFFICIAL_PORTS = [
  { type: '3:1', ratio: 3 },
  { type: 'sheep', ratio: 2 },
  { type: '3:1', ratio: 3 },
  { type: '3:1', ratio: 3 },
  { type: 'brick', ratio: 2 },
  { type: 'wood', ratio: 2 },
  { type: '3:1', ratio: 3 },
  { type: 'wheat', ratio: 2 },
  { type: 'ore', ratio: 2 }
];

// Puertos oficiales XL (11 puertos)
const OFFICIAL_PORTS_XL = [
  { type: '3:1', ratio: 3 },
  { type: 'sheep', ratio: 2 },
  { type: '3:1', ratio: 3 },
  { type: 'wood', ratio: 2 },
  { type: '3:1', ratio: 3 },
  { type: 'brick', ratio: 2 },
  { type: 'sheep', ratio: 2 },
  { type: '3:1', ratio: 3 },
  { type: 'wheat', ratio: 2 },
  { type: 'ore', ratio: 2 },
  { type: '3:1', ratio: 3 }
];

/**
 * Genera el tablero estándar o XL.
 * mapMode: 'random' | 'official'
 * mapSize: 'normal' (19 hex) | 'xl' (30 hex)
 */
function generateBoard(mapMode = 'random', mapSize = 'normal') {
  const isOfficial = mapMode === 'official';
  const isXL = mapSize === 'xl';
  const axialCoords = [];

  if (isXL) {
    // Generación de 30 hexágonos para mapa XL (rango extendido)
    // 7 filas de hexágonos: 3, 4, 5, 6, 5, 4, 3
    const rowCounts = [3, 4, 5, 6, 5, 4, 3];
    const rowRs = [-3, -2, -1, 0, 1, 2, 3];
    rowRs.forEach((r, rIdx) => {
      const count = rowCounts[rIdx];
      // Para cada fila centramos q
      const startQ = Math.floor(-count / 2) - Math.floor(r / 2);
      for (let i = 0; i < count; i++) {
        axialCoords.push({ q: startQ + i, r });
      }
    });
  } else {
    // Estándar 19 hexágonos
    for (let q = -2; q <= 2; q++) {
      const r1 = Math.max(-2, -q - 2);
      const r2 = Math.min(2, -q + 2);
      for (let r = r1; r <= r2; r++) {
        axialCoords.push({ q, r });
      }
    }
  }

  // Asignación fija por coordenada para el modo oficial
  const officialByCoord = new Map();
  if (isOfficial) {
    if (isXL) {
      const rowRs = [-3, -2, -1, 0, 1, 2, 3];
      rowRs.forEach((r, rIdx) => {
        const rowCoords = axialCoords.filter(c => c.r === r).sort((a, b) => a.q - b.q);
        const rowDef = OFFICIAL_LAYOUT_ROWS_XL[rIdx];
        rowCoords.forEach((c, i) => {
          if (rowDef && rowDef[i]) {
            officialByCoord.set(`${c.q},${c.r}`, { terrain: rowDef[i][0], number: rowDef[i][1] });
          }
        });
      });
    } else {
      for (let r = -2; r <= 2; r++) {
        const rowCoords = axialCoords.filter(c => c.r === r).sort((a, b) => a.q - b.q);
        const rowDef = OFFICIAL_LAYOUT_ROWS[r + 2];
        rowCoords.forEach((c, i) => {
          officialByCoord.set(`${c.q},${c.r}`, { terrain: rowDef[i][0], number: rowDef[i][1] });
        });
      }
    }
  }

  const standardTerrains = [
    'wood', 'wood', 'wood', 'wood',
    'sheep', 'sheep', 'sheep', 'sheep',
    'wheat', 'wheat', 'wheat', 'wheat',
    'brick', 'brick', 'brick',
    'ore', 'ore', 'ore',
    'desert'
  ];

  const xlTerrains = [
    'wood', 'wood', 'wood', 'wood', 'wood', 'wood',
    'sheep', 'sheep', 'sheep', 'sheep', 'sheep', 'sheep',
    'wheat', 'wheat', 'wheat', 'wheat', 'wheat', 'wheat',
    'brick', 'brick', 'brick', 'brick', 'brick',
    'ore', 'ore', 'ore', 'ore', 'ore',
    'desert', 'desert'
  ];

  const standardTokens = [
    2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12
  ];

  const xlTokens = [
    2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 8, 8, 8, 9, 9, 9, 10, 10, 10, 11, 11, 11, 12, 12
  ];

  const terrains = shuffle(isXL ? xlTerrains : standardTerrains);
  const numberTokens = shuffle(isXL ? xlTokens : standardTokens);

  const hexes = [];
  const vertexMap = new Map();
  const vertices = [];
  const edgeMap = new Map();
  const edges = [];

  let tokenIdx = 0;
  let robberHexId = 0;

  axialCoords.forEach((coord, idx) => {
    const official = isOfficial ? officialByCoord.get(`${coord.q},${coord.r}`) : null;
    const terrain = official ? official.terrain : terrains[idx] || 'desert';
    const x = Math.sqrt(3) * (coord.q + coord.r / 2);
    const z = 1.5 * coord.r;
    let number = null;
    if (terrain !== 'desert') {
      number = official ? official.number : numberTokens[tokenIdx++];
    } else {
      robberHexId = idx;
    }

    const hexVertices = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 180) * (60 * i - 30);
      const vx = Math.round((x + Math.cos(angle)) * 1000) / 1000;
      const vz = Math.round((z + Math.sin(angle)) * 1000) / 1000;
      const key = `${vx.toFixed(2)},${vz.toFixed(2)}`;

      let vObj = vertexMap.get(key);
      if (!vObj) {
        vObj = {
          id: vertices.length,
          x: vx,
          z: vz,
          hexIds: [],
          adjacentVertexIds: [],
          edgeIds: [],
          building: null,
          port: null
        };
        vertexMap.set(key, vObj);
        vertices.push(vObj);
      }
      if (!vObj.hexIds.includes(idx)) {
        vObj.hexIds.push(idx);
      }
      hexVertices.push(vObj.id);
    }

    const hexEdges = [];
    for (let i = 0; i < 6; i++) {
      const v1 = hexVertices[i];
      const v2 = hexVertices[(i + 1) % 6];
      const minV = Math.min(v1, v2);
      const maxV = Math.max(v1, v2);
      const eKey = `${minV}-${maxV}`;

      let eObj = edgeMap.get(eKey);
      if (!eObj) {
        const vert1 = vertices[minV];
        const vert2 = vertices[maxV];
        eObj = {
          id: edges.length,
          v1: minV,
          v2: maxV,
          x: (vert1.x + vert2.x) / 2,
          z: (vert1.z + vert2.z) / 2,
          angle: Math.atan2(vert2.z - vert1.z, vert2.x - vert1.x),
          hexIds: [],
          road: null
        };
        edgeMap.set(eKey, eObj);
        edges.push(eObj);

        if (!vert1.adjacentVertexIds.includes(maxV)) vert1.adjacentVertexIds.push(maxV);
        if (!vert2.adjacentVertexIds.includes(minV)) vert2.adjacentVertexIds.push(minV);
        if (!vert1.edgeIds.includes(eObj.id)) vert1.edgeIds.push(eObj.id);
        if (!vert2.edgeIds.includes(eObj.id)) vert2.edgeIds.push(eObj.id);
      }
      if (!eObj.hexIds.includes(idx)) {
        eObj.hexIds.push(idx);
      }
      hexEdges.push(eObj.id);
    }

    hexes.push({
      id: idx,
      q: coord.q,
      r: coord.r,
      x: Math.round(x * 1000) / 1000,
      z: Math.round(z * 1000) / 1000,
      terrain,
      number,
      vertexIds: hexVertices,
      edgeIds: hexEdges
    });
  });

  const coastalEdges = edges.filter(e => e.hexIds.length === 1);
  const orderedCoastal = [];
  if (coastalEdges.length > 0) {
    const remaining = new Set(coastalEdges.map(e => e.id));
    let current = coastalEdges[0];
    orderedCoastal.push(current);
    remaining.delete(current.id);
    let currVertex = current.v2;

    while (remaining.size > 0) {
      let nextEdge = null;
      for (const eId of remaining) {
        const candidate = edges[eId];
        if (candidate.v1 === currVertex || candidate.v2 === currVertex) {
          nextEdge = candidate;
          currVertex = candidate.v1 === currVertex ? candidate.v2 : candidate.v1;
          break;
        }
      }
      if (!nextEdge) {
        const firstId = remaining.values().next().value;
        nextEdge = edges[firstId];
      }
      orderedCoastal.push(nextEdge);
      remaining.delete(nextEdge.id);
    }
  }

  let portTypes;
  let portIndices;

  if (isXL) {
    portTypes = isOfficial ? OFFICIAL_PORTS_XL : shuffle([
      { type: '3:1', ratio: 3 },
      { type: '3:1', ratio: 3 },
      { type: '3:1', ratio: 3 },
      { type: '3:1', ratio: 3 },
      { type: '3:1', ratio: 3 },
      { type: 'wood', ratio: 2 },
      { type: 'brick', ratio: 2 },
      { type: 'sheep', ratio: 2 },
      { type: 'sheep', ratio: 2 },
      { type: 'wheat', ratio: 2 },
      { type: 'ore', ratio: 2 }
    ]);
    // En XL hay aproximadamente 36-40 aristas costeras, distribuimos 11 puertos
    const step = Math.floor(orderedCoastal.length / 11) || 3;
    portIndices = Array.from({ length: 11 }, (_, i) => i * step);
  } else {
    portTypes = isOfficial ? OFFICIAL_PORTS : shuffle([
      { type: '3:1', ratio: 3 },
      { type: '3:1', ratio: 3 },
      { type: '3:1', ratio: 3 },
      { type: '3:1', ratio: 3 },
      { type: 'wood', ratio: 2 },
      { type: 'brick', ratio: 2 },
      { type: 'sheep', ratio: 2 },
      { type: 'wheat', ratio: 2 },
      { type: 'ore', ratio: 2 }
    ]);
    portIndices = [0, 3, 6, 10, 13, 16, 20, 23, 26];
  }

  const ports = [];

  portIndices.forEach((coastalIdx, pIdx) => {
    const edge = orderedCoastal[coastalIdx % orderedCoastal.length];
    if (!edge) return;
    const pConfig = portTypes[pIdx % portTypes.length];
    const hex = hexes[edge.hexIds[0]];
    const dx = edge.x - hex.x;
    const dz = edge.z - hex.z;
    const len = Math.hypot(dx, dz) || 1;

    const portObj = {
      id: pIdx,
      edgeId: edge.id,
      v1: edge.v1,
      v2: edge.v2,
      type: pConfig.type,
      ratio: pConfig.ratio,
      x: edge.x + (dx / len) * 0.48,
      z: edge.z + (dz / len) * 0.48,
      dirX: dx / len,
      dirZ: dz / len
    };
    ports.push(portObj);
    vertices[edge.v1].port = { type: pConfig.type, ratio: pConfig.ratio };
    vertices[edge.v2].port = { type: pConfig.type, ratio: pConfig.ratio };
  });

  return {
    hexes,
    vertices,
    edges,
    ports,
    robberHexId
  };
}

function createDevCardDeck() {
  const deck = [
    ...Array(14).fill('knight'),
    ...Array(5).fill('vp'),
    ...Array(2).fill('road_building'),
    ...Array(2).fill('year_of_plenty'),
    ...Array(2).fill('monopoly')
  ];
  return shuffle(deck);
}

function createRoomState(roomCode, hostId, hostName, profile = {}) {
  const firstPlayer = createPlayerObject(hostId, hostName, [], false, profile);
  return {
    roomCode,
    hostId,
    status: 'lobby',
    phase: 'lobby',
    settings: {
      vpToWin: 10,
      discardLimit: 7,
      friendlyRobber: false,
      turnTimerSeconds: 90,
      mapMode: 'random',
      mapSize: 'normal',
      initialSettlements: 1, // 1 (por defecto: 1 casa y 1 camino rápido) | 2 (estándar oficial: 2 casas y 2 caminos)
      pityProduction: false, // Racha de mala suerte: si pasas 3 rondas sin cosechar, recibes 1 recurso de consuelo
      generousBank: false, // Banca favorable: comercio 3:1 general con el banco sin necesidad de puerto
      startingBonus: false, // Abundancia inicial: cada jugador empieza con 1 recurso de cada tipo
      theme: 'dynamic' // 'dynamic' (por defecto: ciclo en vivo Amanecer/Día/Ocaso/Noche y tormentas) | 'day' | 'sunset' | 'night' | 'storm'
    },
    weather: {
      mode: 'dynamic',
      currentTheme: 'sunrise',
      name: 'Amanecer',
      icon: '🌄',
      description: 'Amanece sobre las costas de Catan mientras se fundan los asentamientos.',
      isStorm: false,
      stormTurnsLeft: 0,
      lastStormTurn: 0
    },
    turnIndex: 0,
    turnNumber: 1,
    turnDeadline: null,
    setupOrder: [],
    setupStep: 0,
    lastPlacedSettlementVertexId: null,
    players: [firstPlayer],
    board: generateBoard('random', 'normal'),
    devDeck: createDevCardDeck(),
    lastDice: null,
    lastHarvest: null,
    stats: {
      diceHistogram: { 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 },
      totalRolls: 0,
      robberCount: 0,
      producedByPlayer: {}
    },
    pendingDiscards: {},
    stealCandidates: [],
    activeTradeOffer: null,
    longestRoadPlayerId: null,
    longestRoadLength: 4,
    largestArmyPlayerId: null,
    largestArmySize: 2,
    winnerId: null,
    logs: [
      { id: Date.now(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), text: `Sala ${roomCode} creada por ${hostName}.`, type: 'system' }
    ],
    chat: []
  };
}

function refreshTurnDeadline(room) {
  const secs = Number(room.settings?.turnTimerSeconds || 0);
  room.turnDeadline = secs > 0 && (room.status === 'setup' || room.status === 'playing')
    ? Date.now() + secs * 1000
    : null;
}

function getCyclePhaseBySeconds(sec) {
  // Ciclo calibrado exactamente a los requerimientos: Total 620 segundos (10 minutos 20 segundos)
  // 0..60s: Amanecer (1 min) | 60..390s: Pleno Día (5 min 30 seg) | 390..450s: Atardecer (1 min) | 450..620s: Noche (2 min 50 seg)
  const s = Math.floor(Math.max(0, sec || 0) % 620);
  if (s < 60) {
    return {
      theme: 'sunrise',
      name: 'Amanecer',
      icon: '🌄',
      description: 'Los primeros rayos de sol iluminan las colinas y costas de Catan.',
      log: '🌄 [Clima] Un nuevo amanecer despunta sobre las colinas de Catan.'
    };
  } else if (s < 390) {
    return {
      theme: 'day',
      name: 'Pleno Día',
      icon: '☀️',
      description: 'El sol brilla en lo alto de Catan y las gaviotas surcan la bahía.',
      log: '☀️ [Clima] Pleno día soleado en Catan: el sol brilla y las gaviotas sobrevuelan el mar.'
    };
  } else if (s < 450) {
    return {
      theme: 'sunset',
      name: 'Atardecer',
      icon: '🌅',
      description: 'Cae la tarde y el sol tiñe el mar de Catan con tonos dorados y rojizos.',
      log: '🌅 [Clima] Cae la tarde sobre Catan: el cielo se tiñe de tonos dorados y rojizos.'
    };
  } else {
    return {
      theme: 'night',
      name: 'Noche',
      icon: '🌙',
      description: 'Cae la noche sobre Catan: se iluminan las antorchas y fogatas bajo las estrellas.',
      log: '🌙 [Clima] Cae la noche en Catan: las aldeas encienden sus antorchas y fogatas bajo las estrellas.'
    };
  }
}

const RANDOM_WEATHER_EVENTS = [
  {
    type: 'snow',
    name: 'Nevada Invernal',
    icon: '❄️',
    theme: 'snow',
    description: 'Una suave nevada blanca cubre la isla con copos de nieve revoloteando en el aire.',
    log: '❄️ [Evento Climático] ¡Comienza a nevar sobre la isla de Catan! Copos de nieve 3D cubren los bosques y colinas.',
    duration: 48
  },
  {
    type: 'storm',
    name: 'Temporal Marino con Relámpagos',
    icon: '⛈️',
    theme: 'storm',
    description: '¡Alerta de temporal! Oleaje bravo, lluvia densa y relámpagos iluminan Catan.',
    log: '⛈️ [Evento Climático] ¡Se desata un violento temporal marino sobre Catan con fuerte lluvia y relámpagos!',
    duration: 48
  },
  {
    type: 'rain',
    name: 'Chubasco de Lluvia',
    icon: '🌧️',
    theme: 'rain',
    description: 'Una cortina de lluvia fresca y continua riega los campos y colinas de Catan.',
    log: '🌧️ [Evento Climático] Un chubasco continuo de lluvia fresca riega los bosques y pastos de la isla.',
    duration: 45
  },
  {
    type: 'foggy',
    name: 'Bruma Costera Mística',
    icon: '🌫️',
    theme: 'foggy',
    description: 'Una densa bruma marina desciende sobre las bahías y envuelve la costa de Catan.',
    log: '🌫️ [Evento Climático] Una densa y misteriosa bruma costera envuelve las bahías y puertos de Catan.',
    duration: 42
  }
];

function triggerWeatherEvent(room, forcedType = null) {
  if (!room.weather || room.weather.activeEvent) return false;

  // Filtrar para que NO repita el mismo tipo anterior consecutivamente
  const candidates = RANDOM_WEATHER_EVENTS.filter(e => e.type !== room.weather.lastEventType);
  const pool = candidates.length > 0 ? candidates : RANDOM_WEATHER_EVENTS;

  let ev = null;
  if (forcedType && forcedType !== room.weather.lastEventType) {
    ev = RANDOM_WEATHER_EVENTS.find(e => e.type === forcedType);
  }
  if (!ev) {
    ev = pool[Math.floor(Math.random() * pool.length)];
  }
  if (!ev) return false;

  room.weather.activeEvent = ev.type;
  room.weather.lastEventType = ev.type;
  room.weather.currentTheme = ev.theme;
  room.weather.name = ev.name;
  room.weather.icon = ev.icon;
  room.weather.description = ev.description;
  room.weather.eventSecondsLeft = ev.duration;
  addLog(room, ev.log, 'system');
  return true;
}

function advanceWeather(room, { isRoll7 = false } = {}) {
  if (!room.weather) {
    room.weather = {
      mode: 'dynamic',
      currentTheme: 'sunrise',
      name: 'Amanecer',
      icon: '🌄',
      description: 'Amanece sobre las costas de Catan.',
      activeEvent: null,
      lastEventType: null,
      eventSecondsLeft: 0,
      cycleSeconds: 0,
      lastEventEndedAt: Date.now()
    };
  }

  // Si la sala está configurada con un tema estático manual
  if (room.settings?.theme && room.settings.theme !== 'dynamic') {
    const fixedTheme = room.settings.theme;
    room.weather.mode = 'manual';
    room.weather.currentTheme = fixedTheme;
    room.weather.activeEvent = null;
    room.weather.name = fixedTheme === 'night' ? 'Noche' : fixedTheme === 'sunset' ? 'Ocaso' : fixedTheme === 'storm' ? 'Tormenta' : fixedTheme === 'sunrise' ? 'Amanecer' : 'Día';
    room.weather.icon = fixedTheme === 'night' ? '🌙' : fixedTheme === 'sunset' ? '🌅' : fixedTheme === 'storm' ? '⛈️' : fixedTheme === 'sunrise' ? '🌄' : '☀️';
    return;
  }

  room.weather.mode = 'dynamic';

  // Si sale un 7 en los dados: Cooldown estricto de 2 minutos (120 segundos) desde que finalizó el último evento
  const now = Date.now();
  const timeSinceLastEvent = now - (room.weather.lastEventEndedAt || 0);

  if (isRoll7 && !room.weather.activeEvent && timeSinceLastEvent >= 120000) {
    if (Math.random() < 0.40) {
      triggerWeatherEvent(room);
    }
  }
}

function tickWeatherClock(room) {
  if (!room || room.status === 'finished') return false;
  if (!room.weather) {
    room.weather = {
      mode: 'dynamic',
      currentTheme: 'sunrise',
      name: 'Amanecer',
      icon: '🌄',
      description: 'Amanece sobre las costas de Catan.',
      activeEvent: null,
      lastEventType: null,
      eventSecondsLeft: 0,
      cycleSeconds: 0,
      lastEventEndedAt: Date.now()
    };
  }

  // Si el anfitrión configuró un clima manual fijo
  if (room.settings?.theme && room.settings.theme !== 'dynamic') {
    const fixedTheme = room.settings.theme;
    if (room.weather.currentTheme !== fixedTheme) {
      room.weather.currentTheme = fixedTheme;
      room.weather.activeEvent = null;
      room.weather.name = fixedTheme === 'night' ? 'Noche' : fixedTheme === 'sunset' ? 'Ocaso' : fixedTheme === 'storm' ? 'Tormenta' : fixedTheme === 'sunrise' ? 'Amanecer' : 'Día';
      room.weather.icon = fixedTheme === 'night' ? '🌙' : fixedTheme === 'sunset' ? '🌅' : fixedTheme === 'storm' ? '⛈️' : fixedTheme === 'sunrise' ? '🌄' : '☀️';
      return true;
    }
    return false;
  }

  // En el lobby mantenemos el amanecer estático
  if (room.status === 'lobby') {
    return false;
  }

  // El reloj continuo del día y la noche de 620s siempre avanza cada segundo
  room.weather.cycleSeconds = ((room.weather.cycleSeconds || 0) + 1) % 620;

  // Si hay un fenómeno meteorológico activo (temporal, bruma o llovizna)
  if (room.weather.activeEvent) {
    room.weather.eventSecondsLeft = (room.weather.eventSecondsLeft || 1) - 1;
    if (room.weather.eventSecondsLeft <= 0) {
      room.weather.activeEvent = null;
      room.weather.lastEventEndedAt = Date.now(); // Iniciar cooldown estricto de 2 minutos
      const phase = getCyclePhaseBySeconds(room.weather.cycleSeconds || 0);
      room.weather.currentTheme = phase.theme;
      room.weather.name = phase.name;
      room.weather.icon = phase.icon;
      room.weather.description = phase.description;
      addLog(room, '☀️ [Clima] El fenómeno meteorológico se disipa y el cielo vuelve a despejarse sobre Catan.', 'system');
      return true;
    }
    return false;
  }

  // Fenómenos meteorológicos aleatorios periódicos:
  // Cooldown estricto de 2 minutos (120 segundos) desde que finalizó el último evento
  const now = Date.now();
  if (!room.weather.lastEventEndedAt) room.weather.lastEventEndedAt = now;
  const timeSinceLastEvent = now - room.weather.lastEventEndedAt;

  if (timeSinceLastEvent >= 120000 && Math.random() < 0.025) {
    return triggerWeatherEvent(room);
  }

  // Comprobar cambio de fase regular del día/noche (Amanecer 1m -> Día 5m30s -> Atardecer 1m -> Noche 2m50s)
  const phase = getCyclePhaseBySeconds(room.weather.cycleSeconds);
  if (room.weather.currentTheme !== phase.theme) {
    room.weather.currentTheme = phase.theme;
    room.weather.name = phase.name;
    room.weather.icon = phase.icon;
    room.weather.description = phase.description;
    addLog(room, phase.log, 'system');
    return true;
  }

  return false;
}

function recordPlayerProduction(room, playerId, resource, qty) {
  if (!room.stats) return;
  if (!room.stats.producedByPlayer[playerId]) {
    room.stats.producedByPlayer[playerId] = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0, total: 0 };
  }
  room.stats.producedByPlayer[playerId][resource] = (room.stats.producedByPlayer[playerId][resource] || 0) + qty;
  room.stats.producedByPlayer[playerId].total = (room.stats.producedByPlayer[playerId].total || 0) + qty;
}

function createPlayerObject(id, name, existingPlayers = [], isBot = false, profile = {}) {
  const chosenColor = getUniqueColorForRoom(existingPlayers, profile.colorId, id);
  const avatar = PLAYER_AVATARS.includes(profile.avatar)
    ? profile.avatar
    : PLAYER_AVATARS[existingPlayers.length % PLAYER_AVATARS.length];
  const pieceStyle = PIECE_STYLES.some(s => s.id === profile.pieceStyle) ? profile.pieceStyle : 'medieval';

  return {
    id,
    name,
    color: chosenColor.hex,
    colorName: chosenColor.name,
    colorId: chosenColor.id,
    avatar,
    pieceStyle,
    isBot,
    connected: true,
    resources: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 },
    devCards: [],
    knightsPlayed: 0,
    playedDevCardThisTurn: false,
    roadsLeft: 15,
    settlementsLeft: 5,
    citiesLeft: 4,
    longestRoad: 0
  };
}

function updatePlayerProfile(room, playerId, { name, colorId, avatar, pieceStyle }) {
  if (room.status !== 'lobby') return { error: 'Solo puedes personalizar tu perfil en el lobby.' };
  const player = room.players.find(p => p.id === playerId);
  if (!player) return { error: 'Jugador no encontrado.' };

  if (name !== undefined) {
    const clean = String(name).trim().slice(0, 18);
    if (clean.length < 2) return { error: 'Tu nombre debe tener al menos 2 caracteres.' };
    player.name = clean;
  }
  if (colorId) {
    const taken = room.players.some(p => p.id !== playerId && p.colorId === colorId);
    if (taken) {
      return { error: '⚠️ Ese color ya lo eligió otro jugador de la sala. Elige uno libre.' };
    }
    const col = PLAYER_COLORS.find(c => c.id === colorId);
    if (col) {
      player.colorId = col.id;
      player.color = col.hex;
      player.colorName = col.name;
    }
  }
  if (avatar && PLAYER_AVATARS.includes(avatar)) {
    player.avatar = avatar;
  }
  if (pieceStyle && PIECE_STYLES.some(s => s.id === pieceStyle)) {
    player.pieceStyle = pieceStyle;
  }
  return { ok: true };
}

function updateRoomSettings(room, playerId, settings = {}) {
  if (room.hostId !== playerId || room.status !== 'lobby') {
    return { error: 'Solo el anfitrión puede cambiar las reglas en la sala.' };
  }
  if ([8, 10, 12, 15].includes(Number(settings.vpToWin))) {
    room.settings.vpToWin = Number(settings.vpToWin);
  }
  if ([7, 9, 12].includes(Number(settings.discardLimit))) {
    room.settings.discardLimit = Number(settings.discardLimit);
  }
  if ([0, 60, 90, 120].includes(Number(settings.turnTimerSeconds))) {
    room.settings.turnTimerSeconds = Number(settings.turnTimerSeconds);
  }
  if (typeof settings.friendlyRobber === 'boolean') {
    room.settings.friendlyRobber = settings.friendlyRobber;
  }
  if (typeof settings.pityProduction === 'boolean') {
    room.settings.pityProduction = settings.pityProduction;
  }
  if (typeof settings.generousBank === 'boolean') {
    room.settings.generousBank = settings.generousBank;
  }
  if (typeof settings.startingBonus === 'boolean') {
    room.settings.startingBonus = settings.startingBonus;
  }
  if (['dynamic', 'day', 'sunset', 'night', 'storm'].includes(settings.theme)) {
    if (room.settings.theme !== settings.theme) {
      room.settings.theme = settings.theme;
      advanceWeather(room);
      addLog(
        room,
        settings.theme === 'dynamic'
          ? '🌅 Atmósfera 3D configurada en modo Dinámico (Ciclo Día/Noche en vivo y tormentas).'
          : `🌅 Atmósfera 3D fijada en: ${settings.theme.toUpperCase()}.`,
        'system'
      );
    }
  }
  if ([1, 2].includes(Number(settings.initialSettlements))) {
    const val = Number(settings.initialSettlements);
    if (room.settings.initialSettlements !== val) {
      room.settings.initialSettlements = val;
      addLog(
        room,
        val === 1
          ? '⚡ Fase Inicial configurada en Rápida: Solo 1 poblado y 1 camino por jugador (da recursos directos).'
          : '🔄 Fase Inicial configurada en Estándar Oficial: 2 poblados y 2 caminos (segundo poblado da recursos).',
        'system'
      );
    }
  }
  let boardNeedsUpdate = false;
  if (['random', 'official'].includes(settings.mapMode) && settings.mapMode !== room.settings.mapMode) {
    room.settings.mapMode = settings.mapMode;
    boardNeedsUpdate = true;
    addLog(
      room,
      room.settings.mapMode === 'official'
        ? '🗺️ Tipo de mapa cambiado a Disposición Oficial (Reglamento).'
        : '🎲 Tipo de mapa cambiado a Aleatorio.',
      'system'
    );
  }
  if (['normal', 'xl'].includes(settings.mapSize) && settings.mapSize !== room.settings.mapSize) {
    room.settings.mapSize = settings.mapSize;
    boardNeedsUpdate = true;
    addLog(
      room,
      room.settings.mapSize === 'xl'
        ? '🏝️ Tamaño del mapa cambiado a XL (30 Hexágonos - Extensión).'
        : '🏝️ Tamaño del mapa cambiado a Normal (19 Hexágonos - Clásico).',
      'system'
    );
  }
  if (boardNeedsUpdate) {
    room.board = generateBoard(room.settings.mapMode, room.settings.mapSize);
  }
  if (settings.regenerateBoard) {
    if (room.settings.mapMode === 'official') {
      return { error: 'El mapa oficial siempre tiene la misma disposición. Cambia a modo Aleatorio para generar una isla nueva.' };
    }
    room.board = generateBoard('random', room.settings.mapSize);
    addLog(room, `🗺️ El anfitrión generó un nuevo mapa aleatorio para la isla (${room.settings.mapSize.toUpperCase()}).`, 'system');
  }
  return { ok: true };
}

function addLog(room, text, type = 'info') {
  room.logs.push({
    id: Date.now() + Math.random(),
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    text,
    type
  });
  if (room.logs.length > 80) {
    room.logs.shift();
  }
}

function getTotalResources(player) {
  return RESOURCES.reduce((sum, r) => sum + (player.resources[r] || 0), 0);
}

function hasResources(player, cost) {
  return Object.entries(cost).every(([res, amount]) => (player.resources[res] || 0) >= amount);
}

function deductResources(player, cost) {
  for (const [res, amount] of Object.entries(cost)) {
    player.resources[res] = Math.max(0, (player.resources[res] || 0) - amount);
  }
}

function getPlayerTradeRatios(room, playerId) {
  const baseRatio = room.settings?.generousBank ? 3 : 4;
  const ratios = { wood: baseRatio, brick: baseRatio, sheep: baseRatio, wheat: baseRatio, ore: baseRatio };
  for (const v of room.board.vertices) {
    if (v.building && v.building.playerId === playerId && v.port) {
      if (v.port.type === '3:1') {
        for (const r of RESOURCES) {
          ratios[r] = Math.min(ratios[r], 3);
        }
      } else if (RESOURCES.includes(v.port.type)) {
        ratios[v.port.type] = Math.min(ratios[v.port.type], 2);
      }
    }
  }
  return ratios;
}

function passesDistanceRule(board, vertexId) {
  const v = board.vertices[vertexId];
  if (!v || v.building) return false;
  for (const adjId of v.adjacentVertexIds) {
    if (board.vertices[adjId].building) return false;
  }
  return true;
}

function getValidSettlementVertices(room, playerId, isSetup = false) {
  const valid = [];
  for (const v of room.board.vertices) {
    if (!passesDistanceRule(room.board, v.id)) continue;
    if (isSetup) {
      valid.push(v.id);
    } else {
      const connectedToOwnRoad = v.edgeIds.some(eId => {
        const edge = room.board.edges[eId];
        return edge.road && edge.road.playerId === playerId;
      });
      if (connectedToOwnRoad) {
        valid.push(v.id);
      }
    }
  }
  return valid;
}

function getValidCityVertices(room, playerId) {
  return room.board.vertices
    .filter(v => v.building && v.building.playerId === playerId && v.building.type === 'settlement')
    .map(v => v.id);
}

function getValidRoadEdges(room, playerId, mustConnectVertexId = null) {
  const valid = [];
  for (const e of room.board.edges) {
    if (e.road) continue;
    if (mustConnectVertexId !== null) {
      if (e.v1 === mustConnectVertexId || e.v2 === mustConnectVertexId) {
        valid.push(e.id);
      }
      continue;
    }

    const checkEndpoint = (vId) => {
      const v = room.board.vertices[vId];
      if (v.building) {
        return v.building.playerId === playerId;
      }
      return v.edgeIds.some(otherEdgeId => {
        if (otherEdgeId === e.id) return false;
        const otherEdge = room.board.edges[otherEdgeId];
        return otherEdge.road && otherEdge.road.playerId === playerId;
      });
    };

    if (checkEndpoint(e.v1) || checkEndpoint(e.v2)) {
      valid.push(e.id);
    }
  }
  return valid;
}

function calculatePlayerLongestRoad(board, playerId) {
  const playerEdges = board.edges.filter(e => e.road && e.road.playerId === playerId);
  if (playerEdges.length === 0) return 0;

  let maxLen = 0;
  const visitedEdges = new Set();

  function dfs(currentVertexId, currentLength) {
    if (currentLength > maxLen) {
      maxLen = currentLength;
    }
    const vertex = board.vertices[currentVertexId];
    if (currentLength > 0 && vertex.building && vertex.building.playerId !== playerId) {
      return;
    }

    for (const eId of vertex.edgeIds) {
      if (visitedEdges.has(eId)) continue;
      const edge = board.edges[eId];
      if (!edge.road || edge.road.playerId !== playerId) continue;

      visitedEdges.add(eId);
      const nextVertexId = edge.v1 === currentVertexId ? edge.v2 : edge.v1;
      dfs(nextVertexId, currentLength + 1);
      visitedEdges.delete(eId);
    }
  }

  for (const edge of playerEdges) {
    visitedEdges.add(edge.id);
    dfs(edge.v1, 1);
    dfs(edge.v2, 1);
    visitedEdges.delete(edge.id);
  }

  return maxLen;
}

function updateLongestRoad(room) {
  for (const p of room.players) {
    p.longestRoad = calculatePlayerLongestRoad(room.board, p.id);
  }

  const currentHolder = room.players.find(p => p.id === room.longestRoadPlayerId);
  let maxRoad = 0;
  for (const p of room.players) {
    if (p.longestRoad > maxRoad) maxRoad = p.longestRoad;
  }

  if (maxRoad < 5) {
    if (room.longestRoadPlayerId !== null) {
      addLog(room, `Nadie mantiene una ruta de al menos 5 tramos. Se pierde la Gran Ruta Comercial.`, 'achievement');
      room.longestRoadPlayerId = null;
      room.longestRoadLength = 4;
    }
    return;
  }

  const topPlayers = room.players.filter(p => p.longestRoad === maxRoad);
  if (currentHolder && currentHolder.longestRoad === maxRoad) {
    room.longestRoadLength = maxRoad;
    return;
  }

  if (topPlayers.length === 1) {
    const newHolder = topPlayers[0];
    if (room.longestRoadPlayerId !== newHolder.id) {
      room.longestRoadPlayerId = newHolder.id;
      room.longestRoadLength = maxRoad;
      addLog(room, `🛣️ ¡${newHolder.name} consigue la Gran Ruta Comercial (${maxRoad} caminos, +2 PV)!`, 'achievement');
    } else {
      room.longestRoadLength = maxRoad;
    }
  } else {
    room.longestRoadPlayerId = null;
    room.longestRoadLength = maxRoad;
  }
}

function updateLargestArmy(room, player) {
  if (player.knightsPlayed >= 3 && player.knightsPlayed > room.largestArmySize) {
    const prevId = room.largestArmyPlayerId;
    room.largestArmyPlayerId = player.id;
    room.largestArmySize = player.knightsPlayed;
    if (prevId !== player.id) {
      addLog(room, `⚔️ ¡${player.name} toma el Gran Ejército de Caballería (${player.knightsPlayed} caballeros, +2 PV)!`, 'achievement');
    }
  }
}

function getPlayerVictoryPoints(room, playerId, includeSecretVP = true) {
  const player = room.players.find(p => p.id === playerId);
  if (!player) return 0;

  let points = 0;
  for (const v of room.board.vertices) {
    if (v.building && v.building.playerId === playerId) {
      points += v.building.type === 'city' ? 2 : 1;
    }
  }

  if (room.longestRoadPlayerId === playerId) points += 2;
  if (room.largestArmyPlayerId === playerId) points += 2;

  if (includeSecretVP) {
    const vpCards = player.devCards.filter(c => c.type === 'vp').length;
    points += vpCards;
  }

  return points;
}

function checkWinner(room) {
  if (room.status !== 'playing') return false;
  const activePlayer = room.players[room.turnIndex];
  if (!activePlayer) return false;

  const targetVP = room.settings?.vpToWin || 10;
  const totalVP = getPlayerVictoryPoints(room, activePlayer.id, true);
  if (totalVP >= targetVP) {
    room.status = 'finished';
    room.phase = 'finished';
    room.winnerId = activePlayer.id;
    addLog(room, `🏆 ¡${activePlayer.name} ha alcanzado ${totalVP} Puntos de Victoria y GANA LA PARTIDA!`, 'victory');
    return true;
  }
  return false;
}

function startGame(room) {
  if (room.players.length < 2) {
    return { error: 'Se necesitan al menos 2 jugadores para iniciar.' };
  }
  room.devDeck = createDevCardDeck();
  room.status = 'setup';
  room.phase = 'setup_settlement';
  room.turnNumber = 1;
  room.stats = {
    diceHistogram: { 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 },
    totalRolls: 0,
    robberCount: 0,
    producedByPlayer: {}
  };

  if (room.settings?.startingBonus) {
    for (const p of room.players) {
      for (const res of RESOURCES) {
        p.resources[res] = (p.resources[res] || 0) + 1;
        recordPlayerProduction(room, p.id, res, 1);
      }
    }
    addLog(room, `🎒 Regla de Abundancia Inicial activada: ¡Todos los jugadores reciben 1 recurso de cada tipo para comenzar!`, 'system');
  }

  const n = room.players.length;
  const forward = Array.from({ length: n }, (_, i) => i);
  const isSingleSetup = Number(room.settings?.initialSettlements) === 1;

  if (isSingleSetup) {
    room.setupOrder = [...forward];
    addLog(room, `🎲 ¡Comienza la partida! Ronda Inicial Rápida: Solo 1 poblado y 1 camino por jugador (da recursos directos).`, 'system');
  } else {
    const backward = [...forward].reverse();
    room.setupOrder = [...forward, ...backward];
    addLog(room, `🎲 ¡Comienza la partida! Ronda Inicial 1 de 2 (Orden de ida: 1° al ${n}° jugador).`, 'system');
  }
  room.setupStep = 0;
  room.turnIndex = room.setupOrder[0];
  refreshTurnDeadline(room);
  advanceWeather(room);

  return { ok: true };
}

function placeSettlement(room, playerId, vertexId) {
  const activePlayer = room.players[room.turnIndex];
  if (!activePlayer || activePlayer.id !== playerId) {
    return { error: 'No es tu turno.' };
  }

  const isSetup = room.phase === 'setup_settlement';
  if (!isSetup && room.phase !== 'main') {
    return { error: 'No puedes construir un poblado en esta fase.' };
  }

  if (activePlayer.settlementsLeft <= 0) {
    return { error: 'Ya no te quedan poblados disponibles (máximo 5).' };
  }

  if (!isSetup && !hasResources(activePlayer, COSTS.settlement)) {
    return { error: 'No tienes recursos suficientes para construir un poblado.' };
  }

  const validVertices = getValidSettlementVertices(room, playerId, isSetup);
  if (!validVertices.includes(vertexId)) {
    return { error: 'Ubicación inválida para el poblado (debe respetar la regla de distancia y conexión).' };
  }

  const vertex = room.board.vertices[vertexId];
  vertex.building = { playerId, type: 'settlement' };
  activePlayer.settlementsLeft -= 1;

  if (!isSetup) {
    deductResources(activePlayer, COSTS.settlement);
    addLog(room, `🏠 ${activePlayer.name} construyó un poblado.`, 'build');
    updateLongestRoad(room);
    checkWinner(room);
  } else {
    room.lastPlacedSettlementVertexId = vertexId;
    room.phase = 'setup_road';

    const isSingleSetup = Number(room.settings?.initialSettlements) === 1;
    const givesInitialResources = isSingleSetup || room.setupStep >= room.players.length;

    if (givesInitialResources) {
      const gained = [];
      const harvestItems = [];
      for (const hId of vertex.hexIds) {
        const hex = room.board.hexes[hId];
        if (hex.terrain !== 'desert') {
          activePlayer.resources[hex.terrain] += 1;
          recordPlayerProduction(room, activePlayer.id, hex.terrain, 1);
          gained.push(RESOURCE_NAMES_ES[hex.terrain]);
          harvestItems.push({
            hexId: hex.id,
            playerId: activePlayer.id,
            playerName: activePlayer.name,
            resource: hex.terrain,
            qty: 1
          });
        }
      }
      if (harvestItems.length > 0) {
        room.lastHarvest = {
          harvestId: `setup_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          delayed: false,
          items: harvestItems
        };
      }
      const roundLabel = isSingleSetup ? 'su poblado inicial' : 'su 2° poblado';
      if (gained.length > 0) {
        addLog(room, `🏠 ${activePlayer.name} colocó ${roundLabel} y recibió recursos iniciales: ${gained.join(', ')}.`, 'build');
      } else {
        addLog(room, `🏠 ${activePlayer.name} colocó ${roundLabel}.`, 'build');
      }
    } else {
      addLog(room, `🏠 ${activePlayer.name} colocó su 1° poblado.`, 'build');
    }
  }

  return { ok: true };
}

function placeRoad(room, playerId, edgeId) {
  const activePlayer = room.players[room.turnIndex];
  if (!activePlayer || activePlayer.id !== playerId) {
    return { error: 'No es tu turno.' };
  }

  const isSetup = room.phase === 'setup_road';
  const isFreeRoadCard = room.phase === 'road_building_1' || room.phase === 'road_building_2';

  if (!isSetup && !isFreeRoadCard && room.phase !== 'main') {
    return { error: 'No puedes construir un camino en esta fase.' };
  }

  if (activePlayer.roadsLeft <= 0) {
    return { error: 'Ya no te quedan caminos disponibles (máximo 15).' };
  }

  if (!isSetup && !isFreeRoadCard && !hasResources(activePlayer, COSTS.road)) {
    return { error: 'No tienes suficientes recursos (1 Madera + 1 Ladrillo).' };
  }

  const mustConnectVertex = isSetup ? room.lastPlacedSettlementVertexId : null;
  const validEdges = getValidRoadEdges(room, playerId, mustConnectVertex);
  if (!validEdges.includes(edgeId)) {
    return { error: 'Ubicación inválida para el camino.' };
  }

  const edge = room.board.edges[edgeId];
  edge.road = { playerId };
  activePlayer.roadsLeft -= 1;

  if (!isSetup && !isFreeRoadCard) {
    deductResources(activePlayer, COSTS.road);
  }

  addLog(room, `🛤️ ${activePlayer.name} construyó un camino.`, 'build');
  updateLongestRoad(room);

  if (isSetup) {
    room.lastPlacedSettlementVertexId = null;
    room.setupStep += 1;
    if (room.setupStep === room.players.length && room.setupOrder.length > room.players.length) {
      addLog(
        room,
        `🔄 Ronda Inicial 2 de 2 (Orden Inverso Oficial de Catan): ${activePlayer.name} repite turno para colocar su 2° poblado y recibir sus recursos iniciales.`,
        'system'
      );
    }
    if (room.setupStep >= room.setupOrder.length) {
      room.status = 'playing';
      room.phase = 'roll';
      room.turnIndex = 0;
      refreshTurnDeadline(room);
      advanceWeather(room);
      addLog(room, `🎉 ¡Fase de Fundación completada! Turno de ${room.players[0].name} para tirar los dados.`, 'system');
    } else {
      room.turnIndex = room.setupOrder[room.setupStep];
      room.phase = 'setup_settlement';
      refreshTurnDeadline(room);
    }
  } else if (room.phase === 'road_building_1') {
    if (activePlayer.roadsLeft > 0 && getValidRoadEdges(room, playerId).length > 0) {
      room.phase = 'road_building_2';
    } else {
      room.phase = 'main';
    }
  } else if (room.phase === 'road_building_2') {
    room.phase = 'main';
  }

  checkWinner(room);
  return { ok: true };
}

function upgradeToCity(room, playerId, vertexId) {
  const activePlayer = room.players[room.turnIndex];
  if (!activePlayer || activePlayer.id !== playerId) return { error: 'No es tu turno.' };
  if (room.phase !== 'main') return { error: 'Solo puedes construir ciudades en tu fase principal.' };
  if (activePlayer.citiesLeft <= 0) return { error: 'No te quedan ciudades disponibles (máximo 4).' };
  if (!hasResources(activePlayer, COSTS.city)) return { error: 'Necesitas 2 de Trigo y 3 de Piedra.' };

  const valid = getValidCityVertices(room, playerId);
  if (!valid.includes(vertexId)) return { error: 'Selecciona uno de tus poblados para mejorarlo a ciudad.' };

  const vertex = room.board.vertices[vertexId];
  vertex.building.type = 'city';
  activePlayer.citiesLeft -= 1;
  activePlayer.settlementsLeft += 1;
  deductResources(activePlayer, COSTS.city);

  addLog(room, `🏰 ${activePlayer.name} mejoró un poblado a Ciudad.`, 'build');
  checkWinner(room);
  return { ok: true };
}

function rollDice(room, playerId) {
  const activePlayer = room.players[room.turnIndex];
  if (!activePlayer || activePlayer.id !== playerId) return { error: 'No es tu turno.' };
  if (room.phase !== 'roll') return { error: 'Ya tiraste los dados este turno.' };

  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  const sum = d1 + d2;
  const rollId = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  if (room.stats) {
    room.stats.diceHistogram[sum] = (room.stats.diceHistogram[sum] || 0) + 1;
    room.stats.totalRolls = (room.stats.totalRolls || 0) + 1;
    if (sum === 7) room.stats.robberCount = (room.stats.robberCount || 0) + 1;
  }

  room.lastDice = {
    d1,
    d2,
    sum,
    rollerName: activePlayer.name,
    rollerAvatar: activePlayer.avatar || '👑',
    rollId
  };

  if (sum === 7) {
    const limit = room.settings?.discardLimit || 7;
    addLog(room, `🎲 ${activePlayer.name} sacó un 7 (${d1} + ${d2}). ¡Se activa el Ladrón!`, 'robber');
    advanceWeather(room, { isRoll7: true });
    room.pendingDiscards = {};
    for (const p of room.players) {
      const total = getTotalResources(p);
      if (total > limit) {
        room.pendingDiscards[p.id] = Math.floor(total / 2);
      }
    }

    if (Object.keys(room.pendingDiscards).length > 0) {
      room.phase = 'discard';
      autoDiscardForBots(room);
    } else {
      room.phase = 'robber_move';
    }
  } else {
    const gainsByPlayer = {};
    const harvestItems = [];
    for (const hex of room.board.hexes) {
      if (hex.number === sum && hex.id !== room.board.robberHexId && hex.terrain !== 'desert') {
        for (const vId of hex.vertexIds) {
          const v = room.board.vertices[vId];
          if (v.building) {
            const p = room.players.find(pl => pl.id === v.building.playerId);
            if (p) {
              const qty = v.building.type === 'city' ? 2 : 1;
              p.resources[hex.terrain] += qty;
              recordPlayerProduction(room, p.id, hex.terrain, qty);
              if (!gainsByPlayer[p.name]) gainsByPlayer[p.name] = [];
              gainsByPlayer[p.name].push(`${qty} ${RESOURCE_NAMES_ES[hex.terrain]}`);
              harvestItems.push({
                hexId: hex.id,
                playerId: p.id,
                playerName: p.name,
                resource: hex.terrain,
                qty
              });
            }
          }
        }
      }
    }

    // Regla opcional: Compensación por Mala Suerte (Pity Production)
    if (room.settings?.pityProduction) {
      for (const p of room.players) {
        if (!gainsByPlayer[p.name]) {
          // El jugador no recibió ningún recurso con esta tirada
          p.consecutiveNoHarvest = (p.consecutiveNoHarvest || 0) + 1;
          if (p.consecutiveNoHarvest >= 3) {
            p.consecutiveNoHarvest = 0;
            // Se le entrega 1 recurso al azar del banco como consuelo
            const randomRes = RESOURCES[Math.floor(Math.random() * RESOURCES.length)];
            p.resources[randomRes] += 1;
            recordPlayerProduction(room, p.id, randomRes, 1);
            addLog(room, `🍀 ¡Compensación de Mala Suerte! ${p.name} llevaba 3 rondas sin cosechar y recibe 1 ${RESOURCE_NAMES_ES[randomRes]}.`, 'system');
          }
        } else {
          p.consecutiveNoHarvest = 0;
        }
      }
    }

    if (harvestItems.length > 0) {
      room.lastHarvest = {
        harvestId: `roll_${rollId}`,
        delayed: true,
        items: harvestItems
      };
    }

    const summary = Object.entries(gainsByPlayer)
      .map(([name, items]) => `${name} (+${items.join(', ')})`)
      .join(' | ');

    addLog(
      room,
      `🎲 ${activePlayer.name} sacó ${sum} (${d1}+${d2}). ${summary ? 'Producción: ' + summary : 'Nadie produjo recursos.'}`,
      'roll'
    );
    room.phase = 'main';
  }

  return { ok: true, dice: room.lastDice };
}

function autoDiscardForBots(room) {
  for (const p of room.players) {
    if (p.isBot && room.pendingDiscards[p.id]) {
      let toDrop = room.pendingDiscards[p.id];
      while (toDrop > 0) {
        const available = RESOURCES.filter(r => p.resources[r] > 0);
        if (available.length === 0) break;
        const pick = available[Math.floor(Math.random() * available.length)];
        p.resources[pick] -= 1;
        toDrop -= 1;
      }
      delete room.pendingDiscards[p.id];
      addLog(room, `🗑️ ${p.name} descartó la mitad de sus cartas por el 7.`, 'robber');
    }
  }
  if (Object.keys(room.pendingDiscards).length === 0 && room.phase === 'discard') {
    room.phase = 'robber_move';
  }
}

function discardResources(room, playerId, discardMap) {
  if (room.phase !== 'discard') return { error: 'No estamos en fase de descarte.' };
  const required = room.pendingDiscards[playerId];
  if (!required) return { error: 'No tienes descartes pendientes.' };

  const player = room.players.find(p => p.id === playerId);
  if (!player) return { error: 'Jugador no encontrado.' };

  let totalSelected = 0;
  for (const r of RESOURCES) {
    const count = Number(discardMap[r] || 0);
    if (count < 0 || count > player.resources[r]) {
      return { error: 'Cantidad inválida de recursos a descartar.' };
    }
    totalSelected += count;
  }

  if (totalSelected !== required) {
    return { error: `Debes descartar exactamente ${required} cartas.` };
  }

  for (const r of RESOURCES) {
    player.resources[r] -= Number(discardMap[r] || 0);
  }

  delete room.pendingDiscards[playerId];
  addLog(room, `🗑️ ${player.name} descartó ${required} cartas.`, 'robber');

  if (Object.keys(room.pendingDiscards).length === 0) {
    room.phase = 'robber_move';
  }

  return { ok: true };
}

function moveRobber(room, playerId, hexId) {
  const activePlayer = room.players[room.turnIndex];
  if (!activePlayer || activePlayer.id !== playerId) return { error: 'No es tu turno.' };
  if (room.phase !== 'robber_move') return { error: 'No toca mover el ladrón ahora.' };
  if (hexId === room.board.robberHexId) return { error: 'Debes mover el ladrón a un hexágono diferente.' };

  const hex = room.board.hexes[hexId];
  if (!hex) return { error: 'Hexágono inválido.' };

  if (room.settings?.friendlyRobber) {
    const touchesLowVP = hex.vertexIds.some(vId => {
      const b = room.board.vertices[vId].building;
      if (!b || b.playerId === playerId) return false;
      return getPlayerVictoryPoints(room, b.playerId, false) <= 2;
    });
    if (touchesLowVP) {
      return { error: 'Ladrón Amistoso activo: no puedes bloquear a un jugador con solo 2 Puntos de Victoria.' };
    }
  }

  room.board.robberHexId = hexId;
  addLog(room, `🥷 ${activePlayer.name} movió el Ladrón al hexágono de ${hex.terrain === 'desert' ? 'Desierto' : RESOURCE_NAMES_ES[hex.terrain]}${hex.number ? ' (' + hex.number + ')' : ''}.`, 'robber');

  const victims = new Set();
  for (const vId of hex.vertexIds) {
    const v = room.board.vertices[vId];
    if (v.building && v.building.playerId !== playerId) {
      const victimPlayer = room.players.find(p => p.id === v.building.playerId);
      if (victimPlayer && getTotalResources(victimPlayer) > 0) {
        victims.add(victimPlayer.id);
      }
    }
  }

  const victimIds = Array.from(victims);
  if (victimIds.length === 0) {
    room.phase = room.robberReturnPhase || 'main';
    room.robberReturnPhase = null;
  } else if (victimIds.length === 1) {
    stealFromVictim(room, activePlayer, victimIds[0]);
    room.phase = room.robberReturnPhase || 'main';
    room.robberReturnPhase = null;
  } else {
    room.stealCandidates = victimIds;
    room.phase = 'robber_steal';
  }

  return { ok: true };
}

function stealFromVictim(room, thiefPlayer, victimId) {
  const victim = room.players.find(p => p.id === victimId);
  if (!victim) return;

  const pool = [];
  for (const r of RESOURCES) {
    for (let i = 0; i < victim.resources[r]; i++) {
      pool.push(r);
    }
  }
  if (pool.length === 0) return;

  const stolenRes = pool[Math.floor(Math.random() * pool.length)];
  victim.resources[stolenRes] -= 1;
  thiefPlayer.resources[stolenRes] += 1;
  addLog(room, `🥷 ${thiefPlayer.name} le robó 1 carta de recurso a ${victim.name}.`, 'robber');
}

function chooseStealVictim(room, playerId, victimId) {
  const activePlayer = room.players[room.turnIndex];
  if (!activePlayer || activePlayer.id !== playerId) return { error: 'No es tu turno.' };
  if (room.phase !== 'robber_steal') return { error: 'No toca elegir víctima.' };
  if (!room.stealCandidates.includes(victimId)) return { error: 'Jugador inválido para robar.' };

  stealFromVictim(room, activePlayer, victimId);
  room.stealCandidates = [];
  room.phase = room.robberReturnPhase || 'main';
  room.robberReturnPhase = null;
  return { ok: true };
}

function buyDevCard(room, playerId) {
  const activePlayer = room.players[room.turnIndex];
  if (!activePlayer || activePlayer.id !== playerId) return { error: 'No es tu turno.' };
  if (room.phase !== 'main') return { error: 'Solo puedes comprar cartas en tu fase principal.' };
  if (room.devDeck.length === 0) return { error: 'El mazo de Cartas de Desarrollo está agotado.' };
  if (!hasResources(activePlayer, COSTS.devCard)) {
    return { error: 'Necesitas 1 Oveja, 1 Trigo y 1 Piedra para comprar una carta.' };
  }

  deductResources(activePlayer, COSTS.devCard);
  const cardType = room.devDeck.pop();
  activePlayer.devCards.push({
    id: `dev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type: cardType,
    boughtTurn: room.turnNumber,
    used: false
  });

  addLog(room, `🃏 ${activePlayer.name} compró una Carta de Desarrollo.`, 'dev');
  checkWinner(room);
  return { ok: true, cardType };
}

function playDevCard(room, playerId, cardType, payload = {}) {
  const activePlayer = room.players[room.turnIndex];
  if (!activePlayer || activePlayer.id !== playerId) return { error: 'No es tu turno.' };
  if (activePlayer.playedDevCardThisTurn) {
    return { error: 'Solo puedes jugar 1 Carta de Desarrollo por turno.' };
  }

  if (cardType === 'knight') {
    if (room.phase !== 'roll' && room.phase !== 'main') {
      return { error: 'No puedes jugar un Caballero en este momento.' };
    }
  } else if (room.phase !== 'main') {
    return { error: 'Solo puedes jugar esta carta en tu fase principal.' };
  }

  const card = activePlayer.devCards.find(
    c => c.type === cardType && !c.used && c.boughtTurn < room.turnNumber && c.type !== 'vp'
  );
  if (!card) {
    return { error: 'No tienes esa carta disponible (recuerda que no puedes usar una carta comprada en este mismo turno).' };
  }

  card.used = true;
  activePlayer.playedDevCardThisTurn = true;

  if (cardType === 'knight') {
    activePlayer.knightsPlayed += 1;
    addLog(room, `⚔️ ${activePlayer.name} jugó un Caballero (${activePlayer.knightsPlayed} jugados).`, 'dev');
    updateLargestArmy(room, activePlayer);
    room.robberReturnPhase = room.phase;
    room.phase = 'robber_move';
    checkWinner(room);
    return { ok: true };
  }

  if (cardType === 'road_building') {
    if (activePlayer.roadsLeft <= 0 || getValidRoadEdges(room, playerId).length === 0) {
      return { error: 'No tienes espacio o caminos disponibles para construir.' };
    }
    addLog(room, `🛤️ ${activePlayer.name} jugó Construcción de Carreteras (2 caminos gratis).`, 'dev');
    room.phase = 'road_building_1';
    return { ok: true };
  }

  if (cardType === 'year_of_plenty') {
    const { res1, res2 } = payload;
    if (!RESOURCES.includes(res1) || !RESOURCES.includes(res2)) {
      card.used = false;
      activePlayer.playedDevCardThisTurn = false;
      return { error: 'Debes elegir 2 recursos válidos del banco.' };
    }
    activePlayer.resources[res1] += 1;
    activePlayer.resources[res2] += 1;
    addLog(room, `🎁 ${activePlayer.name} jugó Año de la Abundancia y tomó ${RESOURCE_NAMES_ES[res1]} y ${RESOURCE_NAMES_ES[res2]}.`, 'dev');
    return { ok: true };
  }

  if (cardType === 'monopoly') {
    const { resource } = payload;
    if (!RESOURCES.includes(resource)) {
      card.used = false;
      activePlayer.playedDevCardThisTurn = false;
      return { error: 'Debes elegir un recurso válido para el Monopolio.' };
    }
    let totalTaken = 0;
    for (const p of room.players) {
      if (p.id !== playerId && p.resources[resource] > 0) {
        totalTaken += p.resources[resource];
        p.resources[resource] = 0;
      }
    }
    activePlayer.resources[resource] += totalTaken;
    addLog(room, `👑 ¡${activePlayer.name} jugó Monopolio de ${RESOURCE_NAMES_ES[resource]} y obtuvo ${totalTaken} cartas de los demás jugadores!`, 'dev');
    return { ok: true };
  }

  return { error: 'Tipo de carta no reconocido.' };
}

function bankTrade(room, playerId, giveRes, getRes) {
  const activePlayer = room.players[room.turnIndex];
  if (!activePlayer || activePlayer.id !== playerId) return { error: 'No es tu turno.' };
  if (room.phase !== 'main') return { error: 'Solo puedes comerciar en tu fase principal.' };
  if (!RESOURCES.includes(giveRes) || !RESOURCES.includes(getRes) || giveRes === getRes) {
    return { error: 'Selecciona recursos válidos y distintos.' };
  }

  const ratios = getPlayerTradeRatios(room, playerId);
  const needed = ratios[giveRes];
  if (activePlayer.resources[giveRes] < needed) {
    return { error: `Necesitas ${needed} de ${RESOURCE_NAMES_ES[giveRes]} para este intercambio.` };
  }

  activePlayer.resources[giveRes] -= needed;
  activePlayer.resources[getRes] += 1;
  addLog(room, `⛵ ${activePlayer.name} comerció ${needed} ${RESOURCE_NAMES_ES[giveRes]} por 1 ${RESOURCE_NAMES_ES[getRes]} (${needed}:1).`, 'trade');
  return { ok: true };
}

function proposePlayerTrade(room, playerId, give, want) {
  const activePlayer = room.players[room.turnIndex];
  if (!activePlayer || activePlayer.id !== playerId) return { error: 'Solo el jugador en turno puede proponer un intercambio.' };
  if (room.phase !== 'main') return { error: 'Solo puedes comerciar en la fase principal.' };

  let totalGive = 0;
  let totalWant = 0;
  const cleanGive = {};
  const cleanWant = {};

  for (const r of RESOURCES) {
    const g = Math.max(0, Math.floor(Number(give[r] || 0)));
    const w = Math.max(0, Math.floor(Number(want[r] || 0)));
    if (g > activePlayer.resources[r]) {
      return { error: `No tienes suficiente ${RESOURCE_NAMES_ES[r]} para ofrecer.` };
    }
    cleanGive[r] = g;
    cleanWant[r] = w;
    totalGive += g;
    totalWant += w;
  }

  if (totalGive === 0 || totalWant === 0) {
    return { error: 'La oferta debe incluir al menos 1 recurso ofrecido y 1 recurso solicitado.' };
  }

  room.activeTradeOffer = {
    id: `trade_${Date.now()}`,
    fromPlayerId: playerId,
    fromPlayerName: activePlayer.name,
    give: cleanGive,
    want: cleanWant,
    responses: {}
  };

  for (const p of room.players) {
    if (p.isBot && p.id !== playerId) {
      const canAfford = hasResources(p, cleanWant);
      if (canAfford && totalGive >= totalWant) {
        room.activeTradeOffer.responses[p.id] = 'accepted';
      } else {
        room.activeTradeOffer.responses[p.id] = 'rejected';
      }
    }
  }

  addLog(room, `🤝 ${activePlayer.name} propuso un intercambio a la mesa.`, 'trade');
  return { ok: true };
}

function respondPlayerTrade(room, playerId, response) {
  const offer = room.activeTradeOffer;
  if (!offer) return { error: 'No hay ninguna oferta activa.' };
  if (offer.fromPlayerId === playerId) return { error: 'No puedes responder a tu propia oferta.' };

  const player = room.players.find(p => p.id === playerId);
  if (!player) return { error: 'Jugador no encontrado.' };

  if (response === 'accepted' && !hasResources(player, offer.want)) {
    return { error: 'No tienes los recursos que pide la oferta.' };
  }

  offer.responses[playerId] = response === 'accepted' ? 'accepted' : 'rejected';
  return { ok: true };
}

function executePlayerTrade(room, activePlayerId, partnerPlayerId) {
  const offer = room.activeTradeOffer;
  if (!offer || offer.fromPlayerId !== activePlayerId) return { error: 'Oferta inválida.' };
  if (offer.responses[partnerPlayerId] !== 'accepted') {
    return { error: 'Ese jugador no ha aceptado la oferta.' };
  }

  const proposer = room.players.find(p => p.id === activePlayerId);
  const partner = room.players.find(p => p.id === partnerPlayerId);
  if (!proposer || !partner) return { error: 'Jugadores no encontrados.' };

  if (!hasResources(proposer, offer.give) || !hasResources(partner, offer.want)) {
    return { error: 'Uno de los jugadores ya no dispone de los recursos acordados.' };
  }

  for (const r of RESOURCES) {
    proposer.resources[r] = proposer.resources[r] - offer.give[r] + offer.want[r];
    partner.resources[r] = partner.resources[r] - offer.want[r] + offer.give[r];
  }

  room.activeTradeOffer = null;
  addLog(room, `🤝 ¡${proposer.name} y ${partner.name} completaron un intercambio!`, 'trade');
  return { ok: true };
}

function cancelPlayerTrade(room, playerId) {
  if (!room.activeTradeOffer || room.activeTradeOffer.fromPlayerId !== playerId) {
    return { error: 'No hay oferta tuya para cancelar.' };
  }
  room.activeTradeOffer = null;
  return { ok: true };
}

function endTurn(room, playerId) {
  const activePlayer = room.players[room.turnIndex];
  if (!activePlayer || activePlayer.id !== playerId) return { error: 'No es tu turno.' };
  if (room.phase !== 'main') return { error: 'No puedes terminar el turno hasta completar la acción pendiente.' };

  room.activeTradeOffer = null;
  activePlayer.playedDevCardThisTurn = false;
  room.turnIndex = (room.turnIndex + 1) % room.players.length;
  room.turnNumber += 1;
  room.phase = 'roll';
  refreshTurnDeadline(room);
  advanceWeather(room, { isTurnEnd: true });

  const nextPlayer = room.players[room.turnIndex];
  nextPlayer.playedDevCardThisTurn = false;
  addLog(room, `➡️ Turno de ${nextPlayer.name}.`, 'turn');

  return { ok: true };
}

function runBotStep(room) {
  if (room.status === 'lobby' || room.status === 'finished') return false;
  const activePlayer = room.players[room.turnIndex];
  if (!activePlayer || !activePlayer.isBot) return false;

  if (room.phase === 'setup_settlement') {
    const valid = getValidSettlementVertices(room, activePlayer.id, true);
    if (valid.length === 0) return false;
    const pipValue = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };
    let bestV = valid[0];
    let bestScore = -1;
    for (const vId of valid) {
      const v = room.board.vertices[vId];
      let score = 0;
      for (const hId of v.hexIds) {
        const h = room.board.hexes[hId];
        score += pipValue[h.number] || 0;
      }
      if (score > bestScore) {
        bestScore = score;
        bestV = vId;
      }
    }
    placeSettlement(room, activePlayer.id, bestV);
    return true;
  }

  if (room.phase === 'setup_road') {
    const valid = getValidRoadEdges(room, activePlayer.id, room.lastPlacedSettlementVertexId);
    if (valid.length === 0) return false;
    const pick = valid[Math.floor(Math.random() * valid.length)];
    placeRoad(room, activePlayer.id, pick);
    return true;
  }

  if (room.phase === 'roll') {
    rollDice(room, activePlayer.id);
    return true;
  }

  if (room.phase === 'robber_move') {
    const candidates = room.board.hexes.filter(
      h => h.id !== room.board.robberHexId && h.terrain !== 'desert'
    );
    const pick = candidates[Math.floor(Math.random() * candidates.length)] || room.board.hexes[0];
    const res = moveRobber(room, activePlayer.id, pick.id);
    if (res.error) {
      const fallback = room.board.hexes.find(h => h.id !== room.board.robberHexId);
      if (fallback) {
        room.board.robberHexId = fallback.id;
        room.phase = room.robberReturnPhase || 'main';
      }
    }
    return true;
  }

  if (room.phase === 'robber_steal') {
    if (room.stealCandidates.length > 0) {
      chooseStealVictim(room, activePlayer.id, room.stealCandidates[0]);
      return true;
    }
  }

  if (room.phase === 'road_building_1' || room.phase === 'road_building_2') {
    const valid = getValidRoadEdges(room, activePlayer.id);
    if (valid.length > 0) {
      placeRoad(room, activePlayer.id, valid[0]);
    } else {
      room.phase = 'main';
    }
    return true;
  }

  if (room.phase === 'main') {
    if (activePlayer.citiesLeft > 0 && hasResources(activePlayer, COSTS.city)) {
      const validCities = getValidCityVertices(room, activePlayer.id);
      if (validCities.length > 0) {
        upgradeToCity(room, activePlayer.id, validCities[0]);
        return true;
      }
    }
    if (activePlayer.settlementsLeft > 0 && hasResources(activePlayer, COSTS.settlement)) {
      const validSettle = getValidSettlementVertices(room, activePlayer.id, false);
      if (validSettle.length > 0) {
        placeSettlement(room, activePlayer.id, validSettle[0]);
        return true;
      }
    }
    if (activePlayer.roadsLeft > 0 && hasResources(activePlayer, COSTS.road)) {
      const validRoads = getValidRoadEdges(room, activePlayer.id);
      if (validRoads.length > 0 && Math.random() < 0.75) {
        const pick = validRoads[Math.floor(Math.random() * validRoads.length)];
        placeRoad(room, activePlayer.id, pick);
        return true;
      }
    }
    if (room.devDeck.length > 0 && hasResources(activePlayer, COSTS.devCard)) {
      buyDevCard(room, activePlayer.id);
      return true;
    }
    const ratios = getPlayerTradeRatios(room, activePlayer.id);
    for (const r of RESOURCES) {
      if (activePlayer.resources[r] >= ratios[r] + 1) {
        const scarce = RESOURCES.reduce((minR, currR) =>
          activePlayer.resources[currR] < activePlayer.resources[minR] ? currR : minR
        , RESOURCES[0]);
        if (scarce !== r) {
          bankTrade(room, activePlayer.id, r, scarce);
          return true;
        }
      }
    }

    endTurn(room, activePlayer.id);
    return true;
  }

  return false;
}

function handleTurnTimeout(room) {
  if (!room || (room.status !== 'setup' && room.status !== 'playing')) return false;
  if (!room.turnDeadline || Date.now() < room.turnDeadline) return false;

  const activePlayer = room.players[room.turnIndex];
  if (!activePlayer) return false;

  if (room.status === 'setup') {
    if (room.phase === 'setup_settlement') {
      const validV = getValidSettlementVertices(room, activePlayer.id, true);
      if (validV.length > 0) {
        placeSettlement(room, activePlayer.id, validV[0]);
      }
    }
    if (room.phase === 'setup_road') {
      const validE = getValidRoadEdges(room, activePlayer.id, room.lastPlacedSettlementVertexId);
      if (validE.length > 0) {
        placeRoad(room, activePlayer.id, validE[0]);
      }
    }
    addLog(room, `⏰ Tiempo agotado para ${activePlayer.name} en fase inicial. Se colocó automáticamente.`, 'system');
    refreshTurnDeadline(room);
    return true;
  }

  if (room.phase === 'discard') {
    for (const p of room.players) {
      if (room.pendingDiscards[p.id]) {
        let toDrop = room.pendingDiscards[p.id];
        while (toDrop > 0) {
          const available = RESOURCES.filter(r => p.resources[r] > 0);
          if (available.length === 0) break;
          const pick = available[Math.floor(Math.random() * available.length)];
          p.resources[pick] -= 1;
          toDrop -= 1;
        }
        delete room.pendingDiscards[p.id];
        addLog(room, `⏰ Tiempo agotado: ${p.name} descartó cartas al azar por el 7.`, 'robber');
      }
    }
    room.phase = 'robber_move';
    refreshTurnDeadline(room);
    return true;
  }

  if (room.phase === 'roll') {
    addLog(room, `⏰ Tiempo agotado: se tiraron los dados automáticamente por ${activePlayer.name}.`, 'system');
    rollDice(room, activePlayer.id);
    if (room.phase === 'discard') {
      refreshTurnDeadline(room);
      return true;
    }
  }

  if (room.phase === 'robber_move') {
    const candidates = room.board.hexes.filter(
      h => h.id !== room.board.robberHexId && h.terrain !== 'desert'
    );
    const pick = candidates[Math.floor(Math.random() * candidates.length)] || room.board.hexes[0];
    const res = moveRobber(room, activePlayer.id, pick.id);
    if (res.error) {
      const fallback = room.board.hexes.find(h => h.id !== room.board.robberHexId);
      if (fallback) {
        room.board.robberHexId = fallback.id;
        room.phase = room.robberReturnPhase || 'main';
      }
    }
  }

  if (room.phase === 'robber_steal') {
    if (room.stealCandidates.length > 0) {
      chooseStealVictim(room, activePlayer.id, room.stealCandidates[0]);
    } else {
      room.phase = 'main';
    }
  }

  if (room.phase === 'road_building_1' || room.phase === 'road_building_2') {
    room.phase = 'main';
  }

  if (room.phase === 'main' && room.status === 'playing') {
    room.activeTradeOffer = null;
    addLog(room, `⏰ Tiempo agotado para ${activePlayer.name}. Se pasó al siguiente turno.`, 'system');
    endTurn(room, activePlayer.id);
    return true;
  }

  refreshTurnDeadline(room);
  return true;
}

function resetRoomForRematch(room, requesterId) {
  if (!room) return { error: 'Sala no encontrada.' };
  if (room.status !== 'finished' && room.hostId !== requesterId) {
    return { error: 'Solo el anfitrión puede reiniciar la partida antes de que termine.' };
  }

  if (room._botTimeout) {
    clearTimeout(room._botTimeout);
    room._botTimeout = null;
  }

  room.status = 'lobby';
  room.phase = 'lobby';
  room.turnIndex = 0;
  room.turnNumber = 1;
  room.turnDeadline = null;
  room.setupOrder = [];
  room.setupStep = 0;
  room.lastPlacedSettlementVertexId = null;
  room.board = generateBoard(room.settings?.mapMode || 'random', room.settings?.mapSize || 'normal');
  room.devDeck = createDevCardDeck();
  room.lastDice = null;
  room.lastHarvest = null;
  room.stats = {
    diceHistogram: { 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 },
    totalRolls: 0,
    robberCount: 0,
    producedByPlayer: {}
  };
  room.pendingDiscards = {};
  room.stealCandidates = [];
  room.activeTradeOffer = null;
  room.longestRoadPlayerId = null;
  room.longestRoadLength = 4;
  room.largestArmyPlayerId = null;
  room.largestArmySize = 2;
  room.winnerId = null;

  for (const p of room.players) {
    p.resources = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
    p.devCards = [];
    p.knightsPlayed = 0;
    p.playedDevCardThisTurn = false;
    p.roadsLeft = 15;
    p.settlementsLeft = 5;
    p.citiesLeft = 4;
    p.longestRoad = 0;
  }

  addLog(room, `🔄 ¡Revancha lista! Se generó una nueva isla 3D conservando a todos los jugadores de la sala.`, 'system');
  return { ok: true };
}

function serializeRoomForPlayer(room, viewerId) {
  const activePlayer = room.players[room.turnIndex] || null;
  const isMyTurn = activePlayer && activePlayer.id === viewerId;

  let validActions = {
    settlementVertices: [],
    cityVertices: [],
    roadEdges: [],
    tradeRatios: getPlayerTradeRatios(room, viewerId)
  };

  if (isMyTurn) {
    if (room.phase === 'setup_settlement') {
      validActions.settlementVertices = getValidSettlementVertices(room, viewerId, true);
    } else if (room.phase === 'setup_road') {
      validActions.roadEdges = getValidRoadEdges(room, viewerId, room.lastPlacedSettlementVertexId);
    } else if (room.phase === 'road_building_1' || room.phase === 'road_building_2') {
      validActions.roadEdges = getValidRoadEdges(room, viewerId);
    } else if (room.phase === 'main') {
      const me = room.players.find(p => p.id === viewerId);
      if (me) {
        if (me.settlementsLeft > 0 && hasResources(me, COSTS.settlement)) {
          validActions.settlementVertices = getValidSettlementVertices(room, viewerId, false);
        }
        if (me.citiesLeft > 0 && hasResources(me, COSTS.city)) {
          validActions.cityVertices = getValidCityVertices(room, viewerId);
        }
        if (me.roadsLeft > 0 && hasResources(me, COSTS.road)) {
          validActions.roadEdges = getValidRoadEdges(room, viewerId);
        }
      }
    }
  }

  return {
    roomCode: room.roomCode,
    hostId: room.hostId,
    status: room.status,
    phase: room.phase,
    settings: room.settings,
    setupStep: room.setupStep,
    setupTotalSteps: room.setupOrder ? room.setupOrder.length : 0,
    turnIndex: room.turnIndex,
    turnNumber: room.turnNumber,
    turnDeadline: room.turnDeadline,
    activePlayerId: activePlayer ? activePlayer.id : null,
    lastDice: room.lastDice,
    lastHarvest: room.lastHarvest,
    stats: room.stats,
    devDeckCount: room.devDeck.length,
    pendingDiscards: room.pendingDiscards,
    stealCandidates: room.stealCandidates,
    activeTradeOffer: room.activeTradeOffer,
    longestRoadPlayerId: room.longestRoadPlayerId,
    longestRoadLength: room.longestRoadLength,
    largestArmyPlayerId: room.largestArmyPlayerId,
    largestArmySize: room.largestArmySize,
    winnerId: room.winnerId,
    board: room.board,
    validActions,
    players: room.players.map(p => {
      const isViewer = p.id === viewerId || room.status === 'finished';
      return {
        id: p.id,
        name: p.name,
        color: p.color,
        colorName: p.colorName,
        colorId: p.colorId,
        avatar: p.avatar,
        pieceStyle: p.pieceStyle,
        isBot: p.isBot,
        connected: p.connected,
        resourceCount: getTotalResources(p),
        resources: isViewer ? p.resources : null,
        devCardCount: p.devCards.filter(c => !c.used).length,
        devCards: isViewer ? p.devCards : null,
        knightsPlayed: p.knightsPlayed,
        playedDevCardThisTurn: p.playedDevCardThisTurn,
        roadsLeft: p.roadsLeft,
        settlementsLeft: p.settlementsLeft,
        citiesLeft: p.citiesLeft,
        longestRoad: p.longestRoad,
        publicVP: getPlayerVictoryPoints(room, p.id, false),
        totalVP: isViewer ? getPlayerVictoryPoints(room, p.id, true) : getPlayerVictoryPoints(room, p.id, false)
      };
    }),
    logs: room.logs,
    chat: room.chat,
    weather: room.weather || {
      mode: room.settings?.theme || 'dynamic',
      currentTheme: 'sunrise',
      name: 'Amanecer',
      icon: '🌄',
      description: 'Amanece sobre las costas de Catan.'
    }
  };
}

module.exports = {
  RESOURCES,
  RESOURCE_NAMES_ES,
  COSTS,
  PLAYER_COLORS,
  PLAYER_AVATARS,
  PIECE_STYLES,
  createRoomState,
  createPlayerObject,
  updatePlayerProfile,
  updateRoomSettings,
  addLog,
  startGame,
  placeSettlement,
  placeRoad,
  upgradeToCity,
  rollDice,
  discardResources,
  moveRobber,
  chooseStealVictim,
  buyDevCard,
  playDevCard,
  bankTrade,
  proposePlayerTrade,
  respondPlayerTrade,
  executePlayerTrade,
  cancelPlayerTrade,
  endTurn,
  runBotStep,
  handleTurnTimeout,
  tickWeatherClock,
  resetRoomForRematch,
  serializeRoomForPlayer
};
