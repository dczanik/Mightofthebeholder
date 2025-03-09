// webgl-renderer.js - WebGL rendering implementation for the Might of the Beholder game
// This file replaces the dummy implementation in webgl-test.js with a real WebGL renderer

class WebGLRenderer {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.options = {
      quality: 'medium',         // 'high', 'medium', 'low'
      useNormalMapping: true,    // Whether to use normal mapping
      ambientLight: 0.2,         // Base ambient light level
      debugMode: false,          // Show debug visuals
      ...options
    };
    
    // Try to get WebGL context
    try {
      this.gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!this.gl) {
        console.error("WebGL not supported on this device");
        throw new Error("WebGL not supported");
      }
    } catch (error) {
      console.error("Failed to initialize WebGL:", error);
      throw error;
    }
    
    // Initialize renderer
    this.init();
    
    // Store original canvas 2D context for fallback/minimap
    this.ctx = canvas.getContext('2d');
    
    console.log("WebGL renderer initialized successfully");
  }
  
  // Initialize renderer components
  init() {
    // Configure WebGL
    this.configureGL();
    
    // Create basic shader program
    this.createShaders();
    
    // Set up buffers
    this.createBuffers();
    
    // Set up textures
    this.loadTextures();
    
    // Set up lighting
    this.setupLighting();
    
    // Set up FPS counter
    this.setupFPSCounter();
    
    // Store player position
    this.playerX = 0;
    this.playerY = 0;
    this.playerAngle = 0;
    
    // Frame tracking
    this.lastFrameTime = 0;
    this.frameCount = 0;
    this.fps = 0;
  }
  
  // Configure WebGL settings
  configureGL() {
    const gl = this.gl;
    
    // Set clear color (dark blue-gray background)
    gl.clearColor(0.05, 0.05, 0.1, 1.0);
    
    // Enable depth testing
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    
    // Enable alpha blending
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    
    // Set viewport
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    
    // Performance hint based on quality
    if (this.options.quality === 'low') {
      gl.hint(gl.GENERATE_MIPMAP_HINT, gl.FASTEST);
    } else {
      gl.hint(gl.GENERATE_MIPMAP_HINT, gl.NICEST);
    }
  }
  
  // Create shader programs
  createShaders() {
    const gl = this.gl;
    
    // Simple vertex shader for walls
    const wallVS = `
      attribute vec4 aPosition;
      attribute vec2 aTexCoord;
      
      uniform mat4 uModelViewMatrix;
      uniform mat4 uProjectionMatrix;
      
      varying highp vec2 vTexCoord;
      varying highp float vDepth;
      
      void main() {
        gl_Position = uProjectionMatrix * uModelViewMatrix * aPosition;
        vTexCoord = aTexCoord;
        vDepth = aPosition.z;  // Pass depth for fog effect
      }
    `;
    
    // Simple fragment shader for walls
    const wallFS = `
      precision mediump float;
      
      varying highp vec2 vTexCoord;
      varying highp float vDepth;
      
      uniform sampler2D uTexture;
      uniform float uAmbientLight;
      uniform vec3 uLightPos;
      uniform vec3 uLightColor;
      uniform float uLightIntensity;
      
      void main() {
        vec4 texColor = texture2D(uTexture, vTexCoord);
        
        // Calculate distance-based lighting
        float distance = vDepth;
        float attenuation = 1.0 - min(distance / 10.0, 1.0);
        attenuation = attenuation * attenuation;  // Quadratic falloff
        
        // Ambient + attenuated light
        vec3 finalColor = texColor.rgb * uAmbientLight;
        finalColor += texColor.rgb * uLightColor * uLightIntensity * attenuation;
        
        // Apply fog effect for distant walls
        vec3 fogColor = vec3(0.05, 0.05, 0.1);  // Dark blue fog
        float fogFactor = min(distance / 15.0, 1.0);
        finalColor = mix(finalColor, fogColor, fogFactor);
        
        gl_FragColor = vec4(finalColor, texColor.a);
      }
    `;
    
    // Compile wall shader program
    this.wallProgram = this.createShaderProgram(wallVS, wallFS);
    
    // Store attribute and uniform locations
    if (this.wallProgram) {
      this.wallAttribs = {
        position: gl.getAttribLocation(this.wallProgram, 'aPosition'),
        texCoord: gl.getAttribLocation(this.wallProgram, 'aTexCoord')
      };
      
      this.wallUniforms = {
        modelViewMatrix: gl.getUniformLocation(this.wallProgram, 'uModelViewMatrix'),
        projectionMatrix: gl.getUniformLocation(this.wallProgram, 'uProjectionMatrix'),
        texture: gl.getUniformLocation(this.wallProgram, 'uTexture'),
        ambientLight: gl.getUniformLocation(this.wallProgram, 'uAmbientLight'),
        lightPos: gl.getUniformLocation(this.wallProgram, 'uLightPos'),
        lightColor: gl.getUniformLocation(this.wallProgram, 'uLightColor'),
        lightIntensity: gl.getUniformLocation(this.wallProgram, 'uLightIntensity')
      };
    }
  }
  
  // Create buffers for rendering
  createBuffers() {
    const gl = this.gl;
    
    // Create wall geometry
    // We'll recreate this per-frame based on raycasting results
    this.wallVertices = [];
    this.wallTexCoords = [];
    
    // Create buffers
    this.wallVertexBuffer = gl.createBuffer();
    this.wallTexCoordBuffer = gl.createBuffer();
  }
  
  // Load textures
  loadTextures() {
    const gl = this.gl;
    
    // Create wall texture
    this.wallTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.wallTexture);
    
    // Fill with placeholder color until loaded
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
                 new Uint8Array([128, 128, 128, 255]));
    
    // Start loading wall texture
    const wallImage = new Image();
    wallImage.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, this.wallTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, wallImage);
      
      // Generate mipmaps if power-of-two
      if (this.isPowerOf2(wallImage.width) && this.isPowerOf2(wallImage.height)) {
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      } else {
        // Not power of 2, disable mipmap and set wrapping to clamp
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      }
      
      console.log("Wall texture loaded for WebGL");
    };
    
    wallImage.onerror = () => {
      console.error("Failed to load wall texture for WebGL");
    };
    
    wallImage.src = 'assets/images/Wall1.png';
  }
  
  // Set up lighting
  setupLighting() {
    // Light properties
    this.lights = [{
      position: [0, 0, 0.5],          // Will be updated to match player position
      color: [1.0, 0.8, 0.5],        // Warm torch color
      intensity: 1.0,                // Brightness
      radius: 10.0                   // Light radius
    }];
    
    // Ambient light level
    this.ambientLight = this.options.ambientLight;
  }
  
  // Set up FPS counter
  setupFPSCounter() {
    this.fpsElement = null;
    this.fpsCounter = 0;
    this.fpsLastUpdate = 0;
    
    // Create FPS display element
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
    fpsCounter.style.display = 'none';  // Hidden by default
    fpsCounter.textContent = 'FPS: --';
    
    document.body.appendChild(fpsCounter);
    this.fpsElement = fpsCounter;
  }
  
  // Toggle FPS display
  toggleFPS() {
    if (this.fpsElement) {
      this.fpsElement.style.display = 
        this.fpsElement.style.display === 'none' ? 'block' : 'none';
    }
  }
  
  // Update FPS counter
  updateFPS(timestamp) {
    this.fpsCounter++;
    
    // Update every second
    if (!this.fpsLastUpdate) {
      this.fpsLastUpdate = timestamp;
    }
    
    const elapsed = timestamp - this.fpsLastUpdate;
    if (elapsed >= 1000) {
      this.fps = Math.round((this.fpsCounter * 1000) / elapsed);
      
      if (this.fpsElement) {
        this.fpsElement.textContent = `FPS: ${this.fps}`;
        
        // Color based on performance
        if (this.fps >= 45) {
          this.fpsElement.style.color = '#00FF00';  // Green for good
        } else if (this.fps >= 30) {
          this.fpsElement.style.color = '#FFFF00';  // Yellow for okay
        } else {
          this.fpsElement.style.color = '#FF0000';  // Red for poor
        }
      }
      
      this.fpsCounter = 0;
      this.fpsLastUpdate = timestamp;
    }
  }
  
  // Update quality settings
  setQuality(quality) {
    if (quality === this.options.quality) return quality;
    
    console.log(`Setting WebGL quality to: ${quality}`);
    this.options.quality = quality;
    
    switch (quality) {
      case 'high':
        this.options.useNormalMapping = true;
        this.ambientLight = 0.2;
        this.gl.hint(this.gl.GENERATE_MIPMAP_HINT, this.gl.NICEST);
        break;
        
      case 'medium':
        this.options.useNormalMapping = true;
        this.ambientLight = 0.3;
        this.gl.hint(this.gl.GENERATE_MIPMAP_HINT, this.gl.NICEST);
        break;
        
      case 'low':
        this.options.useNormalMapping = false;
        this.ambientLight = 0.4;
        this.gl.hint(this.gl.GENERATE_MIPMAP_HINT, this.gl.FASTEST);
        break;
    }
    
    return quality;
  }
  
  // Update player position
  updatePlayer(player) {
    // Use animated position if available
    this.playerX = window.animX ? window.animX() : player.x;
    this.playerY = window.animY ? window.animY() : player.y;
    this.playerAngle = player.angle;
    
    // Update player torch
    if (this.lights.length > 0) {
      this.lights[0].position = [this.playerX, this.playerY, 0.5];
    }
  }
  
  // Main render method
  render(worldMap, player, entities, projectiles) {
    // Skip if no world map
    if (!worldMap || !player) return;
    
    // Update player
    this.updatePlayer(player);
    
    // Begin timing for FPS counter
    const startTime = performance.now();
    
    // Clear screen
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    
    // Render raycasted walls
    this.renderRaycastedWalls(worldMap);
    
    // End timing
    this.updateFPS(startTime);
  }
  
  // Calculate rays for walls
  renderRaycastedWalls(worldMap) {
    // Skip if no world map or castRay function
    if (!worldMap || !window.castRay) return;
    
    // Clear arrays
    this.wallVertices = [];
    this.wallTexCoords = [];
    
    // Render wall columns
    const screenW = this.canvas.width;
    const screenH = this.canvas.height;
    const fov = window.fov || Math.PI / 3;
    
    // Draw walls based on raycasting results
    for (let x = 0; x < screenW; x += 2) {  // Step by 2 pixels for better performance
      // Calculate ray angle for this column
      const rayAngle = this.playerAngle - fov/2 + (x / screenW) * fov;
      
      // Cast ray
      const ray = window.castRay(this.playerX, this.playerY, rayAngle);
      
      // Apply fish-eye correction
      const correctedDist = ray.distance * Math.cos(rayAngle - this.playerAngle);
      
      // Calculate wall height based on distance
      const wallHeight = 1.0 / (correctedDist === 0 ? 0.001 : correctedDist);
      
      // Calculate texture coordinates
      const texX = ray.textureX;
      
      // Add wall vertices to buffer
      this.addWallQuad(x, screenW, screenH, wallHeight, texX, correctedDist);
    }
    
    // Render the walls using WebGL
    this.drawWalls();
  }
  
  // Add a wall quad to the vertex buffers
  addWallQuad(x, screenW, screenH, height, texX, depth) {
    // Convert screen coordinates to clip space (-1 to 1)
    const ndcX = (x / screenW) * 2 - 1;
    const ndcStepX = (2 / screenW) * 2;  // Double the step size
    
    // Calculate top and bottom positions
    const halfHeight = height / 2;
    const top = halfHeight;
    const bottom = -halfHeight;
    
    // Add vertices for this wall slice (2 triangles = 6 vertices)
    // Triangle 1: Bottom left, bottom right, top right
    this.wallVertices.push(
      ndcX, bottom, depth,
      ndcX + ndcStepX, bottom, depth,
      ndcX + ndcStepX, top, depth
    );
    
    // Triangle 2: Bottom left, top right, top left
    this.wallVertices.push(
      ndcX, bottom, depth,
      ndcX + ndcStepX, top, depth,
      ndcX, top, depth
    );
    
    // Add texture coordinates
    this.wallTexCoords.push(
      texX, 1.0,
      texX, 1.0,
      texX, 0.0
    );
    
    this.wallTexCoords.push(
      texX, 1.0,
      texX, 0.0,
      texX, 0.0
    );
  }
  
  // Draw walls using the WebGL renderer
  drawWalls() {
    const gl = this.gl;
    
    // Skip if no wall program
    if (!this.wallProgram) return;
    
    // Use wall shader
    gl.useProgram(this.wallProgram);
    
    // Set up projection and model-view matrices (simple for 2D game)
    const projMatrix = this.createPerspectiveMatrix(45, this.canvas.width / this.canvas.height, 0.1, 100.0);
    const modelViewMatrix = this.createIdentityMatrix();
    
    // Pass matrices to shader
    gl.uniformMatrix4fv(this.wallUniforms.projectionMatrix, false, projMatrix);
    gl.uniformMatrix4fv(this.wallUniforms.modelViewMatrix, false, modelViewMatrix);
    
    // Pass lighting info
    gl.uniform1f(this.wallUniforms.ambientLight, this.ambientLight);
    gl.uniform3fv(this.wallUniforms.lightPos, this.lights[0].position);
    gl.uniform3fv(this.wallUniforms.lightColor, this.lights[0].color);
    gl.uniform1f(this.wallUniforms.lightIntensity, this.lights[0].intensity);
    
    // Setup vertex position buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.wallVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.wallVertices), gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(this.wallAttribs.position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(this.wallAttribs.position);
    
    // Setup texture coordinate buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.wallTexCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.wallTexCoords), gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(this.wallAttribs.texCoord, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(this.wallAttribs.texCoord);
    
    // Bind texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.wallTexture);
    gl.uniform1i(this.wallUniforms.texture, 0);
    
    // Draw walls
    gl.drawArrays(gl.TRIANGLES, 0, this.wallVertices.length / 3);
    
    // Clean up
    gl.disableVertexAttribArray(this.wallAttribs.position);
    gl.disableVertexAttribArray(this.wallAttribs.texCoord);
  }
  
  // Helper function to create a shader program
  createShaderProgram(vsSource, fsSource) {
    const gl = this.gl;
    
    try {
      // Create vertex shader
      const vertexShader = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(vertexShader, vsSource);
      gl.compileShader(vertexShader);
      
      // Check compilation
      if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(vertexShader);
        throw `Vertex shader compilation failed: ${info}`;
      }
      
      // Create fragment shader
      const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(fragmentShader, fsSource);
      gl.compileShader(fragmentShader);
      
      // Check compilation
      if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(fragmentShader);
        throw `Fragment shader compilation failed: ${info}`;
      }
      
      // Create program and attach shaders
      const program = gl.createProgram();
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      
      // Check linking
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const info = gl.getProgramInfoLog(program);
        throw `Shader program linking failed: ${info}`;
      }
      
      return program;
    } catch (error) {
      console.error("Error creating shader program:", error);
      return null;
    }
  }
  
  // Helper function to check if a number is a power of 2
  isPowerOf2(value) {
    return (value & (value - 1)) === 0;
  }
  
  // Helper function to create a perspective matrix (simplified)
  createPerspectiveMatrix(fovDegrees, aspect, near, far) {
    const fovRadians = fovDegrees * Math.PI / 180;
    const f = 1.0 / Math.tan(fovRadians / 2);
    const rangeInv = 1.0 / (near - far);
    
    return [
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (near + far) * rangeInv, -1,
      0, 0, near * far * rangeInv * 2, 0
    ];
  }
  
  // Helper function to create an identity matrix
  createIdentityMatrix() {
    return [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ];
  }
}

// Canvas renderer (fallback for devices without WebGL)
class CanvasRenderer {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    this.options = {
      quality: 'medium',
      useNormalMapping: false,
      ambientLight: 0.3,
      ...options
    };
    
    // FPS tracking
    this.fps = 0;
    this.fpsCounter = 0;
    this.fpsLastUpdate = 0;
    this.fpsElement = null;
    
    this.setupFPSCounter();
    
    console.log("Canvas renderer initialized");
  }
  
  // Set up FPS counter (same as WebGL version)
  setupFPSCounter() {
    this.fpsElement = null;
    this.fpsCounter = 0;
    this.fpsLastUpdate = 0;
    
    // Create FPS display element
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
    fpsCounter.style.display = 'none';  // Hidden by default
    fpsCounter.textContent = 'FPS: --';
    
    document.body.appendChild(fpsCounter);
    this.fpsElement = fpsCounter;
  }
  
  // Toggle FPS display
  toggleFPS() {
    if (this.fpsElement) {
      this.fpsElement.style.display = 
        this.fpsElement.style.display === 'none' ? 'block' : 'none';
    }
  }
  
  // Update FPS counter
  updateFPS(timestamp) {
    this.fpsCounter++;
    
    // Update every second
    if (!this.fpsLastUpdate) {
      this.fpsLastUpdate = timestamp;
    }
    
    const elapsed = timestamp - this.fpsLastUpdate;
    if (elapsed >= 1000) {
      this.fps = Math.round((this.fpsCounter * 1000) / elapsed);
      
      if (this.fpsElement) {
        this.fpsElement.textContent = `FPS: ${this.fps}`;
        
        // Color based on performance
        if (this.fps >= 45) {
          this.fpsElement.style.color = '#00FF00';
        } else if (this.fps >= 30) {
          this.fpsElement.style.color = '#FFFF00';
        } else {
          this.fpsElement.style.color = '#FF0000';
        }
      }
      
      this.fpsCounter = 0;
      this.fpsLastUpdate = timestamp;
    }
  }
  
  // Set quality (compatibility method with WebGLRenderer)
  setQuality(quality) {
    if (quality === this.options.quality) return quality;
    
    console.log(`Setting Canvas quality to: ${quality}`);
    this.options.quality = quality;
    
    // Adjust settings based on quality
    switch (quality) {
      case 'high':
        this.options.ambientLight = 0.2;
        break;
      case 'medium':
        this.options.ambientLight = 0.3;
        break;
      case 'low':
        this.options.ambientLight = 0.4;
        break;
    }
    
    return quality;
  }
  
  // Update player (compatibility method with WebGLRenderer)
  updatePlayer(player) {
    // No need to store player position in Canvas renderer
    // as it's handled by the main engine
  }
  
  // Render method (compatibility method with WebGLRenderer)
  render(worldMap, player, entities, projectiles) {
    // This is empty because the original engine's renderFrame() will handle Canvas rendering
    this.updateFPS(performance.now());
  }
}

// Renderer factory - Creates appropriate renderer based on capabilities
class RendererFactory {
  static createRenderer(canvas, options = {}) {
    // Try to create WebGL renderer first
    try {
      // Check if WebGL is supported
      const context = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (context) {
        return new WebGLRenderer(canvas, options);
      }
    } catch (error) {
      console.warn("WebGL initialization failed:", error);
    }
    
    // Fall back to Canvas renderer
    console.log("Falling back to Canvas renderer");
    return new CanvasRenderer(canvas, options);
  }
}

// Export to global scope
window.WebGLRenderer = WebGLRenderer;
window.CanvasRenderer = CanvasRenderer;
window.RendererFactory = RendererFactory;

// Helper function to toggle FPS counter
window.toggleFPSCounter = function() {
  if (window.renderer) {
    window.renderer.toggleFPS();
  }
};

console.log("WebGL renderer module loaded");