// Wall Vertex Shader
const wallVertexShaderSource = `
  attribute vec4 aPosition;
  attribute vec2 aTextureCoord;
  
  uniform mat4 uProjectionMatrix;
  uniform mat4 uModelViewMatrix;
  
  varying highp vec2 vTextureCoord;
  varying highp float vDistance;
  
  void main() {
    gl_Position = uProjectionMatrix * uModelViewMatrix * aPosition;
    vTextureCoord = aTextureCoord;
    // Pass the z-coordinate as the distance for fog effects
    vDistance = aPosition.z;
  }
`;

// Wall Fragment Shader with lighting
const wallFragmentShaderSource = `
  precision mediump float;
  
  varying highp vec2 vTextureCoord;
  varying highp float vDistance;
  
  uniform sampler2D uWallTexture;
  uniform sampler2D uNormalMap;
  uniform sampler2D uSpecularMap;
  uniform sampler2D uAOMap;
  
  uniform vec3 uLightPosition; // Player's torch position
  uniform vec3 uLightColor;    // Color of the light
  uniform float uLightIntensity;
  uniform float uAmbientLight;
  uniform bool uUseNormalMapping;
  uniform bool uUseHighQuality;
  
  void main() {
    // Get base color from texture
    vec4 texelColor = texture2D(uWallTexture, vTextureCoord);
    
    // Apply ambient lighting as a base
    vec3 finalColor = texelColor.rgb * uAmbientLight;
    
    // Calculate distance factor for fog and light attenuation
    float distFactor = clamp(1.0 - (vDistance / 10.0), 0.0, 1.0);
    
    // High-quality lighting with normal mapping
    if (uUseHighQuality && uUseNormalMapping) {
      // Get normal from normal map (transform from [0,1] to [-1,1] range)
      vec3 normal = normalize(texture2D(uNormalMap, vTextureCoord).rgb * 2.0 - 1.0);
      
      // Get specular intensity
      float specularFactor = texture2D(uSpecularMap, vTextureCoord).r;
      
      // Get ambient occlusion
      float aoFactor = texture2D(uAOMap, vTextureCoord).r;
      
      // Calculate light direction (simplified for 2.5D)
      vec3 lightDir = normalize(vec3(0.0, 0.0, 1.0));
      
      // Calculate diffuse lighting
      float diffuse = max(dot(normal, lightDir), 0.0);
      
      // Apply lighting with distance attenuation
      vec3 lightContribution = uLightColor * diffuse * uLightIntensity * distFactor;
      
      // Add light to base ambient
      finalColor += texelColor.rgb * lightContribution * aoFactor;
      
      // Add specular highlight for shiny surfaces
      if (specularFactor > 0.0) {
        vec3 viewDir = vec3(0.0, 0.0, 1.0);
        vec3 halfDir = normalize(lightDir + viewDir);
        float specularIntensity = pow(max(dot(normal, halfDir), 0.0), 32.0) * specularFactor;
        finalColor += uLightColor * specularIntensity * distFactor;
      }
    } else {
      // Simplified lighting for low-quality mode
      finalColor += texelColor.rgb * uLightColor * uLightIntensity * distFactor;
    }
    
    // Apply fog effect for distance
    vec3 fogColor = vec3(0.05, 0.05, 0.1); // Dark blue fog
    float fogFactor = 1.0 - distFactor;
    finalColor = mix(finalColor, fogColor, fogFactor * 0.7);
    
    gl_FragColor = vec4(finalColor, texelColor.a);
  }
`;

// Floor/Ceiling Vertex Shader
const floorVertexShaderSource = `
  attribute vec4 aPosition;
  attribute vec2 aTextureCoord;
  
  uniform mat4 uProjectionMatrix;
  uniform mat4 uModelViewMatrix;
  
  varying highp vec2 vTextureCoord;
  varying highp float vDistance;
  
  void main() {
    gl_Position = uProjectionMatrix * uModelViewMatrix * aPosition;
    vTextureCoord = aTextureCoord;
    vDistance = aPosition.z;
  }
`;

// Floor/Ceiling Fragment Shader
const floorFragmentShaderSource = `
  precision mediump float;
  
  varying highp vec2 vTextureCoord;
  varying highp float vDistance;
  
  uniform sampler2D uTexture;
  uniform float uAmbientLight;
  uniform vec3 uLightColor;
  
  void main() {
    vec4 texelColor = texture2D(uTexture, vTextureCoord);
    
    // Distance-based darkness
    float distFactor = clamp(1.0 - (vDistance / 15.0), 0.0, 1.0);
    
    // Apply lighting
    vec3 finalColor = texelColor.rgb * uAmbientLight;
    finalColor += texelColor.rgb * uLightColor * distFactor * 0.5;
    
    // Add fog for distant areas
    vec3 fogColor = vec3(0.03, 0.03, 0.08); // Dark fog
    float fogFactor = 1.0 - distFactor;
    finalColor = mix(finalColor, fogColor, fogFactor * 0.8);
    
    gl_FragColor = vec4(finalColor, texelColor.a);
  }
`;

// Billboarding Vertex Shader for entities
const billboardVertexShaderSource = `
  attribute vec4 aPosition;
  attribute vec2 aTextureCoord;
  
  uniform mat4 uProjectionMatrix;
  uniform mat4 uModelViewMatrix;
  uniform vec3 uEntityPosition; // World position of the entity
  uniform float uEntityWidth;   // Width of the entity
  uniform float uEntityHeight;  // Height of the entity
  uniform vec3 uPlayerPosition; // Camera/player position
  uniform float uPlayerAngle;   // Camera/player angle
  
  varying highp vec2 vTextureCoord;
  varying highp float vDistance;
  
  void main() {
    // Calculate direction from player to entity
    vec2 dirToEntity = vec2(uEntityPosition.x - uPlayerPosition.x, 
                           uEntityPosition.y - uPlayerPosition.y);
    
    // Calculate distance to entity
    float distance = length(dirToEntity);
    vDistance = distance;
    
    // Calculate angle to entity
    float angleToEntity = atan(dirToEntity.y, dirToEntity.x);
    
    // Calculate angle relative to player's view direction
    float relativeAngle = angleToEntity - uPlayerAngle;
    
    // Normalize to [-PI, PI]
    while (relativeAngle > 3.14159) relativeAngle -= 6.28318;
    while (relativeAngle < -3.14159) relativeAngle += 6.28318;
    
    // Calculate position on screen based on field of view
    float screenX = tan(relativeAngle);
    
    // Scale for distance (perspective division)
    float scale = 1.0 / max(distance, 0.1);
    
    // Apply vertex offset based on normalized texture coordinates
    // This creates the actual billboard quad
    vec2 offset = (aTextureCoord - 0.5) * 2.0; // Convert from [0,1] to [-1,1]
    
    // Final position - note how we use the original z from uEntityPosition
    vec4 position = vec4(
      screenX + (offset.x * uEntityWidth * scale),
      offset.y * uEntityHeight * scale,
      distance,
      1.0
    );
    
    gl_Position = uProjectionMatrix * uModelViewMatrix * position;
    vTextureCoord = aTextureCoord;
  }
`;

// Billboard Fragment Shader with lighting
const billboardFragmentShaderSource = `
  precision mediump float;
  
  varying highp vec2 vTextureCoord;
  varying highp float vDistance;
  
  uniform sampler2D uEntityTexture;
  uniform vec3 uLightPosition;
  uniform vec3 uLightColor;
  uniform float uLightIntensity;
  uniform float uAmbientLight;
  uniform vec3 uEntityColor;    // Base color for untextured entities
  uniform bool uUseTexture;     // Whether to use texture or flat color
  
  void main() {
    vec4 color;
    
    // Choose between texture or flat color
    if (uUseTexture) {
      color = texture2D(uEntityTexture, vTextureCoord);
      
      // Discard fully transparent pixels
      if (color.a < 0.1) {
        discard;
      }
    } else {
      color = vec4(uEntityColor, 1.0);
    }
    
    // Calculate distance factor for light attenuation
    float distFactor = clamp(1.0 - (vDistance / 7.0), 0.0, 1.0);
    
    // Apply lighting
    vec3 finalColor = color.rgb * uAmbientLight;
    finalColor += color.rgb * uLightColor * uLightIntensity * distFactor;
    
    // Apply fog for distant entities
    vec3 fogColor = vec3(0.05, 0.05, 0.1);
    float fogFactor = 1.0 - distFactor;
    finalColor = mix(finalColor, fogColor, fogFactor * 0.7);
    
    gl_FragColor = vec4(finalColor, color.a);
  }
`;

// Projectile Vertex Shader - Similar to billboard but with glow effect
const projectileVertexShaderSource = `
  attribute vec4 aPosition;
  attribute vec2 aTextureCoord;
  
  uniform mat4 uProjectionMatrix;
  uniform mat4 uModelViewMatrix;
  uniform vec3 uProjectilePosition;
  uniform float uProjectileSize;
  uniform vec3 uPlayerPosition;
  uniform float uPlayerAngle;
  uniform float uTime; // For animation effects
  
  varying highp vec2 vTextureCoord;
  varying highp float vDistance;
  varying highp float vTime;
  
  void main() {
    // Similar to billboard shader but with time component for effects
    vec2 dirToProjectile = vec2(uProjectilePosition.x - uPlayerPosition.x, 
                               uProjectilePosition.y - uPlayerPosition.y);
    
    float distance = length(dirToProjectile);
    vDistance = distance;
    
    float angleToProjectile = atan(dirToProjectile.y, dirToProjectile.x);
    float relativeAngle = angleToProjectile - uPlayerAngle;
    
    // Normalize to [-PI, PI]
    while (relativeAngle > 3.14159) relativeAngle -= 6.28318;
    while (relativeAngle < -3.14159) relativeAngle += 6.28318;
    
    float screenX = tan(relativeAngle);
    float scale = 1.0 / max(distance, 0.1);
    
    // Add pulsating effect based on time
    float pulseFactor = 1.0 + 0.1 * sin(uTime * 10.0);
    
    vec2 offset = (aTextureCoord - 0.5) * 2.0;
    vec4 position = vec4(
      screenX + (offset.x * uProjectileSize * scale * pulseFactor),
      offset.y * uProjectileSize * scale * pulseFactor,
      distance,
      1.0
    );
    
    gl_Position = uProjectionMatrix * uModelViewMatrix * position;
    vTextureCoord = aTextureCoord;
    vTime = uTime;
  }
`;

// Projectile Fragment Shader with glow
const projectileFragmentShaderSource = `
  precision mediump float;
  
  varying highp vec2 vTextureCoord;
  varying highp float vDistance;
  varying highp float vTime;
  
  uniform vec3 uProjectileColor;
  uniform float uAmbientLight;
  
  void main() {
    // Calculate distance from center of the billboard (for circular glow)
    vec2 center = vec2(0.5, 0.5);
    float dist = distance(vTextureCoord, center);
    
    // Create circular glow that fades at edges
    float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
    
    // Add pulsating effect
    float pulse = 0.8 + 0.2 * sin(vTime * 15.0);
    alpha *= pulse;
    
    // Make the core brighter
    float intensity = 1.0;
    if (dist < 0.2) {
      intensity = 1.5;
    }
    
    // Apply lighting based on distance
    float distFactor = clamp(1.0 - (vDistance / 10.0), 0.0, 1.0);
    vec3 finalColor = uProjectileColor * (uAmbientLight + distFactor) * intensity;
    
    // Add inner bright core
    if (dist < 0.1) {
      finalColor = mix(finalColor, vec3(1.0, 1.0, 1.0), 0.7);
    }
    
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

