import { useState, useEffect, useRef } from "react";
import { Play, RotateCcw } from "lucide-react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import {
  addMeteorImpact,
  updateMeteorImpact,
  setFastForward,
  resetMeteorImpact,
  getMeteorState,
} from "../three/meteorImpact";

export default function ThreeDOrbitViewer() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const labelRendererRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [stats, setStats] = useState({
    distance: "2.4 AU",
    velocity: "15.2 km/s",
    timeToApproach: "92 days"
  });

  useEffect(() => {
    if (!isPlaying) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    
    const scene = new THREE.Scene();
    let isImpacted = false;
    let earthPivot = null;
    let earthMesh = null;
    let sunMesh = null;
    let sunCorona = null;
    let pivots = [];

    // Get container dimensions
    const width = container.clientWidth;
    const height = container.clientHeight;

    // === Renderer ===
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.setClearColor(0x000010);
    scene.fog = new THREE.FogExp2(0x110022, 0.0003);

    // === Camera ===
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    camera.position.set(0, 30, 100);
    camera.lookAt(0, 0, 0);

    // === Controls ===
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 15;
    controls.maxDistance = 300;

    // === Label Renderer ===
    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(width, height);
    labelRenderer.domElement.style.position = "absolute";
    labelRenderer.domElement.style.top = "0px";
    labelRenderer.domElement.style.left = "0px";
    labelRenderer.domElement.style.pointerEvents = "none";
    container.appendChild(labelRenderer.domElement);
    labelRendererRef.current = labelRenderer;

    // === Starfield ===
    function createStarfield() {
      const starsGeometry = new THREE.BufferGeometry();
      const starsMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.7,
        sizeAttenuation: true,
      });
      const starsVertices = [];
      for (let i = 0; i < 10000; i++) {
        const x = (Math.random() - 0.5) * 2000;
        const y = (Math.random() - 0.5) * 2000;
        const z = (Math.random() - 0.5) * 2000;
        starsVertices.push(x, y, z);
      }
      starsGeometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(starsVertices, 3)
      );
      const starField = new THREE.Points(starsGeometry, starsMaterial);
      scene.add(starField);
    }
    createStarfield();

    // === Atmosphere Function ===
    function createAtmosphere(radius, color, intensity = 1.0) {
      const atmosphereGeometry = new THREE.SphereGeometry(radius * 1.015, 64, 64);
      const atmosphereMaterial = new THREE.ShaderMaterial({
        uniforms: {
          glowColor: { value: new THREE.Color(color) },
          intensity: { value: intensity },
        },
        vertexShader: `
          varying vec3 vNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vNormal;
          uniform vec3 glowColor;
          uniform float intensity;
          void main() {
            float glow = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.5);
            gl_FragColor = vec4(glowColor, 1.0) * glow * intensity;
          }
        `,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
      });
      return new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    }

    // === Sun ===
    const loader = new THREE.TextureLoader();
    const sunTexture = loader.load("/textures/sun.jpg");
    sunTexture.colorSpace = THREE.SRGBColorSpace;
    sunMesh = new THREE.Mesh(
      new THREE.SphereGeometry(5, 64, 64),
      new THREE.MeshBasicMaterial({ map: sunTexture })
    );
    scene.add(sunMesh);

    const coronaGeometry = new THREE.SphereGeometry(5.3, 64, 64);
    const coronaMaterial = new THREE.MeshBasicMaterial({
      color: 0xffcc66,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
    });
    sunCorona = new THREE.Mesh(coronaGeometry, coronaMaterial);
    sunMesh.add(sunCorona);

    const sunLabelDiv = document.createElement("div");
    sunLabelDiv.className = "label";
    sunLabelDiv.textContent = "Sun";
    sunLabelDiv.style.color = "#ffffff";
    sunLabelDiv.style.fontSize = "16px";
    sunLabelDiv.style.textShadow = "0 0 6px rgba(255, 200, 0, 0.8)";
    const sunLabel = new CSS2DObject(sunLabelDiv);
    sunLabel.position.set(0, 7, 0);
    sunMesh.add(sunLabel);

    const sunLight = new THREE.PointLight(0xffffff, 2, 300);
    sunLight.position.set(0, 0, 0);
    scene.add(sunLight);
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));

    // === Earth ===
    const planetsData = [
      {
        name: "Earth",
        size: 1.3,
        distance: 25,
        texture: "/textures/earth.jpg",
        axialTilt: 23.44,
        inclination: 0.0,
        orbitalPeriod: 1.0,
        rotationPeriod: 1.0,
        orbitDirection: 1,
        orbitColor: 0x4488ff,
      },
    ];

    let earthAngle = Math.random() * Math.PI * 2;

    planetsData.forEach((planet) => {
      const pivot = new THREE.Object3D();
      pivot.rotation.x = THREE.MathUtils.degToRad(planet.inclination);
      scene.add(pivot);
      earthPivot = pivot;

      const texture = loader.load(planet.texture);
      texture.colorSpace = THREE.SRGBColorSpace;

      const material = new THREE.MeshStandardMaterial({
        map: texture,
        emissive: 0x112244,
        emissiveIntensity: 0.4,
        color: 0xffffff,
        roughness: 0.7,
        metalness: 0.2,
      });

      const geometry = new THREE.SphereGeometry(planet.size, 64, 64);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.z = THREE.MathUtils.degToRad(planet.axialTilt);

      const earthAtmosphere = createAtmosphere(planet.size, 0x4488ff, 1.2);
      mesh.add(earthAtmosphere);
      earthMesh = mesh;

      mesh.position.set(planet.distance, 0, 0);
      pivot.add(mesh);

      // Orbit line
      const orbitGeometry = new THREE.BufferGeometry();
      const orbitPoints = [];
      const segments = 128;
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        orbitPoints.push(
          new THREE.Vector3(
            Math.cos(angle) * planet.distance,
            0,
            Math.sin(angle) * planet.distance
          )
        );
      }
      orbitGeometry.setFromPoints(orbitPoints);
      const orbitMaterial = new THREE.LineBasicMaterial({
        color: planet.orbitColor,
        transparent: true,
        opacity: 0.4,
      });
      const orbitLine = new THREE.Line(orbitGeometry, orbitMaterial);
      pivot.add(orbitLine);

      pivots.push({ pivot, data: planet, angle: earthAngle, mesh });
    });

    const earthLabelDiv = document.createElement("div");
    earthLabelDiv.className = "label";
    earthLabelDiv.textContent = "Earth";
    earthLabelDiv.style.color = "#ffffff";
    earthLabelDiv.style.fontSize = "16px";
    earthLabelDiv.style.textShadow = "0 0 6px rgba(100, 200, 255, 0.8)";
    const earthLabel = new CSS2DObject(earthLabelDiv);
    scene.add(earthLabel);

    // Initialize meteor
    addMeteorImpact(scene, earthMesh, sunMesh, earthPivot, earthAngle);

    // === Animation Loop ===
    const clock = new THREE.Clock();
    function animate() {
      requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const meteorState = getMeteorState();

      if (meteorState.hasImpacted && !isImpacted) {
        isImpacted = true;
        setShowReset(true);
      }

      sunMesh.rotation.y += delta * (2 * Math.PI / 25);
      const time = Date.now() * 0.001;
      sunCorona.material.opacity = 0.1 + Math.sin(time * 2.0) * 0.02;
      const scalePulse = 1.0 + Math.sin(time * 1.5) * 0.008;
      sunCorona.scale.set(scalePulse, scalePulse, scalePulse);

      if (!isImpacted) {
        const speedMultiplier = meteorState.isFastForward ? 30 : 1;
        pivots.forEach(({ data, mesh }, index) => {
          const orbitSpeed = (2 * Math.PI / data.orbitalPeriod) * data.orbitDirection;
          pivots[index].angle += (delta * orbitSpeed * speedMultiplier) / 365.25;
          const x = data.distance * Math.cos(pivots[index].angle);
          const z = data.distance * Math.sin(pivots[index].angle);
          mesh.position.set(x, 0, z);
          const rotationSpeed = (2 * Math.PI) / data.rotationPeriod;
          mesh.rotation.y += delta * rotationSpeed;
        });
      }

      if (earthMesh) {
        const earthWorldPos = new THREE.Vector3();
        earthMesh.getWorldPosition(earthWorldPos);
        const labelOffset = new THREE.Vector3(0, 3, 0);
        const labelPos = earthWorldPos.clone().add(labelOffset);
        earthLabel.position.copy(labelPos);
      }

      updateMeteorImpact(delta, earthMesh);
      controls.update();
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    }
    animate();

    // === Resize Handler ===
    const handleResize = () => {
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
      labelRenderer.setSize(newWidth, newHeight);
    };
    window.addEventListener("resize", handleResize);

    // === Cleanup ===
    return () => {
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      if (labelRendererRef.current?.domElement) {
        labelRendererRef.current.domElement.remove();
      }
    };
  }, [isPlaying]);

  const handlePlayAnimation = () => {
    setIsPlaying(true);
  };

  const handleFastForward = () => {
    setFastForward(true);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setShowReset(false);
    setTimeout(() => setIsPlaying(true), 100);
  };

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-slate-800 rounded-t-xl px-6 py-5 border-b border-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <h3 className="text-lg font-semibold text-white">
              Real-Time Asteroid Trajectory
            </h3>
          </div>
          <p className="text-slate-400 text-sm">
            3D visualization of asteroid orbit relative to Earth. Data updated every 6 hours from JPL.
          </p>
        </div>

        {/* Viewer Container */}
        <div className="bg-slate-800 rounded-b-xl px-6 py-5">
          {/* Canvas Container */}
          <div ref={containerRef} className="relative w-full h-[500px] bg-black rounded-lg overflow-hidden mb-5">
            {!isPlaying && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 z-10">
                <button
                  onClick={handlePlayAnimation}
                  className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mb-4 cursor-pointer hover:bg-blue-700 transition-all shadow-lg hover:shadow-blue-500/50"
                >
                  <Play className="w-10 h-10 text-white ml-1" fill="white" />
                </button>
                <p className="text-base font-medium">3D Orbit Viewer</p>
                <p className="text-sm text-slate-500 mt-1">Click to visualize</p>
              </div>
            )}
            <canvas ref={canvasRef} className="w-full h-full" />
          </div>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5">
            <div className="flex gap-3">
              <button
                onClick={handleFastForward}
                disabled={!isPlaying || showReset}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-700 text-white text-sm font-medium hover:bg-slate-600 transition-all border border-slate-600 hover:border-slate-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="w-4 h-4" />
                Fast Forward
              </button>
              {showReset && (
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-slate-700 text-white text-sm font-medium hover:bg-slate-600 transition-all border border-slate-600 hover:border-slate-500"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset View
                </button>
              )}
            </div>

            <div className="text-xs text-slate-500 italic">
              Last updated: 15 Dec 2024, 14:30 UTC
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div className="bg-slate-700/50 rounded-lg p-5 border border-slate-600 hover:border-slate-500 transition-all">
              <h4 className="text-slate-400 text-sm font-medium mb-2">
                Current Distance
              </h4>
              <p className="text-3xl font-bold text-blue-400 mb-1">{stats.distance}</p>
              <p className="text-sm text-slate-500">358 million km from Earth</p>
            </div>

            <div className="bg-slate-700/50 rounded-lg p-5 border border-slate-600 hover:border-slate-500 transition-all">
              <h4 className="text-slate-400 text-sm font-medium mb-2">Velocity</h4>
              <p className="text-3xl font-bold text-orange-400 mb-1">{stats.velocity}</p>
              <p className="text-sm text-slate-500">Relative to Earth</p>
            </div>

            <div className="bg-slate-700/50 rounded-lg p-5 border border-slate-600 hover:border-slate-500 transition-all">
              <h4 className="text-slate-400 text-sm font-medium mb-2">
                Time to Closest Approach
              </h4>
              <p className="text-3xl font-bold text-red-400 mb-1">{stats.timeToApproach}</p>
              <p className="text-sm text-slate-500">March 15, 2025</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .label {
          font-family: Arial, sans-serif;
          padding: 2px 8px;
          background: rgba(0, 0, 0, 0.5);
          border-radius: 3px;
          pointer-events: none;
        }
      `}</style>
    </section>
  );
}