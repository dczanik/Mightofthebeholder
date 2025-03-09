// entity.js - Entity system for Might of the Beholder
// Non-module version

// Basic Entity class
class Entity {
  constructor(type, x, y, properties = {}) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.active = true;
    this.visible = true;
    this.properties = properties;
    
    // Default properties
    this.width = properties.width || 1.0;
    this.height = properties.height || 1.0;
  }
  
  update(dt) {
    // Basic update logic - to be overridden by child classes
  }
  
  render(ctx, player, screenW, screenH, fov, castRay) {
    // Basic render logic - to be overridden by child classes
  }
  
  renderMinimap(ctx, tileSize) {
    // Draw a basic shape on the minimap
    if (!this.active || !this.visible) return;
    
    ctx.fillStyle = this.properties.minimapColor || "#0F0";
    
    // Size based on entity type
    const size = this.type === "monster" ? tileSize * 0.6 : tileSize * 0.4;
    
    ctx.beginPath();
    ctx.arc(this.x * tileSize, this.y * tileSize, size, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Calculate distance to another entity
  distanceTo(entity) {
    const dx = this.x - entity.x;
    const dy = this.y - entity.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  // Check if this entity is in front of the player
  isInFrontOf(player) {
    // Calculate vector from player to entity
    const dx = this.x - player.x;
    const dy = this.y - player.y;
    
    // Calculate dot product with player's direction vector
    const dirX = Math.cos(player.angle);
    const dirY = Math.sin(player.angle);
    
    const dotProduct = dx * dirX + dy * dirY;
    
    // If dot product is positive, entity is in front of player
    return dotProduct > 0;
  }
  
  // Default damage handling
  takeDamage(amount) {
    // Initialize health if not present
    if (this.properties.health === undefined) {
      this.properties.health = 100;
    }
    
    // Subtract damage
    this.properties.health -= amount;
    
    // Check if defeated
    if (this.properties.health <= 0) {
      this.active = false;
      return true; // Indicates entity was defeated
    }
    
    return false; // Entity still active
  }
}

// Entity Manager class
class EntityManager {
  constructor() {
    this.entities = [];
  }
  
  add(entity) {
    this.entities.push(entity);
    return entity;
  }
  
  remove(entity) {
    const index = this.entities.indexOf(entity);
    if (index > -1) {
      this.entities.splice(index, 1);
      return true;
    }
    return false;
  }
  
  removeById(id) {
    for (let i = 0; i < this.entities.length; i++) {
      if (this.entities[i].id === id) {
        this.entities.splice(i, 1);
        return true;
      }
    }
    return false;
  }
  
  getById(id) {
    return this.entities.find(e => e.id === id);
  }
  
  getByType(type) {
    return this.entities.filter(e => e.type === type);
  }
  
  getAllEntities() {
    return this.entities;
  }
  
  getNearby(x, y, radius) {
    return this.entities.filter(e => {
      const dx = e.x - x;
      const dy = e.y - y;
      const distSq = dx*dx + dy*dy;
      return distSq <= radius*radius;
    });
  }
  
  update(dt) {
    for (const entity of this.entities) {
      if (entity.active) {
        entity.update(dt);
      }
    }
  }
  
  render(ctx, player, screenW, screenH, fov, castRay) {
    // First, sort entities by distance from player (furthest first)
    const sortedEntities = this.entities
      .filter(e => e.active && e.visible)
      .sort((a, b) => {
        const distA = Math.pow(a.x - player.x, 2) + Math.pow(a.y - player.y, 2);
        const distB = Math.pow(b.x - player.x, 2) + Math.pow(b.y - player.y, 2);
        return distB - distA;
      });
    
    // Then render in order
    for (const entity of sortedEntities) {
      entity.render(ctx, player, screenW, screenH, fov, castRay);
    }
  }
  
  renderMinimap(ctx, tileSize) {
    for (const entity of this.entities) {
      if (entity.active && entity.visible) {
        entity.renderMinimap(ctx, tileSize);
      }
    }
  }
}

// Make Entity and EntityManager available globally
window.Entity = Entity;
window.EntityManager = EntityManager;