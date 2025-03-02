// ==================== GLOBAL VARIABLES & CANVAS SETUP ====================
var canvas = document.getElementById("gameCanvas");
var ctx = canvas.getContext("2d");
var screenW = canvas.width;
var screenH = canvas.height;
var fov = Math.PI / 3; // 60° field of view

// ==================== TEXTURE LOADING ====================
// Wall texture
var wallTextureLoaded = false;
var wallTexture = new Image();
wallTexture.onload = function() { 
  wallTextureLoaded = true; 
  console.log("Wall texture loaded."); 
};
wallTexture.src = "MM3images/Wall1.png";

// Fireball system globals (available for other modules)
var fireballs = []; 
var fireballCooldown = [0, 0, 0, 0];   // One cooldown per character
var FIREBALL_COOLDOWN_MS = 1000;       // 1 second cooldown
var FIREBALL_SPEED = 5.0;              // speed in tiles/sec
var FIREBALL_SIZE = 0.5;               // Size in world units

// ==================== WORLD MAP SETUP ====================
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
var worldMap = [];
var mapHeight = asciiMap.length;
var mapWidth = asciiMap[0].length;

// ==================== PLAYER SETUP ====================
var player = {
  x: 0.0, 
  y: 0.0,
  direction: 1,  // 0=North, 1=East, 2=South, 3=West
  angle: 0,
  isMoving: false, 
  moveStartTime: 0, 
  moveDuration: 200,
  startX: 0, 
  startY: 0, 
  endX: 0, 
  endY: 0,
  isTurning: false, 
  turnStartTime: 0, 
  turnDuration: 200,
  startAngle: 0, 
  endAngle: 0
};

// Parse ASCII map into world map array
function parseAsciiMap() {
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
}

// ==================== MOVEMENT & ANGLES ====================
function dirToAngle(d) {
  // 0=North => -π/2, 1=East => 0, 2=South => π/2, 3=West => π
  switch(d) {
    case 0: return -Math.PI / 2;
    case 1: return 0;
    case 2: return Math.PI / 2;
    case 3: return Math.PI;
  }
  return 0;
}

function directionToString(dir) {
  switch(dir) {
    case 0: return "North";
    case 1: return "East";
    case 2: return "South";
    case 3: return "West";
    default: return "Unknown";
  }
}

function dirDeltas(d) {
  // 0=North => (0,-1), 1=East => (1,0), 2=South => (0,1), 3=West => (-1,0)
  switch(d) {
    case 0: return [0, -1];
    case 1: return [1, 0];
    case 2: return [0, 1];
    case 3: return [-1, 0];
  }
  return [0, 0];
}


// Determine if the player can move to an area 
function canMoveTo(nx, ny) {
  var tileX = Math.floor(nx), tileY = Math.floor(ny);
  
  // First, check wall collision
  if (tileX < 0 || tileY < 0 || tileX >= worldMap[0].length || tileY >= worldMap.length) return false;
  if (worldMap[tileY][tileX] !== 0) return false;
  
  // Check for monster collision
  if (window.entityManager) {
    const monsters = window.entityManager.getByType("monster");
    for (const monster of monsters) {
      // Check if monster is active and at the target tile
      if (monster.active && 
          Math.floor(monster.x) === tileX && 
          Math.floor(monster.y) === tileY) {
        return false;
      }
    }
  }
  
  return true;
}

function startMoveAnimation(tx, ty) {
  player.isMoving = true;
  player.moveStartTime = performance.now();
  player.startX = player.x;
  player.startY = player.y;
  player.endX = tx;
  player.endY = ty;
}

function startTurnAnimation(newDir) {
  player.isTurning = true;
  player.turnStartTime = performance.now();
  player.startAngle = player.angle;
  player.direction = newDir;
  player.endAngle = dirToAngle(newDir);
  var diff = player.endAngle - player.startAngle;
  if (diff > Math.PI) {
    player.startAngle += 2 * Math.PI;
  } else if (diff < -Math.PI) {
    player.endAngle += 2 * Math.PI;
  }
}

// Helper functions to get animated player position
function animX() {
  if (!player.isMoving) return player.x;
  var t = performance.now() - player.moveStartTime;
  var frac = Math.min(t / player.moveDuration, 1);
  return player.startX + (player.endX - player.startX) * frac;
}

function animY() {
  if (!player.isMoving) return player.y;
  var t = performance.now() - player.moveStartTime;
  var frac = Math.min(t / player.moveDuration, 1);
  return player.startY + (player.endY - player.startY) * frac;
}

// ==================== RAYCASTING FUNCTION ====================
function castRay(px, py, angle) {
  var sin = Math.sin(angle), cos = Math.cos(angle);
  var mapX = Math.floor(px), mapY = Math.floor(py);
  var deltaDistX = Math.abs(1 / cos), deltaDistY = Math.abs(1 / sin);
  var stepX, stepY, sideDistX, sideDistY;
  
  // Calculate step and initial sideDist
  if (cos < 0) { stepX = -1; sideDistX = (px - mapX) * deltaDistX; }
  else { stepX = 1;  sideDistX = (mapX + 1 - px) * deltaDistX; }
  if (sin < 0) { stepY = -1; sideDistY = (py - mapY) * deltaDistY; }
  else { stepY = 1;  sideDistY = (mapY + 1 - py) * deltaDistY; }
  
  // DDA algorithm
  var distance = 0, hit = false, hitVertical = false, tileType = 1;
  while (!hit) {
    // Jump to next square
    if (sideDistX < sideDistY) {
      mapX += stepX;
      distance = sideDistX;
      sideDistX += deltaDistX;
      hitVertical = true;
    } else {
      mapY += stepY;
      distance = sideDistY;
      sideDistY += deltaDistY;
      hitVertical = false;
    }
    
    // Check if ray hit a wall
    if (mapX < 0 || mapY < 0 || mapX >= mapWidth || mapY >= mapHeight) {
      hit = true;
      distance = 50; // Maximum view distance
    } else if (worldMap[mapY][mapX] >= 1) {
      hit = true;
      tileType = worldMap[mapY][mapX];
    }
  }
  
  // Calculate texture coordinate
  var textureX = 0;
  if (hit) {
    var hitX = px + distance * cos;
    var hitY = py + distance * sin;
    if (hitVertical) textureX = hitY - Math.floor(hitY);
    else textureX = hitX - Math.floor(hitX);
    if (hitVertical && cos > 0) textureX = 1 - textureX;
    if (!hitVertical && sin < 0) textureX = 1 - textureX;
  }
  
  return { 
    distance: distance, 
    hitVertical: hitVertical, 
    tileType: tileType, 
    textureX: textureX 
  };
}

// ==================== RENDERING FUNCTIONS ====================
function draw3DView() {
  for (var x = 0; x < screenW; x++) {
    var rayAngle = player.angle - fov/2 + (x / screenW) * fov;
    var ray = castRay(animX(), animY(), rayAngle);
    var dist = ray.distance * Math.cos(rayAngle - player.angle);
    var lineH = screenH / dist;
    var lineTop = (screenH - lineH) / 2;
    
    // Draw ceiling
    ctx.fillStyle = "#223";
    ctx.fillRect(x, 0, 1, lineTop);
    
    // Draw wall
    if (wallTextureLoaded) {
      var texX = Math.floor(ray.textureX * wallTexture.width);
      ctx.drawImage(wallTexture, texX, 0, 1, wallTexture.height, x, lineTop, 1, lineH);
      if (ray.tileType === 2) {
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fillRect(x, lineTop, 1, lineH);
      }
    } else {
      ctx.fillStyle = (ray.tileType === 2) ? "#444" : (ray.hitVertical ? "rgb(200,200,200)" : "rgb(255,255,255)");
      ctx.fillRect(x, lineTop, 1, lineH);
    }
    
    // Draw floor
    ctx.fillStyle = "#333";
    var floorStart = lineTop + lineH;
    if (floorStart < screenH) {
      ctx.fillRect(x, floorStart, 1, screenH - floorStart);
    }
  }
}

function drawMiniMap() {
  var miniCanvas = document.getElementById("miniMapCanvas");
  var miniCtx = miniCanvas.getContext("2d");
  var tileSize = 8;
  
  // Clear minimap
  miniCtx.fillStyle = "#222";
  miniCtx.fillRect(0, 0, miniCanvas.width, miniCanvas.height);
  
  // Draw map tiles
  for (var y = 0; y < mapHeight; y++) {
    for (var x = 0; x < mapWidth; x++) {
      var cell = worldMap[y][x];
      if (cell === 1) miniCtx.fillStyle = "#888";
      else if (cell === 2) miniCtx.fillStyle = "#555";
      else miniCtx.fillStyle = "#333";
      miniCtx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
    }
  }
  
  // Draw player
  miniCtx.fillStyle = "red";
  miniCtx.beginPath();
  miniCtx.arc(animX() * tileSize, animY() * tileSize, 3, 0, Math.PI * 2);
  miniCtx.fill();
  
  // Draw player direction
  var dirLen = 10;
  var dx = Math.cos(player.angle) * dirLen;
  var dy = Math.sin(player.angle) * dirLen;
  miniCtx.strokeStyle = "red";
  miniCtx.beginPath();
  miniCtx.moveTo(animX() * tileSize, animY() * tileSize);
  miniCtx.lineTo(animX() * tileSize + dx, animY() * tileSize + dy);
  miniCtx.stroke();
  
  // Draw entities on minimap (will be implemented in beholder.js)
  if (window.renderEntitiesOnMinimap) {
    window.renderEntitiesOnMinimap(miniCtx, tileSize);
  }
}

function renderFrame() {
  // Clear screen
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, screenW, screenH);
  
  // Draw 3D view
  draw3DView();
  
  // Draw minimap
  drawMiniMap();
  
  // Render game entities (called from beholder.js)
  if (window.renderGameEntities) {
    window.renderGameEntities();
  }
  
  // Render attack effect if available
  if (window.renderAttackEffect) {
    window.renderAttackEffect(ctx, screenW, screenH);
  }
}


// ==================== LOGGING ====================
function log(msg) {
  var panel = document.getElementById("logPanel");
  var div = document.createElement("div");
  div.textContent = msg;
  panel.appendChild(div);
  while (panel.children.length > 10) {
    panel.removeChild(panel.firstChild);
  }
}

function logPos() {
  log(`Now at tile (${Math.floor(player.x)},${Math.floor(player.y)}), x=${player.x.toFixed(2)}, y=${player.y.toFixed(2)}, facing ${directionToString(player.direction)}`);
}

// ==================== MAIN GAME LOOP ====================
var lastTime = 0;

function gameLoop(time) {
  var dt = time - lastTime;
  lastTime = time;
  
  // Update player movement and turning animations
  updatePlayerAnimations(dt);
  
  // Update game entities (called from beholder.js)
  if (window.updateGame) {
    window.updateGame(dt);
  }
  
  // Render the frame
  renderFrame();
  
  // Continue the loop
  requestAnimationFrame(gameLoop);
}

function updatePlayerAnimations(dt) {
  // Turning animation
  if (player.isTurning) {
    var e = performance.now() - player.turnStartTime;
    var frac = Math.min(e / player.turnDuration, 1);
    player.angle = player.startAngle + (player.endAngle - player.startAngle) * frac;
    if (frac >= 1) {
      player.isTurning = false;
      player.angle = player.endAngle;
      logPos();
    }
  }
  
  // Movement animation
  if (player.isMoving) {
    var e = performance.now() - player.moveStartTime;
    var frac = Math.min(e / player.moveDuration, 1);
    if (frac >= 1) {
      player.isMoving = false;
      player.x = player.endX;
      player.y = player.endY;
      logPos();
    }
  }
}

// ==================== INITIALIZATION ====================
function initEngine() {
  // Initialize player
  player.angle = dirToAngle(player.direction);
  
  // Parse the map
  parseAsciiMap();
  
  // Export global objects and functions for use in other modules
  exportGlobals();
  
  // Welcome message
  console.log("Engine initialized!");
  log("Welcome brave adventurers!");
  log(`You are facing ${directionToString(player.direction)}.`);
  
  // Start the game loop
  requestAnimationFrame(gameLoop);
}

// Export global objects and functions for use in other modules
function exportGlobals() {
  window.player = player;
  window.worldMap = worldMap;
  window.castRay = castRay;
  window.log = log;
  window.fov = fov;
  window.screenW = screenW;
  window.screenH = screenH;
  window.ctx = ctx;
  window.animX = animX;
  window.animY = animY;
  window.dirDeltas = dirDeltas;
  window.canMoveTo = canMoveTo;
  window.startMoveAnimation = startMoveAnimation;
  window.startTurnAnimation = startTurnAnimation;
  window.directionToString = directionToString;
  window.fireballs = fireballs;
  window.fireballCooldown = fireballCooldown;
  window.FIREBALL_COOLDOWN_MS = FIREBALL_COOLDOWN_MS;
  window.FIREBALL_SPEED = FIREBALL_SPEED;
  window.FIREBALL_SIZE = FIREBALL_SIZE;
}

// Initialize the engine
window.addEventListener("load", function() {
  // Check that all necessary components are loaded before initializing
  if (window.Entity && window.EntityManager) {
    initEngine();
  } else {
    console.error("Required components (Entity, EntityManager) not found. Check script loading.");
  }
});