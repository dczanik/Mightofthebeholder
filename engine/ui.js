// ui.js - UI elements and display functionality for the WebGL version
// Non-module version

// Log messages to the game console
function log(message) {
  const logPanel = document.getElementById("logPanel");
  const div = document.createElement("div");
  div.textContent = message;
  logPanel.appendChild(div);
  
  // Keep only the last 10 messages
  while (logPanel.children.length > 10) {
    logPanel.removeChild(logPanel.firstChild);
  }
}

// Update the minimap display
function updateMinimap(worldMap, player) {
  const miniCanvas = document.getElementById("miniMapCanvas");
  const miniCtx = miniCanvas.getContext("2d");
  const tileSize = 8;
  
  // Skip if canvas not ready
  if (!miniCanvas || !miniCtx) return;
  
  // Clear minimap
  miniCtx.fillStyle = "#222";
  miniCtx.fillRect(0, 0, miniCanvas.width, miniCanvas.height);
  
  // Draw map tiles
  for (let y = 0; y < worldMap.length; y++) {
    for (let x = 0; x < worldMap[0].length; x++) {
      const cell = worldMap[y][x];
      if (cell === 1) miniCtx.fillStyle = "#888";
      else if (cell === 2) miniCtx.fillStyle = "#c33";
      else miniCtx.fillStyle = "#333";
      miniCtx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
    }
  }
  
  // Draw player
  miniCtx.fillStyle = "red";
  miniCtx.beginPath();
  miniCtx.arc(player.x * tileSize, player.y * tileSize, 3, 0, Math.PI * 2);
  miniCtx.fill();
  
  // Draw player direction
  const dirLen = 10;
  const dx = Math.cos(player.angle) * dirLen;
  const dy = Math.sin(player.angle) * dirLen;
  miniCtx.strokeStyle = "red";
  miniCtx.beginPath();
  miniCtx.moveTo(player.x * tileSize, player.y * tileSize);
  miniCtx.lineTo(player.x * tileSize + dx, player.y * tileSize + dy);
  miniCtx.stroke();
  
  // Render entities on minimap if they exist
  if (window.entityManager && typeof window.renderEntitiesOnMinimap === 'function') {
    window.renderEntitiesOnMinimap(miniCtx, tileSize);
  }
  
  // Render projectiles on minimap if that function exists
  if (typeof window.renderProjectilesOnMinimap === 'function') {
    window.renderProjectilesOnMinimap(miniCtx, tileSize);
  }
}

// Setup character abilities and UI elements
function setupUI(shootFireballFromCharacter) {
  // Set up character ability buttons
  document.getElementById("char1Fireball").onclick = function() { 
    shootFireballFromCharacter(0); 
  };
  
  document.getElementById("char2Fireball").onclick = function() { 
    shootFireballFromCharacter(1); 
  };
  
  document.getElementById("char3Fireball").onclick = function() { 
    shootFireballFromCharacter(2); 
  };
  
  document.getElementById("char4Fireball").onclick = function() { 
    shootFireballFromCharacter(3); 
  };
  
  // Setup attack buttons when that functionality is implemented
  document.getElementById("attack1").onclick = function() {
    log("Character 1 attacks! (Not implemented)");
  };
  
  document.getElementById("attack2").onclick = function() {
    log("Character 2 attacks! (Not implemented)");
  };
  
  document.getElementById("attack3").onclick = function() {
    log("Character 3 attacks! (Not implemented)");
  };
  
  document.getElementById("attack4").onclick = function() {
    log("Character 4 attacks! (Not implemented)");
  };
  
  // Initialize global game state (to be expanded)
  window.gameState = {
    playerHealth: 100,
    playerMaxHealth: 100,
    score: 0,
    level: 1,
    gameOver: false,
    victory: false
  };
  
  // Show game state UI
  updateGameStateUI();
  
  console.log("WebGL UI initialized");
}

// Update game state display (health, score, etc.)
function updateGameStateUI() {
  // This can be expanded to show player health, score, etc.
  // For now we'll just set up the structure
  
  // Setup FPS counter if needed
  setupFPSCounter();
}

// FPS counter setup
function setupFPSCounter() {
  // Create FPS display if it doesn't exist
  if (!document.getElementById('fpsCounter')) {
    const fpsCounter = document.createElement('div');
    fpsCounter.id = 'fpsCounter';
    fpsCounter.style.position = 'absolute';
    fpsCounter.style.top = '10px';
    fpsCounter.style.right = '410px';
    fpsCounter.style.color = '#fff';
    fpsCounter.style.fontFamily = 'monospace';
    fpsCounter.style.zIndex = '1000';
    document.body.appendChild(fpsCounter);
    
    // Setup FPS calculation
    window.fpsDisplay = {
      frameCount: 0,
      lastTime: performance.now(),
      fps: 0
    };
  }
}

// Update FPS counter
function updateFPSCounter(time) {
  if (!window.fpsDisplay) return;
  
  window.fpsDisplay.frameCount++;
  
  // Update FPS every second
  if (time - window.fpsDisplay.lastTime >= 1000) {
    window.fpsDisplay.fps = Math.round(window.fpsDisplay.frameCount * 1000 / (time - window.fpsDisplay.lastTime));
    window.fpsDisplay.frameCount = 0;
    window.fpsDisplay.lastTime = time;
    
    // Update display
    const fpsCounter = document.getElementById('fpsCounter');
    if (fpsCounter) {
      fpsCounter.textContent = `FPS: ${window.fpsDisplay.fps}`;
    }
  }
}

// Make UI functions available globally
window.log = log;
window.updateMinimap = updateMinimap;
window.setupUI = setupUI;
window.updateGameStateUI = updateGameStateUI;
window.setupFPSCounter = setupFPSCounter;
window.updateFPSCounter = updateFPSCounter;