// normal.js - Normal mapping system for lighting in 3D environments
// Can be used independently or with the lighting.js system

// ==================== TEXTURE TYPES ====================
const TextureType = {
  DIFFUSE: 0,   // Base color texture
  NORMAL: 1,    // Normal map with surface direction
  SPECULAR: 2,  // Specular/shininess map
  AO: 3,        // Ambient occlusion map
  ROUGHNESS: 4, // Roughness map (PBR)
  METALLIC: 5,  // Metallic map (PBR)
  EMISSIVE: 6,  // Emissive map for glowing parts
  HEIGHT: 7     // Height/displacement map
};

// ==================== TEXTURE HANDLER ====================
class TextureHandler {
  constructor() {
    this.textures = {};
    this.loading = {};
    this.defaultNormal = this.createDefaultNormalMap();
    this.defaultSpecular = this.createDefaultSpecularMap();
    this.defaultAO = this.createDefaultAOMap();
  }
  
  // Create a solid color texture for defaults
  createSolidTexture(width, height, color) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
    return canvas;
  }
  
  // Create default normal map (flat surface, normal pointing outward)
  createDefaultNormalMap() {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 2;
    const ctx = canvas.getContext('2d');
    // RGB 128,128,255 = Normal pointing straight out (0,0,1)
    ctx.fillStyle = 'rgb(128,128,255)';
    ctx.fillRect(0, 0, 2, 2);
    return canvas;
  }
  
  // Create default specular map (medium shininess)
  createDefaultSpecularMap() {
    return this.createSolidTexture(2, 2, 'rgb(128,128,128)');
  }
  
  // Create default ambient occlusion map (no occlusion)
  createDefaultAOMap() {
    return this.createSolidTexture(2, 2, 'white');
  }
  
  // Load a texture and store it by name
  loadTexture(name, url, type, callback) {
    // Skip if already loaded or loading
    if (this.textures[name] || this.loading[name]) {
      if (callback && this.textures[name]) callback(this.textures[name]);
      return;
    }
    
    // Mark as loading
    this.loading[name] = true;
    
    // Create new image
    const img = new Image();
    
    // Set up load handler
    img.onload = () => {
      // Store in texture cache
      this.textures[name] = {
        image: img,
        type: type,
        width: img.width,
        height: img.height,
        loaded: true
      };
      
      delete this.loading[name];
      
      console.log(`Texture loaded: ${name}`);
      
      // Call callback if provided
      if (callback) callback(this.textures[name]);
    };
    
    // Set up error handler
    img.onerror = () => {
      console.error(`Failed to load texture: ${url}`);
      delete this.loading[name];
      
      // Call callback with null if provided
      if (callback) callback(null);
    };
    
    // Start loading
    img.src = url;
  }
  
  // Load a complete material set (diffuse, normal, specular, ao)
  loadMaterial(baseName, basePath, format, callbacks) {
    // Standard suffix naming convention
    const suffixes = {
      [TextureType.DIFFUSE]: '',
      [TextureType.NORMAL]: '-Normal',
      [TextureType.SPECULAR]: '-Specular',
      [TextureType.AO]: '-AO',
      [TextureType.ROUGHNESS]: '-Roughness',
      [TextureType.METALLIC]: '-Metallic',
      [TextureType.EMISSIVE]: '-Emissive',
      [TextureType.HEIGHT]: '-Height'
    };
    
    // Which texture types to load
    const typesToLoad = callbacks ? Object.keys(callbacks).map(Number) : [
      TextureType.DIFFUSE, 
      TextureType.NORMAL, 
      TextureType.SPECULAR, 
      TextureType.AO
    ];
    
    // Load each texture type
    for (const type of typesToLoad) {
      const suffix = suffixes[type] || '';
      const url = `${basePath}${baseName}${suffix}.${format}`;
      this.loadTexture(`${baseName}${suffix}`, url, type, callbacks ? callbacks[type] : null);
    }
  }
  
  // Get a loaded texture by name
  getTexture(name, type) {
    // If specific texture type requested, use name+type naming convention
    if (type !== undefined) {
      const suffixes = {
        [TextureType.DIFFUSE]: '',
        [TextureType.NORMAL]: '-Normal',
        [TextureType.SPECULAR]: '-Specular',
        [TextureType.AO]: '-AO',
        [TextureType.ROUGHNESS]: '-Roughness',
        [TextureType.METALLIC]: '-Metallic',
        [TextureType.EMISSIVE]: '-Emissive',
        [TextureType.HEIGHT]: '-Height'
      };
      
      const suffix = suffixes[type] || '';
      name = `${name}${suffix}`;
    }
    
    // Return the texture if loaded
    if (this.textures[name] && this.textures[name].loaded) {
      return this.textures[name];
    }
    
    // Return default texture based on type
    if (type === TextureType.NORMAL) {
      return { image: this.defaultNormal, loaded: true };
    } else if (type === TextureType.SPECULAR) {
      return { image: this.defaultSpecular, loaded: true };
    } else if (type === TextureType.AO) {
      return { image: this.defaultAO, loaded: true };
    }
    
    return null;
  }
}

// ==================== NORMAL MAPPING ====================
class NormalMapping {
  constructor(textureHandler) {
    this.textureHandler = textureHandler || new TextureHandler();
    
    // Create offscreen canvas for sampling
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1;
    this.canvas.height = 1;
    this.ctx = this.canvas.getContext('2d');
  }
  
  // Get normal vector at texture coordinate
  getNormalAt(textureName, texCoordX, texCoordY) {
    // Get normal map texture
    const texture = this.textureHandler.getTexture(textureName, TextureType.NORMAL);
    if (!texture) {
      return { x: 0, y: 0, z: 1 }; // Default normal
    }
    
    // Sample normal map
    return this.sampleNormalMap(texture.image, texCoordX, texCoordY);
  }
  
  // Get specular factor at texture coordinate
  getSpecularAt(textureName, texCoordX, texCoordY) {
    // Get specular map texture
    const texture = this.textureHandler.getTexture(textureName, TextureType.SPECULAR);
    if (!texture) {
      return 0.5; // Default specular
    }
    
    // Sample specular map
    return this.sampleSpecularMap(texture.image, texCoordX, texCoordY);
  }
  
  // Get ambient occlusion at texture coordinate
  getAOAt(textureName, texCoordX, texCoordY) {
    // Get AO map texture
    const texture = this.textureHandler.getTexture(textureName, TextureType.AO);
    if (!texture) {
      return 1.0; // Default no occlusion
    }
    
    // Sample AO map
    return this.sampleAOMap(texture.image, texCoordX, texCoordY);
  }
  
  // Sample normal map and convert to normal vector
  sampleNormalMap(normalMap, texCoordX, texCoordY) {
    // Calculate texture pixel coordinates
    const pixelX = Math.floor(texCoordX * normalMap.width) % normalMap.width;
    const pixelY = Math.floor(texCoordY * normalMap.height) % normalMap.height;
    
    // Draw pixel to canvas
    this.ctx.clearRect(0, 0, 1, 1);
    this.ctx.drawImage(normalMap, pixelX, pixelY, 1, 1, 0, 0, 1, 1);
    
    // Get pixel data
    const pixelData = this.ctx.getImageData(0, 0, 1, 1).data;
    
    // Convert RGB to normal vector
    // Normal maps store XYZ as RGB with 128,128,255 being (0,0,1)
    let nx = (pixelData[0] / 255) * 2 - 1; // -1 to 1
    let ny = (pixelData[1] / 255) * 2 - 1; // -1 to 1
    let nz = pixelData[2] / 255;           // 0 to 1
    
    // Normalize vector
    const length = Math.sqrt(nx*nx + ny*ny + nz*nz);
    if (length > 0) {
      nx /= length;
      ny /= length;
      nz /= length;
    } else {
      nx = 0;
      ny = 0;
      nz = 1;
    }
    
    return { x: nx, y: ny, z: nz };
  }
  
  // Sample specular map and return shininess
  sampleSpecularMap(specularMap, texCoordX, texCoordY) {
    // Calculate texture pixel coordinates
    const pixelX = Math.floor(texCoordX * specularMap.width) % specularMap.width;
    const pixelY = Math.floor(texCoordY * specularMap.height) % specularMap.height;
    
    // Draw pixel to canvas
    this.ctx.clearRect(0, 0, 1, 1);
    this.ctx.drawImage(specularMap, pixelX, pixelY, 1, 1, 0, 0, 1, 1);
    
    // Get pixel data (use red channel for specular)
    const pixelData = this.ctx.getImageData(0, 0, 1, 1).data;
    return pixelData[0] / 255; // 0 to 1
  }
  
  // Sample ambient occlusion map
  sampleAOMap(aoMap, texCoordX, texCoordY) {
    // Calculate texture pixel coordinates
    const pixelX = Math.floor(texCoordX * aoMap.width) % aoMap.width;
    const pixelY = Math.floor(texCoordY * aoMap.height) % aoMap.height;
    
    // Draw pixel to canvas
    this.ctx.clearRect(0, 0, 1, 1);
    this.ctx.drawImage(aoMap, pixelX, pixelY, 1, 1, 0, 0, 1, 1);
    
    // Get pixel data (use red channel for AO)
    const pixelData = this.ctx.getImageData(0, 0, 1, 1).data;
    return pixelData[0] / 255; // 0 to 1 (0 = full occlusion, 1 = no occlusion)
  }
  
  // Calculate lighting on a surface with normal mapping
  calculateNormalLighting(position, texCoord, lightPos, lightColor, lightRadius, materialName) {
    // Get normal at texture coordinate
    const normal = this.getNormalAt(materialName, texCoord.x, texCoord.y);
    
    // Get specular factor
    const specular = this.getSpecularAt(materialName, texCoord.x, texCoord.y);
    
    // Get ambient occlusion
    const ao = this.getAOAt(materialName, texCoord.x, texCoord.y);
    
    // Calculate light direction
    const lightDir = {
      x: lightPos.x - position.x,
      y: lightPos.y - position.y,
      z: lightPos.z - position.z
    };
    
    // Calculate distance
    const distance = Math.sqrt(
      lightDir.x * lightDir.x + 
      lightDir.y * lightDir.y + 
      lightDir.z * lightDir.z
    );
    
    // Normalize light direction
    lightDir.x /= distance;
    lightDir.y /= distance;
    lightDir.z /= distance;
    
    // Calculate attenuation
    const attenuation = Math.max(0, 1 - distance / lightRadius);
    
    // Calculate diffuse factor (N·L)
    const diffuse = Math.max(0, 
      normal.x * lightDir.x +
      normal.y * lightDir.y +
      normal.z * lightDir.z
    );
    
    // Calculate view direction (assume view from above for simplicity)
    const viewDir = { x: 0, y: 0, z: 1 };
    
    // Calculate half vector for Blinn-Phong
    const halfVector = {
      x: (viewDir.x + lightDir.x) * 0.5,
      y: (viewDir.y + lightDir.y) * 0.5,
      z: (viewDir.z + lightDir.z) * 0.5
    };
    
    // Normalize half vector
    const halfLength = Math.sqrt(
      halfVector.x * halfVector.x +
      halfVector.y * halfVector.y +
      halfVector.z * halfVector.z
    );
    
    halfVector.x /= halfLength;
    halfVector.y /= halfLength;
    halfVector.z /= halfLength;
    
    // Calculate specular factor (N·H)^shininess
    const specPower = 32.0;
    const nDotH = Math.max(0,
      normal.x * halfVector.x +
      normal.y * halfVector.y +
      normal.z * halfVector.z
    );
    const specularFactor = specular * Math.pow(nDotH, specPower);
    
    // Parse light color
    const r = parseInt(lightColor.substr(1, 2), 16) / 255;
    const g = parseInt(lightColor.substr(3, 2), 16) / 255;
    const b = parseInt(lightColor.substr(5, 2), 16) / 255;
    
    // Calculate final color with attenuation
    const att = attenuation * attenuation; // Quadratic attenuation
    
    // Combine diffuse and specular, apply AO
    const finalR = (r * diffuse + r * specularFactor) * att * ao;
    const finalG = (g * diffuse + g * specularFactor) * att * ao;
    const finalB = (b * diffuse + b * specularFactor) * att * ao;
    
    // Convert to hex color
    const toHex = (v) => {
      const hex = Math.floor(Math.min(1, Math.max(0, v)) * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    
    return {
      color: `#${toHex(finalR)}${toHex(finalG)}${toHex(finalB)}`,
      diffuse: diffuse,
      specular: specularFactor,
      attenuation: att,
      ao: ao
    };
  }
  
  // Generate a normal map from a height map
  generateNormalFromHeight(heightMap, strength = 1.0) {
    // Create a canvas to work with
    const canvas = document.createElement('canvas');
    canvas.width = heightMap.width;
    canvas.height = heightMap.height;
    const ctx = canvas.getContext('2d');
    
    // Draw height map to canvas
    ctx.drawImage(heightMap, 0, 0);
    
    // Get pixel data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    
    // Create output normal map
    const normalData = ctx.createImageData(canvas.width, canvas.height);
    const normalPixels = normalData.data;
    
    // Function to safely get height value at position
    const getHeight = (x, y) => {
      x = Math.max(0, Math.min(canvas.width - 1, x));
      y = Math.max(0, Math.min(canvas.height - 1, y));
      const idx = (y * canvas.width + x) * 4;
      return pixels[idx] / 255; // Use red channel as height
    };
    
    // Generate normal map
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        // Sample height map at neighboring pixels
        const left = getHeight(x - 1, y);
        const right = getHeight(x + 1, y);
        const up = getHeight(x, y - 1);
        const down = getHeight(x, y + 1);
        
        // Calculate normal using central differences
        let nx = (left - right) * strength;
        let ny = (up - down) * strength;
        let nz = 1.0; // Z always points out
        
        // Normalize
        const length = Math.sqrt(nx*nx + ny*ny + nz*nz);
        nx /= length;
        ny /= length;
        nz /= length;
        
        // Convert to RGB (0-255)
        // Normal maps store normals as RGB colors
        // XYZ => RGB, where (0,0,1) is stored as (128,128,255)
        const r = Math.floor((nx * 0.5 + 0.5) * 255);
        const g = Math.floor((ny * 0.5 + 0.5) * 255);
        const b = Math.floor(nz * 255);
        
        // Set pixel in normal map
        const idx = (y * canvas.width + x) * 4;
        normalPixels[idx] = r;
        normalPixels[idx + 1] = g;
        normalPixels[idx + 2] = b;
        normalPixels[idx + 3] = 255; // Alpha
      }
    }
    
    // Apply normal map to canvas
    ctx.putImageData(normalData, 0, 0);
    
    return canvas;
  }
}

// ==================== EXPORT & INITIALIZATION ====================
// Export classes and create global instances
let textureHandler;
let normalMapping;

function initNormalMapping() {
  // Create texture handler
  textureHandler = new TextureHandler();
  
  // Create normal mapping instance
  normalMapping = new NormalMapping(textureHandler);
  
  // Load standard textures
  textureHandler.loadMaterial('Wall1', 'assets/images/', 'png');
  
  // Export objects globally
  window.TextureType = TextureType;
  window.textureHandler = textureHandler;
  window.normalMapping = normalMapping;
  
  console.log("Normal mapping system initialized!");
  
  return normalMapping;
}

// Initialize on window load
window.addEventListener("load", function() {
  initNormalMapping();
});