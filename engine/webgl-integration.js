// webgl-integration.js - WebGL integration with game engine
// Minimal version that works with engine.js loading architecture

// Initialize when DOM is ready
window.addEventListener('load', function() {
  // Setup will happen after engine.js loads all components
  console.log("WebGL integration module loaded");
});

// Create debug UI
function createWebGLDebugUI() {
  // Check if it already exists
  if (document.getElementById('webgl-debug-ui')) return;
  
  // Create container
  const container = document.createElement('div');
  container.id = 'webgl-debug-ui';
  container.style.position = 'fixed';
  container.style.bottom = '10px';
  container.style.left = '10px';
  container.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  container.style.color = 'white';
  container.style.padding = '10px';
  container.style.borderRadius = '5px';
  container.style.fontFamily = 'monospace';
  container.style.fontSize = '12px';
  container.style.zIndex = '1000';
  
  // Create title
  const title = document.createElement('div');
  title.textContent = 'WebGL Controls';
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '5px';
  container.appendChild(title);
  
  // Create control buttons
  const buttons = [
    { id: 'toggle-renderer', text: 'Toggle Renderer (R)', action: 'toggleRenderer' },
    { id: 'toggle-quality', text: 'Toggle Quality (T)', action: 'toggleRendererQuality' },
    { id: 'toggle-fps', text: 'Toggle FPS (F)', action: 'toggleFPSCounter' },
    { id: 'toggle-debug', text: 'Toggle Debug (D)', action: 'toggleDebugMode' }
  ];
  
  buttons.forEach(btn => {
    const button = document.createElement('button');
    button.id = btn.id;
    button.textContent = btn.text;
    button.style.display = 'block';
    button.style.width = '100%';
    button.style.marginBottom = '5px';
    button.style.padding = '5px';
    button.style.backgroundColor = '#333';
    button.style.color = 'white';
    button.style.border = 'none';
    button.style.borderRadius = '3px';
    button.style.cursor = 'pointer';
    
    // Add click handler
    button.onclick = function() {
      const action = btn.action;
      if (action === 'toggleRenderer' && window.toggleRenderer) {
        window.toggleRenderer();
      } 
      else if (action === 'toggleQuality' && window.toggleRendererQuality) {
        window.toggleRendererQuality();
      }
      else if (action === 'toggleFPS' && window.toggleFPSCounter) {
        window.toggleFPSCounter();
      }
      else if (action === 'toggleDebugMode') {
        toggleDebugMode();
      }
    };
    
    container.appendChild(button);
  });
  
  // Create status section
  const status = document.createElement('div');
  status.id = 'webgl-status';
  status.style.marginTop = '10px';
  status.style.padding = '5px';
  status.style.backgroundColor = '#222';
  status.style.borderRadius = '3px';
  
  // Add status info
  updateStatus();
  function updateStatus() {
    const renderer = window.usingWebGL ? 'WebGL' : 'Canvas';
    const quality = window.renderer?.options?.quality || 'unknown';
    const debugMode = (window.lightingManager?.debugMode || false) ? 'ON' : 'OFF';
    
    status.innerHTML = `
      <div>Renderer: ${renderer}</div>
      <div>Quality: ${quality}</div>
      <div>Debug: ${debugMode}</div>
    `;
  }
  
  // Store update function
  window.updateWebGLDebugUI = updateStatus;
  
  container.appendChild(status);
  
  // Add to document
  document.body.appendChild(container);
}

// Toggle debug mode
function toggleDebugMode() {
  // Toggle debug mode for lighting manager
  if (window.lightingManager) {
    window.lightingManager.debugMode = !window.lightingManager.debugMode;
  }
  
  // Toggle debug mode for renderer
  if (window.renderer && window.renderer.options) {
    window.renderer.options.debugMode = !window.renderer.options.debugMode;
  }
  
  // Log status
  const debugEnabled = window.lightingManager ? window.lightingManager.debugMode : false;
  console.log(`Debug mode: ${debugEnabled ? 'enabled' : 'disabled'}`);
  if (window.log) {
    window.log(`Debug mode: ${debugEnabled ? 'enabled' : 'disabled'}`);
  }
  
  // Update UI
  if (window.updateWebGLDebugUI) {
    window.updateWebGLDebugUI();
  }
}

// Run diagnostics on WebGL rendering
function diagnoseWebGLStatus() {
  console.log("=== WEBGL RENDERING DIAGNOSIS ===");
  
  // Check canvas element
  const canvas = document.getElementById('gameCanvas');
  console.log("Canvas:", canvas ? `Found (${canvas.width}x${canvas.height})` : "MISSING");
  
  // Check WebGL context
  let webglAvailable = false;
  let webglVersion = "None";
  try {
    const testCtx1 = canvas.getContext('webgl2');
    if (testCtx1) {
      webglAvailable = true;
      webglVersion = "WebGL 2.0";
    } else {
      const testCtx2 = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (testCtx2) {
        webglAvailable = true;
        webglVersion = "WebGL 1.0";
      }
    }
  } catch (e) {}
  
  console.log("WebGL Support:", webglAvailable ? webglVersion : "Not available");
  
  // Check renderer
  console.log("Current Renderer:", window.usingWebGL ? "WebGL" : "Canvas");
  if (window.renderer) {
    console.log("Renderer Options:", window.renderer.options || "Not available");
    console.log("FPS:", window.fps || "Unknown");
  } else {
    console.log("No renderer found");
  }
  
  // Check player position
  if (window.player) {
    console.log(`Player Position: x=${window.player.x.toFixed(2)}, y=${window.player.y.toFixed(2)}`);
    console.log(`Player Angle: ${window.player.angle.toFixed(2)} rad`);
  }
  
  // Check lighting
  if (window.lightingManager) {
    const numLights = Object.keys(window.lightingManager.lights).length;
    console.log(`Lighting System: ${numLights} lights`);
    console.log(`Debug Mode: ${window.lightingManager.debugMode ? "ON" : "OFF"}`);
  } else {
    console.log("No lighting manager found");
  }
  
  console.log("=== END OF DIAGNOSIS ===");
  
  // Log to game console
  if (window.log) {
    window.log("WebGL diagnosis printed to console (F12)");
  }
}

// Enhance keyboard controls
function enhanceKeyboardControls() {
  document.addEventListener('keydown', function(e) {
    const key = e.key.toLowerCase();
    
    // R key toggles renderer
    if (key === 'r' && window.toggleRenderer) {
      window.toggleRenderer();
    }
    
    // T key toggles quality
    if (key === 't' && window.toggleRendererQuality) {
      window.toggleRendererQuality();
    }
    
    // D key toggles debug mode
    if (key === 'd') {
      toggleDebugMode();
    }
    
    // V key runs diagnostics
    if (key === 'v') {
      diagnoseWebGLStatus();
    }
  });
}

// Initialize WebGL enhancements
function initWebGLEnhancements() {
  // Set up debug UI
  createWebGLDebugUI();
  
  // Set up keyboard controls
  enhanceKeyboardControls();
  
  // Export functions globally
  window.toggleDebugMode = toggleDebugMode;
  window.diagnoseWebGLStatus = diagnoseWebGLStatus;
  
  console.log("WebGL enhancements initialized");
}

// Call initialization after a delay to ensure engine.js has loaded everything
setTimeout(initWebGLEnhancements, 1000);

// End of webgl-intergration