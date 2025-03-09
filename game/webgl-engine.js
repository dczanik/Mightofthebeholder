// webgl-engine.js - Core WebGL implementation for Might of the Beholder
// Non-module version

//////////////////////////
// Global Variables
//////////////////////////

const SCALE_FACTOR = 3.0;  // Scale factor for X,Y dimensions (width & depth)
const wallHeight = 2.25;  // Wall height in world units

// Initialize with default map from engine.js if needed
let worldMap = [];
let mapHeight, mapWidth;
let currentLevel;

const player = {
  x: 0.0,
  y: 0.0, // we'll use this as the z-coordinate in Three.js
  direction: 1, // 0=North, 1=East, 2=South, 3=West
  angle: 0,
  isMoving: false,
  moveStartTime: 0,
  moveDuration: 500, // Slower movement for more realistic feel
  startX: 0,
  startY: 0,
  endX: 0,
  endY: 0,
  isTurning: false,
  turnStartTime: 0,
  turnDuration: 500, // Slower turning for more realistic feel
  startAngle: 0,
  endAngle: 0,
  playedStepSound: false
};

let scene, camera, renderer;
let lastTime = 0;
let projectileSystem, entityIntegration;
let wallTexture, floorTexture, ceilingTexture;

// Make SCALE_FACTOR globally available right away
window.SCALE_FACTOR = SCALE_FACTOR;

// Initialize world map right away to prevent initialization order issues
let mapInitialized = false;
function ensureWorldMap() {
  if (!mapInitialized) {
    initDefaultWorldMap();
    mapInitialized = true;
    console.log("Default world map initialized immediately:", worldMap.length + "x" + (worldMap[0] ? worldMap[0].length : 0));
    window.worldMap = worldMap;
    window.mapWidth = mapWidth;
    window.mapHeight = mapHeight;
  }
}

// Call it immediately to ensure it's available
ensureWorldMap();

// Make initEngine available globally as soon as possible
window.initEngine = initEngine;

// Engine initialization function
function initEngine() {
  console.log("Initializing WebGL Engine...");
  
  try {
    // Export global variables for other modules before doing anything else
    exportGlobals();
    
    // Set the player's initial angle (using the function from controls.js if available)
    if (typeof window.dirToAngle === 'function') {
      player.angle = window.dirToAngle(player.direction);
    } else {
      // Fallback if controls.js isn't loaded yet
      player.angle = 0; // East by default
    }
    
    // Initialize Three.js (returns true if successful)
    const threeJSInit = initThreeJS();
    
    if (!threeJSInit) {
      console.error("Failed to initialize Three.js. Aborting WebGL engine initialization.");
      return;
    }
    
    // Initialize debug tools before anything else so we can see logs
    if (typeof initDebugControls === 'function') {
      initDebugControls();
    }
    
    // Load textures first, then build environment
    loadTextures(() => {
      try {
        // Add environment components (walls, floor and ceiling in one function)
        createWalls();
        
        // Setup lighting after environment is created
        setupLighting();
        
        // Set up UI and character abilities
        if (typeof setupUI === 'function') {
          setupUI(shootFireballFromCharacter);
        }
        
        // Initialize the projectile system
        if (typeof initProjectileSystem === 'function') {
          projectileSystem = initProjectileSystem(scene);
        }
        
        // Initialize controls if available
        if (typeof window.setupControls === 'function') {
          // Pass the player object and world map reference only
          window.setupControls(player, worldMap);
          console.log("Controls initialized with player reference");
        } else {
          console.warn("setupControls function not found. Make sure controls.js is loaded.");
        }
        
        // Initialize game systems from beholder.js if it exists
        try {
          if (typeof window.initGame === 'function' && !window.beholderIsInitialized) {
            console.log("Initializing game systems from beholder.js");
            window.beholderIsInitialized = true;
            window.initGame();
          } else {
            console.warn("initGame function not found in beholder.js or already initialized");
          }
        } catch (e) {
          console.error("Error initializing game systems from beholder.js:", e);
        }
        
        // Create debug panel for movement
        createSimpleDebugPanel();
        
        // Start the game loop once everything is loaded
        lastTime = performance.now();
        animate(lastTime);
        
        console.log("WebGL Engine initialization complete");
      } catch (e) {
        console.error("Error during engine initialization:", e);
      }
    });
  } catch (e) {
    console.error("Critical error during engine initialization:", e);
  }
}

// Add this to the exportGlobals function to ensure it correctly makes all variables global
function exportGlobals() {
  console.log("Exporting global objects and functions...");
  
  // Ensure worldMap is properly initialized before exporting
  if (!worldMap || worldMap.length === 0) {
    console.log("WorldMap not initialized during export, initializing now");
    initDefaultWorldMap();
  }
  
  // These must be set directly to ensure they're available
  window.worldMap = worldMap; 
  window.mapWidth = mapWidth;
  window.mapHeight = mapHeight;
  window.SCALE_FACTOR = SCALE_FACTOR;
  
  // Expose important functions and objects to global scope
  window.player = player;
  window.log = log;
  window.castRay = castRay;
  
  // Ensure initEngine is globally available
  window.initEngine = initEngine;
  
  // Three.js objects (only if they exist)
  if (scene) window.scene = scene;
  if (camera) window.camera = camera;
  if (renderer) window.renderer = renderer;
  
  // Game functions
  window.shootFireballFromCharacter = shootFireballFromCharacter;
  
  // Initialize fireballCooldown array if it doesn't exist
  if (!window.fireballCooldown) {
    window.fireballCooldown = [0, 0, 0, 0];
    window.FIREBALL_COOLDOWN_MS = 1000;
  }
  
  console.log("Global export complete - worldMap dimensions:", 
              window.worldMap.length + "x" + (window.worldMap[0] ? window.worldMap[0].length : 0));
}

// Helper to compute available width for the canvas
function getCanvasWidth() {
  return window.innerWidth - 400; // subtract UI panel width
}

// Initialize world map from ASCII layout if levels.js isn't loaded
function initDefaultWorldMap() {
  console.log("Initializing default world map...");
  // Default ASCII map from engine.js
  var asciiMap = [
    "XXXXXXXXXXXXXXXXXXXXX",
    "XXOOOOOOOOXOOOOOOOOXX",
    "XXOXXOXXXOXOXXXOXXOXX",
    "XXOXXOXXXOXOXXXOXXOXX",
    "XXOOOOOXOOOOXOOOOOOXX",
    "XXOXXOOXXXXXXOXXXXXXX",
    "XXOOOOOXOOOOOOXOOOOEX",
    "XXXXOOOXOOXXXXXOXXXXX",
    "XXOOOXXXOOOOOOOOOOOXX",
    "XXXXOOOXXXXXXXXXXXXXX",
    "XXOOOXOOOOXXOOOOOOOXX",
    "XXOXXOXXXXOOXXXOXXOXX",
    "XXOOOOXOOOSOOOOOOOOXX",
    "XXOXXOXXOXXXXXOXXOOXX",
    "XXOOOOOOOOOOOOOOOOOXX",
    "XXXXXXXXXXXXXXXXXXXXX"
  ];
  
  worldMap = [];
  mapHeight = asciiMap.length;
  mapWidth = asciiMap[0].length;
  
  // Parse ASCII map to numerical format
  for (var y = 0; y < mapHeight; y++) {
    worldMap[y] = [];
    var row = asciiMap[y];
    for (var x = 0; x < mapWidth; x++) {
      var c = (x < row.length) ? row[x] : 'X';
      if (c === 'X') {
        worldMap[y][x] = 1; // Wall
      } else if (c === 'E') {
        worldMap[y][x] = 2; // Exit
      } else if (c === 'O') {
        worldMap[y][x] = 0; // Floor
      } else if (c === 'S') {
        worldMap[y][x] = 0; // Starting position
        player.x = x + 0.5;
        player.y = y + 0.5;
      } else {
        worldMap[y][x] = 1; // Default to wall
      }
    }
  }
  
  // Set default level info
  currentLevel = {
    name: "Default Level",
    startPosition: { 
      x: player.x, 
      y: player.y 
    },
    ambientLight: 0x333344,
    ambientIntensity: 0.4,
    torchColor: 0xff9933,
    torchIntensity: 1.0,
    torchRange: 10.0
  };
  
  console.log(`Default map initialized with dimensions: ${mapWidth}x${mapHeight}`);
  return {
    worldMap: worldMap,
    mapWidth: mapWidth,
    mapHeight: mapHeight,
    levelData: currentLevel
  };
}

function loadLevel(levelId) {
  console.log(`Attempting to load level ${levelId}...`);
  
  // Try to load from levels.js if available
  if (typeof getLevel === 'function') {
    try {
      const levelInfo = getLevel(levelId);
      
      // Store the level data
      worldMap = levelInfo.worldMap;
      mapWidth = levelInfo.mapWidth;
      mapHeight = levelInfo.mapHeight;
      currentLevel = levelInfo.levelData;
      
      // Set player position
      if (currentLevel.startPosition) {
        player.x = currentLevel.startPosition.x;
        player.y = currentLevel.startPosition.y;
      }
      
      console.log(`Level "${currentLevel.name}" loaded. Map dimensions: ${mapWidth}x${mapHeight}`);
      console.log(`Player starting at: (${player.x.toFixed(2)}, ${player.y.toFixed(2)})`);
      
      return levelInfo;
    } catch (e) {
      console.error("Error loading level from getLevel():", e);
      console.log("Falling back to default map");
      return initDefaultWorldMap();
    }
  } else {
    console.log("levels.js not loaded, using default map");
    return initDefaultWorldMap();
  }
}

// Update player animations based on current state
function updatePlayerAnimations(dt) {
  // Turning animation
  if (player.isTurning) {
    let elapsed = performance.now() - player.turnStartTime;
    let frac = Math.min(elapsed / player.turnDuration, 1);
    
    // Use a smoother easing function for turning
    frac = easeInOutQuad(frac);
    
    player.angle = player.startAngle + (player.endAngle - player.startAngle) * frac;
    
    if (elapsed >= player.turnDuration) {
      player.isTurning = false;
      player.angle = player.endAngle;
      log(`Now facing ${window.directionToString ? window.directionToString(player.direction) : player.direction}`);
    }
  }
  
  // Movement animation
  if (player.isMoving) {
    let elapsed = performance.now() - player.moveStartTime;
    let frac = Math.min(elapsed / player.moveDuration, 1);
    
    // Use easing for smoother movement
    frac = easeInOutQuad(frac);
    
    if (elapsed >= player.moveDuration) {
      player.isMoving = false;
      player.x = player.endX;
      player.y = player.endY;
      log(`Now at tile (${Math.floor(player.x / SCALE_FACTOR)},${Math.floor(player.y / SCALE_FACTOR)})`);
      
      // Add slight camera bob when stopping
      if (camera) {
        const bobEffect = function() {
          let startTime = performance.now();
          let bobDuration = 300;
          
          function updateBob() {
            const elapsed = performance.now() - startTime;
            const bobFrac = Math.min(elapsed / bobDuration, 1);
            
            if (bobFrac < 1) {
              // Apply small vertical bob
              const bobAmount = Math.sin(bobFrac * Math.PI) * 0.05;
              camera.position.y = 1.5 + bobAmount;
              requestAnimationFrame(updateBob);
            } else {
              camera.position.y = 1.5; // Reset to normal height
            }
          }
          
          requestAnimationFrame(updateBob);
        };
        
        bobEffect();
      }
    } else {
      player.x = player.startX + (player.endX - player.startX) * frac;
      player.y = player.startY + (player.endY - player.startY) * frac;
      
      // Add footstep sound at midpoint of movement
      if (frac > 0.4 && frac < 0.6 && !player.playedStepSound) {
        playFootstepSound();
        player.playedStepSound = true;
      }
      
      // Add slight bob during movement
      if (camera) {
        // Simple bob based on sin wave 
        const bobPhase = frac * Math.PI * 2; // One complete cycle
        const bobAmount = Math.abs(Math.sin(bobPhase)) * 0.07;
        camera.position.y = 1.5 + bobAmount;
      }
    }
  } else {
    player.playedStepSound = false;
  }
}

// Easing function for smoother animations
function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// Simple footstep sound function (can be expanded later)
function playFootstepSound() {
  // Check if the Audio API is available
  if (typeof Audio !== 'undefined') {
    // Create footstep sound effect
    try {
      const footstepSounds = [
        'assets/sounds/footstep1.mp3',
        'assets/sounds/footstep2.mp3',
        'assets/sounds/footstep3.mp3'
      ];
      
      // For now, simulate a footstep with a console message
      console.log("*footstep*");
      
      // This would be the actual sound implementation:
      /*
      const soundIndex = Math.floor(Math.random() * footstepSounds.length);
      const sound = new Audio(footstepSounds[soundIndex]);
      sound.volume = 0.3;
      sound.play();
      */
    } catch (e) {
      console.warn("Could not play footstep sound:", e);
    }
  }
}

// Simple log function that works when the DOM is not fully loaded
function log(message) {
  console.log(message);
  
  // Try to use the DOM log panel if it exists
  try {
    const logPanel = document.getElementById("logPanel");
    if (logPanel) {
      const div = document.createElement("div");
      div.textContent = message;
      logPanel.appendChild(div);
      
      // Trim log if too long
      while (logPanel.children.length > 10) {
        logPanel.removeChild(logPanel.firstChild);
      }
      
      // Scroll to bottom
      logPanel.scrollTop = logPanel.scrollHeight;
    }
  } catch (e) {
    // Silently fail if the DOM element isn't ready
  }
}

//////////////////////////
// Raycasting for collision detection
//////////////////////////

// Cast a ray from a position in a specified angle and return the first collision
function castRay(x, y, angle) {
  // Check horizontal walls
  let horizontalHit = castHorizontalRay(x, y, angle);
  
  // Check vertical walls
  let verticalHit = castVerticalRay(x, y, angle);
  
  // Return the closer hit
  if (horizontalHit.distance < verticalHit.distance) {
    return horizontalHit;
  } else {
    return verticalHit;
  }
}

// Cast a ray checking for horizontal walls (north/south facing)
function castHorizontalRay(x, y, angle) {
  const dirY = Math.sin(angle) > 0 ? 1 : -1; // Going south or north
  const firstY = dirY > 0 ? Math.floor(y) + 1 : Math.floor(y);
  const firstX = x + (firstY - y) / Math.tan(angle);
  
  const stepY = dirY;
  const stepX = stepY / Math.tan(angle);
  
  let nextX = firstX;
  let nextY = firstY;
  
  let distance = Infinity;
  let wallType = 0;
  
  // Loop until we hit a wall or exceed map boundaries
  for (let i = 0; i < 100; i++) { // Safety limit
    const mapY = dirY > 0 ? nextY : nextY - 1;
    const mapX = Math.floor(nextX);
    
    // Check if we've hit map boundaries
    if (mapX < 0 || mapY < 0 || mapX >= mapWidth || mapY >= mapHeight) {
      break;
    }
    
    // Check if we've hit a wall
    if (worldMap[mapY][mapX] !== 0) {
      // Calculate exact distance
      const dx = nextX - x;
      const dy = nextY - y;
      distance = Math.sqrt(dx*dx + dy*dy);
      wallType = worldMap[mapY][mapX];
      break;
    }
    
    // Move to next intersection
    nextX += stepX;
    nextY += stepY;
  }
  
  return {
    distance,
    wallType,
    direction: dirY > 0 ? 'north' : 'south',
    x: nextX,
    y: nextY
  };
}

// Cast a ray checking for vertical walls (east/west facing)
function castVerticalRay(x, y, angle) {
  const dirX = Math.cos(angle) > 0 ? 1 : -1; // Going east or west
  const firstX = dirX > 0 ? Math.floor(x) + 1 : Math.floor(x);
  const firstY = y + (firstX - x) * Math.tan(angle);
  
  const stepX = dirX;
  const stepY = stepX * Math.tan(angle);
  
  let nextX = firstX;
  let nextY = firstY;
  
  let distance = Infinity;
  let wallType = 0;
  
  // Loop until we hit a wall or exceed map boundaries
  for (let i = 0; i < 100; i++) { // Safety limit
    const mapX = dirX > 0 ? nextX : nextX - 1;
    const mapY = Math.floor(nextY);
    
    // Check if we've hit map boundaries
    if (mapX < 0 || mapY < 0 || mapX >= mapWidth || mapY >= mapHeight) {
      break;
    }
    
    // Check if we've hit a wall
    if (worldMap[mapY][mapX] !== 0) {
      // Calculate exact distance
      const dx = nextX - x;
      const dy = nextY - y;
      distance = Math.sqrt(dx*dx + dy*dy);
      wallType = worldMap[mapY][mapX];
      break;
    }
    
    // Move to next intersection
    nextX += stepX;
    nextY += stepY;
  }
  
  return {
    distance,
    wallType,
    direction: dirX > 0 ? 'west' : 'east',
    x: nextX,
    y: nextY
  };
}

//////////////////////////
// Texture Loading
//////////////////////////

function loadTextures(callback) {
  console.log("Starting texture loading...");
  
  // Make sure Three.js is available
  if (typeof THREE === 'undefined') {
    console.error("THREE is not defined! Make sure Three.js is loaded.");
    // Still call callback to continue initialization
    if (callback) setTimeout(callback, 0);
    return;
  }
  
  const textureLoader = new THREE.TextureLoader();
  let loadedCount = 0;
  const totalTextures = 1; // Increase as we add more textures
  
  function checkAllLoaded() {
    loadedCount++;
    console.log(`Texture ${loadedCount}/${totalTextures} loaded`);
    if (loadedCount === totalTextures && callback) {
      callback();
    }
  }
  
  // Wall texture - use fake texture if loading fails
  try {
    wallTexture = textureLoader.load('assets/images/Wall1.png', 
      texture => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1, 1);
        console.log("Wall texture loaded successfully");
        
        // Create floor and ceiling textures from the same image
        floorTexture = texture.clone();
        floorTexture.wrapS = THREE.RepeatWrapping;
        floorTexture.wrapT = THREE.RepeatWrapping;
        floorTexture.repeat.set(mapWidth, mapHeight);
        
        ceilingTexture = texture.clone();
        ceilingTexture.wrapS = THREE.RepeatWrapping;
        ceilingTexture.wrapT = THREE.RepeatWrapping;
        ceilingTexture.repeat.set(mapWidth, mapHeight);
        
        checkAllLoaded();
      }, 
      undefined, 
      err => {
        console.error("Error loading wall texture:", err);
        
        // Create a default checkerboard texture
        const size = 512;
        const data = new Uint8Array(size * size * 4);
        for (let i = 0; i < size; i++) {
          for (let j = 0; j < size; j++) {
            const stride = (i * size + j) * 4;
            const isEven = (Math.floor(i / 32) + Math.floor(j / 32)) % 2 === 0;
            const value = isEven ? 128 : 255;
            data[stride] = value;     // r
            data[stride + 1] = value; // g
            data[stride + 2] = value; // b
            data[stride + 3] = 255;   // a
          }
        }
        
        const texture = new THREE.DataTexture(data, size, size);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.needsUpdate = true;
        
        wallTexture = texture;
        floorTexture = texture.clone();
        ceilingTexture = texture.clone();
        
        checkAllLoaded(); // Continue even if loading fails
      }
    );
  } catch (e) {
    console.error("Error during texture loading:", e);
    checkAllLoaded(); // Continue even if loading fails
  }
}

//////////////////////////
// Three.js Scene Setup
//////////////////////////

function createWalls() {
  console.log("Creating walls using Three.js...");
  
  // Make sure worldMap is valid
  if (!Array.isArray(worldMap) || worldMap.length === 0) {
    console.error("worldMap is not initialized!");
    // Initialize a default map as fallback
    initDefaultWorldMap();
  }
  
  // Ensure we have Three.js
  if (typeof THREE === 'undefined') {
    console.error("THREE is not defined! Cannot create walls.");
    return;
  }
  
  try {
    // Materials with more authentic colors
    const wallMaterial = new THREE.MeshStandardMaterial({ 
      map: wallTexture,
      color: 0xbbbbbb,
      roughness: 0.8,
      metalness: 0.2
    });
    
    const exitMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xcc3333,
      roughness: 0.7,
      metalness: 0.3,
      emissive: 0x330000,
      emissiveIntensity: 0.2
    });
    
    // Create wall group for better organization
    const wallGroup = new THREE.Group();
    scene.add(wallGroup);
    
    // Helper function to check if position has a wall
    const hasWall = (x, y) => {
      if (x < 0 || y < 0 || x >= mapWidth || y >= mapHeight) return true;
      return worldMap[y][x] === 1 || worldMap[y][x] === 2;
    };
    
    // Function to get wall material based on map value
    const getWallMaterial = (x, y) => {
      if (x < 0 || y < 0 || x >= mapWidth || y >= mapHeight) return wallMaterial;
      return worldMap[y][x] === 2 ? exitMaterial : wallMaterial;
    };
    
    // Create walls with expanded dimensions
    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        if (hasWall(x, y)) {
          const material = getWallMaterial(x, y);
          
          // Add ultra-thin wall segments along the edges where needed
          // North wall (negative Z direction)
          if (!hasWall(x, y-1)) {
            const wallSegment = new THREE.Mesh(
              new THREE.BoxGeometry(0.99 * SCALE_FACTOR, wallHeight, 0.01 * SCALE_FACTOR),
              material
            );
            wallSegment.position.set(
              x * SCALE_FACTOR + 0.5 * SCALE_FACTOR, 
              wallHeight/2, 
              y * SCALE_FACTOR
            );
            wallGroup.add(wallSegment);
          }
        
          // South wall (positive Z direction)
          if (!hasWall(x, y+1)) {
            const wallSegment = new THREE.Mesh(
              new THREE.BoxGeometry(0.99 * SCALE_FACTOR, wallHeight, 0.01 * SCALE_FACTOR),
              material
            );
            wallSegment.position.set(
              x * SCALE_FACTOR + 0.5 * SCALE_FACTOR, 
              wallHeight/2, 
              y * SCALE_FACTOR + 1 * SCALE_FACTOR
            );
            wallGroup.add(wallSegment);
          }
          
          // East wall (positive X direction)
          if (!hasWall(x+1, y)) {
            const wallSegment = new THREE.Mesh(
              new THREE.BoxGeometry(0.01 * SCALE_FACTOR, wallHeight, 0.99 * SCALE_FACTOR),
              material
            );
            wallSegment.position.set(
              x * SCALE_FACTOR + 1 * SCALE_FACTOR, 
              wallHeight/2, 
              y * SCALE_FACTOR + 0.5 * SCALE_FACTOR
            );
            wallGroup.add(wallSegment);
          }
          
          // West wall (negative X direction)
          if (!hasWall(x-1, y)) {
            const wallSegment = new THREE.Mesh(
              new THREE.BoxGeometry(0.01 * SCALE_FACTOR, wallHeight, 0.99 * SCALE_FACTOR),
              material
            );
            wallSegment.position.set(
              x * SCALE_FACTOR, 
              wallHeight/2, 
              y * SCALE_FACTOR + 0.5 * SCALE_FACTOR
            );
            wallGroup.add(wallSegment);
          }
        }
      }
    }
    
    // Floor with fixed texture seams
    const floorGeometry = new THREE.PlaneGeometry(mapWidth * SCALE_FACTOR, mapHeight * SCALE_FACTOR);
    
    // Create a properly tiled floor texture 
    const floorTexture = wallTexture.clone();
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    // This ensures tiles across the floor (one tile per unit)
    floorTexture.repeat.set(mapWidth, mapHeight);
    
    const floorMaterial = new THREE.MeshStandardMaterial({
      map: floorTexture,
      color: 0x555555, // Tint the texture darker
      roughness: 0.9,
      metalness: 0.1,
      side: THREE.DoubleSide
    });
    
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2; // Make it horizontal
    floor.position.set(
      mapWidth * SCALE_FACTOR / 2, 
      0, 
      mapHeight * SCALE_FACTOR / 2
    );
    scene.add(floor);
    
    // Add textured ceiling with expanded dimensions
    const ceilingTexture = wallTexture.clone();
    ceilingTexture.wrapS = THREE.RepeatWrapping;
    ceilingTexture.wrapT = THREE.RepeatWrapping;
    // This ensures tiles across the ceiling (one tile per unit)
    ceilingTexture.repeat.set(mapWidth, mapHeight);
    
    const ceilingGeometry = new THREE.PlaneGeometry(mapWidth * SCALE_FACTOR, mapHeight * SCALE_FACTOR);
    const ceilingMaterial = new THREE.MeshStandardMaterial({ 
      map: ceilingTexture,
      color: 0x223344, // Tint the texture darker
      roughness: 0.9,
      metalness: 0.1,
      side: THREE.DoubleSide
    });
    
    const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
    ceiling.rotation.x = Math.PI / 2; // Make it horizontal
    ceiling.position.set(
      mapWidth * SCALE_FACTOR / 2, 
      wallHeight, 
      mapHeight * SCALE_FACTOR / 2
    );
    scene.add(ceiling);
    
    console.log(`EXPANDED DUNGEON: All dimensions multiplied by ${SCALE_FACTOR}!`);
    
    // Update player position to match the new scale
    if (player) {
      player.x *= SCALE_FACTOR;
      player.y *= SCALE_FACTOR;
      player.startX *= SCALE_FACTOR;
      player.startY *= SCALE_FACTOR;
      player.endX *= SCALE_FACTOR;
      player.endY *= SCALE_FACTOR;
      
      // Also update camera if it exists
      if (camera) {
        camera.position.set(player.x, camera.position.y, player.y);
      }
    }
  } catch (e) {
    console.error("Error creating walls:", e);
  }
}

// Initialize Three.js scene, camera, and renderer
function initThreeJS() {
  console.log("Initializing Three.js...");
  
  try {
    // Make sure Three.js is available
    if (typeof THREE === 'undefined') {
      console.error("THREE is not defined! Make sure Three.js is loaded.");
      return false;
    }
    
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    
    // Create camera with FOV matching the original engine (60°)
    camera = new THREE.PerspectiveCamera(60, getCanvasWidth() / window.innerHeight, 0.1, 50);
    camera.position.set(player.x, 1.5, player.y); // Eye height is 1.5 units
    
    // Get game container - create if it doesn't exist
    let gameContainer = document.getElementById("gameContainer");
    if (!gameContainer) {
      console.log("Creating gameContainer div");
      gameContainer = document.createElement("div");
      gameContainer.id = "gameContainer";
      gameContainer.style.display = "inline-block";
      document.getElementById("container").prepend(gameContainer);
    }
    
    // Create renderer with appropriate settings
    renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      powerPreference: "high-performance" 
    });
    renderer.setSize(getCanvasWidth(), window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    try {
      gameContainer.appendChild(renderer.domElement);
    } catch (e) {
      console.error("Error appending renderer to DOM:", e);
      // Fallback - try to replace the canvas element
      const canvas = document.getElementById("gameCanvas");
      if (canvas && canvas.parentNode) {
        console.log("Replacing gameCanvas with WebGL renderer");
        canvas.parentNode.replaceChild(renderer.domElement, canvas);
      } else {
        console.error("Could not find gameCanvas element for replacement");
      }
    }
  
    // Handle window resize
    window.addEventListener('resize', function() {
      camera.aspect = getCanvasWidth() / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(getCanvasWidth(), window.innerHeight);
    });
    
    return true; // Indicate success
  } catch (e) {
    console.error("Error initializing Three.js:", e);
    return false;
  }
}

// Setting up scene lighting
function setupLighting() {
  console.log("Setting up lighting...");
  
  try {
    // Create ambient light for base illumination
    const ambientLight = new THREE.AmbientLight(0x333344, 0.5);
    scene.add(ambientLight);
    
    // Create a player torch light that follows the camera
    const playerLight = new THREE.PointLight(0xff9933, 1.2, 10.0);
    playerLight.position.set(0, 1.0, 0); // Slightly below eye level
    
    // Add shadow properties
    playerLight.castShadow = true;
    playerLight.shadow.mapSize.width = 512;
    playerLight.shadow.mapSize.height = 512;
    playerLight.shadow.camera.near = 0.1;
    playerLight.shadow.camera.far = 10;
    
    // Add to camera so it moves with the player
    camera.add(playerLight);
    
    // Make sure camera is added to the scene (important!)
    scene.add(camera);
    
    // Add some atmosphere lights around the level
    // These add some ambient color to different areas
    if (currentLevel && currentLevel.atmosphereLights) {
      currentLevel.atmosphereLights.forEach(lightConfig => {
        const atmosphereLight = new THREE.PointLight(
          lightConfig.color || 0x4466aa,
          lightConfig.intensity || 0.3,
          lightConfig.range || 15
        );
        
        atmosphereLight.position.set(
          lightConfig.position.x * SCALE_FACTOR || 5 * SCALE_FACTOR,
          1.8, // Ceiling height - 0.5
          lightConfig.position.y * SCALE_FACTOR || 5 * SCALE_FACTOR
        );
        
        scene.add(atmosphereLight);
      });
    } else {
      // Add some default atmosphere lights if level doesn't define them
      const light1 = new THREE.PointLight(0x4466aa, 0.3, 15);
      light1.position.set(5 * SCALE_FACTOR, 1.8, 5 * SCALE_FACTOR);
      scene.add(light1);
      
      const light2 = new THREE.PointLight(0x227744, 0.3, 15);
      light2.position.set(15 * SCALE_FACTOR, 1.8, 5 * SCALE_FACTOR);
      scene.add(light2);
      
      const light3 = new THREE.PointLight(0x664422, 0.3, 15);
      light3.position.set(10 * SCALE_FACTOR, 1.8, 10 * SCALE_FACTOR);
      scene.add(light3);
    }
    
    console.log("Lighting setup complete");
  } catch (e) {
    console.error("Error setting up lighting:", e);
  }
}

// Fireball shooting function
function shootFireballFromCharacter(charIndex) {
  console.log(`Character ${charIndex + 1} attempting to shoot fireball`);
  
  // Check if projectile system exists
  if (projectileSystem && typeof projectileSystem.shootFireball === 'function') {
    try {
      return projectileSystem.shootFireball(charIndex, player);
    } catch (e) {
      console.error("Error shooting fireball:", e);
      if (typeof window.log === 'function') {
        window.log(`Error casting fireball!`);
      }
      return null;
    }
  } else {
    console.warn("Projectile system not available");
    // Log to game console if possible
    if (typeof window.log === 'function') {
      window.log(`Character ${charIndex + 1} tries to cast a fireball, but can't!`);
    }
    return null;
  }
}

// Animation loop - CRITICAL FOR RENDERING
function animate(time) {
  requestAnimationFrame(animate);
  
  const dt = time - lastTime;
  lastTime = time;
  
  // Update player position and animation
  updatePlayerAnimations(dt);
  
  // Check for continuous movement using the function from controls.js
  if (typeof window.updateContinuousMovement === 'function') {
    window.updateContinuousMovement();
  }
  
  // Update projectiles if the system exists but don't break if it has errors
  try {
    if (projectileSystem && typeof projectileSystem.update === 'function') {
      projectileSystem.update(dt, worldMap);
    }
  } catch (e) {
    console.warn("Projectile system update error (skipping):", e);
  }
  
  // Update game entities if the function exists
  try {
    if (typeof window.updateGame === 'function') {
      window.updateGame(dt);
    }
  } catch (e) {
    console.warn("Game update error (skipping):", e);
  }
  
  // Update minimap if the function exists
  try {
    if (typeof window.updateMinimap === 'function') {
      window.updateMinimap(worldMap, player);
    }
  } catch (e) {
    console.warn("Minimap update error (skipping):", e);
  }
  
  // Update FPS counter if it exists
  try {
    if (typeof window.updateFPSCounter === 'function') {
      window.updateFPSCounter(time);
    }
  } catch (e) {
    // Silently ignore FPS counter errors
  }
  
  // Make sure camera is positioned correctly
camera.position.x = player.x;
camera.position.z = player.y;
const lookAtX = player.x + Math.cos(player.angle);
const lookAtZ = player.y + Math.sin(player.angle);
camera.lookAt(new THREE.Vector3(lookAtX, camera.position.y, lookAtZ));


  // Only render if renderer exists
  if (renderer) {
    renderer.render(scene, camera);
  }
}

// Simple debug panel for movement debugging
function createSimpleDebugPanel() {
  // Create panel if it doesn't exist
  if (!document.getElementById('simpleDebugPanel')) {
    const panel = document.createElement('div');
    panel.id = 'simpleDebugPanel';
    panel.style.position = 'fixed';
    panel.style.top = '10px';
    panel.style.left = '10px';
    panel.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    panel.style.color = 'white';
    panel.style.padding = '10px';
    panel.style.fontFamily = 'monospace';
    panel.style.fontSize = '12px';
    panel.style.zIndex = '1000';
    panel.style.borderRadius = '5px';
    panel.style.maxWidth = '300px';
    panel.style.display = 'none'; // Start hidden
    
    document.body.appendChild(panel);
  }
  
  // Function to update the panel content
  function updateDebugPanel() {
    const panel = document.getElementById('simpleDebugPanel');
    if (!panel) return;
    
    // Display movement state
    let content = `<strong>Movement Debug:</strong><br>`;
    content += `Player Pos: (${player.x.toFixed(1)}, ${player.y.toFixed(1)})<br>`;
    content += `Direction: ${window.directionToString ? window.directionToString(player.direction) : player.direction}<br>`;
    content += `Angle: ${player.angle.toFixed(2)}<br>`;
    content += `Is Moving: ${player.isMoving}<br>`;
    content += `Is Turning: ${player.isTurning}<br>`;
    content += `<br>`;
    content += `<strong>Movement Keys:</strong><br>`;
    content += `Forward (W): ${window.moveForward}<br>`;
    content += `Back (S): ${window.moveBackward}<br>`;
    content += `Left (A): ${window.moveLeft}<br>`;
    content += `Right (D): ${window.moveRight}<br>`;
    
    // Add reset button
    content += `<br><button id="resetPlayerPos">Reset Player Position</button>`;
    
    panel.innerHTML = content;
    
    // Add button event listener
    document.getElementById('resetPlayerPos').addEventListener('click', function() {
      player.x = 12.5 * SCALE_FACTOR;
      player.y = 12.5 * SCALE_FACTOR;
      player.isMoving = false;
      player.isTurning = false;
      player.direction = 1; // East
      player.angle = window.dirToAngle ? window.dirToAngle(player.direction) : 0;
      
      if (camera) {
        camera.position.x = player.x;
        camera.position.z = player.y;
        camera.rotation.y = -player.angle;
      }
      
      console.log("Player position reset!");
    });
  }
  
  // Update debug panel periodically
  setInterval(updateDebugPanel, 100);
  
  // Toggle the panel with F2
  document.addEventListener('keydown', function(e) {
    if (e.key === 'F2') {
      const panel = document.getElementById('simpleDebugPanel');
      if (panel) {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
      }
    }
  });
  
  console.log("Simple debug panel created. Press F2 to toggle.");
}

// Make the animate function globally available
window.animate = animate;