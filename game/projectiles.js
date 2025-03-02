// projectiles.js - Projectile system for Might of the Beholder

// Projectile type definitions
const PROJECTILE_TYPES = {
  fireball: {
    name: "Fireball",
    damage: 10,
    speed: 5.0,
    range: 15.0,
    sprite: "fireball",
    color: "#FF5500",
    width: 0.5,
    height: 0.5,
    collisionEffect: "explosion"
  },
  
  arrow: {
    name: "Arrow",
    damage: 5,
    speed: 8.0,
    range: 20.0,
    sprite: "arrow",
    color: "#964B00",
    width: 0.3,
    height: 0.1,
    collisionEffect: "stick"
  },
  
  iceSpell: {
    name: "Ice Bolt",
    damage: 8,
    speed: 4.0,
    range: 12.0,
    sprite: "icebolt",
    color: "#0EF",
    width: 0.5,
    height: 0.5,
    collisionEffect: "freeze"
  }
};

// Texture loading for projectiles
const projectileTextures = {};

// Load projectile textures
function loadProjectileTextures() {
  // Set up the fireball animation frames
  projectileTextures.fireball = {
    frames: []
  };
  
  // Load the three fireball animation frames
  for (let i = 1; i <= 3; i++) {
    const frameTexture = new Image();
    frameTexture.onload = function() { 
      console.log(`Fireball frame ${i} loaded.`); 
    };
    frameTexture.src = `assets/images/fireball${i}.png`;
    projectileTextures.fireball.frames.push(frameTexture);
  }
}

// Call this function to preload projectile textures
loadProjectileTextures();

// Projectile class - extends Entity
class Projectile extends Entity {
  constructor(type, x, y, angle, properties = {}) {
    // Load projectile stats
    const projectileStats = PROJECTILE_TYPES[type] || PROJECTILE_TYPES.fireball;
    
    // Call parent constructor
    super("projectile", x, y, {
      sprite: projectileStats.sprite,
      width: projectileStats.width,
      height: projectileStats.height,
      damage: projectileStats.damage,
      speed: projectileStats.speed,
      range: projectileStats.range,
      angle: angle,
      distance: 0,
      projectileType: type,
      source: properties.source || "player",
      sourceEntity: properties.sourceEntity || null,
      collided: false,
      collisionTime: null,
      
      // Simple animation properties
      animationFrame: 0,
      lastAnimationUpdate: performance.now(),
      
      ...properties
    });
    
    // Store projectile-specific properties
    this.projectileType = type;
    this.color = projectileStats.color;
    this.name = projectileStats.name;
    this.collisionEffect = projectileStats.collisionEffect;
    
    // Calculate expected collision point
    if (properties.castRay) {
      const ray = properties.castRay(x, y, angle);
      this.collisionPoint = {
        x: x + ray.distance * Math.cos(angle),
        y: y + ray.distance * Math.sin(angle)
      };
    } else {
      // Estimate collision point based on range
      this.collisionPoint = {
        x: x + projectileStats.range * Math.cos(angle),
        y: y + projectileStats.range * Math.sin(angle)
      };
    }
    
    // Creation time
    this.creationTime = performance.now();
  }




  
update(dt, entities, worldMap) {
  // Skip if already collided
  if (!this.active || this.collided) return;
  
  // Update animation frame about 10 times per second
  const now = performance.now();
  if (now - this.properties.lastAnimationUpdate > 100) {
    this.properties.animationFrame = (this.properties.animationFrame + 1) % 3;
    this.properties.lastAnimationUpdate = now;
  }
  
  // Convert dt to seconds
  const deltaSec = dt / 1000;
  
  // Store old position for collision checking
  const oldX = this.x;
  const oldY = this.y;
  
  // Calculate new position
  const newX = this.x + Math.cos(this.properties.angle) * this.properties.speed * deltaSec;
  const newY = this.y + Math.sin(this.properties.angle) * this.properties.speed * deltaSec;
  
  // Update position
  this.x = newX;
  this.y = newY;
  
  // Calculate distance traveled in this frame
  const distanceTraveledThisFrame = Math.sqrt((newX - oldX) * (newX - oldX) + (newY - oldY) * (newY - oldY));
  
  // Update total distance traveled
  this.properties.distance += distanceTraveledThisFrame;
  
  // Check if we've reached the expected hit distance
  if (this.properties.expectedHitDistance && this.properties.distance >= this.properties.expectedHitDistance) {
    console.log(`Fireball reached expected hit point at distance ${this.properties.distance.toFixed(2)}`);
    // Set position to the collision point to ensure precise collision
    if (this.collisionPoint) {
      this.x = this.collisionPoint.x;
      this.y = this.collisionPoint.y;
    }
    this.handleCollision("wall");
    return;
  }
  
  // Check if out of range
  if (this.properties.distance >= this.properties.range) {
    console.log(`Fireball reached maximum range at distance ${this.properties.distance.toFixed(2)}`);
    this.active = false;
    return;
  }
  
  // Ray trace for collision detection (for distant collisions)
  if (worldMap && this.properties.castRay) {
    try {
      const ray = this.properties.castRay(oldX, oldY, this.properties.angle);
      const distToWall = ray.distance;
      
      // If we moved past a wall in this frame, handle the collision
      if (distanceTraveledThisFrame >= distToWall) {
        console.log(`Fireball collision detected by raycast at distance ${distToWall.toFixed(2)}`);
        
        // Adjust position to collision point
        const collisionX = oldX + Math.cos(this.properties.angle) * (distToWall - 0.01);
        const collisionY = oldY + Math.sin(this.properties.angle) * (distToWall - 0.01);
        
        this.x = collisionX;
        this.y = collisionY;
        
        this.handleCollision("wall");
        return;
      }
    } catch (e) {
      console.error("Error in projectile raycasting:", e);
    }
  }
  
  // Traditional tile-based collision detection
  if (worldMap) {
    const tileX = Math.floor(this.x);
    const tileY = Math.floor(this.y);
    
    // Check if tile coordinates are in bounds
    if (tileX >= 0 && tileY >= 0 && tileY < worldMap.length && tileX < worldMap[0].length) {
      // Check for collision with non-floor tiles
      if (worldMap[tileY][tileX] !== 0) {
        console.log(`Fireball hit wall at tile (${tileX}, ${tileY})`);
        this.handleCollision("wall");
        return;
      }
    } else {
      // Out of bounds of the map - deactivate
      console.log(`Projectile went out of bounds at (${this.x.toFixed(2)}, ${this.y.toFixed(2)})`);
      this.active = false;
      return;
    }
  }
  
  // Check collision with entities
  if (!entities) return;
  
  for (const entity of entities) {
    // Skip self and source entity
    if (entity === this || entity === this.properties.sourceEntity) continue;
    
    // Skip inactive entities
    if (!entity.active) continue;
    
    // Check if entity can be hit
    if (entity.type === "monster" || // Monster collision
        entity.type === "player" ||  // Player collision
        (entity.type === "projectile" && entity.projectileType !== this.projectileType)) { // Different projectile collision
      
      // Simple distance-based collision
      const distance = this.distanceTo(entity);
      if (distance < 0.5) { // Collision radius
        this.handleCollision("entity", entity);
        return;
      }
    }
  }
}









  
  handleCollision(type, hitEntity = null, collisionPoint = null) {
    // Skip if already collided
    if (this.collided) return;
    
    // Mark as collided
    this.collided = true;
    this.active = false;
    this.collisionTime = performance.now();
    
    // If collision point is specified, update our position
    if (collisionPoint) {
      this.x = collisionPoint.x;
      this.y = collisionPoint.y;
    }
    
    // Handle entity hit
    if (type === "entity" && hitEntity) {
      // Apply damage
      if (typeof hitEntity.takeDamage === "function") {
        const killed = hitEntity.takeDamage(this.properties.damage);
        console.log(`${this.name} hit ${hitEntity.name || 'entity'} for ${this.properties.damage} damage!`);
        
        // Only call log if it exists
        if (typeof log === "function") {
          log(`${this.name} hit ${hitEntity.name || 'entity'} for ${this.properties.damage} damage!`);
        }
        
        if (killed) {
          console.log(`${hitEntity.name || 'Entity'} was defeated!`);
          
          // Only call log if it exists
          if (typeof log === "function") {
            log(`${hitEntity.name || 'Entity'} was defeated!`);
          }
        }
      }
    } else if (type === "wall") {
      console.log(`${this.name} hit a wall at position (${this.x.toFixed(2)}, ${this.y.toFixed(2)})!`);
      
      // Only call log if it exists
      if (typeof log === "function") {
        log(`${this.name} hit a wall at position (${this.x.toFixed(2)}, ${this.y.toFixed(2)})!`);
      }
    } else if (type === "projectile") {
      console.log(`${this.name} collided with another projectile!`);
      
      // Only call log if it exists
      if (typeof log === "function") {
        log(`${this.name} collided with another projectile!`);
      }
    }
      
    // Handle collision effect
    switch(this.collisionEffect) {
      case "explosion":
        // Create explosion effect
        console.log(`${this.name} explodes!`);
        
        // Alert nearby entities about the explosion (optional AOE damage)
        if (window.entityManager) {
          const nearbyEntities = window.entityManager.getNearby(this.x, this.y, 1.5);
          for (const entity of nearbyEntities) {
            if (entity !== hitEntity && entity !== this.properties.sourceEntity && 
                (entity.type === "monster" || entity.type === "player")) {
              // Calculate distance for damage falloff
              const distance = this.distanceTo(entity);
              // Damage decreases with distance
              const damageMultiplier = 1 - (distance / 1.5);
              if (damageMultiplier > 0 && typeof entity.takeDamage === "function") {
                const splashDamage = Math.floor(this.properties.damage * damageMultiplier * 0.5);
                entity.takeDamage(splashDamage);
                console.log(`${entity.name || 'Entity'} takes ${splashDamage} splash damage from explosion!`);
              }
            }
          }
        }
        break;
      
      case "stick":
        // Make the projectile stick in the wall/entity
        console.log(`${this.name} gets stuck!`);
        
        // For arrows and similar projectiles, we could keep them visible at the collision point
        this.visible = true;
        this.active = false;
        break;
        
      case "freeze":
        // Apply a freeze effect to the entity
        if (hitEntity) {
          console.log(`${hitEntity.name || 'Entity'} is frozen!`);
          // Could add frozen state to entity
          if (hitEntity.properties) {
            hitEntity.properties.frozen = true;
            hitEntity.properties.frozenUntil = performance.now() + 3000; // 3 seconds
          }
        }
        break;
    }
  }
  
  render(ctx, player, screenW, screenH, fov, castRay) {
    if (!this.visible) return;
    
    // Check if all required parameters exist
    if (!ctx || !player || !screenW || !screenH || !fov || !castRay) return;
    
    // Calculate vector from player to projectile
    const dx = this.x - player.x;
    const dy = this.y - player.y;
    const distance = Math.sqrt(dx*dx + dy*dy);
    
    // Calculate angle to projectile
    const projectileAngle = Math.atan2(dy, dx);
    
    // Calculate angle difference
    let angleDiff = projectileAngle - player.angle;
    
    // Normalize angle difference to [-PI, PI]
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    
    // Only display if within field of view
    if (Math.abs(angleDiff) > fov/2) return;
    
    // Check for wall occlusion
    const ray = castRay(player.x, player.y, projectileAngle);
    if (ray.distance < distance - 0.3) return;
    
    // Calculate screen position
    const screenX = screenW / 2 + (angleDiff / (fov/2)) * (screenW / 2);
    
    // Calculate size based on distance
    const scale = 1.0 / distance;
    const spriteHeight = this.height * scale * screenH * 0.5;
    const spriteWidth = this.width * scale * screenH * 0.5;
    
    // Position vertically centered
    const screenY = screenH / 2 - spriteHeight / 2;
    
    // Draw glow effect first (behind the projectile)
    if (!this.collided) {
      // Save context for clipping
      ctx.save();
      
      // Create glow effect
      const glowRadius = Math.max(spriteWidth, spriteHeight) * 1.5;
      
      // Create radial gradient for glow
      const gradient = ctx.createRadialGradient(
        screenX, screenY + spriteHeight/2, 0,
        screenX, screenY + spriteHeight/2, glowRadius
      );
      
      gradient.addColorStop(0, 'rgba(255, 200, 80, 0.8)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      
      // Draw glow
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(
        screenX, 
        screenY + spriteHeight/2, 
        glowRadius, 
        0, 
        Math.PI * 2
      );
      ctx.fill();
      
      // Restore context
      ctx.restore();
    }
    
    // Draw the projectile
    if (!this.collided) {
      // Get the animation frames for this projectile type
      const frames = projectileTextures[this.projectileType] ? 
                   projectileTextures[this.projectileType].frames : 
                   null;
      
      if (frames && frames.length > 0) {
        // Get the current animation frame
        const frameIndex = this.properties.animationFrame % frames.length;
        const currentTexture = frames[frameIndex];
        
        // Draw using the current frame if loaded
        if (currentTexture && currentTexture.complete) {
          ctx.drawImage(
            currentTexture,
            screenX - spriteWidth / 2,
            screenY,
            spriteWidth,
            spriteHeight
          );
        } else {
          // Fallback if texture isn't loaded
          ctx.fillStyle = this.color;
          ctx.beginPath();
          ctx.arc(
            screenX,
            screenY + spriteHeight / 2,
            spriteWidth / 2,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
      } else {
        // Fallback to color circle if no frames available
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(
          screenX,
          screenY + spriteHeight / 2,
          spriteWidth / 2,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }
    
    // For debugging, draw projectile name and distance (only if not collided)
    if (!this.collided && window.showProjectileDebug) {
      ctx.fillStyle = "white";
      ctx.font = "10px Arial";
      ctx.textAlign = "center";
      ctx.fillText(this.name, screenX, screenY - 5);
      ctx.fillText(distance.toFixed(1) + "m", screenX, screenY + spriteHeight + 12);
    }
  }
  
  renderMinimap(ctx, tileSize) {
    // Don't render inactive projectiles that aren't collided
    if (!this.active && !this.collided) return;
    
    const now = performance.now();
    
    if (this.active) {
      // Active projectile
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x * tileSize, this.y * tileSize, tileSize/3, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw path line to expected collision
      ctx.strokeStyle = "yellow";
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(this.x * tileSize, this.y * tileSize);
      ctx.lineTo(this.collisionPoint.x * tileSize, this.collisionPoint.y * tileSize);
      ctx.stroke();
      ctx.setLineDash([]);
    } 
    else if (this.collided && this.collisionTime) {
      // Calculate time since collision
      const timeSinceCollision = now - this.collisionTime;
      
      // Show collision marker for 1 second with fade out
      if (timeSinceCollision < 1000) {
        const fadeLevel = 1 - (timeSinceCollision / 1000);
        
        ctx.fillStyle = `rgba(255, 0, 0, ${fadeLevel})`;
        ctx.beginPath();
        ctx.arc(this.x * tileSize, this.y * tileSize, tileSize/2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

// Factory function for creating projectiles
function createProjectile(type, x, y, angle, properties = {}) {
  return new Projectile(type, x, y, angle, properties);
}

// Function to shoot a projectile from an entity

function shootProjectile(entityManager, type, sourceEntity, angle, properties = {}) {
  // Default to entity's angle if not specified
  angle = angle !== undefined ? angle : sourceEntity.angle;
  
  // Calculate spawn position (slightly in front of the entity)
  const spawnDistance = 0.5;
  const spawnX = sourceEntity.x + Math.cos(angle) * spawnDistance;
  const spawnY = sourceEntity.y + Math.sin(angle) * spawnDistance;
  
  // Get projectile stats
  const projectileStats = PROJECTILE_TYPES[type] || PROJECTILE_TYPES.fireball;
  
  // Make sure we have a valid worldMap reference
  const worldMap = window.worldMap;
  
  // Default maximum range
  let maxRange = projectileStats.range;
  
  // Calculate expected collision point and distance
  let expectedHitDistance = maxRange;
  let collisionPoint = {
    x: spawnX + maxRange * Math.cos(angle),
    y: spawnY + maxRange * Math.sin(angle)
  };
  
  // Use castRay to get accurate collision point
  if (properties.castRay) {
    try {
      const ray = properties.castRay(spawnX, spawnY, angle);
      
      // If ray hit something within range, use that as collision point
      if (ray.distance < maxRange) {
        expectedHitDistance = ray.distance;
        
        // Calculate exact collision coordinates (slightly before the wall)
        collisionPoint = {
          x: spawnX + (ray.distance - 0.01) * Math.cos(angle),
          y: spawnY + (ray.distance - 0.01) * Math.sin(angle)
        };
        
        console.log(`Fireball expected to hit at (${collisionPoint.x.toFixed(2)}, ${collisionPoint.y.toFixed(2)}) at distance ${ray.distance.toFixed(2)}`);
      } else {
        console.log(`Fireball will reach maximum range without hitting anything`);
      }
    } catch (e) {
      console.error("Error calculating projectile collision:", e);
    }
  }
  
  // Create the projectile with enhanced properties
  const projectile = createProjectile(type, spawnX, spawnY, angle, {
    sourceEntity: sourceEntity,
    source: sourceEntity.type,
    castRay: properties.castRay,
    collisionPoint: collisionPoint,
    expectedHitDistance: expectedHitDistance, // Store the expected hit distance
    maxRange: maxRange, // Store the maximum range
    ...properties
  });
  
  // Add to entity manager
  entityManager.add(projectile);
  
  return projectile;
}






// Debug flag for showing projectile details
window.showProjectileDebug = false;

// Make functions globally available
window.createProjectile = createProjectile;
window.shootProjectile = shootProjectile;
window.PROJECTILE_TYPES = PROJECTILE_TYPES;
window.projectileTextures = projectileTextures;

console.log("Projectile system loaded successfully!");