// monsters.js - Monster entities for Might of the Beholder

// Monster type definitions
const MONSTER_TYPES = {
  skeleton: {
    name: "Skeleton",
    health: 20,
    damage: 5,
    speed: 0.5,
    attackRange: 1.0,
    sightRange: 5.0,
    sprite: "skeleton",
    color: "#FFF",
    width: 0.8,
    height: 1.5,
    frames: 2 // Number of animation frames
  },
  
  orc: {
    name: "Orc",
    health: 30,
    damage: 8,
    speed: 1.5,
    attackRange: 1.0,
    sightRange: 6.0,
    sprite: "orc",
    color: "#0F0",
    width: 1.0,
    height: 1
  },
  
  spider: {
    name: "Giant Spider",
    health: 15,
    damage: 4,
    speed: 3.0,
    attackRange: 1.0,
    sightRange: 4.0,
    sprite: "spider",
    color: "#F00",
    width: 1.2,
    height: 0.8,
    frames: 1 // Spider has just 1 frame for now
  },
  
  wizard: {
    name: "Dark Wizard",
    health: 25,
    damage: 12,
    speed: 1.0,
    attackRange: 5.0, // Ranged attack!
    sightRange: 7.0,
    sprite: "wizard",
    color: "#99F",
    width: 0.8,
    height: 1.7
  }
};

// Texture loading for monsters
const monsterTextures = {};

// Texture loading for monster attack animations
const monsterAttackTextures = {};

// Load monster textures
function loadMonsterTextures() {
  // Load skeleton textures
  monsterTextures.skeleton = {
    frames: []
  };
  
  // Load the two skeleton animation frames
  for (let i = 1; i <= 2; i++) {
    const frameTexture = new Image();
    frameTexture.onload = function() { 
      console.log(`Skeleton frame ${i} loaded.`); 
    };
    frameTexture.src = `assets/images/skeleton${i}.png`;
    monsterTextures.skeleton.frames.push(frameTexture);
  }
  
  // Load spider texture
  monsterTextures.spider = {
    frames: []
  };
  
  const spiderTexture = new Image();
  spiderTexture.onload = function() {
    console.log("Spider texture loaded.");
  };
  spiderTexture.src = "assets/images/Spider1.png";
  monsterTextures.spider.frames.push(spiderTexture);
 
 
// Load orc texture
monsterTextures.orc = {
  frames: []
}; 
 
	const orcTexture = new Image();
	orcTexture.onload = function() {
	  console.log("Orc texture loaded.");
	};
	orcTexture.src = "assets/images/Orc1.png";
	monsterTextures.orc.frames.push(orcTexture);

  // Load other monster textures here as needed
}

// Load monster attack textures
function loadMonsterAttackTextures() {
  // Load skeleton attack textures
  monsterAttackTextures.skeleton = {
    frames: []
  };
  
  // Load the two skeleton attack animation frames
  for (let i = 1; i <= 2; i++) {
    const frameTexture = new Image();
    frameTexture.onload = function() { 
      console.log(`Skeleton attack frame ${i} loaded.`); 
    };
    frameTexture.src = `assets/images/skeleton-fight${i}.png`;
    monsterAttackTextures.skeleton.frames.push(frameTexture);
  }
  
  // Add textures for other monster types as needed
}

// Call texture loading functions
loadMonsterTextures();
loadMonsterAttackTextures();

// Monster class - extends Entity
class Monster extends Entity {
  constructor(type, x, y, properties = {}) {
    // Load monster stats
    const monsterStats = MONSTER_TYPES[type] || MONSTER_TYPES.skeleton;
    
    // Call parent constructor
    super("monster", x, y, {
      sprite: monsterStats.sprite,
      width: monsterStats.width,
      height: monsterStats.height,
      health: monsterStats.health,
      maxHealth: monsterStats.health,
      damage: monsterStats.damage,
      attackRange: monsterStats.attackRange,
      speed: monsterStats.speed,
      sightRange: monsterStats.sightRange,
      state: "idle", // idle, patrol, chase, attack
      monsterType: type,
      
      // Animation properties
      animationFrame: 0,
      lastAnimationUpdate: performance.now(),
      animationFrameCount: monsterStats.frames || 1,
      animationSpeed: 250, // ms per frame
      
      // Attack animation properties
      isAttacking: false,
      attackAnimationFrame: 0,
      lastAttackAnimationUpdate: 0,
      attackAnimationSpeed: 200, // ms per frame
      
      ...properties
    });
    
    // Store monster-specific properties
    this.monsterType = type;
    this.color = monsterStats.color;
    this.name = monsterStats.name;
    
    // AI state
    this.targetX = null;
    this.targetY = null;
    this.lastSawPlayerTime = 0;
    this.patrolPoints = properties.patrolPoints || null;
    this.currentPatrolIndex = 0;
    this.waitTime = 0;
    
    // Attack cooldown
    this.lastAttackTime = 0;
    this.attackCooldown = 1000; // 1 second cooldown
  }
  
update(dt, player, worldMap, castRay) {
    const now = performance.now();
    
    // Update normal animation frame
    if (!this.properties.isAttacking && 
        this.properties.animationFrameCount > 1 && 
        now - this.properties.lastAnimationUpdate > this.properties.animationSpeed) {
      this.properties.animationFrame = 
        (this.properties.animationFrame + 1) % this.properties.animationFrameCount;
      this.properties.lastAnimationUpdate = now;
    }
    
    // Update attack animation frame
    if (this.properties.isAttacking && 
        now - this.properties.lastAttackAnimationUpdate > this.properties.attackAnimationSpeed) {
      this.properties.attackAnimationFrame = 
        (this.properties.attackAnimationFrame + 1) % 2; // Assuming 2 frames for attack
      this.properties.lastAttackAnimationUpdate = now;
    }
    
    // Health check
    if (this.properties.health <= 0) {
      this.active = false;
      return;
    }
    
    // Check if player is valid
    if (!player || typeof player.x === 'undefined' || typeof player.y === 'undefined') {
      // Reset attack state if no player
      this.properties.isAttacking = false;
      return;
    }
    
    // Check if monster can see player
    let canSeePlayer = false;
    try {
      canSeePlayer = this.isInLineOfSight(player, worldMap, castRay) && 
                     this.distanceTo(player) < this.properties.sightRange;
    } catch (e) {
      console.error("Error checking line of sight:", e);
    }
    
    if (canSeePlayer) {
      this.lastSawPlayerTime = now;
      
      // Check if close enough to attack
      const distanceToPlayer = this.distanceTo(player);
      const isAdjacentToPlayer = distanceToPlayer <= 1.5; // Slightly larger than 1 to be safe
      
      if (isAdjacentToPlayer) {
        // Stop moving and start attacking
        this.state = "attack";
        this.targetX = null;
        this.targetY = null;
        this.properties.isAttacking = true;
        
        // Check attack cooldown
        if (now - this.lastAttackTime > this.attackCooldown) {
          this.lastAttackTime = now;
          console.log(`${this.name} is attacking the player!`);
          if (window.log) window.log(`${this.name} is attacking the player!`);
          
          // Trigger attack visualization
          if (window.triggerMonsterAttack) {
            // Use predefined width from monster type or fallback to a default
            const monsterWidth = MONSTER_TYPES[this.monsterType].width * 100; // Scale up for screen units
            
            window.triggerMonsterAttack(
              window.screenW / 2, // Centered horizontally
              monsterWidth
            );
          }
        }
      } else {
        // Chase the player
        this.state = "chase";
        this.targetX = player.x;
        this.targetY = player.y;
        this.properties.isAttacking = false;
      }
    } else {
      // Reset attack state
      this.properties.isAttacking = false;
    }
 
    // Movement logic for patrol and chase
    switch (this.state) {
      case "idle":
        // Just stand around
        this.waitTime -= dt;
        if (this.waitTime <= 0) {
          // Switch to patrol if patrol points exist
          if (this.patrolPoints && this.patrolPoints.length > 0) {
            this.state = "patrol";
            this.currentPatrolIndex = 0;
            this.targetX = this.patrolPoints[0].x;
            this.targetY = this.patrolPoints[0].y;
          } else {
            // Reset wait time
            this.waitTime = 2000 + Math.random() * 3000;
          }
        }
        break;
        
      case "patrol":
        if (!this.patrolPoints || this.patrolPoints.length === 0) {
          this.state = "idle";
          break;
        }
        
        // Move toward current patrol point
        this.moveToward(this.targetX, this.targetY, dt);
        
        // Check if reached destination
        if (this.distanceTo({x: this.targetX, y: this.targetY}) < 0.2) {
          // Move to next patrol point
          this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.patrolPoints.length;
          this.targetX = this.patrolPoints[this.currentPatrolIndex].x;
          this.targetY = this.patrolPoints[this.currentPatrolIndex].y;
          
          // Wait a bit
          this.waitTime = 1000 + Math.random() * 1000;
          this.state = "idle";
        }
        break;
        
      case "chase":
        // Move toward player, but stop when adjacent
        if (this.targetX !== null && this.targetY !== null) {
          this.moveTowardAdjacent(this.targetX, this.targetY, dt, player);
        }
        break;
    }
  }
  
  moveToward(targetX, targetY, dt) {
    // Skip if target is invalid
    if (targetX === null || targetY === null) return;
    
    // Calculate direction to target
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const distance = Math.sqrt(dx*dx + dy*dy);
    
    if (distance < 0.01) return; // Already at target
    
    // Normalize direction
    const moveX = dx / distance;
    const moveY = dy / distance;
    
    // Calculate movement amount
    const moveAmount = this.properties.speed * dt / 1000;
    
    // Calculate new position
    const newX = this.x + moveX * moveAmount;
    const newY = this.y + moveY * moveAmount;
    
    // Check if new position is valid (not inside a wall)
    if (this.canMoveTo(newX, this.y)) {
      this.x = newX;
    }
    
    if (this.canMoveTo(this.x, newY)) {
      this.y = newY;
    }
  }
  
  moveTowardAdjacent(targetX, targetY, dt, player) {
    // Calculate direction to target
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const distance = Math.sqrt(dx*dx + dy*dy);
    
    // Stop if close to player (adjacent)
    if (distance <= 1.5) return;
    
    // Normalize direction
    const moveX = dx / distance;
    const moveY = dy / distance;
    
    // Calculate movement amount
    const moveAmount = this.properties.speed * dt / 1000;
    
    // Calculate new position
    const newX = this.x + moveX * moveAmount;
    const newY = this.y + moveY * moveAmount;
    
    // Check if new position is valid (not inside a wall)
    if (this.canMoveTo(newX, this.y)) {
      this.x = newX;
    }
    
    if (this.canMoveTo(this.x, newY)) {
      this.y = newY;
    }
  }
  
  canMoveTo(x, y) {
    // Make sure worldMap is available globally
    if (!window.worldMap) return false;
    
    // Add padding to prevent wall cutting
    const padding = 0.3; // Adjust this value to fine-tune monster movement
    
    // Get the tile coordinates with padding
    const tileX = Math.floor(x);
    const tileY = Math.floor(y);
    
    // Check if coordinates are valid
    if (tileX < 0 || tileY < 0 || 
        tileX >= window.worldMap[0].length || 
        tileY >= window.worldMap.length) {
      return false;
    }
    
    // Precise tile checking with padding
    const leftTile = Math.floor(x - padding);
    const rightTile = Math.floor(x + padding);
    const topTile = Math.floor(y - padding);
    const bottomTile = Math.floor(y + padding);
    
    // Check all potentially intersecting tiles
    const tilesToCheck = [
      window.worldMap[tileY][tileX],
      leftTile >= 0 ? window.worldMap[tileY][leftTile] : 1,
      rightTile < window.worldMap[0].length ? window.worldMap[tileY][rightTile] : 1,
      topTile >= 0 ? window.worldMap[topTile][tileX] : 1,
      bottomTile < window.worldMap.length ? window.worldMap[bottomTile][tileX] : 1
    ];
    
    // Ensure no tiles are walls
    return tilesToCheck.every(tile => tile === 0);
  }
  
  takeDamage(amount) {
    this.properties.health -= amount;
    if (this.properties.health <= 0) {
      this.active = false;
      return true; // Indicates monster died
    }
    return false;
  }
  
  render(ctx, player, screenW, screenH, fov, castRay) {
    if (!this.visible || !this.active) return;
    
    // Make sure all required parameters exist
    if (!ctx || !player || !screenW || !screenH || !fov || !castRay) return;
    
    // Calculate vector from player to monster
    const dx = this.x - player.x;
    const dy = this.y - player.y;
    const distance = Math.sqrt(dx*dx + dy*dy);
    
    // Calculate angle to monster
    const angle = Math.atan2(dy, dx);
    
    // Calculate angle difference
    let angleDiff = angle - player.angle;
    
    // Normalize angle difference to [-PI, PI]
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff +=2 * Math.PI;
    
    // Only display if within field of view
    if (Math.abs(angleDiff) > fov/2) return;
    
    // Check for wall occlusion
    const ray = castRay(player.x, player.y, angle);
    if (ray.distance < distance - 0.1) return;
    
    // Calculate screen position
    const screenX = screenW / 2 + (angleDiff / (fov/2)) * (screenW / 2);
    
	// Calculate size based on distance, with reduced divisor to bring monster closer
	const scale = 1.0 / (distance * 0.5);  // Adjust the 0.5 to control closeness
	const spriteHeight = this.height * scale * screenH * 0.5;
	const spriteWidth = this.width * scale * screenH * 0.5;

    
    // Position vertically centered
    const screenY = screenH / 2 - spriteHeight / 2;
    
    // Get the animation frames
    const normalFrames = monsterTextures[this.monsterType] ? 
                       monsterTextures[this.monsterType].frames : 
                       null;
    const attackFrames = monsterAttackTextures[this.monsterType] ? 
                       monsterAttackTextures[this.monsterType].frames : 
                       null;
    
    let currentTexture = null;
    
    // Determine which frames to use
    if (this.properties.isAttacking && attackFrames && attackFrames.length > 0) {
      // Use attack animation frames
      const frameIndex = this.properties.attackAnimationFrame % attackFrames.length;
      currentTexture = attackFrames[frameIndex];
    } else if (normalFrames && normalFrames.length > 0) {
      // Use normal animation frames
      const frameIndex = this.properties.animationFrame % normalFrames.length;
      currentTexture = normalFrames[frameIndex];
    }
    
    // Draw the sprite
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
      this.drawFallbackSprite(ctx, screenX, screenY, spriteWidth, spriteHeight);
    }
    
    // Draw monster name and health
    ctx.fillStyle = "white";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`${this.name}`, screenX, screenY - 15);
    ctx.fillText(`HP: ${this.properties.health}`, screenX, screenY - 5);
  }
  
  drawFallbackSprite(ctx, screenX, screenY, spriteWidth, spriteHeight) {
    // Draw as colored rectangle
    ctx.fillStyle = this.color || "red";
    ctx.fillRect(
      screenX - spriteWidth / 2,
      screenY,
      spriteWidth,
      spriteHeight
    );
  }
  
  renderMinimap(ctx, tileSize) {
    if (!this.active) return;
    
    ctx.fillStyle = this.color || "red";
    ctx.beginPath();
    ctx.arc(this.x * tileSize, this.y * tileSize, tileSize/2, 0, Math.PI * 2);
    ctx.fill();
    
    // If chasing player, draw a line to the target
    if (this.state === "chase" && this.targetX !== null) {
      ctx.strokeStyle = "yellow";
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(this.x * tileSize, this.y * tileSize);
      ctx.lineTo(this.targetX * tileSize, this.targetY * tileSize);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

// Factory function for creating monsters
function createMonster(type, x, y, properties = {}) {
  return new Monster(type, x, y, properties);
}

// Function to spawn a monster at a specific position
function spawnMonster(entityManager, type, x, y, properties = {}) {
  const monster = createMonster(type, x, y, properties);
  entityManager.add(monster);
  return monster;
}

// Make functions globally available
window.createMonster = createMonster;
window.spawnMonster = spawnMonster;
window.MONSTER_TYPES = MONSTER_TYPES;
window.monsterTextures = monsterTextures;
window.monsterAttackTextures = monsterAttackTextures;

console.log("Monster system loaded successfully!");