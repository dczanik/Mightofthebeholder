// entity.js - Base entity system for Might of the Beholder
// Contains the base Entity class and EntityManager

// Utility function to generate unique IDs
function generateUniqueId() {
  return '_' + Math.random().toString(36).substr(2, 9);
}

// Base entity class for all objects in the game world
class Entity {
  constructor(type, x, y, properties = {}) {
    // Core positioning
    this.x = x;
    this.y = y;
    this.type = type;
    this.id = generateUniqueId();
    
    // Visual properties
    this.sprite = properties.sprite || null;
    this.width = properties.width || 1.0;
    this.height = properties.height || 1.0;
    
    // Physics/interaction
    this.solid = properties.solid !== undefined ? properties.solid : true;
    this.interactive = properties.interactive !== undefined ? properties.interactive : false;
    this.visible = properties.visible !== undefined ? properties.visible : true;
    
    // Game state
    this.active = true;
    this.tags = properties.tags || [];
    
    // Custom properties (for specific entity types)
    this.properties = properties;
  }
  
  update(dt) {
    // Base update logic - override in subclasses
    if (this.onUpdate) this.onUpdate(dt);
  }
  
  interact(player) {
    // Base interaction logic - override in subclasses
    if (this.onInteract) this.onInteract(player);
    return { success: false, message: "Nothing happens." };
  }
  
  // Distance to another entity or point
  distanceTo(entity) {
    const dx = this.x - (entity.x || entity);
    const dy = this.y - (entity.y || 0);
    return Math.sqrt(dx*dx + dy*dy);
  }
  
  // Angle to another entity
  angleTo(entity) {
    const dx = entity.x - this.x;
    const dy = entity.y - this.y;
    return Math.atan2(dy, dx);
  }
  
  // Get if entity is in line of sight using raycasting
  isInLineOfSight(entity, worldMap, castRay) {
    const angle = this.angleTo(entity);
    const distance = this.distanceTo(entity);
    const ray = castRay(this.x, this.y, angle);
    return ray.distance >= distance;
  }
  
  // Render the entity
  render(ctx, player, screenW, screenH, fov, castRay) {
    // Basic billboard rendering - override for custom rendering
    if (!this.visible) return;
    
    // Calculate vector from player to entity
    const dx = this.x - player.x;
    const dy = this.y - player.y;
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
    const spriteHeight = this.height * scale * screenH * 0.5;
    const spriteWidth = this.width * scale * screenH * 0.5;
    
    // Position vertically centered
    const screenY = screenH / 2 - spriteHeight / 2;
    
    // Draw the entity (custom rendering would go here)
    ctx.fillStyle = "red";  // Default color, override in subclasses
    ctx.fillRect(
      screenX - spriteWidth / 2,
      screenY,
      spriteWidth,
      spriteHeight
    );
    
    // For debugging: show entity type and distance
    ctx.fillStyle = "white";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`${this.type}: ${distance.toFixed(1)}`, screenX, screenY - 5);
  }
  
  // Render on minimap
  renderMinimap(ctx, tileSize) {
    ctx.fillStyle = "blue"; // Default color, override in subclasses
    ctx.beginPath();
    ctx.arc(this.x * tileSize, this.y * tileSize, tileSize/2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// EntityManager to handle all game objects
class EntityManager {
  constructor() {
    this.entities = {};
    this.typeLookup = {}; // For quick access by type
  }
  
  add(entity) {
    this.entities[entity.id] = entity;
    
    // Add to type lookup
    if (!this.typeLookup[entity.type]) {
      this.typeLookup[entity.type] = [];
    }
    this.typeLookup[entity.type].push(entity.id);
    
    return entity.id;
  }
  
  remove(entityId) {
    const entity = this.entities[entityId];
    if (entity) {
      // Remove from type lookup
      const typeArray = this.typeLookup[entity.type];
      if (typeArray) {
        const index = typeArray.indexOf(entityId);
        if (index !== -1) typeArray.splice(index, 1);
      }
      
      delete this.entities[entityId];
      return true;
    }
    return false;
  }
  
  getById(entityId) {
    return this.entities[entityId];
  }
  
  getByType(type) {
    const ids = this.typeLookup[type] || [];
    return ids.map(id => this.entities[id]);
  }
  
  getAllEntities() {
    return Object.values(this.entities);
  }
  
  getNearby(x, y, radius) {
    const result = [];
    for (const id in this.entities) {
      const entity = this.entities[id];
      const dx = entity.x - x;
      const dy = entity.y - y;
      const distance = Math.sqrt(dx*dx + dy*dy);
      if (distance <= radius) {
        result.push(entity);
      }
    }
    return result;
  }
  
  update(dt) {
    for (const id in this.entities) {
      this.entities[id].update(dt);
    }
  }
  
  render(ctx, player, screenW, screenH, fov, castRay) {
    // Get all entities
    const entities = this.getAllEntities();
    
    // Sort entities by distance from player (furthest first)
    const sortedEntities = entities
      .filter(entity => entity.visible)
      .map(entity => {
        const dx = entity.x - player.x;
        const dy = entity.y - player.y;
        return {
          entity: entity,
          distance: Math.sqrt(dx*dx + dy*dy)
        };
      })
      .sort((a, b) => b.distance - a.distance);
    
    // Render entities from furthest to closest
    for (const item of sortedEntities) {
      item.entity.render(ctx, player, screenW, screenH, fov, castRay);
    }
  }
  
  renderMinimap(ctx, tileSize) {
    for (const id in this.entities) {
      this.entities[id].renderMinimap(ctx, tileSize);
    }
  }
}

// Export classes globally
window.Entity = Entity;
window.EntityManager = EntityManager;

console.log("Entity system loaded successfully!");