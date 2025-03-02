// This contains tools used to debug the game, developer stuff.

// Define the green billboard at position (15.5, 12.5)
var greenBillboard = { 
  x: 15.5, 
  y: 12.5,
  width: 1.0,   // Width in world units
  height: 2.0   // Height in world units (makes it rectangular)
};

function drawBillboard(obj) {
  // Calculate vector from player to billboard
  var dx = obj.x - animX();
  var dy = obj.y - animY();
  var actualDistance = Math.sqrt(dx*dx + dy*dy);
  
  // Calculate the angle to the billboard (in world space)
  var billboardAngle = Math.atan2(dy, dx);
  
  // Calculate the angle difference between player's view and billboard
  var angleDiff = billboardAngle - player.angle;
  
  // Normalize angle difference to [-PI, PI]
  while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
  while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
  
  // Only display the billboard if it's within our field of view
  if (Math.abs(angleDiff) > fov/2) return;
  
  // Project the billboard's screen position based on angle difference
  var screenX = screenW / 2 + (angleDiff / (fov/2)) * (screenW / 2);
  
  // Calculate billboard size based on distance (perspective division)
  var scale = 1.0 / actualDistance;
  var spriteHeight = obj.height * scale * screenH * 0.5;
  var spriteWidth = obj.width * scale * screenH * 0.5;
  
  // Calculate vertical position (centered)
  var screenY = screenH / 2 - spriteHeight / 2;
  
  // Check occlusion for each vertical strip of the billboard
  var leftEdge = Math.floor(screenX - spriteWidth / 2);
  var rightEdge = Math.ceil(screenX + spriteWidth / 2);
  
  // Clamp to screen boundaries
  leftEdge = Math.max(0, leftEdge);
  rightEdge = Math.min(screenW - 1, rightEdge);
  
  // Pre-compute some values
  var billboardLeftAngle = player.angle + ((leftEdge - screenW/2) / (screenW/2)) * (fov/2);
  var angleStep = fov / screenW;
  
  // Create a depth buffer for the billboard strips
  var stripsToRender = [];
  
  // Check each column of the billboard
  for (var x = leftEdge; x <= rightEdge; x++) {
    // Calculate the ray angle for this screen column
    var rayAngle = billboardLeftAngle + (x - leftEdge) * angleStep;
    
    // Cast a ray to find the nearest wall
    var ray = castRay(animX(), animY(), rayAngle);
    
    // Only render this strip if the billboard is closer than the wall
    if (actualDistance < ray.distance) {
      stripsToRender.push(x);
    }
  }
  
  // Only proceed if some strips are visible
  if (stripsToRender.length > 0) {
    // Draw the billboard's visible strips
    ctx.fillStyle = "lime";
    
    // Draw visible strips (this is a simplified approach)
    for (var i = 0; i < stripsToRender.length; i++) {
      var x = stripsToRender[i];
      
      // Map from screen coordinates back to billboard texture coordinates
      var relativeX = (x - (screenX - spriteWidth/2)) / spriteWidth;
      
      // Ensure relativeX is within valid range
      if (relativeX >= 0 && relativeX <= 1) {
        // Draw a vertical strip of the billboard
        ctx.fillRect(
          x,
          screenY,
          1,
          spriteHeight
        );
      }
    }
    
    // Show distance text only if enough of the billboard is visible
    if (stripsToRender.length > spriteWidth / 4) {
      ctx.fillStyle = "white";
      ctx.font = "14px Arial";
      ctx.textAlign = "center";
      ctx.fillText("Distance: " + actualDistance.toFixed(2), screenX, screenY - 10);
    }
  }
  
  // Add a debug call to the minimap to visualize the billboard
  var miniCanvas = document.getElementById("miniMapCanvas");
  var miniCtx = miniCanvas.getContext("2d");
  miniCtx.fillStyle = "lime";
  miniCtx.fillRect(obj.x * 8 - 4, obj.y * 8 - 4, 8, 8);
}

