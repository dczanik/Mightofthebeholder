// sprites.js - Sprite and animation system for Might of the Beholder

// Global sprite sheets cache
const spriteSheets = {};

// Class to handle sprite sheets
class SpriteSheet {
  constructor(imagePath, frameWidth, frameHeight, config = {}) {
    this.loaded = false;
    this.image = new Image();
    this.image.onload = () => {
      this.loaded = true;
      console.log(`Sprite sheet loaded: ${imagePath}`);
    };
    this.image.onerror = (err) => {
      console.error(`Failed to load sprite sheet: ${imagePath}`, err);
    };
    this.image.src = imagePath;
    
    this.frameWidth = frameWidth;
    this.frameHeight = frameHeight;
    
    // Calculate frames in the sprite sheet
    this.framesPerRow = config.framesPerRow || 0; // Will be calculated when loaded if not provided
    this.totalFrames = config.totalFrames || 0;   // Will be calculated when loaded if not provided
    
    // Animation configuration
    this.animations = config.animations || {};
  }
  
  // Returns true if the sprite sheet is ready to use
  isReady() {
    // If not loaded yet, check if it's loaded now and initialize if needed
    if (!this.loaded && this.image.complete) {
      this.loaded = true;
      
      // If framesPerRow wasn't provided, calculate it
      if (!this.framesPerRow) {
        this.framesPerRow = Math.floor(this.image.width / this.frameWidth);
      }
      
      // If totalFrames wasn't provided, calculate it
      if (!this.totalFrames) {
        const rows = Math.floor(this.image.height / this.frameHeight);
        this.totalFrames = this.framesPerRow * rows;
      }
    }
    
    return this.loaded;
  }
  
  // Get the source rectangle for a specific frame
  getFrameRect(frameIndex) {
    if (frameIndex >= this.totalFrames) {
      console.warn(`Frame index ${frameIndex} is out of bounds (max: ${this.totalFrames - 1})`);
      frameIndex = frameIndex % this.totalFrames;
    }
    
    const row = Math.floor(frameIndex / this.framesPerRow);
    const col = frameIndex % this.framesPerRow;
    
    return {
      x: col * this.frameWidth,
      y: row * this.frameHeight,
      width: this.frameWidth,
      height: this.frameHeight
    };
  }
  
  // Draw a specific frame at the target position and size
  drawFrame(ctx, frameIndex, x, y, width, height) {
    if (!this.isReady()) return false;
    
    const srcRect = this.getFrameRect(frameIndex);
    
    ctx.drawImage(
      this.image,
      srcRect.x, srcRect.y, srcRect.width, srcRect.height,
      x, y, width, height
    );
    
    return true;
  }
  
  // Get animation frames array for an animation name
  getAnimationFrames(animationName) {
    if (this.animations[animationName]) {
      return this.animations[animationName];
    }
    // Default: Return array of first frame
    return [0];
  }
}

// Class to handle animated sprites
class AnimatedSprite {
  constructor(spriteSheet, defaultAnimation = 'idle') {
    this.spriteSheet = spriteSheet;
    this.currentAnimation = defaultAnimation;
    this.currentFrame = 0;
    this.frameTime = 0;
    this.animationSpeed = 10; // Frames per second
    this.lastUpdateTime = performance.now();
    this.direction = 1; // For directional sprites: 0=N, 1=E, 2=S, 3=W
  }
  
  // Set active animation
  setAnimation(animationName) {
    if (this.currentAnimation !== animationName) {
      this.currentAnimation = animationName;
      this.currentFrame = 0;
      this.frameTime = 0;
    }
  }
  
  // Set direction (0=North, 1=East, 2=South, 3=West)
  setDirection(direction) {
    this.direction = direction;
  }
  
  // Update animation based on elapsed time
  update(dt) {
    if (!this.spriteSheet.isReady()) return;
    
    // Update animation timer
    this.frameTime += dt;
    
    // Check if it's time for the next frame
    const frameDuration = 1000 / this.animationSpeed;
    if (this.frameTime >= frameDuration) {
      // Get the frames for current animation
      const frames = this.spriteSheet.getAnimationFrames(this.currentAnimation);
      
      // Advance frame
      this.currentFrame = (this.currentFrame + 1) % frames.length;
      
      // Reset time counter
      this.frameTime -= frameDuration;
    }
  }
  
  // Draw the current animation frame
  draw(ctx, x, y, width, height) {
    if (!this.spriteSheet.isReady()) return false;
    
    // Get frames for current animation
    const frames = this.spriteSheet.getAnimationFrames(this.currentAnimation);
    
    // Make sure currentFrame is valid
    const frameIndex = frames[this.currentFrame % frames.length];
    
    // Adjust frame index based on direction, if using directional sprites
    // This assumes sprite sheet has directions in rows: N, E, S, W
    // and animations in columns
    let adjustedFrameIndex = frameIndex;
    if (this.spriteSheet.directional) {
      const framesPerDirection = this.spriteSheet.totalFrames / 4;
      adjustedFrameIndex = frameIndex + (this.direction * framesPerDirection);
    }
    
    // Draw the current frame
    return this.spriteSheet.drawFrame(ctx, adjustedFrameIndex, x, y, width, height);
  }
}

// Function to load a sprite sheet and cache it
function loadSpriteSheet(name, imagePath, frameWidth, frameHeight, config = {}) {
  const sheet = new SpriteSheet(imagePath, frameWidth, frameHeight, config);
  spriteSheets[name] = sheet;
  return sheet;
}

// Function to get a sprite sheet from the cache
function getSpriteSheet(name) {
  return spriteSheets[name];
}

// Monster-specific animation configurations
const MONSTER_SPRITE_CONFIG = {
  'skeleton': {
    frameWidth: 32,
    frameHeight: 32,
    animations: {
      'idle': [0, 1, 2, 3],
      'walk': [4, 5, 6, 7],
      'attack': [8, 9, 10, 11],
      'death': [12, 13, 14, 15]
    }
  },
  'orc': {
    frameWidth: 32,
    frameHeight: 32,
    animations: {
      'idle': [0, 1, 2, 3],
      'walk': [4, 5, 6, 7],
      'attack': [8, 9, 10, 11],
      'death': [12, 13, 14, 15]
    }
  },
  'spider': {
    frameWidth: 32,
    frameHeight: 32,
    animations: {
      'idle': [0, 1, 2, 3],
      'walk': [4, 5, 6, 7],
      'attack': [8, 9, 10, 11],
      'death': [12, 13, 14, 15]
    }
  },
  'wizard': {
    frameWidth: 32,
    frameHeight: 32,
    animations: {
      'idle': [0, 1, 2, 3],
      'walk': [4, 5, 6, 7],
      'attack': [8, 9, 10, 11],
      'death': [12, 13, 14, 15]
    }
  }
};

// Initialize the sprite system with common monster sprites
function initSpriteSystem() {
  console.log("Initializing sprite system...");
  
  // Load monster sprite sheets
  loadSpriteSheet('skeleton', 'assets/images/skeleton_sheet.png', 
    MONSTER_SPRITE_CONFIG.skeleton.frameWidth, 
    MONSTER_SPRITE_CONFIG.skeleton.frameHeight, 
    { animations: MONSTER_SPRITE_CONFIG.skeleton.animations }
  );
  
  loadSpriteSheet('orc', 'assets/images/orc_sheet.png', 
    MONSTER_SPRITE_CONFIG.orc.frameWidth, 
    MONSTER_SPRITE_CONFIG.orc.frameHeight, 
    { animations: MONSTER_SPRITE_CONFIG.orc.animations }
  );
  
  loadSpriteSheet('spider', 'assets/images/spider_sheet.png', 
    MONSTER_SPRITE_CONFIG.spider.frameWidth, 
    MONSTER_SPRITE_CONFIG.spider.frameHeight, 
    { animations: MONSTER_SPRITE_CONFIG.spider.animations }
  );
  
  loadSpriteSheet('wizard', 'assets/images/wizard_sheet.png', 
    MONSTER_SPRITE_CONFIG.wizard.frameWidth, 
    MONSTER_SPRITE_CONFIG.wizard.frameHeight, 
    { animations: MONSTER_SPRITE_CONFIG.wizard.animations }
  );
  
  // Load projectile sprite sheets
  loadSpriteSheet('fireball', 'assets/images/fireball_sheet.png', 32, 32, {
    animations: {
      'fly': [0, 1, 2, 3],
      'explode': [4, 5, 6, 7]
    }
  });
  
  console.log("Sprite system initialized!");
}

// Export the sprite system
window.SpriteSheet = SpriteSheet;
window.AnimatedSprite = AnimatedSprite;
window.loadSpriteSheet = loadSpriteSheet;
window.getSpriteSheet = getSpriteSheet;
window.initSpriteSystem = initSpriteSystem;
window.MONSTER_SPRITE_CONFIG = MONSTER_SPRITE_CONFIG;

// Initialize when the window loads
window.addEventListener("load", function() {
  // Initialize the sprite system
  initSpriteSystem();
});