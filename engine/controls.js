// controls.js - Input handling for the game

// Movement functions
function moveForward() {
  if (player.isMoving || player.isTurning) return;
  var delta = dirDeltas(player.direction);
  var nx = Math.floor(player.x) + delta[0];
  var ny = Math.floor(player.y) + delta[1];
  if (canMoveTo(nx + 0.5, ny + 0.5)) {
    log("Move Forward.");
    startMoveAnimation(nx + 0.5, ny + 0.5);
  }
}

function moveBackward() {
  if (player.isMoving || player.isTurning) return;
  var delta = dirDeltas(player.direction);
  var nx = Math.floor(player.x) - delta[0];
  var ny = Math.floor(player.y) - delta[1];
  if (canMoveTo(nx + 0.5, ny + 0.5)) {
    log("Move Backward.");
    startMoveAnimation(nx + 0.5, ny + 0.5);
  }
}

function strafeLeft() {
  if (player.isMoving || player.isTurning) return;
  var leftDir = (player.direction + 3) % 4;
  var delta = dirDeltas(leftDir);
  var nx = Math.floor(player.x) + delta[0];
  var ny = Math.floor(player.y) + delta[1];
  if (canMoveTo(nx + 0.5, ny + 0.5)) {
    log("Strafe Left.");
    startMoveAnimation(nx + 0.5, ny + 0.5);
  }
}

function strafeRight() {
  if (player.isMoving || player.isTurning) return;
  var rightDir = (player.direction + 1) % 4;
  var delta = dirDeltas(rightDir);
  var nx = Math.floor(player.x) + delta[0];
  var ny = Math.floor(player.y) + delta[1];
  if (canMoveTo(nx + 0.5, ny + 0.5)) {
    log("Strafe Right.");
    startMoveAnimation(nx + 0.5, ny + 0.5);
  }
}

function turnLeft() {
  if (player.isMoving || player.isTurning) return;
  var newDir = (player.direction + 3) % 4;
  log("Turn Left. Now facing " + directionToString(newDir) + ".");
  startTurnAnimation(newDir);
}

function turnRight() {
  if (player.isMoving || player.isTurning) return;
  var newDir = (player.direction + 1) % 4;
  log("Turn Right. Now facing " + directionToString(newDir) + ".");
  startTurnAnimation(newDir);
}

// Set up button event listeners
function setupControlButtons() {
  document.getElementById("btnForward").onclick = moveForward;
  document.getElementById("btnBack").onclick = moveBackward;
  document.getElementById("btnTurnLeft").onclick = turnLeft;
  document.getElementById("btnTurnRight").onclick = turnRight;
  document.getElementById("btnStrafeLeft").onclick = strafeLeft;
  document.getElementById("btnStrafeRight").onclick = strafeRight;
}

// Test functions for renderer controls
function testToggleRenderer() {
  console.log("Test toggle renderer button clicked");
  if (typeof window.toggleRenderer === 'function') {
    window.toggleRenderer();
    console.log("Renderer type after toggle:", window.usingWebGL ? "WebGL" : "Canvas");
  } else {
    console.error("toggleRenderer function is not defined!");
    alert("WebGL toggle function not available");
  }
  updateControlPanelButtons();
}

function testToggleQuality() {
  console.log("Test toggle quality button clicked"); 
  if (typeof window.toggleRendererQuality === 'function') {
    const quality = window.toggleRendererQuality();
    console.log("Quality after toggle:", quality);
  } else {
    console.error("toggleRendererQuality function is not defined!");
    alert("Quality toggle function not available");
  }
  updateControlPanelButtons();
}

// Function to update all control panel buttons
function updateControlPanelButtons() {
  // Update renderer toggle button
  var rendererToggle = document.getElementById('rendererToggleBtn');
  if (rendererToggle) {
    rendererToggle.textContent = `Switch to ${window.usingWebGL ? 'Canvas' : 'WebGL'} (R)`;
  }
  
  // Update quality toggle button
  var qualityToggle = document.getElementById('qualityToggleBtn');
  if (qualityToggle && window.renderer && window.renderer.options) {
    qualityToggle.textContent = `Quality: ${window.renderer.options.quality} (T)`;
  }
  
  // Update lighting toggle button
  var lightingToggle = document.getElementById('lightingToggleBtn');
  if (lightingToggle) {
    lightingToggle.textContent = `Lighting: ${window.useEnhancedLighting ? 'ON' : 'OFF'} (L)`;
  }
  
  // Update debug toggle button
  var debugToggle = document.getElementById('debugToggleBtn');
  if (debugToggle && window.lightingManager) {
    debugToggle.textContent = `Debug: ${window.lightingManager.debugMode ? 'ON' : 'OFF'} (D)`;
  }
}

// Create renderer control panel
function createRendererControls() {
  // Check if it already exists
  if (document.getElementById('rendererControls')) {
    return;
  }
  
  // Create control panel container
  var controlPanel = document.createElement('div');
  controlPanel.id = 'rendererControls';
  controlPanel.style.position = 'absolute';
  controlPanel.style.bottom = '10px';
  controlPanel.style.right = '10px';
  controlPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  controlPanel.style.color = 'white';
  controlPanel.style.padding = '10px';
  controlPanel.style.borderRadius = '5px';
  controlPanel.style.fontFamily = 'sans-serif';
  controlPanel.style.fontSize = '14px';
  controlPanel.style.zIndex = '1000';
  controlPanel.style.minWidth = '200px';
  
  // Add title
  var title = document.createElement('div');
  title.textContent = 'Renderer Settings';
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '10px';
  title.style.borderBottom = '1px solid #444';
  title.style.paddingBottom = '5px';
  controlPanel.appendChild(title);
  
  // Add renderer toggle button
  var rendererToggle = document.createElement('button');
  rendererToggle.id = 'rendererToggleBtn';
  rendererToggle.textContent = 'Switch Renderer (R)';
  rendererToggle.style.display = 'block';
  rendererToggle.style.width = '100%';
  rendererToggle.style.padding = '5px';
  rendererToggle.style.marginBottom = '5px';
  rendererToggle.style.backgroundColor = '#444';
  rendererToggle.style.color = 'white';
  rendererToggle.style.border = 'none';
  rendererToggle.style.borderRadius = '3px';
  rendererToggle.style.cursor = 'pointer';
  rendererToggle.onclick = testToggleRenderer; // Use test function
  controlPanel.appendChild(rendererToggle);
  
  // Add quality toggle button
  var qualityToggle = document.createElement('button');
  qualityToggle.id = 'qualityToggleBtn';
  qualityToggle.textContent = 'Toggle Quality (T)';
  qualityToggle.style.display = 'block';
  qualityToggle.style.width = '100%';
  qualityToggle.style.padding = '5px';
  qualityToggle.style.marginBottom = '5px';
  qualityToggle.style.backgroundColor = '#444';
  qualityToggle.style.color = 'white';
  qualityToggle.style.border = 'none';
  qualityToggle.style.borderRadius = '3px';
  qualityToggle.style.cursor = 'pointer';
  qualityToggle.onclick = testToggleQuality; // Use test function
  controlPanel.appendChild(qualityToggle);
  
  // Add lighting toggle button
  var lightingToggle = document.createElement('button');
  lightingToggle.id = 'lightingToggleBtn';
  lightingToggle.textContent = 'Toggle Lighting (L)';
  lightingToggle.style.display = 'block';
  lightingToggle.style.width = '100%';
  lightingToggle.style.padding = '5px';
  lightingToggle.style.marginBottom = '5px';
  lightingToggle.style.backgroundColor = '#444';
  lightingToggle.style.color = 'white';
  lightingToggle.style.border = 'none';
  lightingToggle.style.borderRadius = '3px';
  lightingToggle.style.cursor = 'pointer';
  lightingToggle.onclick = function() {
    window.useEnhancedLighting = !window.useEnhancedLighting;
    log("Enhanced lighting: " + (window.useEnhancedLighting ? "ON" : "OFF"));
    updateControlPanelButtons();
  };
  controlPanel.appendChild(lightingToggle);
  
  // Add debug toggle button
  var debugToggle = document.createElement('button');
  debugToggle.id = 'debugToggleBtn';
  debugToggle.textContent = 'Toggle Debug (D)';
  debugToggle.style.display = 'block';
  debugToggle.style.width = '100%';
  debugToggle.style.padding = '5px';
  debugToggle.style.backgroundColor = '#444';
  debugToggle.style.color = 'white';
  debugToggle.style.border = 'none';
  debugToggle.style.borderRadius = '3px';
  debugToggle.style.cursor = 'pointer';
  debugToggle.onclick = function() {
    if (window.lightingManager) {
      window.lightingManager.debugMode = !window.lightingManager.debugMode;
      log("Debug mode: " + (window.lightingManager.debugMode ? "ON" : "OFF"));
      updateControlPanelButtons();
    }
  };
  controlPanel.appendChild(debugToggle);
  
  // Add diagnostic button
  var diagnosticBtn = document.createElement('button');
  diagnosticBtn.id = 'diagnosticBtn';
  diagnosticBtn.textContent = 'Diagnostics (P)';
  diagnosticBtn.style.display = 'block';
  diagnosticBtn.style.width = '100%';
  diagnosticBtn.style.padding = '5px';
  diagnosticBtn.style.marginTop = '10px';
  diagnosticBtn.style.backgroundColor = '#555';
  diagnosticBtn.style.color = 'white';
  diagnosticBtn.style.border = 'none';
  diagnosticBtn.style.borderRadius = '3px';
  diagnosticBtn.style.cursor = 'pointer';
  diagnosticBtn.onclick = function() {
    if (window.diagnoseRendererIssues) {
      window.diagnoseRendererIssues();
      log("Renderer diagnostic printed to console");
    } else {
      console.error("diagnoseRendererIssues function is not defined!");
    }
  };
  controlPanel.appendChild(diagnosticBtn);
  
  // Add to document
  document.body.appendChild(controlPanel);
  
  // Update buttons with current state
  updateControlPanelButtons();
  
  return controlPanel;
}

// Set up keyboard event listeners
function setupKeyboardControls() {
  // Remove any existing event listeners to avoid duplicates
  window.removeEventListener("keydown", handleKeyDown);
  
  // Add the event listener with our handler function
  window.addEventListener("keydown", handleKeyDown);
  console.log("Keyboard controls initialized");
}

// Centralized keyboard handler function
function handleKeyDown(e) {
  var key = e.key.toLowerCase();
  console.log("Key pressed:", key);
  
  // Movement controls
  if (key === 'q') turnLeft();
  if (key === 'w') moveForward();
  if (key === 'e') turnRight();
  if (key === 'a') strafeLeft();
  if (key === 's') moveBackward();
  if (key === 'd') strafeRight();
  
  // Renderer controls
  if (key === 'r') {
    console.log("R key pressed - toggling renderer");
    if (typeof window.toggleRenderer === 'function') {
      window.toggleRenderer();
      console.log("Renderer toggled to:", window.usingWebGL ? "WebGL" : "Canvas");
    } else {
      console.error("toggleRenderer function not found!");
    }
  }
  
  // Quality controls
  if (key === 't') {
    console.log("T key pressed - toggling quality");
    if (typeof window.toggleRendererQuality === 'function') {
      const quality = window.toggleRendererQuality();
      console.log("Quality set to:", quality);
    } else {
      console.error("toggleRendererQuality function not found!");
    }
  }
  
  // Lighting controls
  if (key === 'l') {
    console.log("L key pressed - toggling lighting");
    window.useEnhancedLighting = !window.useEnhancedLighting;
    log("Enhanced lighting: " + (window.useEnhancedLighting ? "ON" : "OFF"));
    updateControlPanelButtons();
  }
  
  // Debug mode
  if (key === 'd' && window.lightingManager) {
    console.log("D key pressed - toggling debug mode");
    window.lightingManager.debugMode = !window.lightingManager.debugMode;
    log("Debug mode: " + (window.lightingManager.debugMode ? "ON" : "OFF"));
    updateControlPanelButtons();
  }
  
  // Diagnostic key
  if (key === 'p' && window.diagnoseRendererIssues) {
    console.log("P key pressed - printing diagnostic info");
    window.diagnoseRendererIssues();
    log("Renderer diagnostic printed to console");
  }
}

// Initialize controls when the page loads
window.addEventListener("load", function() {
  // Setup UI controls
  setupControlButtons();
  
  // Setup keyboard controls
  setupKeyboardControls();
  
  // Create renderer controls panel after a delay to ensure everything is loaded
  setTimeout(function() {
    createRendererControls();
  }, 1000);
  
  console.log("Controls initialized");
});