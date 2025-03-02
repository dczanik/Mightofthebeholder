// controls.js - Input handling for the game

// Movement functions
function moveForward() {
  if (player.isMoving || player.isTurning) return;
  var delta = dirDeltas(player.direction);
  var nx = Math.floor(player.x) + delta[0];
  var ny = Math.floor(player.y) + delta[1];
  if (canMoveTo(nx + 0.5, ny + 0.5)) {
    log("Move Forward.");
    startMoveAnimation(nx + 0.5, ny + 0.5);
  }
}

function moveBackward() {
  if (player.isMoving || player.isTurning) return;
  var delta = dirDeltas(player.direction);
  var nx = Math.floor(player.x) - delta[0];
  var ny = Math.floor(player.y) - delta[1];
  if (canMoveTo(nx + 0.5, ny + 0.5)) {
    log("Move Backward.");
    startMoveAnimation(nx + 0.5, ny + 0.5);
  }
}

function strafeLeft() {
  if (player.isMoving || player.isTurning) return;
  var leftDir = (player.direction + 3) % 4;
  var delta = dirDeltas(leftDir);
  var nx = Math.floor(player.x) + delta[0];
  var ny = Math.floor(player.y) + delta[1];
  if (canMoveTo(nx + 0.5, ny + 0.5)) {
    log("Strafe Left.");
    startMoveAnimation(nx + 0.5, ny + 0.5);
  }
}

function strafeRight() {
  if (player.isMoving || player.isTurning) return;
  var rightDir = (player.direction + 1) % 4;
  var delta = dirDeltas(rightDir);
  var nx = Math.floor(player.x) + delta[0];
  var ny = Math.floor(player.y) + delta[1];
  if (canMoveTo(nx + 0.5, ny + 0.5)) {
    log("Strafe Right.");
    startMoveAnimation(nx + 0.5, ny + 0.5);
  }
}

function turnLeft() {
  if (player.isMoving || player.isTurning) return;
  var newDir = (player.direction + 3) % 4;
  log("Turn Left. Now facing " + directionToString(newDir) + ".");
  startTurnAnimation(newDir);
}

function turnRight() {
  if (player.isMoving || player.isTurning) return;
  var newDir = (player.direction + 1) % 4;
  log("Turn Right. Now facing " + directionToString(newDir) + ".");
  startTurnAnimation(newDir);
}

// Set up button event listeners
function setupControlButtons() {
  document.getElementById("btnForward").onclick = moveForward;
  document.getElementById("btnBack").onclick = moveBackward;
  document.getElementById("btnTurnLeft").onclick = turnLeft;
  document.getElementById("btnTurnRight").onclick = turnRight;
  document.getElementById("btnStrafeLeft").onclick = strafeLeft;
  document.getElementById("btnStrafeRight").onclick = strafeRight;
}

// Set up keyboard event listeners
function setupKeyboardControls() {
  window.addEventListener("keydown", function(e) {
    var k = e.key.toLowerCase();
    if (k === 'q') turnLeft();
    if (k === 'w') moveForward();
    if (k === 'e') turnRight();
    if (k === 'a') strafeLeft();
    if (k === 's') moveBackward();
    if (k === 'd') strafeRight();
  });
}

// Initialize controls
window.addEventListener("load", function() {
  setupControlButtons();
  setupKeyboardControls();
  console.log("Controls initialized");
});