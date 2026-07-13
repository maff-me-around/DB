let ball;
let xSymbol;
let anchorPoint;
let isPulling = false;
let pullLineColor;
let magneticForceRadius = 150;
let magnetStrength = 0.4; 
let magneticTargets;

// Rotation variables
let rotationAngle = 0;
let rotationSpeed = 0.015; 

// --- SETTINGS ---
let targetDistanceMultiplier = 1.35; 

// UI elements and logs
let dynamicLogText = "status: ready to launch";
let gameResult = ""; 
let bounceCount = 0; // Variabile per contare i rimbalzi

function setup() {
  createCanvas(windowWidth, windowHeight);
  background(0);
  pullLineColor = color(0, 255, 255); 
  
  let centerX = width / 2;
  let centerY = height / 2;
  let xLength = 200;
  let xWidth = xLength / 4.5;

  xSymbol = {
    pos: createVector(centerX, centerY),
    len: xLength,
    wid: xWidth
  };

  let halfLen = xLength / 2;
  let baseTargetDist = dist(centerX, centerY, centerX + halfLen, centerY + halfLen);
  let targetDist = baseTargetDist * targetDistanceMultiplier;
  
  magneticTargets = [
    { baseAngle: -PI * 0.75, dist: targetDist, name: "top-left target", pos: createVector(0,0) },
    { baseAngle: -PI * 0.25, dist: targetDist, name: "top-right target", pos: createVector(0,0) },
    { baseAngle: PI * 0.25, dist: targetDist, name: "bottom-right target", pos: createVector(0,0) },
    { baseAngle: PI * 0.75, dist: targetDist, name: "bottom-left target", pos: createVector(0,0) }
  ];

  anchorPoint = createVector(width * 0.15, height * 0.75);

  ball = {
    pos: anchorPoint.copy(),
    vel: createVector(0, 0),
    acc: createVector(0, 0),
    r: 26,
    friction: 0.985, 
    state: "stationary", 
    capturedBy: null 
  };
}

function draw() {
  background(0); 

  // Update rotation and target positions
  rotationAngle += rotationSpeed;
  for (let target of magneticTargets) {
    target.pos.x = xSymbol.pos.x + cos(target.baseAngle + rotationAngle) * target.dist;
    target.pos.y = xSymbol.pos.y + sin(target.baseAngle + rotationAngle) * target.dist;
  }

  drawXSymbol();
  drawMagneticPoints();

  // Catapult Logic
  if (isPulling) {
    let pullDir = p5.Vector.sub(createVector(mouseX, mouseY), anchorPoint);
    pullDir.limit(100); 
    ball.pos = p5.Vector.add(anchorPoint, pullDir);
    
    stroke(pullLineColor);
    strokeWeight(3);
    line(anchorPoint.x, anchorPoint.y, ball.pos.x, ball.pos.y);
    
    let launchPower = map(pullDir.mag(), 0, 100, 0, 10);
    dynamicLogText = "status: pulling... power: " + launchPower.toFixed(1);
  } 
  else if (ball.state === "captured" && ball.capturedBy) {
    ball.pos = ball.capturedBy.pos.copy();
    ball.vel.set(0, 0);
    ball.acc.set(0, 0);
  }
  else if (ball.state === "moving") {
    ball.vel.mult(ball.friction); 

    // Check collision with the rotating X and add bounces
    let angle1 = rotationAngle + PI / 4;
    let angle2 = rotationAngle + PI / 4 + PI / 2;
    if (checkRectCollision(ball, xSymbol.pos, xSymbol.len, xSymbol.wid, angle1)) bounceCount++;
    if (checkRectCollision(ball, xSymbol.pos, xSymbol.len, xSymbol.wid, angle2)) bounceCount++;

    // Magnetic Attraction & Wobble-to-Stop physics
    for (let target of magneticTargets) {
      let distToTarget = p5.Vector.dist(ball.pos, target.pos);

      if (distToTarget < magneticForceRadius) {
        let forceDir = p5.Vector.sub(target.pos, ball.pos);
        forceDir.normalize();
        
        let forceMag = map(distToTarget, magneticForceRadius, 0, 0, magnetStrength);
        ball.acc.add(forceDir.mult(forceMag));
        
        if (distToTarget < 40) {
          ball.vel.mult(0.92); 
        }
        
        // Final Catch & Win/Loss check
        if (distToTarget < 12) { 
          ball.capturedBy = target;
          ball.state = "captured";
          
          if (target.name === "top-left target") {
            gameResult = "WIN";
            dynamicLogText = "status: success! correct target";
          } else {
            gameResult = "LOSS";
            dynamicLogText = "status: failed! wrong target";
          }
          break; 
        }
      }
    }

    if (ball.state === "moving") {
      ball.vel.add(ball.acc);
      ball.pos.add(ball.vel);
      ball.acc.mult(0); 

      // Screen edge bounce
      let bouncedOnWall = false;
      if (ball.pos.x < ball.r || ball.pos.x > width - ball.r) {
        ball.vel.x *= -1;
        bouncedOnWall = true;
      }
      if (ball.pos.y < ball.r || ball.pos.y > height - ball.r) {
        ball.vel.y *= -1;
        bouncedOnWall = true;
      }
      
      if (bouncedOnWall) bounceCount++;
    }
  }

  drawBall();
  drawUI();
}

// Function to handle collision with rotated rectangles (now returns true if it hits)
function checkRectCollision(b, center, w, h, angle) {
  let translatedX = b.pos.x - center.x;
  let translatedY = b.pos.y - center.y;

  let localX = translatedX * cos(-angle) - translatedY * sin(-angle);
  let localY = translatedX * sin(-angle) + translatedY * cos(-angle);

  let closestX = constrain(localX, -w/2, w/2);
  let closestY = constrain(localY, -h/2, h/2);

  let dX = localX - closestX;
  let dY = localY - closestY;
  let distanceSquared = dX*dX + dY*dY;

  if (distanceSquared < b.r * b.r) {
     let distance = sqrt(distanceSquared);
     if(distance === 0) return false; 
     
     let nx = dX / distance;
     let ny = dY / distance;

     let globalNx = nx * cos(angle) - ny * sin(angle);
     let globalNy = nx * sin(angle) + ny * cos(angle);
     let normal = createVector(globalNx, globalNy);

     let dot = b.vel.dot(normal);
     b.vel.sub(p5.Vector.mult(normal, 2 * dot));

     let overlap = b.r - distance;
     b.pos.add(p5.Vector.mult(normal, overlap));
     
     b.vel.mult(0.7);
     return true; // Ha colpito la X!
  }
  return false;
}

function drawXSymbol() {
  push();
  translate(xSymbol.pos.x, xSymbol.pos.y);
  rotate(rotationAngle); 
  fill(255);
  noStroke();
  rotate(PI / 4); 
  rectMode(CENTER);
  rect(0, 0, xSymbol.len, xSymbol.wid);
  rotate(PI / 2);
  rect(0, 0, xSymbol.len, xSymbol.wid);
  pop();
}

function drawMagneticPoints() {
  push();
  noFill();
  strokeWeight(1.5);
  
  for (let target of magneticTargets) {
    let d = p5.Vector.dist(ball.pos, target.pos);
    
    if (target.name === "top-left target") {
      stroke(255); 
      ellipse(target.pos.x, target.pos.y, 30);
    } else {
      if (d < magneticForceRadius) {
        let fadeAlpha = map(d, magneticForceRadius, 0, 0, 255);
        stroke(255, fadeAlpha); 
        ellipse(target.pos.x, target.pos.y, 30);
      }
    }
    
    if (ball.state === "moving") {
      if (d < magneticForceRadius) {
        if (target.name !== "top-left target") {
          let fadeAlpha = map(d, magneticForceRadius, 0, 0, 255);
          stroke(255, fadeAlpha);
        } else {
          stroke(255);
        }
        
        let ringSize = map(d, magneticForceRadius, 0, 60, 20);
        ellipse(target.pos.x, target.pos.y, ringSize);
      }
    }
  }
  
  fill(pullLineColor);
  noStroke();
  ellipse(anchorPoint.x, anchorPoint.y, 10);
  pop();
}

function drawBall() {
  push();
  noStroke();
  if (ball.state === "captured") {
    if (ball.capturedBy.name === "top-left target") {
      fill(255); 
    } else {
      fill(255, 0, 0); 
    }
  } else {
    fill(255);
  }
  ellipse(ball.pos.x, ball.pos.y, ball.r * 2);
  pop();
}

function drawUI() {
  push();
  fill(255);
  noStroke(); 
  
  // Win/Loss Message (Centered)
  textAlign(CENTER);
  if (gameResult === "WIN") {
    fill(0, 255, 0);
    textSize(16);
    text("you win", width / 2, 100);
  } else if (gameResult === "LOSS") {
    fill(255);
    textSize(16);
    text("press space to retry", width / 2, 100);
  }

  // Dynamic Log (Bottom Left)
  fill(255);
  textAlign(LEFT);
  textSize(16);
  text(dynamicLogText, 30, height - 30);
  
  // Bounces Score (Bottom Right)
  textAlign(RIGHT);
  text("bounces: " + bounceCount, width - 30, height - 30);
  
  pop();
}

// Mouse Controls
function mousePressed() {
  let dToBall = dist(mouseX, mouseY, ball.pos.x, ball.pos.y);
  if ((ball.state === "stationary" || ball.state === "captured") && dToBall < ball.r) {
    isPulling = true;
    ball.state = "launching";
    ball.capturedBy = null; 
    gameResult = ""; 
    bounceCount = 0; // Resetta i rimbalzi al nuovo lancio
  }
}

function mouseReleased() {
  if (isPulling) {
    let launchVector = p5.Vector.sub(anchorPoint, ball.pos);
    launchVector.mult(0.65); 
    ball.vel.set(launchVector);
    isPulling = false;
    ball.state = "moving";
    dynamicLogText = "status: launched";
  }
}

// SPACEBAR to reset
function keyPressed() {
  if (key === ' ' || keyCode === 32) {
    resetGame();
  }
}

function resetGame() {
  ball.pos = anchorPoint.copy();
  ball.vel.set(0, 0);
  ball.acc.set(0, 0);
  ball.state = "stationary";
  ball.capturedBy = null;
  isPulling = false;
  gameResult = "";
  bounceCount = 0; // Resetta i rimbalzi
  dynamicLogText = "status: game reset - ready to launch";
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
