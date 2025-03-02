// beholder.js - Main game file for Might of the Beholder
// This ties together all the components and manages the game state

// Function to load game components in sequence
function loadGameScripts(callback) {
  var scriptsToLoad = [
    'game/monsters.js',
    'game/projectiles.js'
  ];
  
  // Keep track of loaded scripts
  var loadedCount = 0;
  
  // Function to handle when a script is loaded
  function scriptLoaded() {
    loadedCount++;
    if (loadedCount === scriptsToLoad.length && callback) {
      callback();
    }
  }
  
  // Load each script
  for (var i = 0; i < scriptsToLoad.length; i++) {
    var script = document.createElement('script');
    script.src = scriptsToLoad[i];
    script.onload = scriptLoaded;
    document.head.appendChild(script);
  }
}

// Create global entityManager
var entityManager; 

// Game state
var gameState = {
  level: 1,
  playerHealth: 100,
  playerMaxHealth: 100,
  score: 0,
  gameOver: false,
  victory: false
};

// Function to check if worldMap is properly initialized
function validateWorldMap() {
  if (!window.worldMap) {
    console.error("worldMap is undefined!");
    return false;
  }
  
  if (!Array.isArray(window.worldMap)) {
    console.error("worldMap is not an array!");
    return false;
  }
  
  if (window.worldMap.length === 0) {
    console.error("worldMap is empty!");
    return false;
  }
  
  if (!Array.isArray(window.worldMap[0])) {
    console.error("worldMap[0] is not an array!");
    return false;
  }
  
  console.log(`worldMap validated: ${window.worldMap.length} rows × ${window.worldMap[0].length} columns`);
  return true;
}

// Call this at initialization and periodically
function setupWorldMapValidation() {
  // Initial validation
  validateWorldMap();
  
  // Add periodic validation (every 2 seconds)
  setInterval(() => {
    validateWorldMap();
  }, 2000);
  
  // Also validate before shooting fireballs
  const originalShootFireball = shootFireballFromCharacter;
  window.shootFireballFromCharacter = function(charIndex) {
    validateWorldMap();
    return originalShootFireball(charIndex);
  };
}


function initGame() {
  console.log("Initializing Might of the Beholder...");
  
  // Make sure Entity and EntityManager exist
  if (!window.Entity || !window.EntityManager) {
    console.error("Entity or EntityManager not found. Make sure entity.js is loaded first.");
    setTimeout(initGame, 100); // Retry after a delay
    return;
  }
  
  // Check for worldMap
  if (!window.worldMap) {
    console.warn("worldMap not found, waiting for engine.js to initialize it...");
    setTimeout(initGame, 100); // Retry after a delay
    return;
  }
  
  // Create entity manager
  entityManager = new EntityManager();
  
  // Let the console know initGame is running with worldMap
  console.log("World map found, continuing initialization...");
  console.log("World map dimensions:", window.worldMap.length, "x", window.worldMap[0].length);
  
  // Add this line to set up the worldMap validation
  setupWorldMapValidation();
  
  // Load game components
  loadGameScripts(function() {
    // Once components are loaded, set up the game
    console.log("Game components loaded!");
    
    // Set up the level
    loadLevel(gameState.level);
    
    // Set up character abilities
    setupCharacterAbilities();
    
    // Set up test entities
    try {
      spawnTestEntities();
    } catch (e) {
      console.error("Failed to spawn test entities:", e);
    }
    
    // Export update and render functions
    window.updateGame = updateGame;
    window.renderGameEntities = renderGameEntities;
    window.renderEntitiesOnMinimap = renderEntitiesOnMinimap;
  });
}



// Load a specific level
function loadLevel(levelNum) {
  console.log(`Loading level ${levelNum}...`);
  
  // For now we don't need to do anything as the map is defined in engine.js
}

// Character abilities
function setupCharacterAbilities() {
  // Fireball buttons
  document.getElementById("char1Fireball").onclick = function() { shootFireballFromCharacter(0); };
  document.getElementById("char2Fireball").onclick = function() { shootFireballFromCharacter(1); };
  document.getElementById("char3Fireball").onclick = function() { shootFireballFromCharacter(2); };
  document.getElementById("char4Fireball").onclick = function() { shootFireballFromCharacter(3); };
}

// Test function to spawn entities for testing
function spawnTestEntities() {
  console.log("Spawning test entities...");
  
  // Make sure required functions exist
  if (typeof spawnMonster !== 'function') {
    console.error("spawnMonster function not found! Monsters not loaded properly.");
    return;
  }
  
  // Spawn a skeleton at position (5.5, 5.5)
  spawnMonster(entityManager, "skeleton", 5.5, 5.5);
  spawnMonster(entityManager, "skeleton", 15.5, 12.5);
  
  // Spawn an orc at position (8.5, 8.5)
  spawnMonster(entityManager, "orc", 8.5, 6.5);
  spawnMonster(entityManager, "orc", 5.5, 14.5);
	
  // Spawn a wizard at position (10.5, 3.5)
  spawnMonster(entityManager, "wizard", 9.5, 4.5);
  
  // Add a patrolling spider
  const patrolPoints = [
    {x: 15.5, y: 6.5},
    {x: 15.5, y: 10.5},
    {x: 12.5, y: 10.5},
    {x: 12.5, y: 6.5}
  ];
  
  spawnMonster(entityManager, "spider", 15.5, 6.5, {
    patrolPoints: patrolPoints
  });
  
  console.log("Test entities spawned successfully!");
}

// Enhanced fireball function that uses the projectile system
function shootFireballFromCharacter(charIndex) {
  // Make sure we have the player object
  if (!window.player) {
    console.error("Player not defined!");
    return;
  }
  
  // Make sure we have the projectile system
  if (typeof shootProjectile !== 'function') {
    console.error("shootProjectile function not found!");
    return;
  }
  
  // Make sure cooldown variables exist
  if (!window.fireballCooldown || !window.FIREBALL_COOLDOWN_MS) {
    console.error("Fireball cooldown variables not found!");
    return;
  }
  
  const now = performance.now();
  
  // Check cooldown
  if (now < window.fireballCooldown[charIndex]) {
    log(`Character ${charIndex+1} can't cast fireball yet! (Cooldown)`);
    return;
  }
  
  // Set cooldown
  window.fireballCooldown[charIndex] = now + window.FIREBALL_COOLDOWN_MS;
  
  try {
    // Create a projectile using our new system
    const projectile = shootProjectile(
      entityManager,
      "fireball",
      player,
      player.angle,
      {
        castRay: window.castRay,
        damage: 10 + (charIndex * 2) // Different damage based on character
      }
    );
    
    log(`Character ${charIndex+1} cast a fireball!`);
    return projectile;
  } catch (e) {
    console.error("Error shooting fireball:", e);
    log(`Error casting fireball!`);
    return null;
  }
}

// Update all game entities - with guaranteed safe worldMap access
function updateGame(dt) {
  // Skip if not initialized
  if (!entityManager) return;
  
  // Skip if game over
  if (gameState.gameOver) return;
  
  try {
    // Update all entities
    entityManager.update(dt);
    
    // Make sure player exists
    if (!window.player) {
      console.error("Player object not found!");
      return;
    }
    
    // Get a secure copy of worldMap - very important to do this only once
    // This prevents race conditions where worldMap might change during the update
    let worldMapCopy = null;
    if (window.worldMap && Array.isArray(window.worldMap) && 
        window.worldMap.length > 0 && Array.isArray(window.worldMap[0])) {
      worldMapCopy = window.worldMap;
    } else {
      console.warn("worldMap unavailable during update cycle");
    }
    
    // Update all monsters (with extra parameters)
    try {
      const monsters = entityManager.getByType("monster");
      for (const monster of monsters) {
        if (monster && typeof monster.update === 'function') {
          // Pass player, worldMap and castRay to update
          monster.update(dt, window.player, worldMapCopy, window.castRay);
        }
      }
    } catch (e) {
      console.error("Error updating monsters:", e);
    }
    
    // Update all projectiles (with extra parameters)
    try {
      const projectiles = entityManager.getByType("projectile");
      
      for (const projectile of projectiles) {
        if (projectile && typeof projectile.update === 'function') {
          // Always pass the same worldMapCopy - this is crucial
          projectile.update(dt, entityManager.getAllEntities(), worldMapCopy);
        }
      }
    } catch (e) {
      console.error("Error updating projectiles:", e);
    }
    
    // Check for game over conditions
    if (gameState.playerHealth <= 0) {
      gameState.gameOver = true;
      log("Game Over! You have been defeated.");
    }
    
    // Check for victory conditions
    const remainingMonsters = entityManager.getByType("monster").filter(m => m.active);
    if (remainingMonsters.length === 0 && entityManager.getByType("monster").length > 0) {
      gameState.victory = true;
      log("Victory! All monsters have been defeated.");
    }
  } catch (e) {
    console.error("Error in updateGame:", e);
  }
}

// Render game entities
function renderGameEntities() {
  // Skip if not initialized
  if (!entityManager) return;
  
  try {
    // Make sure required variables exist
    if (!window.ctx || !window.player || !window.screenW || 
        !window.screenH || !window.fov || !window.castRay) {
      console.error("Required rendering variables not found!");
      return;
    }
    
    // Render all entities
    entityManager.render(window.ctx, window.player, window.screenW, window.screenH, window.fov, window.castRay);
  } catch (e) {
    console.error("Error in renderGameEntities:", e);
  }
}

// Render entities on minimap
function renderEntitiesOnMinimap(miniCtx, tileSize) {
  // Skip if not initialized
  if (!entityManager) return;
  
  try {
    entityManager.renderMinimap(miniCtx, tileSize);
  } catch (e) {
    console.error("Error in renderEntitiesOnMinimap:", e);
  }
}

// Button cooldown animation system
function setupCooldownButtons() {
  // Add CSS for cooldown animations
  const style = document.createElement('style');
  style.textContent = `
    .btn {
      position: relative;
      overflow: hidden;
    }
    
    .btn.cooldown {
      cursor: default;
      opacity: 0.7;
    }
    
    .cooldown-overlay {
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      width: 100%;
      background-color: rgba(0, 0, 0, 0.6);
      pointer-events: none;
      transition: width linear;
    }
  `;
  document.head.appendChild(style);
  
  // Apply cooldown effect to fireball buttons
  document.getElementById("char1Fireball").addEventListener("click", function() {
    applyCooldown(this, window.FIREBALL_COOLDOWN_MS);
  });
  
  document.getElementById("char2Fireball").addEventListener("click", function() {
    applyCooldown(this, window.FIREBALL_COOLDOWN_MS);
  });
  
  document.getElementById("char3Fireball").addEventListener("click", function() {
    applyCooldown(this, window.FIREBALL_COOLDOWN_MS);
  });
  
  document.getElementById("char4Fireball").addEventListener("click", function() {
    applyCooldown(this, window.FIREBALL_COOLDOWN_MS);
  });
}

// Apply cooldown effect to a button
function applyCooldown(button, duration) {
  // Check if already in cooldown
  if (button.classList.contains('cooldown')) {
    return;
  }
  
  // Add cooldown class
  button.classList.add('cooldown');
  
  // Create cooldown overlay if it doesn't exist
  let overlay = button.querySelector('.cooldown-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'cooldown-overlay';
    button.appendChild(overlay);
  }
  
  // Reset overlay width to full
  overlay.style.width = '100%';
  
  // Force reflow to ensure animation runs
  overlay.offsetWidth;
  
  // Set transition duration
  overlay.style.transitionDuration = (duration / 1000) + 's';
  
  // Start animation
  requestAnimationFrame(() => {
    overlay.style.width = '0%';
  });
  
  // Remove cooldown when animation completes
  setTimeout(() => {
    button.classList.remove('cooldown');
    if (overlay && button.contains(overlay)) {
      overlay.style.width = '0%';
    }
  }, duration);
}

// Function to disable firing when in cooldown
function getButtonCooldownStatus(characterIndex) {
  const buttonIds = ["char1Fireball", "char2Fireball", "char3Fireball", "char4Fireball"];
  const button = document.getElementById(buttonIds[characterIndex]);
  
  if (!button) return false;
  return button.classList.contains('cooldown');
}

// Update the shootFireballFromCharacter function
function updateShootFireballFunction() {
  // With our enhanced function in place, we don't need to replace it
  console.log("Using enhanced fireball function with proper cooldown checks");
}

// Initialize cooldown system
window.addEventListener("load", function() {
  setTimeout(() => {
    setupCooldownButtons();
    updateShootFireballFunction();
    console.log("Cooldown button system initialized");
  }, 500); // Small delay to ensure other elements are loaded
});


// Initialize game when window loads
window.addEventListener("load", function() {
  // Add a small delay to make sure everything is loaded
  setTimeout(initGame, 100);
});


// Attack effect variables
let attackEffectActive = false;
let attackEffectStartTime = 0;
let attackMonsterScreenX = 0;
let attackMonsterWidth = 0;
const ATTACK_EFFECT_DURATION = 800; // Shortened duration

function triggerMonsterAttack(monsterScreenX, monsterWidth) {
  attackEffectActive = true;
  attackEffectStartTime = performance.now();
  attackMonsterScreenX = monsterScreenX;
  attackMonsterWidth = monsterWidth;
  
  // Create custom font face
  const fontFace = new FontFace('Bloody Sisters', 'url(assets/fonts/Bloody\ Sisters\ Night\ Club.ttf)');
  document.fonts.add(fontFace);
  
  // Create attack text element
  const attackText = document.createElement('div');
  attackText.id = 'monster-attack-text';
  attackText.innerHTML = 'ATTACK!';
  attackText.style.position = 'fixed';
  attackText.style.top = '50%';
  
  // Measure text width and adjust horizontal position
  const tempDiv = document.createElement('div');
  tempDiv.style.visibility = 'hidden';
  tempDiv.style.position = 'absolute';
  tempDiv.style.fontSize = '5rem';
  tempDiv.style.fontFamily = "'Bloody Sisters', sans-serif";
  tempDiv.innerHTML = 'ATTACK!';
  document.body.appendChild(tempDiv);
  const textWidth = tempDiv.offsetWidth;
  document.body.removeChild(tempDiv);

  // Adjust left position to center the text
  const adjustedLeft = monsterScreenX - (textWidth / 2);

  attackText.style.left = `${adjustedLeft}px`;
  attackText.style.width = `${textWidth}px`;
  attackText.style.textAlign = 'center';
  attackText.style.transformOrigin = 'center center';
  attackText.style.fontSize = '4rem';
  attackText.style.fontFamily = "'Bloody Sisters', sans-serif";
  attackText.style.fontWeight = 'bold';
  attackText.style.color = 'darkred';
  attackText.style.zIndex = '1000';
  attackText.style.opacity = '0';
  attackText.style.textShadow = '0 0 3px rgba(255,0,0,0.7)';
  attackText.style.transform = 'translate(-50%, -50%)';  // Ensure true centering
  
  // Add to document
  document.body.appendChild(attackText);

  
  // Animate attack text
  requestAnimationFrame(function animateAttackText() {
    const elapsed = performance.now() - attackEffectStartTime;
    const progress = Math.min(elapsed / ATTACK_EFFECT_DURATION, 1);
    
  // Initial scale starts huge and quickly reduces
  // Higher first number = larger initial size
  // Second number controls how fast it shrinks
  const initialScale = 3.5 - (progress * 1.5);
  
  // Bounce effect parameters:
  // First multiplier (12) controls bounce frequency - higher = more rapid bounces
  // Second multiplier (150) controls initial bounce height - higher = more dramatic first bounce
  // (1 - progress) * X controls decay - lower X means bounce dies out faster
  const bounce = Math.sin(progress * Math.PI * 12) * (1 - progress) * 50;
    
    // Opacity with sharp initial rise
    const opacity = Math.min(Math.sin(progress * Math.PI), 1);
    
    attackText.style.transform = `translate(-50%, ${-50 + bounce}%) scale(${initialScale})`;
    attackText.style.opacity = opacity;
    
    if (progress < 1) {
      requestAnimationFrame(animateAttackText);
    } else {
      document.body.removeChild(attackText);
      attackEffectActive = false;
    }
  });
}

// Modify the attack rendering to add a screen flash
function renderAttackEffect(ctx, screenW, screenH) {
  if (!attackEffectActive) return;
  
  const elapsed = performance.now() - attackEffectStartTime;
  const progress = Math.min(elapsed / ATTACK_EFFECT_DURATION, 1);
  
  // Sharp, sudden red flash with quick fade
  const opacity = Math.sin(progress * Math.PI) * 0.6;
  
  ctx.fillStyle = `rgba(255, 0, 0, ${opacity})`;
  ctx.fillRect(0, 0, screenW, screenH);
}

// Export functions
window.triggerMonsterAttack = triggerMonsterAttack;
window.renderAttackEffect = renderAttackEffect;