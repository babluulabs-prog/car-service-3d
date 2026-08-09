import * as THREE from "three";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js";

const root = document.getElementById("webgl");
const loaderScreen = document.getElementById("loader");
const loaderBar = document.getElementById("loaderBar");
const touchHint = document.getElementById("touchHint");

const isMobile = window.matchMedia("(max-width:760px)").matches;

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  32, window.innerWidth / window.innerHeight, 0.05, 100
);
camera.position.set(0, 1.75, isMobile ? 6.4 : 7.2);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  powerPreference: "high-performance"
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.25 : 1.6));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = !isMobile;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
root.appendChild(renderer.domElement);

/* ---------- LIGHTING ---------- */
scene.add(new THREE.HemisphereLight(0xffffff, 0x050505, 1.15));

const key = new THREE.DirectionalLight(0xffffff, 3.8);
key.position.set(5, 6, 6);
key.castShadow = !isMobile;
scene.add(key);

const rim = new THREE.DirectionalLight(0xffffff, 3.0);
rim.position.set(-5, 4, -6);
scene.add(rim);

const fill = new THREE.PointLight(0xffffff, 2.0, 14);
fill.position.set(0, 3, 5);
scene.add(fill);

/* ---------- WHITE STUDIO FLOOR ---------- */
const floor = new THREE.Mesh(
  new THREE.CircleGeometry(18, 64),
  new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.30,
    metalness: 0.22
  })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -2.2;
floor.receiveShadow = true;
scene.add(floor);

/* ---------- CAR ---------- */
const carRoot = new THREE.Group();
scene.add(carRoot);

let car = null;
let headlightSpots = [];
let headlightGlow = [];
let headlightBulbs = [];

/*
  The supplied model is oriented with its nose along -X.
  Rotating -90° puts the FRONT of the car toward the opening camera (+Z).
*/
const CAR_BASE_ROTATION = -Math.PI / 2;
const MODEL_FRONT_Z = 1;

const gltfLoader = new GLTFLoader();

function finishLoading(message) {
  if (loaderBar) loaderBar.style.width = "100%";
  if (loaderScreen) {
    loaderScreen.classList.add("done");
    const label = loaderScreen.querySelector(".loader-label");
    if (label && message) label.textContent = message;
  }
}

gltfLoader.load(
  "./models/car.glb",
  (gltf) => {
    car = gltf.scene;

    /* Center and fit the model. */
    const originalBox = new THREE.Box3().setFromObject(car);
    const originalSize = originalBox.getSize(new THREE.Vector3());
    const originalCenter = originalBox.getCenter(new THREE.Vector3());
    const maxDim = Math.max(originalSize.x, originalSize.y, originalSize.z);

    car.position.sub(originalCenter);
    car.scale.setScalar(4.5 / maxDim);
    car.rotation.y = CAR_BASE_ROTATION;

    car.traverse((obj) => {
      if (!obj.isMesh) return;

      obj.castShadow = !isMobile;
      obj.receiveShadow = true;

      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];

      mats.forEach((mat) => {
        if (!mat) return;

        const name = `${obj.name} ${mat.name || ""}`.toLowerCase();

        const tyre =
          name.includes("tyre") || name.includes("tire") ||
          name.includes("rubber") || name.includes("wheel");

        const glass =
          name.includes("glass") || name.includes("window") ||
          name.includes("windshield");

        const chrome =
          name.includes("chrome") || name.includes("metal");

        /* Only recolor obvious body materials. */
        if (mat.color && !tyre && !glass && !chrome) {
          mat.color.setHex(0x171a1e);
          mat.metalness = 0.78;
          mat.roughness = 0.20;
        }

        if (tyre && mat.color) {
          mat.color.setHex(0x090909);
          mat.metalness = 0.02;
          mat.roughness = 0.72;
        }

        if (glass) {
          mat.roughness = 0.08;
          mat.metalness = 0.15;
        }

        if (chrome) {
          mat.metalness = 0.95;
          mat.roughness = 0.12;
        }

        if ("envMapIntensity" in mat) mat.envMapIntensity = 1.45;
      });
    });

    /* Put wheels/body above the white floor. */
    const fitted = new THREE.Box3().setFromObject(car);
    car.position.y -= fitted.min.y + 1.72;

    carRoot.add(car);

    createHeadlights();
    finishLoading();

    /* Small safety timeout: loader can never trap the user after success. */
    setTimeout(() => finishLoading(), 1500);
  },
  (xhr) => {
    if (loaderBar && xhr.total) {
      loaderBar.style.width =
        Math.min(96, (xhr.loaded / xhr.total) * 100) + "%";
    }
  },
  (error) => {
    console.error("CAR LOAD ERROR:", error);

    /* Never leave the whole website permanently stuck. */
    if (loaderScreen) {
      const label = loaderScreen.querySelector(".loader-label");
      if (label) label.textContent = "VEHICLE PREVIEW UNAVAILABLE";
      setTimeout(() => loaderScreen.classList.add("done"), 500);
    }
  }
);

/* ---------- CINEMATIC HEADLIGHTS ---------- */
function createHeadlights() {
  if (!car) return;

  const box = new THREE.Box3().setFromObject(car);
  const size = box.getSize(new THREE.Vector3());

  const width = size.x;
  const height = size.y;
  const depth = size.z;

  /*
    These lights are attached to the car's local front.
    Because the car itself is rotated -90° around Y, local +Z
    becomes the visible front toward the camera.
  */
  const frontZ = MODEL_FRONT_Z * depth * 0.48;
  const xOffset = width * 0.30;
  const y = -height * 0.17;

  [-1, 1].forEach((side) => {
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(width * 0.035, 20, 20),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0
      })
    );
    bulb.position.set(side * xOffset, y, frontZ);
    car.add(bulb);
    headlightBulbs.push(bulb);

    const spot = new THREE.SpotLight(
      0xffffff, 0, width * 8, Math.PI / 8, 0.45, 1.5
    );
    spot.position.set(side * xOffset, y, frontZ);

    const target = new THREE.Object3D();
    target.position.set(
      side * xOffset,
      y - height * 0.08,
      depth * 4
    );
    car.add(target);

    spot.target = target;
    car.add(spot);
    headlightSpots.push(spot);

    const glow = new THREE.PointLight(0xffffff, 0, width * 2.5);
    glow.position.set(side * xOffset, y, frontZ);
    car.add(glow);
    headlightGlow.push(glow);
  });
}

/* ---------- SCROLL ---------- */
let scrollProgress = 0;

function updateScroll() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  scrollProgress = max > 0 ? window.scrollY / max : 0;
}
window.addEventListener("scroll", updateScroll, { passive: true });
updateScroll();

/* ---------- GENTLE DRAG ---------- */
let dragging = false;
let lastX = 0;
let dragTarget = 0;
let dragSmooth = 0;

renderer.domElement.addEventListener("pointerdown", (e) => {
  dragging = true;
  lastX = e.clientX;
  renderer.domElement.setPointerCapture?.(e.pointerId);
});

renderer.domElement.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastX;
  lastX = e.clientX;
  dragTarget += dx * 0.0022;
});

renderer.domElement.addEventListener("pointerup", () => dragging = false);
renderer.domElement.addEventListener("pointercancel", () => dragging = false);

if (isMobile && touchHint) {
  setTimeout(() => touchHint.classList.add("show"), 2200);
  setTimeout(() => touchHint.classList.remove("show"), 6500);
}

/* ---------- TEXT REVEALS ---------- */
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) entry.target.classList.add("visible");
  });
}, { threshold: 0.18 });

document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

/* ---------- ANIMATION ---------- */
const clock = new THREE.Clock();
let smoothScroll = 0;
let cameraAngle = 0;
let cameraHeight = 1.80;
const cameraRadius = isMobile ? 6.3 : 7.2;

function animate() {
  requestAnimationFrame(animate);

  const time = clock.getElapsedTime();

  smoothScroll += (scrollProgress - smoothScroll) * 0.035;
  dragSmooth += (dragTarget - dragSmooth) * 0.045;

  /* Front-facing opening. Orbit only becomes visible after scrolling. */
  const orbit = THREE.MathUtils.smoothstep(smoothScroll, 0.05, 0.22);
  const targetAngle = orbit * Math.PI * 1.15;
  cameraAngle += (targetAngle - cameraAngle) * 0.035;

  const targetX = Math.sin(cameraAngle) * cameraRadius;
  const targetZ = Math.cos(cameraAngle) * cameraRadius;
  const targetY = 1.80 + Math.sin(smoothScroll * Math.PI) * 0.65;

  cameraHeight += (targetY - cameraHeight) * 0.04;
  camera.position.x += (targetX - camera.position.x) * 0.045;
  camera.position.z += (targetZ - camera.position.z) * 0.045;
  camera.position.y += (cameraHeight - camera.position.y) * 0.045;

  camera.lookAt(0, -0.15, 0);

  if (car) {
    const desiredRotation = CAR_BASE_ROTATION + dragSmooth;
    car.rotation.y += (desiredRotation - car.rotation.y) * 0.04;
    car.position.y += Math.sin(time * 0.7) * 0.00035;
  }

  /* Headlights fade on dramatically during the opening. */
  const reveal = THREE.MathUtils.smoothstep(
    THREE.MathUtils.clamp((time - 0.75) / 1.8, 0, 1), 0, 1
  );
  const pulse = 1 + Math.sin(time * 2.8) * 0.035;

  headlightSpots.forEach((light) => {
    light.intensity = reveal * 34 * pulse;
  });

  headlightGlow.forEach((light) => {
    light.intensity = reveal * 6 * pulse;
  });

  headlightBulbs.forEach((bulb) => {
    bulb.material.opacity = reveal;
    bulb.scale.setScalar(0.8 + reveal * 0.35);
  });

  renderer.render(scene, camera);
}

animate();

/* ---------- RESPONSIVE ---------- */
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, window.innerWidth < 768 ? 1.25 : 1.6)
  );
});
