// webgl-integration.js - Connects original game systems to WebGL renderer

import * as THREE from 'three';

let scene; // Reference to the Three.js scene
let entityMeshes = {}; // Map entity IDs to their 3D meshes

// Store the original Entity class methods we'll be overriding
let originalEntityRender;
let originalEntityManagerRender;

// Materials for different entity types
const entityMaterials = {
  monster: {
    skeleton: new THREE.MeshStandardMaterial({ 
      color: 0xffffff, 
      emissive: 0x111111,
      roughness: 0.9,
      metalness: 0.1
    }),
    orc: new THREE.MeshStandardMaterial({ 
      color: 0x22cc22, 
      emissive: 0x002200,
      roughness: 0.7,
      metalness: 0.2
    }),
    spider: new THREE.MeshStandardMaterial({ 
      color: 0xcc2222, 
      emissive: 0x220000,
      roughness: 0.8,
      metalness: 0.2
    }),
    wizard: new THREE.MeshStandardMaterial({ 
      color: 0x7777ff, 
      emissive: 0x000022,
      roughness: 0.5,
      metalness: 0.5
    })
  },
  projectile: {
    fireball: new THREE.MeshStandardMaterial({ 
      color: 0xff5500, 
      emissive: 0xff3300,
      emissiveIntensity: 0.7,
      roughness: 0.3,
      metalness: 0.2
    }),
    arrow: new THREE.MeshStandardMaterial({ 
      color: 0xaa7700
    }),
    iceSpell: new THREE.MeshStandardMaterial({ 
      color: 0x00aaff, 
      emissive: 0x0055aa,
      emissiveIntensity: 0.5,
      roughness: 0.4,
      metalness: 0.6
    })
  }
};

// Initialize the integration
function initWebGLIntegration(threeScene) {
  scene = threeScene;
  
  // Patch Entity methods if available
  if (window.Entity && window.Entity.prototype) {
    patchEntityClass();
  }
  
  // Patch EntityManager methods if available
  if (window.EntityManager && window.EntityManager.prototype) {
    patchEntityManagerClass();
  }
  
  console.log("WebGL Integration initialized");
  
  return {
    createEntityMesh,
    updateEntityMesh,
    removeEntityMesh
  };
}

// Patch the Entity class to handle WebGL rendering
function patchEntityClass() {
  // Store the original render method
  originalEntityRender = window.Entity.prototype.render;
  
  // Override the render method
  window.Entity.prototype.render = function(ctx, player, screenW, screenH, fov, castRay) {
    // Still call the original method for minimap and UI
    if (originalEntityRender) {
      originalEntityRender.call(this, ctx, player, screenW, screenH, fov, castRay);
    }
    
    // WebGL rendering is handled separately in createEntityMesh and updateEntityMesh
    // We don't need to do anything here
  };
  
  // Add a method for WebGL rendering (separate from Canvas)
  window.Entity.prototype.renderWebGL = function(scene, player) {
    // This is handled by the mesh system, so it's just a placeholder
  };
  
  console.log("Entity class patched for WebGL");
}

// Patch the EntityManager class
function patchEntityManagerClass() {
  // Store the original render method
  originalEntityManagerRender = window.EntityManager.prototype.render;
  
  // Override the render method
  window.EntityManager.prototype.render = function(ctx, player, screenW, screenH, fov, castRay) {
    // Still call the original method for minimap and UI
    if (originalEntityManagerRender) {
      originalEntityManagerRender.call(this, ctx, player, screenW, screenH, fov, castRay);
    }
    
    // WebGL rendering is handled in the updateEntities function
  };
  
  // Add an update method specifically for WebGL rendering
  window.EntityManager.prototype.updateWebGLEntities = function(scene, player) {
    // Update each entity's WebGL representation
    const entities = this.getAllEntities();
    
    for (const entity of entities) {
      // Skip inactive entities
      if (!entity.active || !entity.visible) {
        // Remove any existing mesh
        if (entityMeshes[entity.id]) {
          removeEntityMesh(entity.id);
        }
        continue;
      }
      
      // Create or update entity mesh
      if (!entityMeshes[entity.id]) {
        createEntityMesh(entity);
      } else {
        updateEntityMesh(entity, player);
      }
    }
    
    // Remove meshes for entities that no longer exist
    const existingIds = new Set(entities.map(e => e.id));
    for (const meshId in entityMeshes) {
      if (!existingIds.has(meshId)) {
        removeEntityMesh(meshId);
      }
    }
  };
  
  console.log("EntityManager class patched for WebGL");
}

// Create a 3D mesh for an entity
function createEntityMesh(entity) {
  if (!scene) return null;
  
  let geometry, material;
  
  // Set up geometry based on entity type
  switch (entity.type) {
    case "monster":
      // For monsters, use different models based on monster type
      switch (entity.monsterType) {
        case "skeleton":
          geometry = new THREE.BoxGeometry(0.8, 1.5, 0.8);
          material = entityMaterials.monster.skeleton;
          break;
        case "orc":
          geometry = new THREE.BoxGeometry(1.0, 1.8, 1.0);
          material = entityMaterials.monster.orc;
          break;
        case "spider":
          geometry = new THREE.BoxGeometry(1.2, 0.8, 1.2);
          material = entityMaterials.monster.spider;
          break;
        case "wizard":
          geometry = new THREE.BoxGeometry(0.8, 1.7, 0.8);
          material = entityMaterials.monster.wizard;
          break;
        default:
          // Default monster geometry
          geometry = new THREE.BoxGeometry(1.0, 1.5, 1.0);
          material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
      }
      break;
    
    case "projectile":
      // For projectiles, use different models based on projectile type
      switch (entity.projectileType) {
        case "fireball":
          geometry = new THREE.SphereGeometry(0.5, 8, 8);
          material = entityMaterials.projectile.fireball;
          break;
        case "arrow":
          geometry = new THREE.CylinderGeometry(0.05, 0.05, 0.8, 8);
          material = entityMaterials.projectile.arrow;
          break;
        case "iceSpell":
          geometry = new THREE.SphereGeometry(0.4, 8, 8);
          material = entityMaterials.projectile.iceSpell;
          break;
        default:
          // Default projectile geometry
          geometry = new THREE.SphereGeometry(0.3, 8, 8);
          material = new THREE.MeshStandardMaterial({ color: 0xffff00 });
      }
      break;
      
    default:
      // Default entity geometry
      geometry = new THREE.BoxGeometry(1.0, 1.0, 1.0);
      material = new THREE.MeshStandardMaterial({ color: 0x0000ff });
  }
  
  // Create mesh
  const mesh = new THREE.Mesh(geometry, material);
  
  // Set initial position
  mesh.position.set(entity.x, entity.height / 2 || 0.5, entity.y);
  
  // Add a light for some entities
  if (entity.type === "projectile" && entity.projectileType === "fireball") {
    const light = new THREE.PointLight(0xff5500, 1.5, 5);
    light.position.set(0, 0, 0);
    mesh.add(light);
    mesh.userData.light = light;
  }
  
  // Add to scene
  scene.add(mesh);
  
  // Store reference
  entityMeshes[entity.id] = mesh;
  
  return mesh;
}

// Update an entity's mesh position and rotation
function updateEntityMesh(entity, player) {
  const mesh = entityMeshes[entity.id];
  if (!mesh) return;
  
  // Update position
  mesh.position.set(entity.x, entity.height / 2 || 0.5, entity.y);
  
  // For monsters, make them face the player
  if (entity.type === "monster") {
    // Calculate angle to player
    const dx = player.x - entity.x;
    const dz = player.y - entity.y;
    const angleToPlayer = Math.atan2(dz, dx);
    
    // Set rotation to face player
    mesh.rotation.y = -angleToPlayer;
    
    // If monster is in attack state, add visual indication
    if (entity.state === "attack") {
      // Pulse the emissive intensity
      const pulseFactor = 0.5 + 0.5 * Math.sin(Date.now() * 0.01);
      if (mesh.material.emissiveIntensity !== undefined) {
        mesh.material.emissiveIntensity = pulseFactor * 0.5;
      }
    }
  }
  
  // For projectiles, set proper rotation based on movement angle
  if (entity.type === "projectile") {
    // Rotate to match direction of travel
    if (entity.angle !== undefined) {
      mesh.rotation.y = -entity.angle + Math.PI / 2;
    }
    
    // Update projectile light flicker if it has one
    if (mesh.userData.light) {
      const flickerFactor = 0.8 + 0.2 * Math.sin(Date.now() * 0.01);
      mesh.userData.light.intensity = 1.5 * flickerFactor;
    }
  }
}

// Remove an entity's mesh
function removeEntityMesh(entityId) {
  const mesh = entityMeshes[entityId];
  if (!mesh) return;
  
  // Remove from scene
  scene.remove(mesh);
  
  // Remove from tracking object
  delete entityMeshes[entityId];
}

// Update all entity meshes
function updateEntities(entityManager, player) {
  if (!entityManager || !player) return;
  
  // Use the EntityManager's updateWebGLEntities method if available
  if (typeof entityManager.updateWebGLEntities === 'function') {
    entityManager.updateWebGLEntities(scene, player);
  } else {
    // Fallback if not patched
    const entities = entityManager.getAllEntities();
    
    for (const entity of entities) {
      if (!entity.active || !entity.visible) {
        // Remove any existing mesh
        if (entityMeshes[entity.id]) {
          removeEntityMesh(entity.id);
        }
        continue;
      }
      
      // Create or update entity mesh
      if (!entityMeshes[entity.id]) {
        createEntityMesh(entity);
      } else {
        updateEntityMesh(entity, player);
      }
    }
  }
}

// Export functions
export {
  initWebGLIntegration,
  updateEntities,
  createEntityMesh,
  updateEntityMesh,
  removeEntityMesh
};