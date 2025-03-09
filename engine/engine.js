// Add this at the beginning of engine.js

// ==================== ENGINE COMPONENT LOADING ====================
// Function to load all engine components in the correct order
function loadEngineComponents(callback) {
  var componentsToLoad = [
    // Core components
    'engine/entity.js',      // Entity system
    'engine/controls.js',    // Input handling
    'engine/player.js',      // Player functionality
    
    // WebGL and rendering components
    'engine/shader-lib.js',      // GLSL shaders
    'engine/webgl-debug.js',     // WebGL diagnostics
    'engine/webgl-renderer.js',  // WebGL implementation
    'engine/webgl-integration.js', // WebGL integration
    
    // Lighting components
    'engine/normal.js',            // Normal mapping
    'engine/lighting.js',          // Lighting system
    'engine/lighting-integration.js' // Lighting integration
  ];
  
  // Keep track of loaded components
  var loadedCount = 0;
  
  // Function to handle when a component is loaded
  function componentLoaded() {
    loadedCount++;
    if (loadedCount === componentsToLoad.length && callback) {
      console.log("All engine components loaded successfully!");
      callback();
    }
  }
  
  // Load each component
  for (var i = 0; i < componentsToLoad.length; i++) {
    var script = document.createElement('script');
    script.src = componentsToLoad[i];
    script.onload = componentLoaded;
    document.head.appendChild(script);
  }
}

// Load components before initializing the engine
window.addEventListener("load", function() {
  loadEngineComponents(function() {
    // Initialize engine once all components are loaded
    initEngine();
  });
});

// Add this to replace the initialization at the bottom of engine.js
// Remove the original window.addEventListener("load", ...) at the bottom

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
  
  // Set up WebGL rendering if available
  initializeWebGL();
  
  // Start the game loop
  requestAnimationFrame(gameLoop);
}

// Initialize WebGL rendering
function initializeWebGL() {
  // Create the WebGL renderer if it doesn't exist
  if (!window.renderer && window.RendererFactory) {
    try {
      window.renderer = window.RendererFactory.createRenderer(canvas, {
        quality: 'medium',
        useNormalMapping: true,
        ambientLight: 0.2
      });
      window.usingWebGL = window.renderer instanceof window.WebGLRenderer;
      console.log(`Created ${window.usingWebGL ? 'WebGL' : 'Canvas'} renderer`);
    } catch (error) {
      console.warn("Could not initialize WebGL renderer:", error);
      window.usingWebGL = false;
    }
  }
  
  // Set up FPS counter
  setupFPSCounter();
  
  // Enable enhanced lighting by default
  if (typeof window.useEnhancedLighting !== 'undefined') {
    window.useEnhancedLighting = true;
  }
}

// Create FPS counter
function setupFPSCounter() {
  // Create FPS display element if it doesn't exist
  if (!document.getElementById('fps-counter')) {
    const fpsCounter = document.createElement('div');
    fpsCounter.id = 'fps-counter';
    fpsCounter.style.position = 'fixed';
    fpsCounter.style.top = '10px';
    fpsCounter.style.right = '10px';
    fpsCounter.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    fpsCounter.style.color = '#00FF00';
    fpsCounter.style.padding = '5px 10px';
    fpsCounter.style.borderRadius = '4px';
    fpsCounter.style.fontFamily = 'monospace';
    fpsCounter.style.fontSize = '14px';
    fpsCounter.style.zIndex = '1000';
    fpsCounter.style.display = 'none'; // Hidden by default
    fpsCounter.textContent = 'FPS: --';
    
    document.body.appendChild(fpsCounter);
    window.fpsElement = fpsCounter;
  }
  
  // Initialize FPS tracking variables
  window.fpsCounter = 0;
  window.fpsLastUpdate = 0;
  window.fps = 0;
  
  // Create toggle function
  window.toggleFPSCounter = function() {
    if (window.fpsElement) {
      window.fpsElement.style.display = 
        window.fpsElement.style.display === 'none' ? 'block' : 'none';
    } else if (window.renderer && window.renderer.toggleFPS) {
      window.renderer.toggleFPS();
    }
  };
  
  // Keyboard shortcut for FPS counter
  document.addEventListener('keydown', function(e) {
    if (e.key.toLowerCase() === 'f') {
      window.toggleFPSCounter();
    }
  });
}

// Update FPS counter in the game loop
function updateFPS(timestamp) {
  window.fpsCounter++;
  
  // Update every second
  if (!window.fpsLastUpdate) {
    window.fpsLastUpdate = timestamp;
  }
  
  const elapsed = timestamp - window.fpsLastUpdate;
  if (elapsed >= 1000) {
    window.fps = Math.round((window.fpsCounter * 1000) / elapsed);
    
    if (window.fpsElement) {
      window.fpsElement.textContent = `FPS: ${window.fps}`;
      
      // Color based on performance
      if (window.fps >= 45) {
        window.fpsElement.style.color = '#00FF00'; // Green
      } else if (window.fps >= 30) {
        window.fpsElement.style.color = '#FFFF00'; // Yellow
      } else {
        window.fpsElement.style.color = '#FF0000'; // Red
      }
    }
    
    window.fpsCounter = 0;
    window.fpsLastUpdate = timestamp;
  }
}

// Enhance game loop with FPS counter and WebGL support
// Modify the existing gameLoop function in engine.js to include this:

// Add at the beginning of gameLoop:
function gameLoop(time) {
  var dt = time - lastTime;
  lastTime = time;
  
  // Update player movement and turning animations
  updatePlayerAnimations(dt);
  
  // Update player position in WebGL renderer if available
  if (window.usingWebGL && window.renderer && window.renderer.updatePlayer) {
    window.renderer.updatePlayer(player);
  }
  
  // Update game entities
  if (window.updateGame) {
    window.updateGame(dt);
  }
  
  // Update lighting system if available
  if (window.lightingManager && window.lightingManager.update) {
    window.lightingManager.update(dt);
    
    // Update player torch position
    if (window.playerTorchId) {
      const torch = window.lightingManager.getById(window.playerTorchId);
      if (torch) {
        torch.x = animX();
        torch.y = animY();
      }
    }
  }
  
  // Update FPS counter
  updateFPS(time);
  
  // Render the frame
  if (window.usingWebGL && window.renderer) {
    // Use WebGL renderer
    window.renderer.render(
      worldMap,
      player,
      window.entityManager ? window.entityManager.getAllEntities() : [],
      fireballs
    );
    
    // Always draw minimap (not handled by WebGL)
    drawMiniMap();
    
    // Render attack effect if available
    if (window.renderAttackEffect) {
      window.renderAttackEffect(ctx, screenW, screenH);
    }
  } else {
    // Use original Canvas rendering
    renderFrame();
  }
  
  // Continue the loop
  requestAnimationFrame(gameLoop);
}
// End of Engine.js