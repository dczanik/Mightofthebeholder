// webgl-debug.js - Utilities for debugging WebGL

// Utility to check WebGL availability and capabilities
function checkWebGLSupport() {
  const canvas = document.createElement('canvas');
  
  // Try WebGL 2 first
  let gl = canvas.getContext('webgl2');
  let version = 2;
  
  if (!gl) {
    // Fall back to WebGL 1
    gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    version = 1;
  }
  
  if (!gl) {
    console.warn('WebGL not supported on this device');
    return {
      supported: false,
      version: 0,
      info: 'WebGL not supported'
    };
  }
  
  // Get GPU info if available
  let renderer = 'Unknown';
  let vendor = 'Unknown';
  
  try {
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
      vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
    }
  } catch (e) {
    console.warn('Could not access renderer info:', e);
  }
  
  // Get other capabilities
  const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  const maxVaryingVectors = gl.getParameter(gl.MAX_VARYING_VECTORS);
  const maxVertexAttribs = gl.getParameter(gl.MAX_VERTEX_ATTRIBS);
  const maxFragmentUniformVectors = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS);
  
  // Check extensions
  const extensions = gl.getSupportedExtensions();
  
  // Check floating point texture support
  const hasFloatTextures = extensions.includes('OES_texture_float');
  const hasFloatTexturesLinear = extensions.includes('OES_texture_float_linear');
  const hasHalfFloatTextures = extensions.includes('OES_texture_half_float');
  
  // Check for anisotropic filtering
  const maxAnisotropy = (() => {
    const ext = gl.getExtension('EXT_texture_filter_anisotropic') ||
                gl.getExtension('MOZ_EXT_texture_filter_anisotropic') ||
                gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
    return ext ? gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 0;
  })();
  
  // Check for MSAA support
  const maxSamples = version === 2 ? gl.getParameter(gl.MAX_SAMPLES) : 0;
  
  // Estimate quality tier based on detected capabilities
  let qualityTier = 'medium';
  
  if (version === 2 && maxTextureSize >= 8192 && maxAnisotropy >= 8 && hasFloatTextures) {
    qualityTier = 'high';
  } else if (version === 1 && maxTextureSize <= 2048) {
    qualityTier = 'low';
  }
  
  // Log detailed capabilities to console
  console.log(`%cWebGL Support Information`, 'font-weight: bold; font-size: 14px; color: #00bb00');
  console.log(`WebGL Version: ${version}`);
  console.log(`GPU Vendor: ${vendor}`);
  console.log(`GPU Renderer: ${renderer}`);
  console.log(`Max Texture Size: ${maxTextureSize}px`);
  console.log(`Maximum Anisotropy: ${maxAnisotropy}`);
  console.log(`Float Textures Support: ${hasFloatTextures ? 'Yes' : 'No'}`);
  if (version === 2) {
    console.log(`MSAA Support: ${maxSamples} samples`);
  }
  console.log(`Quality Tier: ${qualityTier}`);
  
  // Return capabilities object
  return {
    supported: true,
    version: version,
    vendor: vendor,
    renderer: renderer,
    maxTextureSize: maxTextureSize,
    maxAnisotropy: maxAnisotropy,
    hasFloatTextures: hasFloatTextures,
    hasHalfFloatTextures: hasHalfFloatTextures,
    extensions: extensions,
    maxVaryingVectors: maxVaryingVectors,
    maxVertexAttribs: maxVertexAttribs,
    maxFragmentUniformVectors: maxFragmentUniformVectors,
    maxSamples: maxSamples,
    qualityTier: qualityTier
  };
}

// Utility to monitor WebGL performance
function createWebGLPerformanceMonitor(gl) {
  if (!gl) return null;
  
  // Variables to track stats
  let frameCount = 0;
  let frameTime = 0;
  let drawCalls = 0;
  let trianglesRendered = 0;
  let gpuMemoryUsage = 0; // Estimation
  
  // Original functions we'll be wrapping
  const originalDrawArrays = gl.drawArrays;
  const originalDrawElements = gl.drawElements;
  const originalCreateTexture = gl.createTexture;
  const originalCreateBuffer = gl.createBuffer;
  const originalDeleteTexture = gl.deleteTexture;
  const originalDeleteBuffer = gl.deleteBuffer;
  
  // Track texture memory
  const textureMemory = new Map();
  const estimateTextureMemory = (width, height, format) => {
    // Rough byte-per-pixel estimate based on format
    let bytesPerPixel = 4; // Default to RGBA
    if (format === gl.RGB) bytesPerPixel = 3;
    else if (format === gl.LUMINANCE_ALPHA) bytesPerPixel = 2;
    else if (format === gl.LUMINANCE || format === gl.ALPHA) bytesPerPixel = 1;
    
    return width * height * bytesPerPixel;
  };
  
  // Track buffer memory
  const bufferMemory = new Map();
  
  // Override draw calls to count triangles
  gl.drawArrays = function(mode, first, count) {
    drawCalls++;
    if (mode === gl.TRIANGLES) {
      trianglesRendered += count / 3;
    } else if (mode === gl.TRIANGLE_STRIP || mode === gl.TRIANGLE_FAN) {
      trianglesRendered += count - 2;
    }
    return originalDrawArrays.call(gl, mode, first, count);
  };
  
  gl.drawElements = function(mode, count, type, offset) {
    drawCalls++;
    if (mode === gl.TRIANGLES) {
      trianglesRendered += count / 3;
    } else if (mode === gl.TRIANGLE_STRIP || mode === gl.TRIANGLE_FAN) {
      trianglesRendered += count - 2;
    }
    return originalDrawElements.call(gl, mode, count, type, offset);
  };
  
  // Override texture creation to track memory
  gl.createTexture = function() {
    const texture = originalCreateTexture.call(gl);
    textureMemory.set(texture, 0);
    return texture;
  };
  
  // Override buffer creation to track memory
  gl.createBuffer = function() {
    const buffer = originalCreateBuffer.call(gl);
    bufferMemory.set(buffer, 0);
    return buffer;
  };
  
  // Override texture deletion to update memory tracking
  gl.deleteTexture = function(texture) {
    if (textureMemory.has(texture)) {
      gpuMemoryUsage -= textureMemory.get(texture);
      textureMemory.delete(texture);
    }
    return originalDeleteTexture.call(gl, texture);
  };
  
  // Override buffer deletion to update memory tracking
  gl.deleteBuffer = function(buffer) {
    if (bufferMemory.has(buffer)) {
      gpuMemoryUsage -= bufferMemory.get(buffer);
      bufferMemory.delete(buffer);
    }
    return originalDeleteBuffer.call(gl, buffer);
  };
  
  // Override texImage2D to track memory usage
  const originalTexImage2D = gl.texImage2D;
  gl.texImage2D = function(...args) {
    // Track memory based on the overload used
    if (args.length >= 9) { // Pixel source version
      const texture = gl.getParameter(gl.TEXTURE_BINDING_2D);
      const level = args[1];
      const internalFormat = args[2];
      const width = args[3];
      const height = args[4];
      
      if (level === 0 && textureMemory.has(texture)) {
        const oldMemory = textureMemory.get(texture);
        const newMemory = estimateTextureMemory(width, height, internalFormat);
        textureMemory.set(texture, newMemory);
        gpuMemoryUsage = gpuMemoryUsage - oldMemory + newMemory;
      }
    } 
    else if (args.length >= 6) { // Image/canvas version
      const texture = gl.getParameter(gl.TEXTURE_BINDING_2D);
      const level = args[1];
      const internalFormat = args[2];
      const source = args[5];
      
      if (level === 0 && textureMemory.has(texture) && source) {
        const width = source.width || source.videoWidth || 0;
        const height = source.height || source.videoHeight || 0;
        const oldMemory = textureMemory.get(texture);
        const newMemory = estimateTextureMemory(width, height, internalFormat);
        textureMemory.set(texture, newMemory);
        gpuMemoryUsage = gpuMemoryUsage - oldMemory + newMemory;
      }
    }
    
    return originalTexImage2D.apply(gl, args);
  };
  
  // Track buffer memory
  const originalBufferData = gl.bufferData;
  gl.bufferData = function(target, data, usage) {
    const buffer = gl.getParameter(
      target === gl.ARRAY_BUFFER ? gl.ARRAY_BUFFER_BINDING : gl.ELEMENT_ARRAY_BUFFER_BINDING
    );
    
    if (buffer && bufferMemory.has(buffer)) {
      const byteLength = data.byteLength || data;
      const oldMemory = bufferMemory.get(buffer);
      bufferMemory.set(buffer, byteLength);
      gpuMemoryUsage = gpuMemoryUsage - oldMemory + byteLength;
    }
    
    return originalBufferData.call(gl, target, data, usage);
  };
  
// Continue from previous implementation
  // Create or get performance display element
  let performanceDisplay = document.getElementById('webglPerformanceDisplay');
  if (!performanceDisplay) {
    performanceDisplay = document.createElement('div');
    performanceDisplay.id = 'webglPerformanceDisplay';
    performanceDisplay.style.position = 'absolute';
    performanceDisplay.style.top = '70px';
    performanceDisplay.style.right = '10px';
    performanceDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    performanceDisplay.style.color = 'white';
    performanceDisplay.style.padding = '5px 10px';
    performanceDisplay.style.fontSize = '12px';
    performanceDisplay.style.fontFamily = 'monospace';
    performanceDisplay.style.borderRadius = '4px';
    performanceDisplay.style.zIndex = '1000';
    performanceDisplay.style.display = 'none'; // Hidden by default
    document.body.appendChild(performanceDisplay);
  }
  
  // Create toggle button for detailed stats
  let statsToggle = document.getElementById('webglStatsToggle');
  if (!statsToggle) {
    statsToggle = document.createElement('button');
    statsToggle.id = 'webglStatsToggle';
    statsToggle.textContent = 'WebGL Stats';
    statsToggle.style.position = 'absolute';
    statsToggle.style.top = '40px';
    statsToggle.style.right = '10px';
    statsToggle.style.backgroundColor = '#444';
    statsToggle.style.color = 'white';
    statsToggle.style.border = 'none';
    statsToggle.style.borderRadius = '3px';
    statsToggle.style.padding = '3px 8px';
    statsToggle.style.fontSize = '10px';
    statsToggle.style.cursor = 'pointer';
    statsToggle.style.zIndex = '1000';
    statsToggle.onclick = function() {
      const display = performanceDisplay.style.display;
      performanceDisplay.style.display = display === 'none' ? 'block' : 'none';
    };
    document.body.appendChild(statsToggle);
  }
  
  // Method to update display
  const updateDisplay = () => {
    performanceDisplay.innerHTML = `
      <div>Draw Calls: ${drawCalls} per frame</div>
      <div>Triangles: ${Math.round(trianglesRendered)} per frame</div>
      <div>Frame Time: ${frameTime.toFixed(2)} ms</div>
      <div>Est. GPU Memory: ${(gpuMemoryUsage / (1024 * 1024)).toFixed(2)} MB</div>
    `;
  };
  
  // Return monitor object with functions to track frame stats
  return {
    beginFrame: (time) => {
      frameCount++;
      drawCalls = 0;
      trianglesRendered = 0;
      frameTime = time;
    },
    
    endFrame: (time) => {
      frameTime = time - frameTime;
      updateDisplay();
    },
    
    reset: () => {
      frameCount = 0;
      drawCalls = 0;
      trianglesRendered = 0;
      frameTime = 0;
    },
    
    getStats: () => ({
      drawCalls,
      trianglesRendered,
      frameTime,
      gpuMemoryUsage
    })
  };
}

// Utility to create WebGL shader
function createShaderHelper(gl, source, type) {
  // Create shader
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  
  // Check compile status
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    // Compilation failed - try to extract line number from error
    const error = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    
    // Parse error to get line number and error message
    let lineNumber = 'unknown';
    let errorMessage = error;
    
    const errorRegex = /ERROR: (\d+):(\d+):/;
    const match = error.match(errorRegex);
    if (match) {
      lineNumber = match[2];
      
      // Format source with line numbers to help debugging
      const sourceLines = source.split('\n');
      const formattedSource = sourceLines.map((line, index) => {
        const lineNum = index + 1;
        const padding = ' '.repeat(4 - lineNum.toString().length);
        const highlight = lineNum.toString() === lineNumber ? ' <<<< ERROR' : '';
        return `${padding}${lineNum}: ${line}${highlight}`;
      }).join('\n');
      
      console.error(`Shader compilation error at line ${lineNumber}:`);
      console.error(errorMessage);
      console.error('Shader source:');
      console.error(formattedSource);
    } else {
      console.error('Shader compilation error:', error);
      console.error('Shader source:', source);
    }
    
    throw new Error(`Failed to compile ${type === gl.VERTEX_SHADER ? 'vertex' : 'fragment'} shader: ${error}`);
  }
  
  return shader;
}

// Utility to create a shader program with error handling and logging
function createProgramHelper(gl, vsSource, fsSource) {
  // Create shaders
  const vertexShader = createShaderHelper(gl, vsSource, gl.VERTEX_SHADER);
  const fragmentShader = createShaderHelper(gl, fsSource, gl.FRAGMENT_SHADER);
  
  // Create program
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  
  // Check link status
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const error = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    
    console.error('Shader program linking error:', error);
    throw new Error(`Failed to link shader program: ${error}`);
  }
  
  // Clean up shaders - they're linked to the program now
  gl.detachShader(program, vertexShader);
  gl.detachShader(program, fragmentShader);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  
  return program;
}

// Function to create a webgl context with debugging enabled
function createDebugContext(canvas) {
  // First try to get a regular context
  let gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  
  if (!gl) {
    console.error('WebGL not supported');
    return null;
  }
  
  // Check if we have the debug extension
  const hasDebugExt = typeof WebGLDebugUtils !== 'undefined';
  
  if (hasDebugExt) {
    // Create a debug context with error checking
    gl = WebGLDebugUtils.makeDebugContext(gl, function(err, funcName, args) {
      console.error(`WebGL error: ${WebGLDebugUtils.glEnumToString(err)} in ${funcName}`);
      console.trace();
    });
  } else {
    // If debug utils not available, wrap common WebGL calls with our own error checking
    const wrappers = [
      'createTexture', 'bindTexture', 'texImage2D',
      'createBuffer', 'bindBuffer', 'bufferData',
      'createFramebuffer', 'bindFramebuffer',
      'createRenderbuffer', 'bindRenderbuffer',
      'useProgram', 'linkProgram', 'compileShader'
    ];
    
    wrappers.forEach(funcName => {
      const original = gl[funcName];
      gl[funcName] = function(...args) {
        const result = original.apply(gl, args);
        const error = gl.getError();
        if (error !== gl.NO_ERROR) {
          console.error(`WebGL error in ${funcName}: ${error}`);
          console.trace();
        }
        return result;
      };
    });
  }
  
  // Create a performance monitor
  gl.perfMonitor = createWebGLPerformanceMonitor(gl);
  
  return gl;
}

// Function to get WebGL context with fallback and logging
function getWebGLContext(canvas, options) {
  // Check WebGL support
  const support = checkWebGLSupport();
  if (!support.supported) {
    console.warn('WebGL not supported, will use Canvas renderer');
    return null;
  }
  
  // Attempt to get context
  try {
    // Try WebGL 2 first
    let gl = canvas.getContext('webgl2', options);
    if (gl) {
      console.log('Using WebGL 2.0');
      return gl;
    }
    
    // Fall back to WebGL 1
    gl = canvas.getContext('webgl', options) || 
         canvas.getContext('experimental-webgl', options);
    
    if (gl) {
      console.log('Using WebGL 1.0');
      return gl;
    }
  } catch (e) {
    console.error('Error creating WebGL context:', e);
  }
  
  console.warn('Failed to create WebGL context');
  return null;
}

// Add WebGL debug utilities to global scope
window.WebGLDebug = {
  checkSupport: checkWebGLSupport,
  createPerformanceMonitor: createWebGLPerformanceMonitor,
  createShader: createShaderHelper,
  createProgram: createProgramHelper,
  createDebugContext: createDebugContext,
  getContext: getWebGLContext
};

// Run WebGL support check on page load and log results
window.addEventListener('load', function() {
  console.log('Checking WebGL support...');
  checkWebGLSupport();
});