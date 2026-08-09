import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js";

const root = document.getElementById("webgl");
const loaderScreen = document.getElementById("loader");
const loaderBar = document.getElementById("loaderBar");
const touchHint = document.getElementById("touchHint");

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  34,
  innerWidth / innerHeight,
  0.05,
  100
);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  powerPreference: "high-performance"
});

renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 768 ? 1.25 : 1.7));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
root.appendChild(renderer.domElement);

const isMobile = matchMedia("(max-width: 760px)").matches;

/* ---------- WORLD ---------- */
scene.add(new THREE.HemisphereLight(0xffffff, 0x050505, 1.25));

const key = new THREE.DirectionalLight(0xffffff, 4.2);
key.position.set(4, 6, 5);
key.castShadow = !isMobile;
scene.add(key);

const rim = new THREE.DirectionalLight(0xffffff, 3.0);
rim.position.set(-5, 3, -5);
scene.add(rim);

const fill = new THREE.PointLight(0xffffff, 2.2, 12);
fill.position.set(0, 3, 2);
scene.add(fill);

/* subtle studio floor */
const floor = new THREE.Mesh(
  new THREE.CircleGeometry(18, 64),
  new THREE.MeshStandardMaterial({color:0x080808, roughness:.32, metalness:.55})
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -2.2;
floor.receiveShadow = true;
scene.add(floor);

/* ---------- CAR ---------- */
let car = null;
const carRoot = new THREE.Group();
scene.add(carRoot);

const loader = new GLTFLoader();

loader.load(
  "./models/car.glb",
  (gltf) => {
    car = gltf.scene;

    /* Automatically fit the uploaded model, regardless of its original units. */
    const box = new THREE.Box3().setFromObject(car);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    car.position.sub(center);
    car.scale.setScalar(4.7 / maxDim);

    /* Put the lowest point near the studio floor. */
    const fitted = new THREE.Box3().setFromObject(car);
    car.position.y -= fitted.min.y + 1.72;

    car.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = !isMobile;
        obj.receiveShadow = true;
        if (obj.material) {
          obj.material.envMapIntensity = 1.35;
        }
      }
    });

    carRoot.add(car);
    loaderBar.style.width = "100%";

    createHeadlights();
    startIntro();
  },
  (xhr) => {
    if (xhr.total) {
      loaderBar.style.width = `${Math.min(96, (xhr.loaded / xhr.total) * 100)}%`;
    }
  },
  (error) => {
    console.error("Could not load car.glb", error);
    loaderScreen.querySelector(".loader-label").textContent = "CAR FILE COULD NOT LOAD";
  }
);

/* ---------- CINEMATIC HEADLIGHTS ----------
   The uploaded GLB does not contain separate headlight meshes.
   So we create the light beams ourselves.
   If the car faces the opposite direction, change HEADLIGHT_Z to -1.
*/
const HEADLIGHT_Z = 1;
let headlightSpots = [];
let headlightGlow = [];

function createHeadlights() {
  const y = 0.15;
  const x = 0.72;

  for (const side of [-1, 1]) {
    const spot = new THREE.SpotLight(0xffffff, 0, 8, Math.PI / 8, 0.55, 1.6);
    spot.position.set(x * side, y, HEADLIGHT_Z * 2.15);
    spot.target.position.set(x * side, 0, HEADLIGHT_Z * 7);
    spot.castShadow = false;
    scene.add(spot, spot.target);
    headlightSpots.push(spot);

    const glow = new THREE.PointLight(0xffffff, 0, 2.2);
    glow.position.copy(spot.position);
    scene.add(glow);
    headlightGlow.push(glow);
  }
}

/* ---------- SCROLL TIMELINE ---------- */
let scrollP = 0;
let cameraAngle = 0;
let cameraRadius = isMobile ? 7.0 : 8.2;
let cameraHeight = 2.2;
let dragAngle = 0;
let targetDrag = 0;

function updateScroll() {
  const max = document.documentElement.scrollHeight - innerHeight;
  scrollP = max > 0 ? scrollY / max : 0;
}
addEventListener("scroll", updateScroll, {passive:true});
updateScroll();

/* ---------- TOUCH / MOUSE ROTATION ----------
   Dragging rotates the car without hijacking vertical scrolling.
*/
let dragging = false;
let lastX = 0;

renderer.domElement.addEventListener("pointerdown", (e) => {
  dragging = true;
  lastX = e.clientX;
  renderer.domElement.setPointerCapture?.(e.pointerId);
});

renderer.domElement.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastX;
  lastX = e.clientX;
  targetDrag += dx * 0.008;
});

renderer.domElement.addEventListener("pointerup", () => dragging = false);
renderer.domElement.addEventListener("pointercancel", () => dragging = false);
renderer.domElement.addEventListener("pointerleave", () => dragging = false);

if (isMobile) {
  setTimeout(() => touchHint.classList.add("show"), 2200);
  setTimeout(() => touchHint.classList.remove("show"), 6500);
}

/* ---------- INTRO ---------- */
const introStart = performance.now();
function startIntro() {
  setTimeout(() => loaderScreen.classList.add("done"), 450);
}

/* ---------- SECTION REVEALS ---------- */
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) entry.target.classList.add("visible");
  });
}, {threshold:.18});

document.querySelectorAll(".reveal").forEach(el => observer.observe(el));

/* ---------- ANIMATION ---------- */
const clock = new THREE.Clock();
let smoothP = 0;
let smoothAngle = 0;
let smoothDrag = 0;

function animate() {
  requestAnimationFrame(animate);

  const t = clock.getElapsedTime();

  /* Smooth all scroll-driven motion. */
  smoothP += (scrollP - smoothP) * 0.055;
  smoothDrag += (targetDrag - smoothDrag) * 0.08;

  /*
    Scroll completes one circular camera journey.
    The extra 0.25π gives a slightly more cinematic starting angle.
  */
  const desiredAngle = -Math.PI * 0.25 + smoothP * Math.PI * 2;
  smoothAngle += (desiredAngle - smoothAngle) * 0.055;

  /* Camera orbit */
  const x = Math.sin(smoothAngle) * cameraRadius;
  const z = Math.cos(smoothAngle) * cameraRadius;

  /* Hero starts lower and closer; middle rises; ending returns forward. */
  const targetY = 1.9 + Math.sin(smoothP * Math.PI) * 0.95;
  cameraHeight += (targetY - cameraHeight) * 0.05;

  camera.position.x += (x - camera.position.x) * 0.055;
  camera.position.z += (z - camera.position.z) * 0.055;
  camera.position.y += (cameraHeight - camera.position.y) * 0.055;

  camera.lookAt(0, -0.35, 0);

  /* Car gently responds to scroll + manual drag. */
  if (car) {
    const targetRotation = smoothDrag + Math.sin(smoothP * Math.PI * 2) * 0.07;
    car.rotation.y += (targetRotation - car.rotation.y) * 0.07;
    car.position.y += Math.sin(t * 0.75) * 0.0007;
  }

  /* Headlights fade in during the first ~18% of the experience. */
  const introLight = THREE.MathUtils.smoothstep(smoothP, 0.015, 0.18);
  const pulse = 1 + Math.sin(t * 1.7) * 0.025;

  headlightSpots.forEach(light => light.intensity = introLight * 18 * pulse);
  headlightGlow.forEach(light => light.intensity = introLight * 2.2 * pulse);

  renderer.render(scene, camera);
}
animate();

/* ---------- RESPONSIVE ---------- */
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 768 ? 1.25 : 1.7));
});
