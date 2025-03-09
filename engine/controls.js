// controls.js - Input handling for the WebGL version
// Non-module version

// State flags for continuous movement
window.moveForward = false;
window.moveBackward = false;
window.moveLeft = false;
window.moveRight = false;

// SCALE_FACTOR will be provided by webgl-engine.js
// DO NOT declare it here to avoid redeclaration errors

// Reference to player object (will be set during initialization)
let playerRef = null;
let worldMapRef = null;

// Base direction deltas without scaling
function dirDeltas(d) {
  // 0=North: (0,-1), 1=East: (1,0), 2=South: (0,1), 3=West: (-1,0)
  switch(d) {
    case 0: return [0, -1];
    case 1: return [1, 0];
    case 2: return [0, 1];
    case 3: return [-1, 0];
  }
  return [0, 0];
}

// Scaled direction deltas for WebGL movement
function getScaledDirectionDeltas(d) {
  const base = dirDeltas(d);
  // Use window.SCALE_FACTOR which is set by webgl-engine.js
  return [base[0] * window.SCALE_FACTOR, base[1] * window.SCALE_FACTOR];
}

// Direction to angle conversion
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

// Collision detection for movement
function canMoveTo(nx, ny) {
  if (!worldMapRef) return false;
  
  // Convert from scaled coordinates back to map coordinates for collision
  const mapX = nx / window.SCALE_FACTOR;
  const mapY = ny / window.SCALE_FACTOR;
  
  const tileX = Math.floor(mapX);
  const tileY = Math.floor(mapY);
  
  // Check map boundaries
  if (tileX < 0 || tileY < 0 || 
      tileX >= window.mapWidth || tileY >= window.mapHeight) {
    return false;
  }
  
  // Check if tile is a wall
  return worldMapRef[tileY][tileX] === 0;
}

// Movement & turning animation functions
function startMoveAnimation(tx, ty) {
  if (!playerRef) {
    console.error("playerRef is not defined in startMoveAnimation! Using window.player instead.");
    if (window.player) {
      playerRef = window.player;
    } else {
      console.error("No player reference available. Movement cannot be performed.");
      return;
    }
  }
  
  if (playerRef.isMoving || playerRef.isTurning) return;
  
  playerRef.isMoving = true;
  playerRef.moveStartTime = performance.now();
  playerRef.startX = playerRef.x;
  playerRef.startY = playerRef.y;
  playerRef.endX = tx;
  playerRef.endY = ty;
  
  // Use global log function if available
  if (typeof window.log === 'function') {
    window.log(`Moving to (${Math.floor(tx/window.SCALE_FACTOR)},${Math.floor(ty/window.SCALE_FACTOR)})`);
  } else {
    console.log(`Moving to (${Math.floor(tx/window.SCALE_FACTOR)},${Math.floor(ty/window.SCALE_FACTOR)})`);
  }
}

function startTurnAnimation(newDir) {
  if (!playerRef) {
    console.error("playerRef is not defined in startTurnAnimation! Using window.player instead.");
    if (window.player) {
      playerRef = window.player;
    } else {
      console.error("No player reference available. Turn cannot be performed.");
      return;
    }
  }
  
  if (playerRef.isMoving || playerRef.isTurning) return;
  
  playerRef.isTurning = true;
  playerRef.turnStartTime = performance.now();
  playerRef.startAngle = playerRef.angle;
  playerRef.direction = newDir;
  
  // Calculate new angle based on direction
  playerRef.endAngle = dirToAngle(newDir);
  
  // Fix for the turning direction - always turn the shorter way
  var diff = playerRef.endAngle - playerRef.startAngle;
  
  // Handle wrapping around
  if (diff > Math.PI) {
    // If difference is more than 180 degrees one way, go the other way
    playerRef.startAngle += 2 * Math.PI;
  } else if (diff < -Math.PI) {
    // If difference is more than 180 degrees the other way, go the first way
    playerRef.endAngle += 2 * Math.PI;
  }
  
  if (typeof window.log === 'function') {
    window.log(`Turning to face ${directionToString(newDir)}`);
  } else {
    console.log(`Turning to face ${directionToString(newDir)}`);
  }
}

// Turn functions
function turnLeft() {
  if (!playerRef) {
    console.error("playerRef is not defined in turnLeft! Using window.player instead.");
    if (window.player) {
      playerRef = window.player;
    } else {
      console.error("No player reference available. Turn cannot be performed.");
      return;
    }
  }
  
  if (playerRef.isMoving || playerRef.isTurning) return;
  
  // Turn counter-clockwise (add 3 and mod 4 = subtract 1 with wrapping)
  const newDir = (playerRef.direction + 3) % 4;
  console.log(`Turning left from ${directionToString(playerRef.direction)} to ${directionToString(newDir)}`);
  startTurnAnimation(newDir);
}

function turnRight() {
  if (!playerRef) {
    console.error("playerRef is not defined in turnRight! Using window.player instead.");
    if (window.player) {
      playerRef = window.player;
    } else {
      console.error("No player reference available. Turn cannot be performed.");
      return;
    }
  }
  
  if (playerRef.isMoving || playerRef.isTurning) return;
  
  // Turn clockwise (add 1 and mod 4)
  const newDir = (playerRef.direction + 1) % 4;
  console.log(`Turning right from ${directionToString(playerRef.direction)} to ${directionToString(newDir)}`);
  startTurnAnimation(newDir);
}

// Handle continuous movement - called from animation loop
function updateContinuousMovement() {
  try {
    if (!playerRef) {
      console.error("playerRef is not defined in updateContinuousMovement! Using window.player instead.");
      if (window.player) {
        playerRef = window.player;
      } else {
        console.error("No player reference available. Movement cannot be performed.");
        return;
      }
    }
    
    if (!worldMapRef) {
      console.error("worldMapRef is not defined! Using window.worldMap instead.");
      if (window.worldMap) {
        worldMapRef = window.worldMap;
      } else {
        console.error("No world map reference available. Movement checks cannot be performed.");
        return;
      }
    }
    
    // Skip if player is already moving or turning
    if (playerRef.isMoving || playerRef.isTurning) return;
    
    // Forward movement (W)
    if (window.moveForward) {
      const delta = getScaledDirectionDeltas(playerRef.direction);
      const nx = Math.floor(playerRef.x / window.SCALE_FACTOR) * window.SCALE_FACTOR + delta[0];
      const ny = Math.floor(playerRef.y / window.SCALE_FACTOR) * window.SCALE_FACTOR + delta[1];
      
      if (canMoveTo(nx + 0.5 * window.SCALE_FACTOR, ny + 0.5 * window.SCALE_FACTOR)) {
        console.log(`Moving forward to (${nx + 0.5 * window.SCALE_FACTOR}, ${ny + 0.5 * window.SCALE_FACTOR})`);
        startMoveAnimation(nx + 0.5 * window.SCALE_FACTOR, ny + 0.5 * window.SCALE_FACTOR);
        return; // Only one movement per frame
      }
    }
    
    // Backward movement (S)
    if (window.moveBackward) {
      const delta = getScaledDirectionDeltas(playerRef.direction);
      const nx = Math.floor(playerRef.x / window.SCALE_FACTOR) * window.SCALE_FACTOR - delta[0];
      const ny = Math.floor(playerRef.y / window.SCALE_FACTOR) * window.SCALE_FACTOR - delta[1];
      
      if (canMoveTo(nx + 0.5 * window.SCALE_FACTOR, ny + 0.5 * window.SCALE_FACTOR)) {
        console.log(`Moving backward to (${nx + 0.5 * window.SCALE_FACTOR}, ${ny + 0.5 * window.SCALE_FACTOR})`);
        startMoveAnimation(nx + 0.5 * window.SCALE_FACTOR, ny + 0.5 * window.SCALE_FACTOR);
        return; // Only one movement per frame
      }
    }
    
    // Strafe left (A)
    if (window.moveLeft) {
      const leftDir = (playerRef.direction + 3) % 4;
      const delta = getScaledDirectionDeltas(leftDir);
      const nx = Math.floor(playerRef.x / window.SCALE_FACTOR) * window.SCALE_FACTOR + delta[0];
      const ny = Math.floor(playerRef.y / window.SCALE_FACTOR) * window.SCALE_FACTOR + delta[1];
      
      if (canMoveTo(nx + 0.5 * window.SCALE_FACTOR, ny + 0.5 * window.SCALE_FACTOR)) {
        console.log(`Strafing left to (${nx + 0.5 * window.SCALE_FACTOR}, ${ny + 0.5 * window.SCALE_FACTOR})`);
        startMoveAnimation(nx + 0.5 * window.SCALE_FACTOR, ny + 0.5 * window.SCALE_FACTOR);
        return; // Only one movement per frame
      }
    }
    
    // Strafe right (D)
    if (window.moveRight) {
      const rightDir = (playerRef.direction + 1) % 4;
      const delta = getScaledDirectionDeltas(rightDir);
      const nx = Math.floor(playerRef.x / window.SCALE_FACTOR) * window.SCALE_FACTOR + delta[0];
      const ny = Math.floor(playerRef.y / window.SCALE_FACTOR) * window.SCALE_FACTOR + delta[1];
      
      if (canMoveTo(nx + 0.5 * window.SCALE_FACTOR, ny + 0.5 * window.SCALE_FACTOR)) {
        console.log(`Strafing right to (${nx + 0.5 * window.SCALE_FACTOR}, ${ny + 0.5 * window.SCALE_FACTOR})`);
        startMoveAnimation(nx + 0.5 * window.SCALE_FACTOR, ny + 0.5 * window.SCALE_FACTOR);
        return; // Only one movement per frame
      }
    }
  } catch (e) {
    console.error("Error in updateContinuousMovement:", e);
  }
}

// Set up button event listeners and keyboard controls
function setupControls(player, worldMap) {
  console.log("Setting up controls...");
  
  // Store references to globally provided objects
  playerRef = player;
  worldMapRef = worldMap;
  
  console.log("PlayerRef set:", playerRef ? "YES" : "NO");
  console.log("WorldMapRef set:", worldMapRef ? "YES" : "NO");
  
  // Make sure SCALE_FACTOR is available from webgl-engine.js
  if (typeof window.SCALE_FACTOR === 'undefined') {
    console.error("SCALE_FACTOR not found! Controls may not work correctly.");
    window.SCALE_FACTOR = 2.0; // Fallback default
  } 
  
  console.log(`Controls using SCALE_FACTOR: ${window.SCALE_FACTOR}`);
  
  // Button event listeners
  const btnForward = document.getElementById("btnForward");
  if (btnForward) {
    btnForward.addEventListener('mousedown', function() { 
      window.moveForward = true; 
      console.log("Forward button pressed");
    });
    btnForward.addEventListener('mouseup', function() { 
      window.moveForward = false; 
    });
    btnForward.addEventListener('mouseleave', function() { 
      window.moveForward = false; 
    });
  }
  
  const btnBack = document.getElementById("btnBack");
  if (btnBack) {
    btnBack.addEventListener('mousedown', function() { 
      window.moveBackward = true;
      console.log("Back button pressed");
    });
    btnBack.addEventListener('mouseup', function() { 
      window.moveBackward = false; 
    });
    btnBack.addEventListener('mouseleave', function() { 
      window.moveBackward = false; 
    });
  }
  
  const btnTurnLeft = document.getElementById("btnTurnLeft");
  if (btnTurnLeft) {
    btnTurnLeft.addEventListener('click', function() {
      turnLeft();
    });
  }
  
  const btnTurnRight = document.getElementById("btnTurnRight");
  if (btnTurnRight) {
    btnTurnRight.addEventListener('click', function() {
      turnRight();
    });
  }
  
  const btnStrafeLeft = document.getElementById("btnStrafeLeft");
  if (btnStrafeLeft) {
    btnStrafeLeft.addEventListener('mousedown', function() { 
      window.moveLeft = true; 
      console.log("Strafe Left button pressed");
    });
    btnStrafeLeft.addEventListener('mouseup', function() { 
      window.moveLeft = false; 
    });
    btnStrafeLeft.addEventListener('mouseleave', function() { 
      window.moveLeft = false; 
    });
  }
  
  const btnStrafeRight = document.getElementById("btnStrafeRight");
  if (btnStrafeRight) {
    btnStrafeRight.addEventListener('mousedown', function() { 
      window.moveRight = true; 
      console.log("Strafe Right button pressed");
    });
    btnStrafeRight.addEventListener('mouseup', function() { 
      window.moveRight = false; 
    });
    btnStrafeRight.addEventListener('mouseleave', function() { 
      window.moveRight = false; 
    });
  }
  
  // Fixed keyboard control mappings - using standard WASD layout
document.addEventListener('keydown', function(e) {
  if (e.code === 'KeyW') window.moveForward = true;
  if (e.code === 'KeyS') window.moveBackward = true;
  if (e.code === 'KeyA') window.moveLeft = true;
  if (e.code === 'KeyD') window.moveRight = true;
  if (e.code === 'KeyQ') turnLeft();
  if (e.code === 'KeyE') turnRight();
});

document.addEventListener('keyup', function(e) {
  if (e.code === 'KeyW') window.moveForward = false;
  if (e.code === 'KeyS') window.moveBackward = false;
  if (e.code === 'KeyA') window.moveLeft = false;
  if (e.code === 'KeyD') window.moveRight = false;
});

  
  console.log("WebGL controls initialized");
}

// Export all the necessary functions to the global scope
window.setupControls = setupControls;
window.updateContinuousMovement = updateContinuousMovement;
window.dirDeltas = dirDeltas;
window.getScaledDirectionDeltas = getScaledDirectionDeltas;
window.dirToAngle = dirToAngle;
window.directionToString = directionToString;
window.canMoveTo = canMoveTo;
window.startMoveAnimation = startMoveAnimation;
window.startTurnAnimation = startTurnAnimation;
window.turnLeft = turnLeft;
window.turnRight = turnRight;

// Initialize on load
window.addEventListener("load", function() {
  console.log("controls.js loaded and ready");
});