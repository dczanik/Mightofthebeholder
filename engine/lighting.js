// lighting.js - Dynamic lighting system for Might of the Beholder
// Supports dynamic point lights, normal mapping, specular highlights, and ambient occlusion

// ==================== LIGHT TYPES ====================
// Light types enum
const LightType = {
  AMBIENT: 0,  // Global ambient light
  POINT: 1,    // Point light with falloff (torch, lantern)
  DIRECTIONAL: 2, // Directional light (sun, moon)
  SPOT: 3      // Spotlight with direction and cone
};

// Lighting quality settings
let lightingQuality = "high"; // "high" or "low"


// Function to toggle lighting quality
function toggleLightingQuality() {
  lightingQuality = lightingQuality === "high" ? "low" : "high";
  
  // Adjust light properties based on quality
  if (window.lightingManager && window.playerTorchLightId) {
    const torch = window.lightingManager.getById(window.playerTorchLightId);
    if (torch) {
      if (lightingQuality === "high") {
        // High quality settings - more detailed, potentially slower
        torch.radius = 7.0;
        torch.intensity = 1.5;
        torch.decay = 2.0;
        torch.flickerEnabled = true;
        window.ambientLevel = 0.1;
      } else {
        // Low quality settings - faster performance
        torch.radius = 5.0;
        torch.intensity = 1.2;
        torch.decay = 1.5;
        torch.flickerEnabled = false;
        window.ambientLevel = 0.3;
      }
    }
  }
  
  window.log(`Lighting quality set to ${lightingQuality}`);
  return lightingQuality;
}

// Export the toggle function
window.toggleLightingQuality = toggleLightingQuality;

// ==================== TEXTURE LOADING ====================
// Normal map texture (contains surface normals for each pixel)
var normalMapLoaded = false;
var normalMap = new Image();
normalMap.onload = function() { 
  normalMapLoaded = true; 
  console.log("Normal map loaded."); 
};
normalMap.src = "assets/images/Wall1-Normal.png";
normalMap.onerror = function() {
  console.error("Failed to load normal map:", normalMap.src);
};

// Specular map texture (defines shininess/reflectivity of surface)
var specularMapLoaded = false;
var specularMap = new Image();
specularMap.onload = function() { 
  specularMapLoaded = true; 
  console.log("Specular map loaded."); 
};
specularMap.src = "assets/images/Wall1-Specular.png";
specularMap.onerror = function() {
  console.error("Failed to load specular map:", specularMap.src);
};

// Ambient Occlusion map (defines shadowed areas)
var aoMapLoaded = false;
var aoMap = new Image();
aoMap.onload = function() { 
  aoMapLoaded = true; 
  console.log("AO map loaded."); 
};
aoMap.src = "assets/images/Wall1-AO.png";
aoMap.onerror = function() {
  console.error("Failed to load AO map:", aoMap.src);
};

// ==================== LIGHT CLASS ====================
class Light {
  constructor(type, properties = {}) {
    this.type = type;
    this.id = generateUniqueId(); // Reuse from entity.js
    this.active = true;
    
    // Common properties
    this.color = properties.color || "#ffffff";
    this.intensity = properties.intensity !== undefined ? properties.intensity : 1.0;
    
    // Position for point and spot lights
    if (type === LightType.POINT || type === LightType.SPOT) {
      this.x = properties.x || 0;
      this.y = properties.y || 0;
      this.z = properties.z || 0; // Height above ground
      this.radius = properties.radius || 5.0; // Falloff radius
      this.decay = properties.decay || 2.0; // Light decay factor (1=linear, 2=quadratic)
      this.castShadows = properties.castShadows !== undefined ? properties.castShadows : true;
    }
    
    // Direction for directional and spot lights
    if (type === LightType.DIRECTIONAL || type === LightType.SPOT) {
      this.dirX = properties.dirX || 0;
      this.dirY = properties.dirY || 0;
      this.dirZ = properties.dirZ || -1; // Default pointing down
    }
    
    // Spot light specific properties
    if (type === LightType.SPOT) {
      this.angle = properties.angle || Math.PI / 4; // Cone angle in radians (default 45°)
      this.penumbra = properties.penumbra || 0.1; // Softness of cone edge
    }
    
    // Flicker effect for torches and fire
    this.flickerEnabled = properties.flickerEnabled || false;
    if (this.flickerEnabled) {
      this.flickerSpeed = properties.flickerSpeed || 10; // Flicker speed
      this.flickerIntensity = properties.flickerIntensity || 0.2; // How much intensity varies
      this.flickerOffset = Math.random() * 1000; // Random offset for each light
    }
    
    // Animation properties
    this.animated = properties.animated || false;
    if (this.animated) {
      this.animationPath = properties.animationPath || null; // Array of points to follow
      this.animationSpeed = properties.animationSpeed || 1.0;
      this.currentPathIndex = 0;
      this.pathProgress = 0;
    }
  }
  
  // Update light properties (for animated lights)
  update(dt) {
    // Skip if inactive
    if (!this.active) return;
    
    // Update flicker effect
    if (this.flickerEnabled) {
      const time = performance.now() / 1000;
      const flickerValue = Math.sin(time * this.flickerSpeed + this.flickerOffset) * this.flickerIntensity;
      this.currentIntensity = this.intensity * (1 + flickerValue);
    } else {
      this.currentIntensity = this.intensity;
    }
    
    // Update animated light position
    if (this.animated && this.animationPath && this.animationPath.length > 1) {
      this.pathProgress += (dt / 1000) * this.animationSpeed;
      
      // Loop back when reaching end of path
      while (this.pathProgress >= 1) {
        this.pathProgress -= 1;
        this.currentPathIndex = (this.currentPathIndex + 1) % this.animationPath.length;
      }
      
      // Get current and next point
      const currentPoint = this.animationPath[this.currentPathIndex];
      const nextPoint = this.animationPath[(this.currentPathIndex + 1) % this.animationPath.length];
      
      // Interpolate position
      this.x = currentPoint.x + (nextPoint.x - currentPoint.x) * this.pathProgress;
      this.y = currentPoint.y + (nextPoint.y - currentPoint.y) * this.pathProgress;
      this.z = currentPoint.z + (nextPoint.z - currentPoint.z) * this.pathProgress;
    }
  }
  
  // Calculate light contribution at a specific point
  calculateLightingAt(x, y, z, normalX, normalY, normalZ) {
    let factor = 0;
    
    switch (this.type) {
      case LightType.AMBIENT:
        // Ambient light is constant everywhere
        factor = this.currentIntensity;
        break;
        
      case LightType.POINT:
        // Calculate distance and falloff for point light
        const dx = this.x - x;
        const dy = this.y - y;
        const dz = this.z - z;
        const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
        
        // Calculate falloff based on distance and radius
        if (distance < this.radius) {
          // Using inverse square law with decay factor
          factor = this.currentIntensity * Math.pow(1.0 - Math.min(distance / this.radius, 1.0), this.decay);
          
          // Apply normal mapping if normal vector is provided
          if (normalX !== undefined && normalY !== undefined && normalZ !== undefined) {
            // Calculate light direction (normalized)
            const lightDirX = dx / distance;
            const lightDirY = dy / distance;
            const lightDirZ = dz / distance;
            
            // Dot product of normal and light direction
            const dotProduct = normalX * lightDirX + normalY * lightDirY + normalZ * lightDirZ;
            
            // Only apply normal lighting if surface faces light
            factor *= Math.max(0, dotProduct);
          }
        }
        break;
        
      case LightType.DIRECTIONAL:
        // For directional light, calculate dot product with normal
        if (normalX !== undefined && normalY !== undefined && normalZ !== undefined) {
          // Dot product of normal and light direction
          const dotProduct = normalX * this.dirX + normalY * this.dirY + normalZ * this.dirZ;
          factor = this.currentIntensity * Math.max(0, dotProduct);
        } else {
          factor = this.currentIntensity;
        }
        break;
        
      case LightType.SPOT:
        // First calculate as point light
        const sdx = this.x - x;
        const sdy = this.y - y;
        const sdz = this.z - z;
        const sDistance = Math.sqrt(sdx*sdx + sdy*sdy + sdz*sdz);
        
        // Early exit if beyond radius
        if (sDistance > this.radius) break;
        
        // Normalize direction to point
        const dirToPtX = sdx / sDistance;
        const dirToPtY = sdy / sDistance;
        const dirToPtZ = sdz / sDistance;
        
        // Calculate dot product with light direction
        const dirDot = dirToPtX * this.dirX + dirToPtY * this.dirY + dirToPtZ * this.dirZ;
        
        // Calculate angle from light direction
        const angleCos = dirDot; // Dot product of normalized vectors = cosine of angle
        
        // Check if point is within spot cone
        const spotCutoff = Math.cos(this.angle);
        if (angleCos > spotCutoff) {
          // Point is inside the cone, calculate intensity with falloff
          const baseIntensity = this.currentIntensity * Math.pow(1.0 - Math.min(sDistance / this.radius, 1.0), this.decay);
          
          // Apply penumbra smoothing at cone edges
          const penumbraRange = this.penumbra * (1.0 - spotCutoff);
          const spotFactor = (angleCos - spotCutoff) / penumbraRange;
          const smoothedSpotFactor = Math.min(1.0, spotFactor);
          
          factor = baseIntensity * smoothedSpotFactor;
          
          // Apply normal mapping
          if (normalX !== undefined && normalY !== undefined && normalZ !== undefined) {
            const dotProduct = normalX * dirToPtX + normalY * dirToPtY + normalZ * dirToPtZ;
            factor *= Math.max(0, dotProduct);
          }
        }
        break;
    }
    
    return factor;
  }
}

// ==================== LIGHTING MANAGER ====================
class LightingManager {
  constructor() {
    this.lights = {};
    this.lightsByType = {};
    this.ambientColor = "#111122"; // Default dark blue ambient
    this.ambientIntensity = 0.15;  // Default low ambient light
    this.debugMode = false;
    
    // Initialize type lookup
    Object.values(LightType).forEach(type => {
      this.lightsByType[type] = [];
    });
    
    // Default lighting setup
    this.createDefaultLights();
    
    // Create offscreen canvas for shadow calculations
    this.shadowMapCanvas = document.createElement('canvas');
    this.shadowMapCanvas.width = 360; // One degree per pixel
    this.shadowMapCanvas.height = 1;  // Just one row needed for 2D shadows
    this.shadowMapCtx = this.shadowMapCanvas.getContext('2d');
  }
  
  createDefaultLights() {
    // Add default ambient light
    this.addLight(new Light(LightType.AMBIENT, {
      color: this.ambientColor,
      intensity: this.ambientIntensity
    }));
  }
  
  addLight(light) {
    this.lights[light.id] = light;
    this.lightsByType[light.type].push(light.id);
    return light.id;
  }
  
  removeLight(lightId) {
    const light = this.lights[lightId];
    if (!light) return false;
    
    // Remove from type lookup
    const typeArray = this.lightsByType[light.type];
    if (typeArray) {
      const index = typeArray.indexOf(lightId);
      if (index !== -1) typeArray.splice(index, 1);
    }
    
    delete this.lights[lightId];
    return true;
  }
  
  getById(lightId) {
    return this.lights[lightId];
  }
  
  getByType(type) {
    const ids = this.lightsByType[type] || [];
    return ids.map(id => this.lights[id]);
  }
  
  update(dt) {
    // Update all lights
    for (const id in this.lights) {
      this.lights[id].update(dt);
    }
  }
  
  // Generate shadow map for a specific light
  generateShadowMap(light, viewerX, viewerY, worldMap, castRay) {
    // Shadow maps only for point and spot lights
    if (light.type !== LightType.POINT && light.type !== LightType.SPOT) return null;
    
    // Skip if shadow casting disabled
    if (!light.castShadows) return null;
    
    // Clear shadow map
    this.shadowMapCtx.clearRect(0, 0, this.shadowMapCanvas.width, 1);
    
    // For each degree around the light
    for (let angle = 0; angle < 360; angle++) {
      const radians = angle * Math.PI / 180;
      
      // Cast ray from light
      const ray = castRay(light.x, light.y, radians);
      
      // Calculate shadow opacity based on distance
      const shadowOpacity = Math.min(1.0, ray.distance / light.radius);
      
      // Draw to shadow map
      this.shadowMapCtx.fillStyle = `rgba(0,0,0,${shadowOpacity})`;
      this.shadowMapCtx.fillRect(angle, 0, 1, 1);
    }
    
    return this.shadowMapCanvas;
  }
  
  // Calculate lighting for a specific pixel in the scene
  calculateLighting(x, y, z, normalX, normalY, normalZ, specularFactor = 0) {
    let totalR = 0, totalG = 0, totalB = 0;
    
    // Convert world coordinates to local texture coordinates for normal mapping
    const texX = x - Math.floor(x);
    const texY = y - Math.floor(y);
    
    // Process all lights
    for (const id in this.lights) {
      const light = this.lights[id];
      if (!light.active) continue;
      
      // Get light contribution factor
      const factor = light.calculateLightingAt(x, y, z, normalX, normalY, normalZ);
      
      // Add contribution to total light
      if (factor > 0) {
        // Parse light color to RGB
        const r = parseInt(light.color.substr(1, 2), 16) / 255;
        const g = parseInt(light.color.substr(3, 2), 16) / 255;
        const b = parseInt(light.color.substr(5, 2), 16) / 255;
        
        totalR += r * factor;
        totalG += g * factor;
        totalB += b * factor;
        
        // Add specular highlights
        if (specularFactor > 0 && light.type !== LightType.AMBIENT) {
          // For point and spot lights, calculate reflection vector
          if (light.type === LightType.POINT || light.type === LightType.SPOT) {
            // Calculate light direction
            const dx = light.x - x;
            const dy = light.y - y;
            const dz = light.z - z;
            const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
            
            // Skip if too far away
            if (dist > light.radius) continue;
            
            // Normalize
            const lightDirX = dx / dist;
            const lightDirY = dy / dist;
            const lightDirZ = dz / dist;
            
            // Calculate reflection vector (2(N·L)N - L)
            const dotNL = normalX * lightDirX + normalY * lightDirY + normalZ * lightDirZ;
            if (dotNL < 0) continue; // Light from behind surface
            
            const reflectionX = 2 * dotNL * normalX - lightDirX;
            const reflectionY = 2 * dotNL * normalY - lightDirY;
            const reflectionZ = 2 * dotNL * normalZ - lightDirZ;
            
            // Viewer direction (assuming viewer is above looking down)
            const viewerDirX = 0;
            const viewerDirY = 0;
            const viewerDirZ = 1;
            
            // Calculate specular factor (R·V)^shininess
            const dotRV = reflectionX * viewerDirX + reflectionY * viewerDirY + reflectionZ * viewerDirZ;
            if (dotRV > 0) {
              const shininess = 32.0; // Higher = sharper highlights
              const spec = Math.pow(dotRV, shininess) * specularFactor;
              
              totalR += r * spec;
              totalG += g * spec;
              totalB += b * spec;
            }
          }
        }
      }
    }
    
    // Clamp values
    totalR = Math.min(1.0, Math.max(0.0, totalR));
    totalG = Math.min(1.0, Math.max(0.0, totalG));
    totalB = Math.min(1.0, Math.max(0.0, totalB));
    
    // Convert to hex color
    const hexR = Math.floor(totalR * 255).toString(16).padStart(2, '0');
    const hexG = Math.floor(totalG * 255).toString(16).padStart(2, '0');
    const hexB = Math.floor(totalB * 255).toString(16).padStart(2, '0');
    
    return `#${hexR}${hexG}${hexB}`;
  }
  
  // Apply lighting to an entity for rendering
  applyLightingToEntity(entity, ctx, screenX, screenY, spriteWidth, spriteHeight) {
    // Skip if no lights or entity not visible
    if (Object.keys(this.lights).length === 0 || !entity.visible) return;
    
    // Calculate entity lighting
    const lightColor = this.calculateLighting(
      entity.x, entity.y, entity.z || 0,
      entity.normalX, entity.normalY, entity.normalZ
    );
    
    // Apply lighting as a colored overlay
    ctx.fillStyle = lightColor;
    ctx.globalCompositeOperation = "multiply";
    ctx.fillRect(
      screenX - spriteWidth / 2,
      screenY,
      spriteWidth,
      spriteHeight
    );
    ctx.globalCompositeOperation = "source-over";
  }
  
  // Debug render all lights on the minimap
  renderDebugMinimap(ctx, tileSize) {
    if (!this.debugMode) return;
    
    // Make debug visualization more prominent
    for (const id in this.lights) {
      const light = this.lights[id];
      
      // Only show point and spot lights
      if (light.type !== LightType.POINT && light.type !== LightType.SPOT) continue;
      
      // Draw light position
      ctx.fillStyle = light.color;
      ctx.beginPath();
      ctx.arc(light.x * tileSize, light.y * tileSize, tileSize/3, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw light radius with more visible effect
      ctx.strokeStyle = light.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(light.x * tileSize, light.y * tileSize, light.radius * tileSize, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
      
      // Add a semi-transparent fill for the light area
      ctx.fillStyle = light.color.replace(')', ', 0.1)').replace('rgb', 'rgba');
      ctx.beginPath();
      ctx.arc(light.x * tileSize, light.y * tileSize, light.radius * tileSize, 0, Math.PI * 2);
      ctx.fill();
      
      // For spot lights, draw direction cone
      if (light.type === LightType.SPOT) {
        const startX = light.x * tileSize;
        const startY = light.y * tileSize;
        const endX = startX + light.dirX * light.radius * tileSize;
        const endY = startY + light.dirY * light.radius * tileSize;
        
        // Draw direction line
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        
        // Draw cone with more visible effect
        const coneAngle = light.angle;
        const leftAngle = Math.atan2(light.dirY, light.dirX) - coneAngle;
        const rightAngle = Math.atan2(light.dirY, light.dirX) + coneAngle;
        
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(
          startX + Math.cos(leftAngle) * light.radius * tileSize,
          startY + Math.sin(leftAngle) * light.radius * tileSize
        );
        ctx.arc(
          startX, startY,
          light.radius * tileSize,
          leftAngle, rightAngle
        );
        ctx.lineTo(startX, startY);
        ctx.globalAlpha = 0.3;
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }
    }
  }
}

// ==================== NORMAL MAPPING UTILITIES ====================
class NormalMapper {
  constructor() {
    // Create offscreen canvas for normal map calculations
    this.normalCanvas = document.createElement('canvas');
    this.normalCtx = this.normalCanvas.getContext('2d');
  }
  
  // Extract normal vector from normal map texture
  getNormalFromTexture(normalMap, textureX, textureY) {
    // Ensure normal map is loaded
    if (!normalMap || !normalMapLoaded) {
      return { x: 0, y: 0, z: 1 }; // Default normal pointing outward
    }
    
    // Calculate pixel coordinates in texture
    const pixelX = Math.floor(textureX * normalMap.width);
    const pixelY = Math.floor(textureY * normalMap.height);
    
    // Draw the single pixel to our offscreen canvas to extract its color
    this.normalCanvas.width = 1;
    this.normalCanvas.height = 1;
    this.normalCtx.drawImage(
      normalMap,
      pixelX, pixelY, 1, 1,
      0, 0, 1, 1
    );
    
    // Get pixel data
    const pixelData = this.normalCtx.getImageData(0, 0, 1, 1).data;
    
    // Convert RGB to normal vector (RGB values are 0-255, normals need -1 to 1)
    let normalX = (pixelData[0] / 255) * 2 - 1;
    let normalY = (pixelData[1] / 255) * 2 - 1;
    let normalZ = (pixelData[2] / 255); // Z is usually stored in 0-1 range
    
    // Normalize the vector
    const length = Math.sqrt(normalX*normalX + normalY*normalY + normalZ*normalZ);
    normalX /= length;
    normalY /= length;
    normalZ /= length;
    
    return { x: normalX, y: normalY, z: normalZ };
  }
  
  // Get specular factor from specular map
  getSpecularFromTexture(specularMap, textureX, textureY) {
    // Ensure specular map is loaded
    if (!specularMap || !specularMapLoaded) {
      return 0.5; // Default medium specular
    }
    
    // Calculate pixel coordinates in texture
    const pixelX = Math.floor(textureX * specularMap.width);
    const pixelY = Math.floor(textureY * specularMap.height);
    
    // Draw the single pixel to our offscreen canvas to extract its color
    this.normalCanvas.width = 1;
    this.normalCanvas.height = 1;
    this.normalCtx.drawImage(
      specularMap,
      pixelX, pixelY, 1, 1,
      0, 0, 1, 1
    );
    
    // Get pixel data (using red channel for specular intensity)
    const pixelData = this.normalCtx.getImageData(0, 0, 1, 1).data;
    return pixelData[0] / 255;
  }
  
  // Get ambient occlusion factor from AO map
  getAOFromTexture(aoMap, textureX, textureY) {
    // Ensure AO map is loaded
    if (!aoMap || !aoMapLoaded) {
      return 1.0; // Default no occlusion
    }
    
    // Calculate pixel coordinates in texture
    const pixelX = Math.floor(textureX * aoMap.width);
    const pixelY = Math.floor(textureY * aoMap.height);
    
    // Draw the single pixel to our offscreen canvas to extract its color
    this.normalCanvas.width = 1;
    this.normalCanvas.height = 1;
    this.normalCtx.drawImage(
      aoMap,
      pixelX, pixelY, 1, 1,
      0, 0, 1, 1
    );
    
    // Get pixel data (white = no occlusion, black = full occlusion)
    const pixelData = this.normalCtx.getImageData(0, 0, 1, 1).data;
    return pixelData[0] / 255;
  }
}

// ==================== EXPORT & INITIALIZATION ====================
// Export classes and objects globally
let lightingManager;
let normalMapper;

function initLighting() {
  // Initialize lighting manager
  lightingManager = new LightingManager();
  
  // Initialize normal mapper
  normalMapper = new NormalMapper();
  
  // Create player torch
  const playerTorch = new Light(LightType.POINT, {
    color: "#ff9933", // Warm orange light
    intensity: 1.5, // Brighter light
    radius: 7.0, // Larger radius
    decay: 2.0,
    z: 0.5, // Light slightly above ground
    flickerEnabled: true,
    flickerSpeed: 15,
    flickerIntensity: 0.3
  });
  
  // Add player torch
  const torchId = lightingManager.addLight(playerTorch);
  
  // Store torch light in player object for easy updating
  window.playerTorchLightId = torchId;
  
  // Export objects globally
  window.LightType = LightType;
  window.Light = Light;
  window.lightingManager = lightingManager;
  window.normalMapper = normalMapper;
  
  console.log("Lighting system initialized!");
}

// Update player torch position to follow player
function updatePlayerTorch() {
  if (window.playerTorchLightId && window.player) {
    const torch = lightingManager.getById(window.playerTorchLightId);
    if (torch) {
      torch.x = window.animX();
      torch.y = window.animY();
    }
  }
}

// Function to apply lighting to the 3D view
function applyLightingTo3DView(ctx, ray, x, lineTop, lineH, texX, texY) {
  // Skip if lighting not initialized
  if (!lightingManager || !normalMapper) return;
  
  // Get normal vector from normal map
  const normal = normalMapper.getNormalFromTexture(normalMap, texX, texY);
  
  // Get specular factor
  const specularFactor = normalMapper.getSpecularFromTexture(specularMap, texX, texY);
  
  // Get ambient occlusion factor
  const aoFactor = normalMapper.getAOFromTexture(aoMap, texX, texY);
  
  // Calculate world position of the wall pixel
  const worldX = window.player.x + ray.distance * Math.cos(window.player.angle);
  const worldY = window.player.y + ray.distance * Math.sin(window.player.angle);
  
  // Calculate lighting at this point
  const pixelHeight = lineH / wallTexture.height;
  
  // Calculate lighting for the entire column
  for (let y = 0; y < lineH; y++) {
    // Skip if pixel is outside screen
    if (lineTop + y < 0 || lineTop + y >= window.screenH) continue;
    
    // Calculate height on the wall (0-1)
    const wallHeight = y / lineH;
    
    // Calculate lighting color
    const lightColor = lightingManager.calculateLighting(
      worldX, worldY, wallHeight,
      normal.x, normal.y, normal.z,
      specularFactor
    );
    
    // Apply ambient occlusion
    let finalColor = lightColor;
    if (aoFactor < 1.0) {
      // Darken color based on AO factor
      const r = parseInt(lightColor.substr(1, 2), 16) * aoFactor;
      const g = parseInt(lightColor.substr(3, 2), 16) * aoFactor;
      const b = parseInt(lightColor.substr(5, 2), 16) * aoFactor;
      
      finalColor = `#${Math.floor(r).toString(16).padStart(2, '0')}${Math.floor(g).toString(16).padStart(2, '0')}${Math.floor(b).toString(16).padStart(2, '0')}`;
    }
    
    // Apply lighting to the pixel
    ctx.fillStyle = finalColor;
    ctx.fillRect(x, lineTop + y, 1, 1);
  }
}

// Hook into the game loop to update lighting
function updateLighting(dt) {
  if (!lightingManager) return;
  
  // Update all lights
  lightingManager.update(dt);
  
  // Update player torch position
  updatePlayerTorch();
}

// ==================== EXPORT ENHANCED 3D RENDERING FUNCTION THAT APPLIES LIGHTING ====================
function enhancedDraw3DView() {
  // Clear screen
  window.ctx.fillStyle = "black";
  window.ctx.fillRect(0, 0, window.screenW, window.screenH);

  // Log texture loading status
  if (!window._texturesChecked) {
    window._texturesChecked = true;
    console.log("Texture loading status:");
    console.log("- Wall texture loaded:", window.wallTextureLoaded);
    console.log("- Normal map loaded:", normalMapLoaded);
    console.log("- Specular map loaded:", specularMapLoaded); 
    console.log("- AO map loaded:", aoMapLoaded);
  }
  
  for (var x = 0; x < window.screenW; x++) {
    var rayAngle = window.player.angle - window.fov/2 + (x / window.screenW) * window.fov;
    var ray = window.castRay(window.animX(), window.animY(), rayAngle);
    var dist = ray.distance * Math.cos(rayAngle - window.player.angle);
    var lineH = window.screenH / dist;
    var lineTop = (window.screenH - lineH) / 2;
    
    // Draw ceiling (dark, only slightly lit by ambient light)
    const ceilingLight = lightingManager ? 
      lightingManager.calculateLighting(
        window.animX(), window.animY(), 1.0, 0, 0, -1
      ) : "#111122";
    window.ctx.fillStyle = ceilingLight;
    window.ctx.fillRect(x, 0, 1, lineTop);
    
// Draw wall
    // if (window.wallTextureLoaded) {
      // // IMPORTANT - First calculate the lighting for this pixel
      // // based on distance from the player's torch
      
      // // Calculate world position of wall hit
      // const wallX = window.animX() + ray.distance * Math.cos(rayAngle);
      // const wallY = window.animY() + ray.distance * Math.sin(rayAngle);
      
      // // Get basic lighting information
      // const torchRadius = 7.0; // How far the torch light reaches
      // const wallDistFromPlayer = Math.sqrt(
        // Math.pow(wallX - window.animX(), 2) + 
        // Math.pow(wallY - window.animY(), 2)
      // );
      
      // // START WITH DARKNESS - this is crucial
      // // Calculate attenuation - how much light reaches this point
      // let lightLevel = 0; // Start with total darkness
      
      // // Add ambient lighting (very dim)
      // lightLevel += 0.05;
      
      // // Add torch light with distance falloff
      // if (wallDistFromPlayer < torchRadius) {
        // // Use inverse square falloff for realistic light
        // lightLevel += 1.0 * Math.pow(1.0 - (wallDistFromPlayer / torchRadius), 2);
      // }
      
      // // Clamp to 0-1 range
      // lightLevel = Math.min(1.0, Math.max(0.01, lightLevel));




	if (window.wallTextureLoaded) {
	  // Calculate world position of wall hit
	  const wallX = window.animX() + ray.distance * Math.cos(rayAngle);
	  const wallY = window.animY() + ray.distance * Math.sin(rayAngle);
	  
	  // Simple distance-based lighting
	  const torchRadius = lightingQuality === "high" ? 8.0 : 6.0; // Different radius based on quality
	  const wallDistFromPlayer = Math.sqrt(
		Math.pow(wallX - window.animX(), 2) + 
		Math.pow(wallY - window.animY(), 2)
	  );
	  
	  // Use ambient level parameter
	  const ambientLevel = window.ambientLevel || 0.2; // Default if not set
	  
	  // Calculate lighting level based on distance
	  let lightLevel = ambientLevel; // Use the configurable ambient level
	  
	  // Add torch light with distance falloff
	  if (wallDistFromPlayer < torchRadius) {
		lightLevel += lightingQuality === "high" 
		  ? 1.0 * Math.pow(1.0 - (wallDistFromPlayer / torchRadius), 2) // Quadratic falloff (high quality)
		  : 0.8 * (1.0 - (wallDistFromPlayer / torchRadius));           // Linear falloff (low quality)
	  }
	  
	  lightLevel = Math.min(1.0, Math.max(0.05, lightLevel));
	  
	  // Draw base wall texture
	  var texX = Math.floor(ray.textureX * window.wallTexture.width);
	  window.ctx.drawImage(window.wallTexture, texX, 0, 1, window.wallTexture.height, x, lineTop, 1, lineH);
	  
	  // Apply the lighting effect as a single operation
	  window.ctx.fillStyle = `rgba(0, 0, 0, ${1.0 - lightLevel})`;
	  window.ctx.fillRect(x, lineTop, 1, lineH);
	  
	  // Only add the warm glow effect in high quality mode
	  if (lightingQuality === "high" && lightLevel > 0.2) {
		// Add warm torch glow
		const torchR = 1.0;
		const torchG = 0.8;
		const torchB = 0.5;
		const tintOpacity = 0.15 * lightLevel;
		
		window.ctx.fillStyle = `rgba(${Math.floor(torchR * 255)}, ${Math.floor(torchG * 255)}, ${Math.floor(torchB * 255)}, ${tintOpacity})`;
		window.ctx.globalCompositeOperation = "overlay";
		window.ctx.fillRect(x, lineTop, 1, lineH);
		window.ctx.globalCompositeOperation = "source-over";
	  }
	}

 
    // Draw floor with darkness gradient
    window.ctx.fillStyle = "#333";
    var floorStart = lineTop + lineH;
    if (floorStart < window.screenH) {
      // Draw floor with darkness gradient for depth
      const floorGradient = window.ctx.createLinearGradient(
        x, floorStart, 
        x, window.screenH
      );
      
      // Start with lit floor near player's feet
      floorGradient.addColorStop(0, "#333");
      
      // Fade to black with distance
      floorGradient.addColorStop(1, "#111");
      
      window.ctx.fillStyle = floorGradient;
      window.ctx.fillRect(x, floorStart, 1, window.screenH - floorStart);
    }
  }
  
  // Render entities
  if (window.renderGameEntities) {
    window.renderGameEntities();
  }
}

// Hook into the entity rendering pipeline to apply lighting to entities
function applyLightingToEntities(entityManager) {
  if (!lightingManager) return;
  
  // Get all visible entities
  const entities = entityManager.getAllEntities().filter(e => e.visible);
  
  // Apply lighting to each entity
  for (const entity of entities) {
    // Skip if entity is not visible or not active
    if (!entity.visible || !entity.active) continue;
    
    // Calculate lighting at entity position
    const lightColor = lightingManager.calculateLighting(
      entity.x, entity.y, entity.z || 0,
      entity.normalX || 0, entity.normalY || 0, entity.normalZ || 1
    );
    
    // Store lighting color for entity to use in its render method
    entity.lightingColor = lightColor;
  }
}

// Enhanced entity rendering with lighting
function enhancedRenderEntity(entity, ctx, player, screenW, screenH, fov, castRay) {
  // Skip if entity not visible or not active
  if (!entity.visible || !entity.active) return;
  
  // Calculate vector from player to entity
  const dx = entity.x - player.x;
  const dy = entity.y - player.y;
  const distance = Math.sqrt(dx*dx + dy*dy);
  
  // Calculate angle to entity
  const angle = Math.atan2(dy, dx);
  
  // Calculate angle difference
  let angleDiff = angle - player.angle;
  
  // Normalize angle difference to [-PI, PI]
  while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
  while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
  
  // Only display if within field of view
  if (Math.abs(angleDiff) > fov/2) return;
  
  // Check for wall occlusion
  const ray = castRay(player.x, player.y, angle);
  if (ray.distance < distance - 0.1) return;
  
  // Calculate screen position
  const screenX = screenW / 2 + (angleDiff / (fov/2)) * (screenW / 2);
  
  // Calculate size based on distance
  const scale = 1.0 / distance;
  const spriteHeight = entity.height * scale * screenH * 0.5;
  const spriteWidth = entity.width * scale * screenH * 0.5;
  
  // Position vertically centered
  const screenY = screenH / 2 - spriteHeight / 2;
  
  // Calculate light level based on distance from player's torch
  const torchRadius = 7.0;
  let lightLevel = 0.05; // Ambient
  
  if (distance < torchRadius) {
    lightLevel += 1.0 * Math.pow(1.0 - (distance / torchRadius), 2);
  }
  
  lightLevel = Math.min(1.0, Math.max(0.05, lightLevel));
  
  // Draw the entity with standard method but respect lighting
  ctx.fillStyle = entity.color || "red";
  ctx.fillRect(
    screenX - spriteWidth / 2,
    screenY,
    spriteWidth,
    spriteHeight
  );
  
  // Apply darkness based on distance from torch
  ctx.fillStyle = `rgba(0, 0, 0, ${1.0 - lightLevel})`;
  ctx.fillRect(
    screenX - spriteWidth / 2,
    screenY,
    spriteWidth,
    spriteHeight
  );
  
  // Draw entity info text - only if lit enough to see
  if (lightLevel > 0.2) {
    const textBrightness = Math.min(1.0, lightLevel * 2); // Make text slightly more visible
    ctx.fillStyle = `rgba(255, 255, 255, ${textBrightness})`;
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`${entity.type === 'monster' ? entity.name : entity.type}: ${distance.toFixed(1)}`, screenX, screenY - 5);
    
    // Draw health for monsters
    if (entity.type === 'monster' && entity.properties && entity.properties.health) {
      ctx.fillText(`HP: ${entity.properties.health}`, screenX, screenY - 20);
    }
  }
}

// Initialize the lighting system
window.addEventListener("load", function() {
  // Make sure entity system is loaded before initializing lighting
  if (window.Entity && window.EntityManager) {
    // Initialize lighting system
    initLighting();
    
    // Override the original draw3DView with our enhanced version
    const originalDraw3DView = window.draw3DView;
    window.enhancedDraw3DView = enhancedDraw3DView;
    
    // Override entity render method
    if (window.Entity) {
      // Store original render method
      const originalRender = window.Entity.prototype.render;
      
      // Create enhanced render method
      window.Entity.prototype.render = function(ctx, player, screenW, screenH, fov, castRay) {
        // Use enhanced rendering for entity
        enhancedRenderEntity(this, ctx, player, screenW, screenH, fov, castRay);
      };
    }
    
    // Hook into the game loop to update lighting
    const originalUpdateGame = window.updateGame;
    if (originalUpdateGame) {
      window.updateGame = function(dt) {
        // Call original update function
        originalUpdateGame(dt);
        
        // Update lighting
        updateLighting(dt);
        
        // Apply lighting to entities
        if (window.entityManager) {
          applyLightingToEntities(window.entityManager);
        }
      };
    }
    
    // Hook into the debug rendering
    const originalDrawMiniMap = window.drawMiniMap;
    if (originalDrawMiniMap) {
      window.drawMiniMap = function() {
        // Call original minimap function
        originalDrawMiniMap();
        
        // Add lighting debug information to minimap
        if (lightingManager) {
          const miniCanvas = document.getElementById("miniMapCanvas");
          const miniCtx = miniCanvas.getContext("2d");
          lightingManager.renderDebugMinimap(miniCtx, 8);
        }
      };
    }
    
    console.log("Lighting system hooks installed successfully!");
  } else {
    console.error("Entity system not loaded. Lighting system initialization delayed.");
    
    // Try again in 100ms
    setTimeout(function() {
      if (window.Entity && window.EntityManager) {
        initLighting();
      } else {
        console.error("Entity system still not loaded. Lighting system initialization failed.");
      }
    }, 100);
  }
});

// ==================== INITIALIZATION ENHANCEMENT ====================
// Fix the lighting to be OFF by default
function fixLightingSystem() {
	
	console.log("FIXING LIGHTING - current state:", window.useEnhancedLighting);	
  // Ensure enhanced lighting is ON by default
	window.useEnhancedLighting = true; // Force it ON instead of OFF
 	console.log("FIXING LIGHTING - current state:", window.useEnhancedLighting);	
    console.log("FIXING LIGHTING - current state:", window.useEnhancedLighting);	
	
  // Initialize with high quality lighting
  lightingQuality = "high";
  window.ambientLevel = 0.2; // Set initial ambient level
  
  // Ensure enhanced lighting is ON
  window.useEnhancedLighting = true;
  
	
  // Replace the default enhancedDraw3DView function
  window.enhancedDraw3DView = enhancedDraw3DView;
  
  // Make sure debug rendering is more visible
  if (window.lightingManager) {
    // Override the debug rendering with our enhanced version
    window.lightingManager.renderDebugMinimap = renderDebugMinimap;
    
    // Make sure player torch has appropriate properties
    if (window.playerTorchLightId) {
      const torch = window.lightingManager.getById(window.playerTorchLightId);
      if (torch) {
        torch.radius = 7.0;        // Larger radius
        torch.intensity = 1.5;     // Brighter
        torch.decay = 2.0;         // Quadratic falloff
        torch.flickerIntensity = 0.3; // More noticeable flicker
      }
    }
  }
  
  console.log("Lighting system fixed - toggle with L key");
}

// Call the fix function after a short delay to ensure everything is loaded
setTimeout(fixLightingSystem, 1000);