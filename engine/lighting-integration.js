// lighting-integration.js - Integrates lighting and normal mapping with the engine
// This file bridges the lighting.js and normal.js systems with the game engine

// ==================== INTEGRATION HELPERS ====================
// Enhanced ray casting to include normal information
function castRayWithNormals(px, py, angle) {
  // Use the original castRay function as base
  const ray = window.castRay(px, py, angle);
  
  // Add normal vector based on hit surface
  if (ray.hitVertical) {
    // For vertical walls, normal points along X axis
    ray.normalX = ray.distance > 0 ? -Math.cos(angle) : Math.cos(angle);
    ray.normalY = 0;
  } else {
    // For horizontal walls, normal points along Y axis
    ray.normalX = 0;
    ray.normalY = ray.distance > 0 ? -Math.sin(angle) : Math.sin(angle);
  }
  ray.normalZ = 0;
  
  return ray;
}

// Enhanced 3D view rendering with lighting and normal mapping
function enhancedDraw3DView() {
  // Skip if rendering context not available
  if (!window.ctx) return;
  
  // Clear the screen
  window.ctx.fillStyle = "black";
  window.ctx.fillRect(0, 0, window.screenW, window.screenH);
  
  // Draw each vertical line (column) of the 3D view
  for (let x = 0; x < window.screenW; x++) {
    // Calculate ray angle for this column
    const rayAngle = window.player.angle - window.fov/2 + (x / window.screenW) * window.fov;
    
    // Cast ray with normal information
    const ray = castRayWithNormals(window.animX(), window.animY(), rayAngle);
    
    // Apply fish-eye correction
    const dist = ray.distance * Math.cos(rayAngle - window.player.angle);
    
    // Calculate wall height and position
    const lineH = window.screenH / dist;
    const lineTop = (window.screenH - lineH) / 2;
    
    // Draw ceiling
    const ceilingLight = window.lightingManager ? 
      window.lightingManager.calculateLighting(
        window.animX(), window.animY(), 1.0, 0, 0, -1
      ) : "#223";
    window.ctx.fillStyle = ceilingLight;
    window.ctx.fillRect(x, 0, 1, lineTop);
    
    // Draw wall
    if (window.wallTextureLoaded) {
      // Get texture coordinate
      const texX = ray.textureX;
      const texY = 0; // Default for vertical strips
      
      // Draw the base wall texture
      const texWidth = 1; // Draw one pixel wide on texture
      const texHeight = window.wallTexture.height;
      
      // Draw texture column to screen
      window.ctx.drawImage(
        window.wallTexture, 
        Math.floor(texX * texWidth * window.wallTexture.width), 0, 
        texWidth, texHeight, 
        x, lineTop, 
        1, lineH
      );
      
      // Apply lighting if available
      if (window.lightingManager && window.normalMapping) {
        // Calculate world position of wall hit
        const wallX = window.animX() + ray.distance * Math.cos(rayAngle);
        const wallY = window.animY() + ray.distance * Math.sin(rayAngle);
        
        // Get normal vector from normal map or ray
        let normal;
        if (window.normalMapping && window.normalMapping.getNormalAt) {
          normal = window.normalMapping.getNormalAt("Wall1", texX, 0.5);
        } else {
          normal = { x: ray.normalX, y: ray.normalY, z: ray.normalZ || 0 };
        }
        
        // Get specular and AO factors
        let specular = 0.5;
        let ao = 1.0;
        if (window.normalMapping) {
          if (window.normalMapping.getSpecularAt)
            specular = window.normalMapping.getSpecularAt("Wall1", texX, 0.5);
          if (window.normalMapping.getAOAt)
            ao = window.normalMapping.getAOAt("Wall1", texX, 0.5);
        }
        
        // Apply lighting to each pixel in the wall column
        for (let y = 0; y < lineH; y++) {
          // Skip if outside screen
          if (lineTop + y < 0 || lineTop + y >= window.screenH) continue;
          
          // Calculate height percentage on wall
          const wallHeightPercent = y / lineH;
          
          // Calculate world Z position
          const wallZ = 1.0 - wallHeightPercent;
          
          // Calculate lighting at this point
          const lighting = window.lightingManager.calculateLighting(
            wallX, wallY, wallZ,
            normal.x, normal.y, normal.z,
            specular
          );
          
          // Apply ambient occlusion
          let finalColor = lighting;
          if (ao < 1.0) {
            // Parse color and apply AO factor
            const r = parseInt(lighting.substr(1, 2), 16);
            const g = parseInt(lighting.substr(3, 2), 16);
            const b = parseInt(lighting.substr(5, 2), 16);
            
            // Apply AO
            const r2 = Math.floor(r * ao);
            const g2 = Math.floor(g * ao);
            const b2 = Math.floor(b * ao);
            
            // Format back to hex
            finalColor = `#${r2.toString(16).padStart(2,'0')}${g2.toString(16).padStart(2,'0')}${b2.toString(16).padStart(2,'0')}`;
          }
          
          // Apply lighting using multiply blend mode
          window.ctx.fillStyle = finalColor;
          window.ctx.globalCompositeOperation = "multiply";
          window.ctx.fillRect(x, lineTop + y, 1, 1);
          window.ctx.globalCompositeOperation = "source-over";
        }
      } 
      // If no advanced lighting, apply simple exit marking
      else if (ray.tileType === 2) {
        window.ctx.fillStyle = "rgba(0,0,0,0.4)";
        window.ctx.fillRect(x, lineTop, 1, lineH);
      }
    } 
    // If texture not loaded, use simple colors
    else {
      window.ctx.fillStyle = (ray.tileType === 2) ? "#444" : 
                            (ray.hitVertical ? "rgb(200,200,200)" : "rgb(255,255,255)");
      window.ctx.fillRect(x, lineTop, 1, lineH);
    }
    
    // Draw floor
    const floorStart = lineTop + lineH;
    if (floorStart < window.screenH) {
      const floorLight = window.lightingManager ? 
        window.lightingManager.calculateLighting(
          window.animX(), window.animY(), 0.0, 0, 0, 1
        ) : "#333";
      window.ctx.fillStyle = floorLight;
      window.ctx.fillRect(x, floorStart, 1, window.screenH - floorStart);
    }
  }
  
  // Render entities if rendering function exists
  if (window.renderGameEntities) {
    window.renderGameEntities();
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
  
  // Draw the entity with standard method
  ctx.fillStyle = entity.color || "red";
  ctx.fillRect(
    screenX - spriteWidth / 2,
    screenY,
    spriteWidth,
    spriteHeight
  );
  
  // Apply lighting effect if lighting system is available
  if (window.lightingManager) {
    // Calculate entity lighting
    const lightColor = window.lightingManager.calculateLighting(
      entity.x, entity.y, entity.z || 0.5,
      entity.normalX || 0, entity.normalY || 0, entity.normalZ || 1
    );
    
    // Apply lighting via multiply blend
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
  
  // Draw entity info text
  ctx.fillStyle = "white";
  ctx.font = "12px Arial";
  ctx.textAlign = "center";
  ctx.fillText(`${entity.type === 'monster' ? entity.name : entity.type}: ${distance.toFixed(1)}`, screenX, screenY - 5);
  
  // Draw health for monsters
  if (entity.type === 'monster' && entity.properties && entity.properties.health) {
    ctx.fillText(`HP: ${entity.properties.health}`, screenX, screenY - 20);
  }
}

// Modify projectile rendering to include lighting
function enhancedRenderProjectile(projectile, ctx, player, screenW, screenH, fov, castRay) {
  if (!projectile.visible || !projectile.active) return;
  
  // Standard projectile rendering logic
  const dx = projectile.x - player.x;
  const dy = projectile.y - player.y;
  const distance = Math.sqrt(dx*dx + dy*dy);
  
  const angle = Math.atan2(dy, dx);
  let angleDiff = angle - player.angle;
  
  // Normalize angle difference
  while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
  while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
  
  // Check if in view
  if (Math.abs(angleDiff) > fov/2) return;
  
  // Check occlusion
  const ray = castRay(player.x, player.y, angle);
  if (ray.distance < distance - 0.3) return;
  
  // Calculate screen position
  const screenX = screenW / 2 + (angleDiff / (fov/2)) * (screenW / 2);
  
  // Calculate size
  const scale = 1.0 / distance;
  const spriteHeight = projectile.height * scale * screenH * 0.5;
  const spriteWidth = projectile.width * scale * screenH * 0.5;
  
  // Position vertically
  const screenY = screenH / 2 - spriteHeight / 2;
  
  // Draw projectile 
  ctx.fillStyle = projectile.color;
  ctx.beginPath();
  ctx.arc(
    screenX,
    screenY + spriteHeight / 2,
    spriteWidth / 2,
    0,
    Math.PI * 2
  );
  ctx.fill();
  
  // Add lighting/glow effect for projectiles
  if (window.lightingManager) {
    // Create a radial gradient for glow effect
    const gradient = ctx.createRadialGradient(
      screenX, screenY + spriteHeight / 2, 0,
      screenX, screenY + spriteHeight / 2, spriteWidth
    );
    
    // Get base color from projectile
    const baseColor = projectile.color || "#ff0000";
    
    // Add gradient stops
    gradient.addColorStop(0, baseColor);
    gradient.addColorStop(0.7, baseColor.replace(')', ', 0.5)').replace('rgb', 'rgba'));
    gradient.addColorStop(1, baseColor.replace(')', ', 0)').replace('rgb', 'rgba'));
    
    // Draw glow effect
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(
      screenX,
      screenY + spriteHeight / 2,
      spriteWidth,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }
  
  // Draw projectile info
  if (!projectile.collided) {
    ctx.fillStyle = "white";
    ctx.font = "10px Arial";
    ctx.textAlign = "center";
    ctx.fillText(projectile.name, screenX, screenY - 5);
    ctx.fillText(distance.toFixed(1) + "m", screenX, screenY + spriteHeight + 12);
  }
}

// ==================== SETUP HELPERS ====================
// Create a torch light attached to player
function createPlayerTorch() {
  if (!window.lightingManager || !window.LightType) return null;
  
  // Create torch light
  const torch = new window.Light(window.LightType.POINT, {
    color: "#ff9933", // Warm orange torch color
    intensity: 1.0,
    radius: 5.0,
    decay: 2.0,
    z: 0.5, // Slightly above ground
    flickerEnabled: true,
    flickerSpeed: 12,
    flickerIntensity: 0.2
  });
  
  // Add to lighting manager
  const torchId = window.lightingManager.addLight(torch);
  
  // Store globally for easy access
  window.playerTorchId = torchId;
  
  return torchId;
}

// Create ambient light
function createAmbientLight(color = "#111122", intensity = 0.15) {
  if (!window.lightingManager || !window.LightType) return null;
  
  // Create ambient light
  const ambient = new window.Light(window.LightType.AMBIENT, {
    color: color,
    intensity: intensity
  });
  
  // Add to lighting manager
  return window.lightingManager.addLight(ambient);
}

// Create a spot light (for directional lighting effects)
function createSpotLight(x, y, dirX, dirY, color = "#ffffff", intensity = 0.8) {
  if (!window.lightingManager || !window.LightType) return null;
  
  // Create spot light
  const spot = new window.Light(window.LightType.SPOT, {
    color: color,
    intensity: intensity,
    x: x,
    y: y,
    z: 1.0, // Above ground level
    dirX: dirX,
    dirY: dirY,
    dirZ: -0.5, // Pointing downward at angle
    radius: 8.0,
    angle: Math.PI / 6, // 30 degree cone
    penumbra: 0.2,
    decay: 1.5
  });
  
  // Add to lighting manager
  return window.lightingManager.addLight(spot);
}

// Load all required textures for normal mapping
function loadNormalMappingTextures() {
  if (!window.textureHandler) return;
  
  // Load wall textures
  window.textureHandler.loadMaterial('Wall1', 'assets/images/', 'png');
  
  // Could add more materials here as needed
}

// ==================== INTEGRATION MAIN ====================
// Initialize lighting integration
function initLightingIntegration() {
  console.log("Initializing lighting integration...");
  
  // Make sure required systems are loaded
  if (!window.lightingManager || !window.normalMapping) {
    console.error("Lighting or normal mapping systems not loaded!");
    return false;
  }
  
  // Override rendering functions
  const origDraw3DView = window.draw3DView;
  window.draw3DView = enhancedDraw3DView;
  
  // Override entity render method
  if (window.Entity) {
    // Store original render method
    const originalRender = window.Entity.prototype.render;
    
    // Create enhanced render method
    window.Entity.prototype.render = function(ctx, player, screenW, screenH, fov, castRay) {
      // Use enhanced rendering for entity
      enhancedRenderEntity(this, ctx, player, screenW, screenH, fov, castRay);
    };
    
    console.log("Entity rendering enhanced with lighting!");
  }
  
  // Override projectile render method if available
  if (typeof window.Projectile !== 'undefined') {
    // Store original projectile render
    const originalProjectileRender = window.Projectile.prototype.render;
    
    // Create enhanced projectile render
    window.Projectile.prototype.render = function(ctx, player, screenW, screenH, fov, castRay) {
      // Use enhanced rendering for projectiles
      enhancedRenderProjectile(this, ctx, player, screenW, screenH, fov, castRay);
    };
    
    console.log("Projectile rendering enhanced with lighting!");
  }
  
  // Create player torch
  createPlayerTorch();
  
  // Create ambient light
  createAmbientLight("#111122", 0.15);
  
  // Update game loop to update lighting
  if (window.updateGame) {
    const originalUpdateGame = window.updateGame;
    window.updateGame = function(dt) {
      // Call original update
      originalUpdateGame(dt);
      
      // Update player torch position
      if (window.playerTorchId && window.lightingManager) {
        const torch = window.lightingManager.getById(window.playerTorchId);
        if (torch) {
          torch.x = window.animX();
          torch.y = window.animY();
        }
      }
      
      // Update lighting system
      if (window.lightingManager) {
        window.lightingManager.update(dt);
      }
    };
    
    console.log("Game loop enhanced with lighting updates!");
  }
  
  // Load textures
  loadNormalMappingTextures();
  
  console.log("Lighting integration complete!");
  return true;
}

// Initialize when window loads
window.addEventListener("load", function() {
  // Small delay to ensure other systems are loaded
  setTimeout(function() {
    initLightingIntegration();
  }, 500);
});