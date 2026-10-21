// public/board3d.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const SCALE = 4.2;

const THEMES = {
  sunrise: {
    name: 'Amanecer',
    sky: 0x22132d,
    fog: 0x22132d,
    oceanDeep: 0x1e1b4b,
    oceanShallow: 0xdb2777,
    ambientColor: 0xfde047,
    ambientIntensity: 0.74,
    sunColor: 0xfb7185,
    sunIntensity: 1.55,
    sunPos: [35, 14, -20],
    windowGlow: 0.55
  },
  day: {
    name: 'Día',
    sky: 0x0c2d48,
    fog: 0x0c2d48,
    oceanDeep: 0x0369a1,
    oceanShallow: 0x0ea5e9,
    ambientColor: 0xffffff,
    ambientIntensity: 0.78,
    sunColor: 0xfffbeb,
    sunIntensity: 1.45,
    sunPos: [22, 38, 24],
    windowGlow: 0.25
  },
  sunset: {
    name: 'Ocaso',
    sky: 0x2e1035,
    fog: 0x2e1035,
    oceanDeep: 0x1e293b,
    oceanShallow: 0xc2410c,
    ambientColor: 0xfdba74,
    ambientIntensity: 0.68,
    sunColor: 0xf97316,
    sunIntensity: 1.65,
    sunPos: [-30, 18, 26],
    windowGlow: 0.85
  },
  night: {
    name: 'Noche',
    sky: 0x040814,
    fog: 0x040814,
    oceanDeep: 0x020617,
    oceanShallow: 0x0f172a,
    ambientColor: 0x60a5fa,
    ambientIntensity: 0.42,
    sunColor: 0x93c5fd,
    sunIntensity: 0.75,
    sunPos: [15, 35, -20],
    windowGlow: 1.35
  },
  storm: {
    name: 'Tormenta',
    sky: 0x0b1120,
    fog: 0x0b1120,
    fogDensity: 0.009,
    oceanDeep: 0x090d16,
    oceanShallow: 0x1e293b,
    ambientColor: 0x64748b,
    ambientIntensity: 0.5,
    sunColor: 0xcfdbe8,
    sunIntensity: 0.85,
    sunPos: [10, 32, 12],
    windowGlow: 0.95
  },
  foggy: {
    name: 'Bruma Costera',
    sky: 0x334155,
    fog: 0x475569,
    fogDensity: 0.016,
    oceanDeep: 0x1e293b,
    oceanShallow: 0x334155,
    ambientColor: 0x94a3b8,
    ambientIntensity: 0.72,
    sunColor: 0xe2e8f0,
    sunIntensity: 0.85,
    sunPos: [15, 30, 20],
    windowGlow: 0.65
  },
  rain: {
    name: 'Chubasco',
    sky: 0x1e293b,
    fog: 0x334155,
    fogDensity: 0.008,
    oceanDeep: 0x0f172a,
    oceanShallow: 0x1e293b,
    ambientColor: 0x94a3b8,
    ambientIntensity: 0.68,
    sunColor: 0xcfdbe8,
    sunIntensity: 0.95,
    sunPos: [20, 36, 18],
    windowGlow: 0.55
  },
  snow: {
    name: 'Nevada',
    sky: 0x243242,
    fog: 0x334155,
    fogDensity: 0.0085,
    oceanDeep: 0x0f172a,
    oceanShallow: 0x25384e,
    ambientColor: 0xe2e8f0,
    ambientIntensity: 0.88,
    sunColor: 0xf8fafc,
    sunIntensity: 1.15,
    sunPos: [20, 36, 18],
    windowGlow: 1.35
  }
};

const PORT_LABELS = {
  '3:1': { text: '3:1', icon: '⛵', color: '#f8fafc' },
  wood: { text: '2:1', icon: '🌲', color: '#4ade80' },
  brick: { text: '2:1', icon: '🧱', color: '#fb923c' },
  sheep: { text: '2:1', icon: '🐑', color: '#a3e635' },
  wheat: { text: '2:1', icon: '🌾', color: '#facc15' },
  ore: { text: '2:1', icon: '⛰️', color: '#cbd5e1' }
};

export class CatanBoard3D {
  constructor(container, onSelectElement) {
    this.container = container;
    this.onSelectElement = onSelectElement;

    this.scene = new THREE.Scene();
    this.currentTheme = 'day';

    this.camera = new THREE.PerspectiveCamera(
      42,
      window.innerWidth / window.innerHeight,
      0.1,
      350
    );
    this.camera.position.set(0, 33, 35);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.maxPolarAngle = Math.PI / 2.22;
    this.controls.minDistance = 12;
    this.controls.maxDistance = 74;
    this.controls.target.set(0, 0, 1.5);

    this.boardGroup = new THREE.Group();
    this.piecesGroup = new THREE.Group();
    this.hotspotsGroup = new THREE.Group();
    this.diceGroup = new THREE.Group();
    this.scene.add(this.boardGroup);
    this.scene.add(this.piecesGroup);
    this.scene.add(this.hotspotsGroup);
    this.scene.add(this.diceGroup);

    this.animatedWindmills = [];
    this.animatedShips = [];
    this.animatedSheep = [];
    this.windowMaterials = [];
    this.tokenMeshes = [];

    this.robberMesh = null;
    this.robberTargetPos = new THREE.Vector3(0, 0.4, 0);

    this.diceRollState = null;
    this.dieFaceMaterials = null;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.hoveredHotspot = null;
    this.pointerDownPos = { x: 0, y: 0 };

    this.currentBoardHash = '';
    this.currentPiecesHash = '';
    this.terrainTextures = {};

    // Materiales compartidos de la nieve acumulada sobre el tablero:
    // arrancan invisibles y solo aparecen (fundido suave) durante el evento de Nevada
    this.snowCoverAmount = 0; // 0 = sin nieve, 1 = nevada completa
    this.snowRimMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.45,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    });
    this.snowPropMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.45,
      transparent: true,
      opacity: 0,
      depthWrite: false
    });
    this.snowCoverMeshes = [];

    this._initLights();
    this._initOcean();
    this._initWeatherAndWildlife();
    this.setTheme('day');
    this._initEvents();
    this._animate();
  }

  _initLights() {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.78);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0xbae6fd, 0x1e293b, 0.55);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfffbeb, 1.45);
    this.sunLight.position.set(22, 38, 24);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 5;
    this.sunLight.shadow.camera.far = 95;
    const d = 30;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.scene.add(this.sunLight);
  }

  _initOcean() {
    // Océano con vértices animados
    this.oceanGeo = new THREE.PlaneGeometry(260, 260, 56, 56);
    this.oceanGeo.rotateX(-Math.PI / 2);
    const posAttr = this.oceanGeo.attributes.position;
    this.oceanBaseY = new Float32Array(posAttr.count);
    for (let i = 0; i < posAttr.count; i++) {
      this.oceanBaseY[i] = posAttr.getY(i);
    }

    this.oceanMat = new THREE.MeshStandardMaterial({
      color: 0x0369a1,
      roughness: 0.25,
      metalness: 0.18,
      flatShading: true
    });
    this.oceanMesh = new THREE.Mesh(this.oceanGeo, this.oceanMat);
    this.oceanMesh.position.y = -0.32;
    this.oceanMesh.receiveShadow = true;
    this.scene.add(this.oceanMesh);

    // Arrecife / costa turquesa alrededor de la isla
    const reefGeo = new THREE.CylinderGeometry(22.6, 25.2, 0.3, 12);
    this.reefMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      roughness: 0.45
    });
    const reef = new THREE.Mesh(reefGeo, this.reefMat);
    reef.position.y = -0.22;
    reef.receiveShadow = true;
    this.scene.add(reef);

    // Banco de arena general bajo el archipiélago
    const sandBankGeo = new THREE.CylinderGeometry(19.8, 21.8, 0.34, 12);
    const sandBankMat = new THREE.MeshStandardMaterial({
      color: 0xe6c786,
      roughness: 0.85
    });
    const sandBank = new THREE.Mesh(sandBankGeo, sandBankMat);
    sandBank.position.y = -0.14;
    sandBank.receiveShadow = true;
    this.scene.add(sandBank);
  }

  _initWeatherAndWildlife() {
    // 1. Bandada de gaviotas 3D sobrevolando la isla (Día y Atardecer)
    this.seagullsGroup = new THREE.Group();
    this.seagulls = [];
    const birdMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5, side: THREE.DoubleSide });
    const beakMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b });

    for (let i = 0; i < 6; i++) {
      const bird = new THREE.Group();
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.48, 6), birdMat);
      body.rotation.x = Math.PI / 2;
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.16, 5), beakMat);
      beak.rotation.x = Math.PI / 2;
      beak.position.z = 0.28;

      const wingGeo = new THREE.BoxGeometry(0.52, 0.025, 0.18);
      const wingL = new THREE.Group();
      const wingMeshL = new THREE.Mesh(wingGeo, birdMat);
      wingMeshL.position.x = -0.25;
      wingL.add(wingMeshL);

      const wingR = new THREE.Group();
      const wingMeshR = new THREE.Mesh(wingGeo, birdMat);
      wingMeshR.position.x = 0.25;
      wingR.add(wingMeshR);

      bird.add(body, beak, wingL, wingR);
      bird.userData = {
        wingL,
        wingR,
        radius: 9 + (i % 3) * 4.5,
        height: 6.5 + (i % 3) * 1.8,
        speed: 0.22 + (i % 2) * 0.07,
        phase: (Math.PI * 2 * i) / 6,
        centerX: (i % 2 === 0 ? 1 : -1) * 2.5,
        centerZ: (i % 3 === 0 ? 1 : -1) * 2.0
      };
      this.seagulls.push(bird);
      this.seagullsGroup.add(bird);
    }
    this.scene.add(this.seagullsGroup);

    // 2. Luciérnagas mágicas y estrellas para el modo Noche
    this.nightGroup = new THREE.Group();
    const fireflyCount = 95;
    const ffGeo = new THREE.BufferGeometry();
    const ffPos = new Float32Array(fireflyCount * 3);
    this.fireflyBase = [];
    for (let i = 0; i < fireflyCount; i++) {
      const r = Math.sqrt(Math.random()) * 17;
      const a = Math.random() * Math.PI * 2;
      const x = Math.cos(a) * r;
      const y = 0.7 + Math.random() * 3.2;
      const z = Math.sin(a) * r;
      ffPos[i * 3] = x;
      ffPos[i * 3 + 1] = y;
      ffPos[i * 3 + 2] = z;
      this.fireflyBase.push({ x, y, z, phase: Math.random() * Math.PI * 2 });
    }
    ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
    const ffMat = new THREE.PointsMaterial({
      color: 0xfde047,
      size: 0.36,
      transparent: true,
      opacity: 0.9
    });
    this.firefliesPoints = new THREE.Points(ffGeo, ffMat);
    this.nightGroup.add(this.firefliesPoints);
    this.scene.add(this.nightGroup);

    // 3. Cortina de lluvia 3D y relámpagos para el modo Tormenta y Chubasco
    this.stormGroup = new THREE.Group();
    const rainCount = 850;
    const rainGeo = new THREE.BufferGeometry();
    const rainVerts = new Float32Array(rainCount * 6);
    for (let i = 0; i < rainCount; i++) {
      const x = (Math.random() - 0.5) * 56;
      const y = Math.random() * 32;
      const z = (Math.random() - 0.5) * 56;
      rainVerts[i * 6] = x;
      rainVerts[i * 6 + 1] = y;
      rainVerts[i * 6 + 2] = z;
      rainVerts[i * 6 + 3] = x - 0.35;
      rainVerts[i * 6 + 4] = y - 1.85;
      rainVerts[i * 6 + 5] = z - 0.2;
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainVerts, 3));
    const rainMat = new THREE.LineBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.76
    });
    this.rainLines = new THREE.LineSegments(rainGeo, rainMat);
    this.stormGroup.add(this.rainLines);
    this.scene.add(this.stormGroup);
    this.nextLightningTime = performance.now() + 3000;

    // 4. Sistema de copos de nieve 3D cayendo y revoloteando sobre la isla
    this.snowGroup = new THREE.Group();
    const snowCount = 650;
    const snowGeo = new THREE.BufferGeometry();
    const snowPos = new Float32Array(snowCount * 3);
    this.snowData = [];
    for (let i = 0; i < snowCount; i++) {
      const x = (Math.random() - 0.5) * 60;
      const y = Math.random() * 32;
      const z = (Math.random() - 0.5) * 60;
      snowPos[i * 3] = x;
      snowPos[i * 3 + 1] = y;
      snowPos[i * 3 + 2] = z;
      this.snowData.push({
        fallSpeed: 0.045 + Math.random() * 0.04,
        swaySpeed: 1.1 + Math.random() * 1.4,
        phase: Math.random() * Math.PI * 2
      });
    }
    snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
    const snowMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.44,
      transparent: true,
      opacity: 0.92
    });
    this.snowPoints = new THREE.Points(snowGeo, snowMat);
    this.snowGroup.add(this.snowPoints);
    this.snowGroup.visible = false;
    this.scene.add(this.snowGroup);
  }

  setTheme(themeId, smooth = false) {
    const t = THEMES[themeId] || THEMES.day;
    this.currentTheme = themeId;
    this.targetTheme = t;

    if (this.seagullsGroup) {
      this.seagullsGroup.visible = themeId === 'day' || themeId === 'sunrise' || themeId === 'sunset' || themeId === 'foggy';
    }
    if (this.nightGroup) {
      this.nightGroup.visible = themeId === 'night';
    }
    if (this.stormGroup) {
      this.stormGroup.visible = themeId === 'storm' || themeId === 'rain';
    }
    if (this.snowGroup) {
      this.snowGroup.visible = themeId === 'snow';
    }

    if (!smooth) {
      this.scene.background = new THREE.Color(t.sky);
      this.scene.fog = new THREE.FogExp2(t.fog, t.fogDensity || 0.0068);
      this.oceanMat.color.setHex(t.oceanDeep);
      this.reefMat.color.setHex(t.oceanShallow);
      this.ambientLight.color.setHex(t.ambientColor);
      this.ambientLight.intensity = t.ambientIntensity;
      this.sunLight.color.setHex(t.sunColor);
      this.sunLight.intensity = t.sunIntensity;
      this.sunLight.position.set(...t.sunPos);

      for (const mat of this.windowMaterials) {
        mat.emissiveIntensity = t.windowGlow;
      }
    }
  }

  getHexScreenPosition(hexId, board) {
    if (!board || !board.hexes || !board.hexes[hexId]) {
      return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    }
    const hex = board.hexes[hexId];
    const vec = new THREE.Vector3(hex.x * SCALE, 1.0, hex.z * SCALE);
    vec.project(this.camera);
    return {
      x: (vec.x * 0.5 + 0.5) * window.innerWidth,
      y: (-vec.y * 0.5 + 0.5) * window.innerHeight
    };
  }

  _getTerrainTexture(terrain) {
    if (this.terrainTextures[terrain]) return this.terrainTextures[terrain];

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    const palettes = {
      wood: ['#14532d', '#166534', '#15803d', '#1e3f20'],
      brick: ['#9a3412', '#b45309', '#c2410c', '#7c2d12'],
      sheep: ['#4d7c0f', '#65a30d', '#84cc16', '#3f6212'],
      wheat: ['#ca8a04', '#eab308', '#facc15', '#a16207'],
      ore: ['#334155', '#475569', '#64748b', '#1e293b'],
      desert: ['#d97706', '#e2b86b', '#f3d088', '#b45309']
    };
    const cols = palettes[terrain] || palettes.desert;

    // Fondo degradado radial
    const grad = ctx.createRadialGradient(256, 256, 30, 256, 256, 260);
    grad.addColorStop(0, cols[1]);
    grad.addColorStop(0.7, cols[0]);
    grad.addColorStop(1, cols[3]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    //Detalles orgánicos según bioma
    for (let i = 0; i < 450; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const r = 3 + Math.random() * 14;
      ctx.fillStyle = cols[i % cols.length];
      ctx.globalAlpha = 0.18;
      ctx.beginPath();
      if (terrain === 'wheat') {
        // Surcos de cultivo
        ctx.fillRect(x, y, 26, 4);
      } else {
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1.0;

    // Marco interior hexagonal sutil
    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    this.terrainTextures[terrain] = tex;
    return tex;
  }

  _initEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    const dom = this.renderer.domElement;

    dom.addEventListener('pointerdown', (e) => {
      this.pointerDownPos = { x: e.clientX, y: e.clientY };
    });

    dom.addEventListener('pointermove', (e) => {
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      this._checkHover();
    });

    dom.addEventListener('pointerup', (e) => {
      const dist = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
      if (dist > 6) return;

      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.camera);

      const intersects = this.raycaster.intersectObjects(this.hotspotsGroup.children, true);
      if (intersects.length > 0) {
        let obj = intersects[0].object;
        while (obj && !obj.userData?.hotspotType && obj.parent) {
          obj = obj.parent;
        }
        if (obj && obj.userData?.hotspotType && this.onSelectElement) {
          this.onSelectElement({
            type: obj.userData.hotspotType,
            id: obj.userData.hotspotId
          });
        }
      }
    });
  }

  _checkHover() {
    if (this.hotspotsGroup.children.length === 0) {
      this.renderer.domElement.style.cursor = 'grab';
      return;
    }
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.hotspotsGroup.children, true);

    if (this.hoveredHotspot) {
      this.hoveredHotspot.scale.set(1, 1, 1);
      this.hoveredHotspot = null;
    }

    if (intersects.length > 0) {
      let obj = intersects[0].object;
      while (obj && !obj.userData?.hotspotType && obj.parent) {
        obj = obj.parent;
      }
      if (obj && obj.userData?.hotspotType) {
        this.hoveredHotspot = obj;
        obj.scale.set(1.32, 1.32, 1.32);
        this.renderer.domElement.style.cursor = 'pointer';
        return;
      }
    }
    this.renderer.domElement.style.cursor = 'grab';
  }

  resetCamera() {
    this.camera.position.set(0, 33, 35);
    this.controls.target.set(0, 0, 1.5);
    this.controls.update();
  }

  updateFromState(roomState, viewerId, buildMode, previewProfile = null) {
    if (!roomState || !roomState.board) return;
    const board = roomState.board;

    const boardHash = board.hexes.map(h => `${h.terrain}:${h.number}`).join('|');
    if (boardHash !== this.currentBoardHash) {
      this.currentBoardHash = boardHash;
      this.currentPiecesHash = '';
      this._buildStaticBoard(board);
    }

    const robberHex = board.hexes[board.robberHexId];
    if (robberHex) {
      this.robberTargetPos.set(robberHex.x * SCALE - 0.9, 0.42, robberHex.z * SCALE + 0.55);
      if (!this.robberMesh) {
        this.robberMesh = this._createRobberMesh();
        this.robberMesh.position.copy(this.robberTargetPos);
        this.robberMesh.userData.restPos = this.robberTargetPos.clone();
        this.robberMesh.userData.restRot = this.robberMesh.rotation.clone();
        this.boardGroup.add(this.robberMesh);
      } else {
        this.robberMesh.userData.restPos = this.robberTargetPos.clone();
      }
    }

    const piecesHash =
      (roomState.players || []).map(p => `${p.id}:${p.color}:${p.pieceStyle}`).join('|') + '||' +
      board.edges.filter(e => e.road).map(e => `${e.id}:${e.road.playerId}`).join(',') + '||' +
      board.vertices.filter(v => v.building).map(v => `${v.id}:${v.building.playerId}:${v.building.type}`).join(',');

    if (piecesHash !== this.currentPiecesHash) {
      this.currentPiecesHash = piecesHash;
      this._rebuildPieces(board, roomState.players, roomState.status === 'lobby' ? previewProfile : null);
    }
    this._rebuildHotspots(roomState, viewerId, buildMode);
  }

  highlightRolledNumber(sum, board) {
    if (!board || !board.hexes || sum === 7) return;
    for (const hex of board.hexes) {
      if (hex.number === sum && hex.id !== board.robberHexId) {
        const ringGeo = new THREE.RingGeometry(1.05, 1.55, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xfacc15,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.95
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(hex.x * SCALE, 0.48, hex.z * SCALE);
        this.boardGroup.add(ring);

        const start = performance.now();
        const animateRing = () => {
          const elapsed = (performance.now() - start) / 1000;
          if (elapsed > 4.2) {
            this.boardGroup.remove(ring);
            return;
          }
          const s = 1 + Math.sin(elapsed * 4.5) * 0.18 + elapsed * 0.45;
          ring.scale.set(s, s, s);
          ringMat.opacity = Math.max(0, 0.95 * (1 - elapsed / 4.2));
          requestAnimationFrame(animateRing);
        };
        requestAnimationFrame(animateRing);
      }
    }
  }

  _buildStaticBoard(board) {
    while (this.boardGroup.children.length > 0) {
      this.boardGroup.remove(this.boardGroup.children[0]);
    }
    this.robberMesh = null;
    this.animatedWindmills = [];
    this.animatedShips = [];
    this.animatedSheep = [];
    this.tokenMeshes = [];
    this.snowCoverMeshes = [];

    for (const hex of board.hexes) {
      const hexGroup = new THREE.Group();
      hexGroup.position.set(hex.x * SCALE, 0, hex.z * SCALE);

      // Marco de piedra / madera tallada entre hexágonos
      const borderGeo = new THREE.CylinderGeometry(SCALE * 0.995, SCALE * 1.02, 0.38, 6);
      const borderMat = new THREE.MeshStandardMaterial({
        color: 0xd6b87c,
        roughness: 0.72,
        metalness: 0.08
      });
      const borderMesh = new THREE.Mesh(borderGeo, borderMat);
      borderMesh.position.y = 0.04;
      borderMesh.receiveShadow = true;
      hexGroup.add(borderMesh);

      // Loseta principal con textura procedural de alta resolución
      const tex = this._getTerrainTexture(hex.terrain);
      const tileGeo = new THREE.CylinderGeometry(SCALE * 0.92, SCALE * 0.955, 0.48, 6);
      const sideMat = new THREE.MeshStandardMaterial({ color: 0x785c38, roughness: 0.85 });
      const topMat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.75
      });
      const tileMesh = new THREE.Mesh(tileGeo, [sideMat, topMat, sideMat]);
      tileMesh.position.y = 0.16;
      tileMesh.castShadow = true;
      tileMesh.receiveShadow = true;
      hexGroup.add(tileMesh);

      // Corona de nieve perimetral sobre la loseta (deja el 70% central libre para distinguir claramente el bioma)
      // Solo visible durante la Nevada: usa el material compartido que se funde/derrite en _animate
      const snowRimGeo = new THREE.RingGeometry(SCALE * 0.72, SCALE * 0.93, 6);
      const snowRim = new THREE.Mesh(snowRimGeo, this.snowRimMat);
      snowRim.rotation.x = -Math.PI / 2;
      snowRim.position.y = 0.405;
      snowRim.receiveShadow = true;
      snowRim.visible = this.snowCoverAmount > 0.01;
      this.snowCoverMeshes.push(snowRim);
      hexGroup.add(snowRim);

      this._addTerrainProps(hexGroup, hex.terrain);
      this.boardGroup.add(hexGroup);

      if (hex.number) {
        const tokenMesh = this._createNumberTokenMesh(hex.number);
        tokenMesh.position.set(hex.x * SCALE, 0.43, hex.z * SCALE);
        tokenMesh.userData = {
          restPos: tokenMesh.position.clone(),
          restRot: tokenMesh.rotation.clone(),
          displaced: false
        };
        this.boardGroup.add(tokenMesh);
        this.tokenMeshes.push(tokenMesh);
      }
    }

    if (board.ports) {
      for (const port of board.ports) {
        const v1 = board.vertices[port.v1];
        const v2 = board.vertices[port.v2];
        const portMesh = this._createPortMesh(port, v1, v2);
        this.boardGroup.add(portMesh);
      }
    }
  }

  _addTerrainProps(hexGroup, terrain) {
    const ringPositions = [
      { x: -1.75, z: -1.15 },
      { x: 0.0, z: -2.05 },
      { x: 1.75, z: -1.1 },
      { x: 1.7, z: 1.15 },
      { x: -0.1, z: 2.0 },
      { x: -1.7, z: 1.2 }
    ];

    if (terrain === 'wood') {
      // Bosque denso: pinos + robles + cabaña maderera + troncos apilados
      ringPositions.forEach((pos, idx) => {
        const tree = new THREE.Group();
        const scale = 0.85 + (idx % 3) * 0.16;
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.11 * scale, 0.16 * scale, 0.55 * scale, 7),
          new THREE.MeshStandardMaterial({ color: 0x5c3a21 })
        );
        trunk.position.y = 0.52;

        if (idx % 3 === 0) {
          // Roble frondoso
          const crown = new THREE.Mesh(
            new THREE.DodecahedronGeometry(0.62 * scale, 1),
            new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.8 })
          );
          crown.position.y = 1.05 * scale;
          crown.castShadow = true;
          tree.add(trunk, crown);
        } else {
          // Pino de 3 niveles
          const c1 = new THREE.Mesh(
            new THREE.ConeGeometry(0.62 * scale, 0.9 * scale, 7),
            new THREE.MeshStandardMaterial({ color: 0x14532d })
          );
          c1.position.y = 0.9 * scale;
          const c2 = new THREE.Mesh(
            new THREE.ConeGeometry(0.48 * scale, 0.8 * scale, 7),
            new THREE.MeshStandardMaterial({ color: 0x166534 })
          );
          c2.position.y = 1.35 * scale;
          const c3 = new THREE.Mesh(
            new THREE.ConeGeometry(0.32 * scale, 0.65 * scale, 7),
            new THREE.MeshStandardMaterial({ color: 0x22c55e })
          );
          c3.position.y = 1.75 * scale;
          c1.castShadow = true;
          c2.castShadow = true;
          c3.castShadow = true;

          // Capuchón nevado en la copa del pino (solo visible durante la Nevada)
          const snowTop = new THREE.Mesh(
            new THREE.ConeGeometry(0.24 * scale, 0.32 * scale, 7),
            this.snowPropMat
          );
          snowTop.position.y = 1.96 * scale;
          snowTop.visible = this.snowCoverAmount > 0.01;
          this.snowCoverMeshes.push(snowTop);

          tree.add(trunk, c1, c2, c3, snowTop);
        }
        tree.position.set(pos.x, 0, pos.z);
        hexGroup.add(tree);
      });

      // Pila de troncos cortados
      const logMat = new THREE.MeshStandardMaterial({ color: 0x78350f });
      for (let i = 0; i < 3; i++) {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.65, 8), logMat);
        log.rotation.z = Math.PI / 2;
        log.position.set(1.15, 0.48 + (i === 2 ? 0.16 : 0), (i - 1) * 0.14);
        log.castShadow = true;
        hexGroup.add(log);
      }
    } else if (terrain === 'ore') {
      // Cordillera rocosa con nieve y cristales de mineral brillante
      const peaks = [
        { x: -1.55, z: -1.05, r: 1.05, h: 2.15 },
        { x: 0.15, z: -1.85, r: 0.88, h: 1.75 },
        { x: 1.65, z: -0.85, r: 0.92, h: 1.9 },
        { x: 1.35, z: 1.25, r: 0.78, h: 1.45 },
        { x: -1.45, z: 1.25, r: 0.72, h: 1.3 }
      ];
      for (const p of peaks) {
        const rock = new THREE.Mesh(
          new THREE.ConeGeometry(p.r, p.h, 6),
          new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.88, flatShading: true })
        );
        rock.position.set(p.x, 0.36 + p.h / 2, p.z);
        rock.rotation.y = Math.random() * Math.PI;
        rock.castShadow = true;
        rock.receiveShadow = true;
        hexGroup.add(rock);

        const snow = new THREE.Mesh(
          new THREE.ConeGeometry(p.r * 0.44, p.h * 0.42, 6),
          new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4, flatShading: true })
        );
        snow.position.set(p.x, 0.37 + p.h * 0.8, p.z);
        snow.rotation.y = rock.rotation.y;
        hexGroup.add(snow);
      }

      // Cristales de mineral brillante
      const crystalMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.35,
        roughness: 0.2,
        metalness: 0.8
      });
      for (let i = 0; i < 4; i++) {
        const cr = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), crystalMat);
        cr.position.set(-0.2 + i * 0.35, 0.52, 1.55 + (i % 2) * 0.25);
        cr.scale.set(0.8, 1.6, 0.8);
        cr.rotation.z = (i - 1.5) * 0.25;
        hexGroup.add(cr);
      }
    } else if (terrain === 'brick') {
      // Cantera de arcilla en terrazas + horno de ladrillos + pilas de ladrillos
      const terraces = [
        { x: -1.5, z: -1.1, r: 0.9, h: 0.55 },
        { x: 1.55, z: -1.0, r: 0.8, h: 0.7 },
        { x: 0.0, z: -1.85, r: 0.75, h: 0.48 },
        { x: -1.4, z: 1.25, r: 0.75, h: 0.5 }
      ];
      for (const t of terraces) {
        const mound = new THREE.Mesh(
          new THREE.CylinderGeometry(t.r * 0.7, t.r, t.h, 7),
          new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.85, flatShading: true })
        );
        mound.position.set(t.x, 0.38 + t.h / 2, t.z);
        mound.castShadow = true;
        hexGroup.add(mound);

        const moundSnow = new THREE.Mesh(
          new THREE.CylinderGeometry(t.r * 0.58, t.r * 0.72, 0.05, 7),
          this.snowPropMat
        );
        moundSnow.position.set(t.x, 0.38 + t.h + 0.02, t.z);
        moundSnow.visible = this.snowCoverAmount > 0.01;
        this.snowCoverMeshes.push(moundSnow);
        hexGroup.add(moundSnow);
      }

      // Horno artesanal con chimenea
      const kiln = new THREE.Group();
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(0.52, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0x7c2d12 })
      );
      dome.position.y = 0.38;
      const chimney = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.18, 0.55, 8),
        new THREE.MeshStandardMaterial({ color: 0x451a03 })
      );
      chimney.position.set(0, 0.88, 0);
      dome.castShadow = true;
      kiln.add(dome, chimney);
      kiln.position.set(1.4, 0, 1.15);
      hexGroup.add(kiln);
    } else if (terrain === 'sheep') {
      // Pradera con colinas suaves, cerca de madera y 5 ovejas animadas
      const sheepCoords = [
        { x: -1.5, z: -1.0 },
        { x: 1.5, z: -1.1 },
        { x: 1.45, z: 1.1 },
        { x: -1.35, z: 1.2 },
        { x: 0.0, z: -1.85 }
      ];
      sheepCoords.forEach((pos, idx) => {
        const sheep = new THREE.Group();
        const woolMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.9 });
        const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });

        const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), woolMat);
        body.scale.set(1.3, 0.95, 1.0);
        body.position.y = 0.58;
        body.castShadow = true;

        const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), darkMat);
        head.position.set(0.32, 0.66, 0);

        for (const lx of [-0.16, 0.16]) {
          for (const lz of [-0.12, 0.12]) {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.26, 6), darkMat);
            leg.position.set(lx, 0.42, lz);
            sheep.add(leg);
          }
        }

        sheep.add(body, head);
        sheep.position.set(pos.x, 0, pos.z);
        sheep.rotation.y = idx * 1.3;
        sheep.userData = { phase: idx * 1.1 };
        hexGroup.add(sheep);
        this.animatedSheep.push(sheep);
      });
    } else if (terrain === 'wheat') {
      // Campo de trigo con Molino de Viento 3D giratorio y pacas doradas
      const millGroup = new THREE.Group();
      const tower = new THREE.Mesh(
        new THREE.CylinderGeometry(0.36, 0.56, 1.45, 8),
        new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.7 })
      );
      tower.position.y = 1.05;
      tower.castShadow = true;

      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(0.45, 0.5, 8),
        new THREE.MeshStandardMaterial({ color: 0x92400e })
      );
      roof.position.y = 1.98;
      roof.castShadow = true;

      const roofSnow = new THREE.Mesh(
        new THREE.ConeGeometry(0.46, 0.22, 8),
        this.snowPropMat
      );
      roofSnow.position.y = 2.16;
      roofSnow.visible = this.snowCoverAmount > 0.01;
      this.snowCoverMeshes.push(roofSnow);

      // Aspas giratorias del molino
      const bladesGroup = new THREE.Group();
      bladesGroup.position.set(0, 1.5, 0.42);
      const bladeMat = new THREE.MeshStandardMaterial({ color: 0x78350f });
      const sailMat = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide });
      for (let i = 0; i < 4; i++) {
        const arm = new THREE.Group();
        arm.rotation.z = (Math.PI / 2) * i;
        const stick = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.95, 0.04), bladeMat);
        stick.position.y = 0.46;
        const sail = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.72), sailMat);
        sail.position.set(0.12, 0.52, 0.01);
        arm.add(stick, sail);
        bladesGroup.add(arm);
      }

      millGroup.add(tower, roof, roofSnow, bladesGroup);
      millGroup.position.set(-1.35, 0, -1.15);
      millGroup.rotation.y = Math.PI / 5;
      hexGroup.add(millGroup);
      this.animatedWindmills.push(bladesGroup);

      // Pacas cilíndricas de trigo dorado
      const balePositions = [
        { x: 1.5, z: -1.0 },
        { x: 1.55, z: 1.1 },
        { x: -1.35, z: 1.25 },
        { x: 0.1, z: -1.9 }
      ];
      for (const bp of balePositions) {
        const bale = new THREE.Mesh(
          new THREE.CylinderGeometry(0.28, 0.28, 0.52, 12),
          new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.8 })
        );
        bale.rotation.z = Math.PI / 2;
        bale.rotation.y = Math.random() * Math.PI;
        bale.position.set(bp.x, 0.58, bp.z);
        bale.castShadow = true;
        hexGroup.add(bale);
      }
    } else if (terrain === 'desert') {
      // Oasis con laguna de agua cristalina, palmera tropical y cactus
      const pond = new THREE.Mesh(
        new THREE.CylinderGeometry(0.85, 0.9, 0.08, 18),
        new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.15, metalness: 0.3 })
      );
      pond.position.set(-1.25, 0.39, -0.95);
      hexGroup.add(pond);

      // Palmera junto al oasis
      const palm = new THREE.Group();
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f });
      const frondMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, side: THREE.DoubleSide });
      const pTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 1.45, 7), trunkMat);
      pTrunk.position.y = 1.05;
      pTrunk.rotation.z = -0.14;
      pTrunk.castShadow = true;
      palm.add(pTrunk);

      for (let i = 0; i < 6; i++) {
        const frond = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.95, 4), frondMat);
        frond.position.set(0.18, 1.72, 0);
        frond.rotation.z = Math.PI / 2.4;
        const holder = new THREE.Group();
        holder.rotation.y = (Math.PI * 2 * i) / 6;
        holder.add(frond);
        palm.add(holder);
      }
      palm.position.set(-1.75, 0, -1.25);
      hexGroup.add(palm);

      // Cactus en el extremo opuesto
      const cactus = new THREE.Group();
      const cMat = new THREE.MeshStandardMaterial({ color: 0x15803d });
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 1.15, 8), cMat);
      stem.position.y = 0.88;
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.52, 8), cMat);
      arm.position.set(0.22, 0.98, 0);
      arm.rotation.z = -Math.PI / 4;
      stem.castShadow = true;
      cactus.add(stem, arm);
      cactus.position.set(1.45, 0, 1.1);
      hexGroup.add(cactus);
    }
  }

  _createNumberTokenMesh(number) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#fffbeb';
    ctx.beginPath();
    ctx.arc(128, 128, 118, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 12;
    ctx.strokeStyle = number === 6 || number === 8 ? '#dc2626' : '#b45309';
    ctx.stroke();

    const isRed = number === 6 || number === 8;
    ctx.fillStyle = isRed ? '#dc2626' : '#0f172a';
    ctx.font = 'bold 112px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(number), 128, 110);

    const pips = 6 - Math.abs(7 - number);
    const dots = '•'.repeat(Math.max(1, pips));
    ctx.font = 'bold 46px sans-serif';
    ctx.fillText(dots, 128, 186);

    const texture = new THREE.CanvasTexture(canvas);
    const geo = new THREE.CylinderGeometry(0.96, 1.0, 0.14, 28);
    const sideMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.3, roughness: 0.4 });
    const topMat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.35 });

    const mesh = new THREE.Mesh(geo, [sideMat, topMat, sideMat]);
    mesh.rotation.y = Math.PI / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  _createPortMesh(port, v1, v2) {
    const group = new THREE.Group();
    const px = port.x * SCALE;
    const pz = port.z * SCALE;

    // Muelles de madera hacia los dos vértices costeros
    const dockMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 });
    for (const v of [v1, v2]) {
      const vx = v.x * SCALE;
      const vz = v.z * SCALE;
      const dist = Math.hypot(px - vx, pz - vz);
      const dockGeo = new THREE.BoxGeometry(dist, 0.16, 0.34);
      const dock = new THREE.Mesh(dockGeo, dockMat);
      dock.position.set((px + vx) / 2, 0.14, (pz + vz) / 2);
      dock.rotation.y = -Math.atan2(pz - vz, px - vx);
      dock.castShadow = true;
      group.add(dock);
    }

    // Barco mercante 3D flotando en el puerto
    const ship = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.24, 1.15, 8),
      new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.7 })
    );
    hull.rotation.z = Math.PI / 2;
    hull.scale.set(1, 1, 0.65);
    hull.position.y = 0.08;
    hull.castShadow = true;

    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.05, 1.35, 6),
      new THREE.MeshStandardMaterial({ color: 0xd97706 })
    );
    mast.position.y = 0.72;

    const info = PORT_LABELS[port.type] || PORT_LABELS['3:1'];
    const sail = new THREE.Mesh(
      new THREE.PlaneGeometry(0.75, 0.85),
      new THREE.MeshStandardMaterial({
        color: info.color,
        side: THREE.DoubleSide,
        roughness: 0.5
      })
    );
    sail.position.set(0, 0.82, 0.06);

    ship.add(hull, mast, sail);
    ship.position.set(px + port.dirX * 0.9, 0.0, pz + port.dirZ * 0.9);
    ship.rotation.y = Math.atan2(port.dirX, port.dirZ);
    ship.userData = { phase: port.id * 0.9, baseY: 0.0 };
    group.add(ship);
    this.animatedShips.push(ship);

    // Medallón flotante del puerto
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(128, 128, 116, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 12;
    ctx.strokeStyle = info.color;
    ctx.stroke();

    ctx.font = '72px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(info.icon, 128, 92);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText(info.text, 128, 176);

    const tex = new THREE.CanvasTexture(canvas);
    const signGeo = new THREE.CylinderGeometry(0.84, 0.84, 0.14, 24);
    const sideMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });
    const topMat = new THREE.MeshStandardMaterial({ map: tex });
    const sign = new THREE.Mesh(signGeo, [sideMat, topMat, sideMat]);
    sign.rotation.y = Math.PI / 2;
    sign.position.set(px, 0.24, pz);
    group.add(sign);

    return group;
  }

  _createRobberMesh() {
    const group = new THREE.Group();
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.3,
      metalness: 0.35
    });

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.56, 0.24, 18), darkMat);
    base.position.y = 0.12;

    const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.46, 1.15, 16), darkMat);
    cloak.position.y = 0.72;

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), darkMat);
    head.position.y = 1.32;

    // Ojos brillantes rojos del ladrón
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), eyeMat);
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), eyeMat);
    eyeL.position.set(-0.09, 1.34, 0.26);
    eyeR.position.set(0.09, 1.34, 0.26);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.72, 24),
      new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;

    base.castShadow = true;
    cloak.castShadow = true;
    head.castShadow = true;

    group.add(base, cloak, head, eyeL, eyeR, ring);
    return group;
  }

  _rebuildPieces(board, players, previewProfile = null) {
    while (this.piecesGroup.children.length > 0) {
      this.piecesGroup.remove(this.piecesGroup.children[0]);
    }
    this.windowMaterials = [];

    const playerMap = {};
    for (const p of players) {
      playerMap[p.id] = p;
    }

    for (const edge of board.edges) {
      if (edge.road) {
        const p = playerMap[edge.road.playerId] || { color: '#ffffff', pieceStyle: 'medieval' };
        const roadMesh = this._createRoadMesh(p.color, p.pieceStyle);
        roadMesh.position.set(edge.x * SCALE, 0.44, edge.z * SCALE);
        roadMesh.rotation.y = -edge.angle;
        roadMesh.userData = {
          restPos: roadMesh.position.clone(),
          restRot: roadMesh.rotation.clone(),
          displaced: false
        };
        this.piecesGroup.add(roadMesh);
      }
    }

    for (const vertex of board.vertices) {
      if (vertex.building) {
        const p = playerMap[vertex.building.playerId] || { color: '#ffffff', pieceStyle: 'medieval' };
        const mesh = vertex.building.type === 'city'
          ? this._createCityMesh(p.color, p.pieceStyle)
          : this._createSettlementMesh(p.color, p.pieceStyle);
        mesh.position.set(vertex.x * SCALE, 0.38, vertex.z * SCALE);
        mesh.userData = {
          restPos: mesh.position.clone(),
          restRot: mesh.rotation.clone(),
          displaced: false
        };
        this.piecesGroup.add(mesh);
      }
    }
  }

  _createWindowMat() {
    const t = THEMES[this.currentTheme] || THEMES.day;
    const mat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: t.windowGlow
    });
    this.windowMaterials.push(mat);
    return mat;
  }

  _createRoadMesh(hexColor, style = 'medieval') {
    const group = new THREE.Group();
    const len = SCALE * 0.65;
    const mainMat = new THREE.MeshStandardMaterial({
      color: hexColor,
      roughness: 0.35,
      metalness: 0.1
    });

    if (style === 'imperial') {
      // Calzada / Acueducto Romano con bordes de mármol blanco
      const base = new THREE.Mesh(new THREE.BoxGeometry(len, 0.24, 0.38), mainMat);
      base.castShadow = true;
      const marbleMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });
      const curb1 = new THREE.Mesh(new THREE.BoxGeometry(len, 0.3, 0.07), marbleMat);
      curb1.position.z = 0.18;
      const curb2 = new THREE.Mesh(new THREE.BoxGeometry(len, 0.3, 0.07), marbleMat);
      curb2.position.z = -0.18;
      group.add(base, curb1, curb2);
    } else if (style === 'nordic') {
      // Puente vikingo con postes de madera oscura y escudos
      const base = new THREE.Mesh(new THREE.BoxGeometry(len, 0.22, 0.36), mainMat);
      base.castShadow = true;
      const woodMat = new THREE.MeshStandardMaterial({ color: 0x451a03 });
      for (let x of [-len * 0.38, 0, len * 0.38]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.42, 6), woodMat);
        post.position.set(x, 0.12, 0.19);
        const post2 = post.clone();
        post2.position.set(x, 0.12, -0.19);
        group.add(post, post2);
      }
      group.add(base);
    } else if (style === 'oriental') {
      // Puente lacado oriental con barandillas doradas
      const base = new THREE.Mesh(new THREE.BoxGeometry(len, 0.24, 0.36), mainMat);
      base.castShadow = true;
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.5, roughness: 0.3 });
      const rail1 = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, 0.06), goldMat);
      rail1.position.set(0, 0.22, 0.16);
      const rail2 = rail1.clone();
      rail2.position.set(0, 0.22, -0.16);
      group.add(base, rail1, rail2);
    } else {
      // Camino medieval clásico con borde negro marcado
      const geo = new THREE.BoxGeometry(len, 0.25, 0.36);
      const mesh = new THREE.Mesh(geo, mainMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: 0x0f172a })
      );
      mesh.add(edges);
      group.add(mesh);
    }
    return group;
  }

  _createSettlementMesh(hexColor, style = 'medieval') {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: hexColor, roughness: 0.35 });
    const darkRoofMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.55, roughness: 0.25 });
    const marbleMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });
    const winMat = this._createWindowMat();

    if (style === 'imperial') {
      // Templo Romano: Podio de mármol, núcleo del color del jugador, 4 columnas blancas y cúpula dorada
      const podium = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.68, 0.16, 16), marbleMat);
      podium.position.y = 0.08;
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.56, 12), mat);
      core.position.y = 0.42;
      for (let i = 0; i < 6; i++) {
        const ang = (Math.PI * 2 * i) / 6;
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.56, 8), marbleMat);
        col.position.set(Math.cos(ang) * 0.52, 0.42, Math.sin(ang) * 0.52);
        group.add(col);
      }
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat);
      dome.position.y = 0.7;
      const finial = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10), goldMat);
      finial.position.y = 1.24;
      core.castShadow = true;
      dome.castShadow = true;
      group.add(podium, core, dome, finial);
    } else if (style === 'nordic') {
      // Casa Larga Vikinga: Techo cruzado con vigas doradas y escudos redondos laterales
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.48, 0.62), mat);
      base.position.y = 0.24;
      const roofGeo = new THREE.ConeGeometry(0.68, 0.72, 4);
      roofGeo.rotateY(Math.PI / 4);
      const roof = new THREE.Mesh(roofGeo, darkRoofMat);
      roof.position.y = 0.82;
      // Vigas cruzadas doradas en la cumbrera
      const horn1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.08), goldMat);
      horn1.position.set(0.32, 1.12, 0);
      horn1.rotation.z = 0.55;
      const horn2 = horn1.clone();
      horn2.position.set(-0.32, 1.12, 0);
      horn2.rotation.z = -0.55;
      base.castShadow = true;
      roof.castShadow = true;
      group.add(base, roof, horn1, horn2);
    } else if (style === 'oriental') {
      // Santuario Pagoda Oriental: 2 techos escalonados oscuros con bordes dorados
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.5, 0.68), mat);
      base.position.y = 0.25;
      const r1 = new THREE.Mesh(new THREE.ConeGeometry(0.76, 0.3, 4), darkRoofMat);
      r1.rotation.y = Math.PI / 4;
      r1.position.y = 0.6;
      const sub = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.34, 0.46), mat);
      sub.position.y = 0.82;
      const r2 = new THREE.Mesh(new THREE.ConeGeometry(0.56, 0.32, 4), goldMat);
      r2.rotation.y = Math.PI / 4;
      r2.position.y = 1.12;
      base.castShadow = true;
      r1.castShadow = true;
      r2.castShadow = true;
      group.add(base, r1, sub, r2);
    } else {
      // Cabaña Medieval con techo a dos aguas, chimenea de piedra y bordes marcados
      const baseGeo = new THREE.BoxGeometry(0.72, 0.56, 0.72);
      const base = new THREE.Mesh(baseGeo, mat);
      base.position.y = 0.28;
      base.castShadow = true;

      const roofGeo = new THREE.ConeGeometry(0.64, 0.52, 4);
      roofGeo.rotateY(Math.PI / 4);
      const roof = new THREE.Mesh(roofGeo, mat);
      roof.position.y = 0.82;
      roof.castShadow = true;

      const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.42, 0.16), darkRoofMat);
      chimney.position.set(0.22, 0.86, 0.18);

      const outline = new THREE.LineSegments(
        new THREE.EdgesGeometry(baseGeo),
        new THREE.LineBasicMaterial({ color: 0x0f172a })
      );
      base.add(outline);
      group.add(base, roof, chimney);
    }

    const win = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.2, 0.76), winMat);
    win.position.y = 0.28;
    group.add(win);

    return group;
  }

  _createCityMesh(hexColor, style = 'medieval') {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: hexColor, roughness: 0.32 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.6, roughness: 0.25 });
    const marbleMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });
    const winMat = this._createWindowMat();

    if (style === 'imperial') {
      // Gran Panteón / Coliseo Imperial con cúpula dorada y columnas de mármol
      const podium = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.2, 0.95), marbleMat);
      podium.position.y = 0.1;
      const hall = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.65, 0.82), mat);
      hall.position.y = 0.52;
      const rotunda = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.48, 1.15, 16), mat);
      rotunda.position.set(-0.2, 0.75, 0);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.46, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), goldMat);
      dome.position.set(-0.2, 1.32, 0);
      hall.castShadow = true;
      rotunda.castShadow = true;
      dome.castShadow = true;
      group.add(podium, hall, rotunda, dome);
    } else if (style === 'nordic') {
      // Fortaleza Vikinga con Gran Salón y Torreón con Cuernos Dorados
      const hall = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.6, 0.82), mat);
      hall.position.y = 0.3;
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.46, 1.35, 6), mat);
      tower.position.set(-0.24, 0.68, 0);
      const spire = new THREE.Mesh(new THREE.ConeGeometry(0.48, 0.7, 6), darkMat);
      spire.position.set(-0.24, 1.68, 0);
      const crest = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.05, 8, 16, Math.PI), goldMat);
      crest.position.set(-0.24, 2.02, 0);
      crest.rotation.x = Math.PI;
      hall.castShadow = true;
      tower.castShadow = true;
      group.add(hall, tower, spire, crest);
    } else if (style === 'oriental') {
      // Pagoda Imperial de 3 Pisos con techos curvados y aguja dorada
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.55, 0.85), mat);
      base.position.y = 0.28;
      let y = 0.58;
      let w = 0.85;
      for (let i = 0; i < 3; i++) {
        const roof = new THREE.Mesh(new THREE.ConeGeometry(w, 0.28, 4), i === 2 ? goldMat : darkMat);
        roof.rotation.y = Math.PI / 4;
        roof.position.y = y + 0.12;
        const story = new THREE.Mesh(new THREE.BoxGeometry(w * 0.75, 0.36, w * 0.75), mat);
        story.position.y = y + 0.32;
        roof.castShadow = true;
        story.castShadow = true;
        group.add(roof, story);
        y += 0.44;
        w *= 0.78;
      }
      const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.07, 0.5, 8), goldMat);
      spire.position.y = y + 0.25;
      group.add(base, spire);
    } else {
      // Castillo Medieval con torre alta, almenas y estandarte
      const hallGeo = new THREE.BoxGeometry(1.12, 0.62, 0.84);
      const hall = new THREE.Mesh(hallGeo, mat);
      hall.position.set(0, 0.31, 0);
      hall.castShadow = true;

      const towerGeo = new THREE.BoxGeometry(0.58, 1.28, 0.58);
      const tower = new THREE.Mesh(towerGeo, mat);
      tower.position.set(-0.24, 0.64, 0);
      tower.castShadow = true;

      const spireGeo = new THREE.ConeGeometry(0.5, 0.64, 4);
      spireGeo.rotateY(Math.PI / 4);
      const spire = new THREE.Mesh(spireGeo, darkMat);
      spire.position.set(-0.24, 1.58, 0);
      spire.castShadow = true;

      const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.45, 6), goldMat);
      flagPole.position.set(-0.24, 2.0, 0);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.16), mat);
      flag.position.set(-0.1, 2.12, 0);

      const outline = new THREE.LineSegments(
        new THREE.EdgesGeometry(towerGeo),
        new THREE.LineBasicMaterial({ color: 0x0f172a })
      );
      tower.add(outline);
      group.add(hall, tower, spire, flagPole, flag);
    }

    const win1 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, 0.62), winMat);
    win1.position.set(-0.24, 0.92, 0);
    const win2 = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.88), winMat);
    win2.position.set(0.24, 0.34, 0);
    group.add(win1, win2);

    return group;
  }

  _rebuildHotspots(roomState, viewerId, buildMode) {
    while (this.hotspotsGroup.children.length > 0) {
      this.hotspotsGroup.remove(this.hotspotsGroup.children[0]);
    }
    this.hoveredHotspot = null;

    if (roomState.activePlayerId !== viewerId) return;

    const board = roomState.board;
    const valid = roomState.validActions || {};

    if (
      roomState.phase === 'setup_settlement' ||
      (roomState.phase === 'main' && buildMode === 'settlement')
    ) {
      for (const vId of valid.settlementVertices || []) {
        const v = board.vertices[vId];
        const marker = this._createHotspotMarker(0x22c55e, 0.44, 'vertex', vId);
        marker.position.set(v.x * SCALE, 0.58, v.z * SCALE);
        this.hotspotsGroup.add(marker);
      }
      return;
    }

    if (
      roomState.phase === 'setup_road' ||
      roomState.phase === 'road_building_1' ||
      roomState.phase === 'road_building_2' ||
      (roomState.phase === 'main' && buildMode === 'road')
    ) {
      for (const eId of valid.roadEdges || []) {
        const e = board.edges[eId];
        const marker = this._createRoadHotspotMarker(0x38bdf8, e.angle, 'edge', eId);
        marker.position.set(e.x * SCALE, 0.5, e.z * SCALE);
        this.hotspotsGroup.add(marker);
      }
      return;
    }

    if (roomState.phase === 'main' && buildMode === 'city') {
      for (const vId of valid.cityVertices || []) {
        const v = board.vertices[vId];
        const marker = this._createHotspotMarker(0xf59e0b, 0.54, 'vertex', vId);
        marker.position.set(v.x * SCALE, 1.2, v.z * SCALE);
        this.hotspotsGroup.add(marker);
      }
      return;
    }

    if (roomState.phase === 'robber_move') {
      for (const hex of board.hexes) {
        if (hex.id === board.robberHexId) continue;
        const marker = this._createHotspotMarker(0xef4444, 0.68, 'hex', hex.id);
        marker.position.set(hex.x * SCALE, 0.9, hex.z * SCALE);
        this.hotspotsGroup.add(marker);
      }
    }
  }

  _createHotspotMarker(colorHex, radius, type, id) {
    const group = new THREE.Group();
    group.userData = { hotspotType: type, hotspotId: id };

    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 18, 18),
      new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.84
      })
    );

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius * 1.15, radius * 1.5, 24),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8
      })
    );
    ring.rotation.x = -Math.PI / 2;

    group.add(sphere, ring);
    return group;
  }

  _createRoadHotspotMarker(colorHex, angle, type, id) {
    const group = new THREE.Group();
    group.userData = { hotspotType: type, hotspotId: id };

    const box = new THREE.Mesh(
      new THREE.BoxGeometry(SCALE * 0.58, 0.34, 0.46),
      new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.82
      })
    );
    box.rotation.y = -angle;
    group.add(box);
    return group;
  }

  _getDieMaterials() {
    if (this.dieFaceMaterials) return this.dieFaceMaterials;

    const pipLayouts = {
      1: [[0.5, 0.5]],
      2: [[0.26, 0.26], [0.74, 0.74]],
      3: [[0.24, 0.24], [0.5, 0.5], [0.76, 0.76]],
      4: [[0.26, 0.26], [0.74, 0.26], [0.26, 0.74], [0.74, 0.74]],
      5: [[0.24, 0.24], [0.76, 0.24], [0.5, 0.5], [0.24, 0.76], [0.76, 0.76]],
      6: [[0.26, 0.22], [0.74, 0.22], [0.26, 0.5], [0.74, 0.5], [0.26, 0.78], [0.74, 0.78]]
    };

    const makeFaceMat = (val) => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');

      // Fondo marfil con bisel dorado/cálido
      const grad = ctx.createRadialGradient(128, 128, 20, 128, 128, 180);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.78, '#fef3c7');
      grad.addColorStop(1, '#d97706');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);

      // Marco interior redondeado
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 12;
      ctx.strokeRect(10, 10, 236, 236);

      const isRed = val === 1 || val === 4;
      const coords = pipLayouts[val] || pipLayouts[1];
      const radius = val === 1 ? 34 : 24;

      for (const [nx, ny] of coords) {
        const cx = nx * 256;
        const cy = ny * 256;

        // Sombra interna del punto
        ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
        ctx.beginPath();
        ctx.arc(cx + 2, cy + 3, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = isRed ? '#dc2626' : '#0f172a';
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      const tex = new THREE.CanvasTexture(canvas);
      tex.anisotropy = 4;
      return new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.22,
        metalness: 0.08
      });
    };

    // Orden BoxGeometry en Three.js: [+X (3), -X (4), +Y arriba (1), -Y abajo (6), +Z (2), -Z (5)]
    this.dieFaceMaterials = [
      makeFaceMat(3),
      makeFaceMat(4),
      makeFaceMat(1),
      makeFaceMat(6),
      makeFaceMat(2),
      makeFaceMat(5)
    ];
    return this.dieFaceMaterials;
  }

  _create3DDieMesh() {
    const size = 1.38;
    const geo = new THREE.BoxGeometry(size, size, size);
    const mesh = new THREE.Mesh(geo, this._getDieMaterials());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.rotation.order = 'YXZ';

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: 0x92400e })
    );
    mesh.add(edges);
    return mesh;
  }

  _getDieTargetRotation(faceValue, yaw) {
    // Con rotation.order = 'YXZ', primero se aplica R_x * R_z (que lleva la cara elegida a +Y) y luego R_y(yaw)
    switch (faceValue) {
      case 1: return { x: 0, y: yaw, z: 0 };
      case 6: return { x: Math.PI, y: yaw, z: 0 };
      case 2: return { x: -Math.PI / 2, y: yaw, z: 0 };
      case 5: return { x: Math.PI / 2, y: yaw, z: 0 };
      case 3: return { x: 0, y: yaw, z: Math.PI / 2 };
      case 4: return { x: 0, y: yaw, z: -Math.PI / 2 };
      default: return { x: 0, y: yaw, z: 0 };
    }
  }

  /**
   * Lanza dos dados 3D físicos sobre el mapa, empujando/desplazando fichas o construcciones
   * si rebotan o caen sobre ellas, y luego acomodando todo suavemente en su lugar.
   */
  roll3DDice(d1, d2, board, callbacks = {}) {
    while (this.diceGroup.children.length > 0) {
      this.diceGroup.remove(this.diceGroup.children[0]);
    }

    // Restaurar inmediatamente cualquier pieza que haya quedado desplazada de una tirada previa
    const allTargets = [
      ...this.piecesGroup.children,
      ...this.tokenMeshes,
      ...(this.robberMesh ? [this.robberMesh] : [])
    ];
    for (const obj of allTargets) {
      if (obj.userData?.restPos) {
        obj.position.copy(obj.userData.restPos);
        obj.rotation.copy(obj.userData.restRot);
        obj.userData.displaced = false;
      }
    }

    const die1 = this._create3DDieMesh();
    const die2 = this._create3DDieMesh();
    this.diceGroup.add(die1, die2);

    // Elegir objetivos reales en el tablero (construcciones o fichas numéricas) para que los dados interactúen con ellos
    const candidateTargets = [
      ...this.piecesGroup.children,
      ...this.tokenMeshes.filter(t => t.position.length() < 9.5)
    ];

    const pickTargetPos = (fallbackX, fallbackZ, avoidPos = null) => {
      if (candidateTargets.length > 0) {
        const shuffled = [...candidateTargets].sort(() => Math.random() - 0.5);
        for (const c of shuffled) {
          const pos = c.userData?.restPos || c.position;
          if (pos.length() < 10.5 && (!avoidPos || Math.hypot(pos.x - avoidPos.x, pos.z - avoidPos.z) > 2.3)) {
            return new THREE.Vector3(
              pos.x + (Math.random() - 0.5) * 0.45,
              1.12,
              pos.z + (Math.random() - 0.5) * 0.45
            );
          }
        }
      }
      return new THREE.Vector3(fallbackX, 1.12, fallbackZ);
    };

    const land1 = pickTargetPos(-1.4, 0.5, null);
    let land2 = pickTargetPos(1.5, -0.6, land1);
    if (Math.hypot(land2.x - land1.x, land2.z - land1.z) < 2.2) {
      land2.set(land1.x + 2.4, 1.12, land1.z - 0.8);
    }

    // Ángulo desde el borde de la isla desde donde entran volando los dados
    const throwAngle = Math.random() * Math.PI * 2;
    const startDist = 15.5;
    const perpX = -Math.sin(throwAngle);
    const perpZ = Math.cos(throwAngle);

    const start1 = new THREE.Vector3(
      Math.cos(throwAngle) * startDist - perpX * 1.4,
      9.5,
      Math.sin(throwAngle) * startDist - perpZ * 1.4
    );
    const start2 = new THREE.Vector3(
      Math.cos(throwAngle) * startDist + perpX * 1.4,
      10.2,
      Math.sin(throwAngle) * startDist + perpZ * 1.4
    );

    const yaw1 = (Math.random() - 0.5) * 1.4;
    const yaw2 = (Math.random() - 0.5) * 1.4;
    const targetRot1 = this._getDieTargetRotation(d1, yaw1);
    const targetRot2 = this._getDieTargetRotation(d2, yaw2);

    // Múltiplos enteros de 2*PI para que giren varias vueltas en el aire y aterricen exactamente en la cara del número
    const spins1 = {
      x: targetRot1.x + Math.PI * 2 * 3,
      y: targetRot1.y + Math.PI * 2 * 2,
      z: targetRot1.z + Math.PI * 2 * 2
    };
    const spins2 = {
      x: targetRot2.x - Math.PI * 2 * 3,
      y: targetRot2.y - Math.PI * 2 * 2,
      z: targetRot2.z + Math.PI * 2 * 3
    };

    // Anillos luminosos bajo cada dado al aterrizar
    const makeRing = () => {
      const r = new THREE.Mesh(
        new THREE.RingGeometry(0.95, 1.32, 28),
        new THREE.MeshBasicMaterial({
          color: d1 + d2 === 7 ? 0xef4444 : 0xfacc15,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0
        })
      );
      r.rotation.x = -Math.PI / 2;
      this.diceGroup.add(r);
      return r;
    };

    this.diceRollState = {
      startTime: performance.now(),
      rollDuration: 1.15,
      settleStart: 4.85,
      totalDuration: 5.85,
      landedTriggered: false,
      bounce1Played: false,
      bounce2Played: false,
      d1,
      d2,
      board,
      callbacks,
      dice: [
        { mesh: die1, ring: makeRing(), start: start1, end: land1, targetRot: targetRot1, startRot: spins1 },
        { mesh: die2, ring: makeRing(), start: start2, end: land2, targetRot: targetRot2, startRot: spins2 }
      ]
    };
  }

  _updateDiceAndJostledPieces() {
    const state = this.diceRollState;
    const allTargets = [
      ...this.piecesGroup.children,
      ...this.tokenMeshes,
      ...(this.robberMesh ? [this.robberMesh] : [])
    ];

    if (state) {
      const elapsed = (performance.now() - state.startTime) / 1000;

      if (elapsed <= state.rollDuration) {
        // Fase 1: Vuelo parabólico con 3 rebotes sobre el mapa
        const u = Math.min(1, elapsed / state.rollDuration);
        const easeOut = 1 - Math.pow(1 - u, 2.15);

        if (u >= 0.45 && !state.bounce1Played) {
          state.bounce1Played = true;
          if (state.callbacks.onBounce) state.callbacks.onBounce(0);
        }
        if (u >= 0.78 && !state.bounce2Played) {
          state.bounce2Played = true;
          if (state.callbacks.onBounce) state.callbacks.onBounce(1);
        }

        for (const d of state.dice) {
          const x = THREE.MathUtils.lerp(d.start.x, d.end.x, easeOut);
          const z = THREE.MathUtils.lerp(d.start.z, d.end.z, easeOut);

          let y = 1.12;
          if (u < 0.45) {
            const p = u / 0.45;
            y = 1.12 + (d.start.y - 1.12) * (1 - p * p);
          } else if (u < 0.78) {
            const p = (u - 0.45) / 0.33;
            y = 1.12 + Math.sin(p * Math.PI) * 3.1;
          } else {
            const p = (u - 0.78) / 0.22;
            y = 1.12 + Math.sin(p * Math.PI) * 1.15;
          }

          d.mesh.position.set(x, y, z);
          d.mesh.rotation.set(
            THREE.MathUtils.lerp(d.startRot.x, d.targetRot.x, easeOut),
            THREE.MathUtils.lerp(d.startRot.y, d.targetRot.y, easeOut),
            THREE.MathUtils.lerp(d.startRot.z, d.targetRot.z, easeOut)
          );

          // Colisión física: si el dado baja cerca del suelo y toca una ficha o construcción, la empuja y la inclina
          if (y < 2.25) {
            for (const obj of allTargets) {
              if (!obj.userData?.restPos) continue;
              const dx = obj.position.x - x;
              const dz = obj.position.z - z;
              const dist = Math.hypot(dx, dz);
              const hitRadius = 2.25;

              if (dist < hitRadius) {
                const angle = dist > 0.04 ? Math.atan2(dz, dx) : Math.random() * Math.PI * 2;
                const pushDist = (hitRadius - dist) + 0.65;
                obj.userData.displaced = true;
                obj.userData.displacedPos = new THREE.Vector3(
                  obj.userData.restPos.x + Math.cos(angle) * pushDist,
                  obj.userData.restPos.y + 0.28,
                  obj.userData.restPos.z + Math.sin(angle) * pushDist
                );
                obj.userData.displacedRot = new THREE.Euler(
                  obj.userData.restRot.x + Math.sin(angle) * 0.48,
                  obj.userData.restRot.y + 0.35,
                  obj.userData.restRot.z - Math.cos(angle) * 0.48
                );
                if (!obj.userData.knockSoundPlayed && state.callbacks.onKnock) {
                  obj.userData.knockSoundPlayed = true;
                  state.callbacks.onKnock();
                }
              }
            }
          }
        }
      } else if (elapsed <= state.settleStart) {
        // Fase 2: Los dados quedan posados mostrando el resultado sobre el mapa
        if (!state.landedTriggered) {
          state.landedTriggered = true;
          for (const d of state.dice) {
            d.mesh.position.copy(d.end);
            d.mesh.rotation.set(d.targetRot.x, d.targetRot.y, d.targetRot.z);
            d.ring.position.set(d.end.x, 0.46, d.end.z);
            d.ring.material.opacity = 0.9;
          }
          if (state.callbacks.onLanded) state.callbacks.onLanded();
        }
        // Bajar las piezas empujadas al nivel del suelo pero manteniéndolas corridas a un lado del dado
        for (const obj of allTargets) {
          if (obj.userData?.displaced && obj.userData.displacedPos) {
            obj.userData.displacedPos.y = obj.userData.restPos.y;
          }
        }
      } else if (elapsed <= state.totalDuration) {
        // Fase 3 ("luego que se acomode"): los dados se retiran suavemente y las fichas/casas vuelven a su lugar exacto
        const p = (elapsed - state.settleStart) / (state.totalDuration - state.settleStart);
        const smooth = p * p * (3 - 2 * p);

        for (const d of state.dice) {
          d.mesh.position.y = 1.12 + smooth * 2.2;
          const s = Math.max(0.001, 1 - smooth);
          d.mesh.scale.set(s, s, s);
          d.ring.material.opacity = Math.max(0, 0.9 * (1 - smooth * 1.5));
        }

        // Liberar las fichas desplazadas para que se acomoden en su posición original
        for (const obj of allTargets) {
          if (obj.userData?.displaced) {
            obj.userData.displaced = false;
            obj.userData.knockSoundPlayed = false;
          }
        }
      } else {
        while (this.diceGroup.children.length > 0) {
          this.diceGroup.remove(this.diceGroup.children[0]);
        }
        this.diceRollState = null;
      }
    }

    // Animar interpolación de piezas desplazadas o su retorno suave ("acomodarse") a su lugar original
    for (const obj of allTargets) {
      if (!obj.userData?.restPos) continue;
      if (obj.userData.displaced && obj.userData.displacedPos) {
        obj.position.lerp(obj.userData.displacedPos, 0.28);
        obj.rotation.x = THREE.MathUtils.lerp(obj.rotation.x, obj.userData.displacedRot.x, 0.28);
        obj.rotation.y = THREE.MathUtils.lerp(obj.rotation.y, obj.userData.displacedRot.y, 0.28);
        obj.rotation.z = THREE.MathUtils.lerp(obj.rotation.z, obj.userData.displacedRot.z, 0.28);
      } else if (obj !== this.robberMesh) {
        obj.position.lerp(obj.userData.restPos, 0.14);
        obj.rotation.x = THREE.MathUtils.lerp(obj.rotation.x, obj.userData.restRot.x, 0.14);
        obj.rotation.y = THREE.MathUtils.lerp(obj.rotation.y, obj.userData.restRot.y, 0.14);
        obj.rotation.z = THREE.MathUtils.lerp(obj.rotation.z, obj.userData.restRot.z, 0.14);
      }
    }
  }

  _animate() {
    requestAnimationFrame(() => this._animate());

    const t = performance.now() * 0.0022;

    const isStorm = this.currentTheme === 'storm';

    // 1. Olas dinámicas del océano (más bravas durante tormentas)
    if (this.oceanGeo) {
      const pos = this.oceanGeo.attributes.position;
      const waveMult = isStorm ? 2.3 : 1.0;
      const waveSpeed = isStorm ? 2.0 : 1.0;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const wave = (Math.sin(x * 0.14 + t * waveSpeed) * 0.12 + Math.cos(z * 0.14 + t * 0.8 * waveSpeed) * 0.12) * waveMult;
        pos.setY(i, this.oceanBaseY[i] + wave);
      }
      pos.needsUpdate = true;
    }

    // 2. Girar aspas de los molinos de trigo (giran con fuerza con viento de tormenta)
    const millSpeed = isStorm ? 0.065 : 0.018;
    for (const blades of this.animatedWindmills) {
      blades.rotation.z -= millSpeed;
    }

    // 3. Balanceo suave de los barcos en los puertos
    const shipRock = isStorm ? 0.16 : 0.06;
    for (const ship of this.animatedShips) {
      const p = ship.userData.phase || 0;
      ship.position.y = Math.sin(t * 1.5 + p) * (isStorm ? 0.16 : 0.08);
      ship.rotation.z = Math.sin(t * 1.2 + p) * shipRock;
    }

    // 4. Pequeño salto/pastoreo de las ovejas
    for (const sheep of this.animatedSheep) {
      const p = sheep.userData.phase || 0;
      sheep.position.y = Math.max(0, Math.sin(t * 2.2 + p) * 0.06);
    }

    // 5. Pulso de hotspots interactivos
    for (const child of this.hotspotsGroup.children) {
      if (child !== this.hoveredHotspot) {
        const s = 1 + Math.sin(t * 3) * 0.12;
        child.scale.set(s, s, s);
      }
    }

    // 6. Movimiento suave del Ladrón
    if (this.robberMesh && !this.robberMesh.userData?.displaced) {
      this.robberMesh.position.lerp(this.robberTargetPos, 0.12);
      if (this.robberMesh.userData?.restRot) {
        this.robberMesh.rotation.x = THREE.MathUtils.lerp(this.robberMesh.rotation.x, this.robberMesh.userData.restRot.x, 0.14);
        this.robberMesh.rotation.z = THREE.MathUtils.lerp(this.robberMesh.rotation.z, this.robberMesh.userData.restRot.z, 0.14);
      }
    }

    // 7. Dados 3D físicos e interacción con fichas del mapa
    this._updateDiceAndJostledPieces();

    // 8. Clima 3D vivo: Gaviotas (Día/Atardecer), Luciérnagas (Noche) y Lluvia + Relámpagos (Tormenta)
    if (this.seagullsGroup && this.seagullsGroup.visible) {
      for (const bird of this.seagulls) {
        const u = bird.userData;
        const ang = t * u.speed + u.phase;
        const nx = u.centerX + Math.cos(ang) * u.radius;
        const nz = u.centerZ + Math.sin(ang) * u.radius;
        const ny = u.height + Math.sin(t * 1.4 + u.phase) * 0.45;
        bird.position.set(nx, ny, nz);
        bird.rotation.y = -ang;
        const flap = Math.sin(t * 5.2 + u.phase * 2) * 0.42;
        u.wingL.rotation.z = flap;
        u.wingR.rotation.z = -flap;
      }
    }

    if (this.nightGroup && this.nightGroup.visible && this.firefliesPoints) {
      const posAttr = this.firefliesPoints.geometry.attributes.position;
      for (let i = 0; i < this.fireflyBase.length; i++) {
        const b = this.fireflyBase[i];
        posAttr.setX(i, b.x + Math.sin(t * 0.9 + b.phase) * 0.45);
        posAttr.setY(i, b.y + Math.cos(t * 1.3 + b.phase) * 0.35);
        posAttr.setZ(i, b.z + Math.cos(t * 0.8 + b.phase) * 0.45);
      }
      posAttr.needsUpdate = true;
      this.firefliesPoints.material.opacity = 0.55 + Math.sin(t * 2.5) * 0.35;
    }

    if (this.stormGroup && this.stormGroup.visible && this.rainLines) {
      const posAttr = this.rainLines.geometry.attributes.position;
      const count = posAttr.count / 2;
      for (let i = 0; i < count; i++) {
        let y1 = posAttr.getY(i * 2) - 0.65;
        let x1 = posAttr.getX(i * 2) - 0.12;
        if (y1 < 0) {
          y1 = 26 + Math.random() * 4;
          x1 = (Math.random() - 0.5) * 48;
        }
        posAttr.setX(i * 2, x1);
        posAttr.setY(i * 2, y1);
        posAttr.setX(i * 2 + 1, x1 - 0.25);
        posAttr.setY(i * 2 + 1, y1 - 1.35);
      }
      posAttr.needsUpdate = true;

      const now = performance.now();
      if (this.currentTheme === 'storm' && now > this.nextLightningTime) {
        this.sunLight.intensity = 4.2;
        this.ambientLight.intensity = 1.6;
        setTimeout(() => {
          if (this.currentTheme === 'storm') {
            this.sunLight.intensity = THEMES.storm.sunIntensity;
            this.ambientLight.intensity = THEMES.storm.ambientIntensity;
          }
        }, 120);
        this.nextLightningTime = now + 4000 + Math.random() * 5000;
      }
    }

    if (this.snowGroup && this.snowGroup.visible && this.snowPoints) {
      const posAttr = this.snowPoints.geometry.attributes.position;
      const count = this.snowData.length;
      for (let i = 0; i < count; i++) {
        const d = this.snowData[i];
        let y = posAttr.getY(i) - d.fallSpeed;
        if (y < 0.2) {
          y = 30 + Math.random() * 4;
        }
        posAttr.setY(i, y);
        posAttr.setX(i, posAttr.getX(i) + Math.sin(t * d.swaySpeed + d.phase) * 0.03);
        posAttr.setZ(i, posAttr.getZ(i) + Math.cos(t * d.swaySpeed + d.phase) * 0.03);
      }
      posAttr.needsUpdate = true;
    }

    // Nieve acumulada en el tablero: se va asentando de a poco al nevar (~8 s)
    // y se derrite lentamente cuando termina la nevada (~15 s)
    const snowTarget = this.currentTheme === 'snow' ? 1 : 0;
    if (this.snowCoverAmount !== snowTarget) {
      const step = snowTarget > this.snowCoverAmount ? 0.002 : 0.0011;
      this.snowCoverAmount = snowTarget > this.snowCoverAmount
        ? Math.min(1, this.snowCoverAmount + step)
        : Math.max(0, this.snowCoverAmount - step);
      this.snowRimMat.opacity = this.snowCoverAmount * 0.6;
      this.snowPropMat.opacity = this.snowCoverAmount * 0.95;
      const showSnow = this.snowCoverAmount > 0.01;
      for (const m of this.snowCoverMeshes) m.visible = showSnow;
    }

    // 9. Transición suave de iluminación, niebla, cielo y mar al cambiar de hora/clima
    if (this.targetTheme) {
      const t = this.targetTheme;
      const factor = 0.035;
      this.scene.background.lerp(new THREE.Color(t.sky), factor);
      if (this.scene.fog) {
        this.scene.fog.color.lerp(new THREE.Color(t.fog), factor);
        const targetDensity = t.fogDensity || 0.0068;
        this.scene.fog.density = THREE.MathUtils.lerp(this.scene.fog.density, targetDensity, factor);
      }
      if (this.oceanMat) {
        this.oceanMat.color.lerp(new THREE.Color(t.oceanDeep), factor);
      }
      if (this.reefMat) {
        this.reefMat.color.lerp(new THREE.Color(t.oceanShallow), factor);
      }
      if (this.ambientLight && (!this.stormGroup || !this.stormGroup.visible || !this.isFlashingLightning)) {
        this.ambientLight.color.lerp(new THREE.Color(t.ambientColor), factor);
        this.ambientLight.intensity = THREE.MathUtils.lerp(this.ambientLight.intensity, t.ambientIntensity, factor);
      }
      if (this.sunLight && (!this.stormGroup || !this.stormGroup.visible || !this.isFlashingLightning)) {
        this.sunLight.color.lerp(new THREE.Color(t.sunColor), factor);
        this.sunLight.intensity = THREE.MathUtils.lerp(this.sunLight.intensity, t.sunIntensity, factor);
        this.sunLight.position.lerp(new THREE.Vector3(...t.sunPos), factor);
      }
      for (const mat of this.windowMaterials) {
        mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, t.windowGlow, factor);
      }
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}

/**
 * Mini visor 3D interactivo para previsualizar en vivo las piezas (Poblado, Ciudad y Camino) según el Color y Estilo elegido
 */
export class PiecePreview3D {
  constructor(boardRef) {
    this.boardRef = boardRef;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(36, 2.2, 0.1, 50);
    this.camera.position.set(0, 2.5, 5.2);
    this.camera.lookAt(0, 0.65, 0);

    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setSize(280, 126);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const amb = new THREE.AmbientLight(0xffffff, 0.9);
    const dir = new THREE.DirectionalLight(0xfffbeb, 1.5);
    dir.position.set(4, 8, 6);
    this.scene.add(amb, dir);

    // Pedestal circular
    const pedGeo = new THREE.CylinderGeometry(2.35, 2.5, 0.18, 32);
    const pedMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });
    this.pedestal = new THREE.Mesh(pedGeo, pedMat);
    this.pedestal.position.y = -0.09;
    this.scene.add(this.pedestal);

    this.turntable = new THREE.Group();
    this.scene.add(this.turntable);

    this._animate();
  }

  mountTo(containerEl) {
    if (!containerEl) return;
    containerEl.innerHTML = '';
    containerEl.appendChild(this.renderer.domElement);
  }

  updatePreview(hexColor, style) {
    while (this.turntable.children.length > 0) {
      this.turntable.remove(this.turntable.children[0]);
    }

    const settlement = this.boardRef._createSettlementMesh(hexColor, style);
    settlement.position.set(-1.35, 0, 0.15);

    const city = this.boardRef._createCityMesh(hexColor, style);
    city.position.set(0.1, 0, -0.05);

    const road = this.boardRef._createRoadMesh(hexColor, style);
    road.scale.set(0.55, 1, 1);
    road.position.set(1.45, 0.12, 0.2);
    road.rotation.y = Math.PI / 5;

    this.turntable.add(settlement, city, road);
  }

  _animate() {
    requestAnimationFrame(() => this._animate());
    this.turntable.rotation.y += 0.012;
    this.renderer.render(this.scene, this.camera);
  }
}

