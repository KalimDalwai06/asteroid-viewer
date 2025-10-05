import * as THREE from "three";

let meteorMesh;
let traveledPath;
let futurePath;
let progress = 0;
let hasImpacted = false;
let isFastForward = false;
let scene = null;

let orbitPoints = [];
let impactTime = 0;
let earthImpactPosition = null;

const ORBIT_SEGMENTS = 400;

export function addMeteorImpact(sceneRef, earthMesh, sunMesh, earthPivot, currentEarthAngle) {
  scene = sceneRef;
  
  // Earth orbital parameters
  const earthDistance = 25;
  const earthOrbitalSpeed = (2 * Math.PI / 1.0) / 365.25;
  
  // Time until impact (in seconds)
  impactTime = 15;
  
  // Calculate where Earth will be when meteor reaches it
  const futureEarthAngle = currentEarthAngle + (earthOrbitalSpeed * impactTime);
  earthImpactPosition = new THREE.Vector3(
    earthDistance * Math.cos(futureEarthAngle),
    0,
    earthDistance * Math.sin(futureEarthAngle)
  );
  
  // Position meteor to start "behind" Earth but on an intercept course
  // Start at a position that will naturally arc toward the impact point
  const meteorStartAngle = currentEarthAngle - Math.PI * 0.4; // Behind Earth
  const meteorStartDistance = 35;
  
  const meteorStartPos = new THREE.Vector3(
    meteorStartDistance * Math.cos(meteorStartAngle),
    0,
    meteorStartDistance * Math.sin(meteorStartAngle)
  );
  
  // Create smooth curved path from meteor start to Earth's future position
  orbitPoints = [];
  
  // Use quadratic bezier curve for smooth trajectory
  const controlPointDistance = 45;
  const controlAngle = (meteorStartAngle + futureEarthAngle) / 2;
  const controlPoint = new THREE.Vector3(
    controlPointDistance * Math.cos(controlAngle),
    0,
    controlPointDistance * Math.sin(controlAngle)
  );
  
  // Generate smooth curve
  for (let i = 0; i <= ORBIT_SEGMENTS; i++) {
    const t = i / ORBIT_SEGMENTS;
    const invT = 1 - t;
    
    // Quadratic Bezier: B(t) = (1-t)²P0 + 2(1-t)tP1 + t²P2
    const point = new THREE.Vector3(
      invT * invT * meteorStartPos.x + 2 * invT * t * controlPoint.x + t * t * earthImpactPosition.x,
      0,
      invT * invT * meteorStartPos.z + 2 * invT * t * controlPoint.z + t * t * earthImpactPosition.z
    );
    
    orbitPoints.push(point);
  }
  
  // Create meteor mesh
  const meteorGeometry = new THREE.SphereGeometry(0.4, 16, 16);
  const meteorMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xff4400, 
    emissive: 0xaa2200,
    emissiveIntensity: 1
  });
  meteorMesh = new THREE.Mesh(meteorGeometry, meteorMaterial);
  meteorMesh.position.copy(meteorStartPos);
  scene.add(meteorMesh);

  // Glow effect
  const glowGeometry = new THREE.SphereGeometry(0.5, 16, 16);
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0xff6600,
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending
  });
  const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
  meteorMesh.add(glowMesh);

  // Traveled path (solid line showing where meteor has been)
  const traveledGeometry = new THREE.BufferGeometry().setFromPoints([meteorStartPos]);
  const traveledMaterial = new THREE.LineBasicMaterial({ 
    color: 0xff6600, 
    opacity: 0.8, 
    transparent: true,
    linewidth: 2
  });
  traveledPath = new THREE.Line(traveledGeometry, traveledMaterial);
  scene.add(traveledPath);

  // Future path (dashed line showing planned trajectory)
  const futureGeometry = new THREE.BufferGeometry().setFromPoints(orbitPoints);
  const futureMaterial = new THREE.LineDashedMaterial({ 
    color: 0xff8844,
    dashSize: 0.8,
    gapSize: 0.4,
    opacity: 0.5,
    transparent: true
  });
  futurePath = new THREE.Line(futureGeometry, futureMaterial);
  futurePath.computeLineDistances();
  scene.add(futurePath);

  progress = 0;
  hasImpacted = false;
  
  console.log(`🌍 Earth current angle: ${currentEarthAngle.toFixed(2)}`);
  console.log(`🎯 Earth impact angle: ${futureEarthAngle.toFixed(2)}`);
  console.log(`☄️ Meteor start position:`, meteorStartPos);
  console.log(`💥 Impact position:`, earthImpactPosition);
}

export function updateMeteorImpact(delta, earthMesh) {
  if (!meteorMesh || hasImpacted || orbitPoints.length === 0) return;

  const baseSpeed = 1 / impactTime;
  const fastSpeed = baseSpeed * 30;
  const speed = isFastForward ? fastSpeed : baseSpeed;

  progress += delta * speed;

  if (progress >= 1) {
    progress = 1;
  }

  // Interpolate position along orbit
  const indexFloat = progress * (orbitPoints.length - 1);
  const currentIndex = Math.floor(indexFloat);
  const nextIndex = Math.min(currentIndex + 1, orbitPoints.length - 1);
  const localProgress = indexFloat - currentIndex;

  const currentPoint = orbitPoints[currentIndex];
  const nextPoint = orbitPoints[nextIndex];
  meteorMesh.position.lerpVectors(currentPoint, nextPoint, localProgress);

  // Rotate meteor
  meteorMesh.rotation.x += delta * 2;
  meteorMesh.rotation.y += delta * 3;

  // Update traveled path
  const traveledPoints = orbitPoints.slice(0, Math.max(currentIndex + 1, 2));
  if (traveledPoints.length > 1) {
    traveledPath.geometry.setFromPoints(traveledPoints);
  }

  // Update future path
  const futurePoints = orbitPoints.slice(currentIndex);
  if (futurePoints.length > 1) {
    futurePath.geometry.setFromPoints(futurePoints);
    futurePath.computeLineDistances();
  }

  // Check for collision
  const earthPos = new THREE.Vector3();
  earthMesh.getWorldPosition(earthPos);
  const distance = meteorMesh.position.distanceTo(earthPos);
  
  if (distance < 2.5 && !hasImpacted) {
    hasImpacted = true;
    
    meteorMesh.material.emissive.set(0xffaa00);
    meteorMesh.material.emissiveIntensity = 3;
    meteorMesh.scale.set(2.5, 2.5, 2.5);
    
    if (futurePath) futurePath.visible = false;
    
    console.log(`💥 IMPACT! Distance: ${distance.toFixed(2)} units`);
    console.log(`☄️ Meteor position:`, meteorMesh.position);
    console.log(`🌍 Earth position:`, earthPos);
  }
}

export function setFastForward(enabled) {
  isFastForward = enabled;
}

export function resetMeteorImpact(sceneRef, earthMesh, sunMesh, earthPivot, currentEarthAngle) {
  if (meteorMesh) { scene.remove(meteorMesh); }
  if (traveledPath) { scene.remove(traveledPath); }
  if (futurePath) { scene.remove(futurePath); }

  meteorMesh = null;
  traveledPath = null;
  futurePath = null;
  orbitPoints = [];
  progress = 0;
  hasImpacted = false;
  isFastForward = false;

  addMeteorImpact(sceneRef, earthMesh, sunMesh, earthPivot, currentEarthAngle);
}

export function getMeteorState() {
  return { progress, hasImpacted, isFastForward };
}