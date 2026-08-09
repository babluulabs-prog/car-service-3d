import * as THREE from "https://esm.sh/three@0.180.0";
import { GLTFLoader } from "https://esm.sh/three@0.180.0/examples/jsm/loaders/GLTFLoader.js";

const root = document.getElementById("webgl");
const loaderScreen = document.getElementById("loader");
const loaderBar = document.getElementById("loaderBar");
const touchHint = document.getElementById("touchHint");

const scene = new THREE.Scene();

const isMobile = window.matchMedia("(max-width: 760px)").matches;

/* =========================
   CAMERA
========================= */

const camera = new THREE.PerspectiveCamera(
  34,
  window.innerWidth / window.innerHeight,
  0.05,
  100
);

camera.position.set(0, 2.2, 8);

/* =========================
   RENDERER
========================= */

const renderer = new THREE.WebGLRenderer({
  antialias: !isMobile,
  alpha: true,
  powerPreference: "high-performance"
});

renderer.setSize(window.innerWidth, window.innerHeight);

renderer.setPixelRatio(
  Math.min(
    window.devicePixelRatio,
    isMobile ? 1.25 : 1.7
  )
);

renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

renderer.shadowMap.enabled = !isMobile;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

root.appendChild(renderer.domElement);

/* =========================
   LIGHTING
========================= */

const ambient = new THREE.HemisphereLight(
  0xffffff,
  0x050505,
  1.4
);

scene.add(ambient);

const keyLight = new THREE.DirectionalLight(
  0xffffff,
  4
);

keyLight.position.set(4, 6, 5);
keyLight.castShadow = !isMobile;

scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(
  0xffffff,
  3
);

rimLight.position.set(-5, 3, -5);

scene.add(rimLight);

const fillLight = new THREE.PointLight(
  0xffffff,
  2,
  12
);

fillLight.position.set(0, 3, 2);

scene.add(fillLight);

/* =========================
   FLOOR
========================= */

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(18, 64),
  new THREE.MeshStandardMaterial({
    color: 0x080808,
    roughness: 0.32,
    metalness: 0.55
  })
);

floor.rotation.x = -Math.PI / 2;
floor.position.y = -2.2;

floor.receiveShadow = !isMobile;

scene.add(floor);

/* =========================
   CAR
========================= */

let car = null;

const carRoot = new THREE.Group();

scene.add(carRoot);

const loader = new GLTFLoader();

/* IMPORTANT:
   GitHub Pages repository path safe
*/

const MODEL_URL = "./models/car.glb";

console.log("Loading 3D car:", MODEL_URL);

loader.load(
  MODEL_URL,

  /* SUCCESS */

  (gltf) => {

    console.log("3D CAR LOADED SUCCESSFULLY!");

    car = gltf.scene;

    /* -------------------------
       FIT MODEL
    ------------------------- */

    const box = new THREE.Box3().setFromObject(car);

    const size = box.getSize(
      new THREE.Vector3()
    );

    const center = box.getCenter(
      new THREE.Vector3()
    );

    const maxDim = Math.max(
      size.x,
      size.y,
      size.z
    );

    car.position.sub(center);

    car.scale.setScalar(
      4.7 / maxDim
    );

    /* -------------------------
       FLOOR POSITION
    ------------------------- */

    const fittedBox =
      new THREE.Box3().setFromObject(car);

    car.position.y -=
      fittedBox.min.y + 1.72;

    /* -------------------------
       MATERIALS
    ------------------------- */

    car.traverse((object) => {

      if (!object.isMesh) return;

      object.castShadow = !isMobile;
      object.receiveShadow = !isMobile;

      if (object.material) {

        object.material.envMapIntensity = 1.35;

        object.material.needsUpdate = true;
      }

    });

    carRoot.add(car);

    /* -------------------------
       HEADLIGHTS
    ------------------------- */

    createHeadlights();

    /* -------------------------
       LOADING COMPLETE
    ------------------------- */

    if (loaderBar) {
      loaderBar.style.width = "100%";
    }

    setTimeout(() => {

      if (loaderScreen) {
        loaderScreen.classList.add("done");
      }

    }, 500);

  },

  /* PROGRESS */

  (xhr) => {

    if (
      xhr.lengthComputable ||
      xhr.total
    ) {

      const percent =
        xhr.total > 0
          ? (xhr.loaded / xhr.total) * 100
          : 20;

      if (loaderBar) {

        loaderBar.style.width =
          `${Math.min(96, percent)}%`;

      }

    }

  },

  /* ERROR */

  (error) => {

    console.error(
      "FAILED TO LOAD 3D CAR:",
      error
    );

    if (loaderScreen) {

      const label =
        loaderScreen.querySelector(
          ".loader-label"
        );

      if (label) {

        label.textContent =
          "3D VEHICLE FAILED — RETRYING";

      }

    }

    /*
      Don't leave the user permanently
      trapped on the loading screen.
    */

    setTimeout(() => {

      if (loaderScreen) {
        loaderScreen.classList.add("done");
      }

    }, 2500);

  }
);

/* =========================
   HEADLIGHTS
========================= */

const HEADLIGHT_Z = 1;

let headlightSpots = [];
let headlightGlow = [];

function createHeadlights() {

  const y = 0.15;
  const x = 0.72;

  for (const side of [-1, 1]) {

    const spot =
      new THREE.SpotLight(
        0xffffff,
        0,
        8,
        Math.PI / 8,
        0.55,
        1.6
      );

    spot.position.set(
      x * side,
      y,
      HEADLIGHT_Z * 2.15
    );

    spot.target.position.set(
      x * side,
      0,
      HEADLIGHT_Z * 7
    );

    scene.add(
      spot,
      spot.target
    );

    headlightSpots.push(spot);

    const glow =
      new THREE.PointLight(
        0xffffff,
        0,
        2.2
      );

    glow.position.copy(
      spot.position
    );

    scene.add(glow);

    headlightGlow.push(glow);
  }
}

/* =========================
   SCROLL
========================= */

let scrollP = 0;

function updateScroll() {

  const max =
    document.documentElement.scrollHeight -
    window.innerHeight;

  scrollP =
    max > 0
      ? window.scrollY / max
      : 0;
}

window.addEventListener(
  "scroll",
  updateScroll,
  { passive: true }
);

updateScroll();

/* =========================
   DRAG ROTATION
========================= */

let dragging = false;

let lastX = 0;

let targetDrag = 0;

let smoothDrag = 0;

renderer.domElement.addEventListener(
  "pointerdown",
  (event) => {

    dragging = true;

    lastX = event.clientX;

    renderer.domElement
      .setPointerCapture?.(
        event.pointerId
      );

  }
);

renderer.domElement.addEventListener(
  "pointermove",
  (event) => {

    if (!dragging) return;

    const dx =
      event.clientX - lastX;

    lastX = event.clientX;

    targetDrag +=
      dx * 0.008;

  }
);

renderer.domElement.addEventListener(
  "pointerup",
  () => {
    dragging = false;
  }
);

renderer.domElement.addEventListener(
  "pointercancel",
  () => {
    dragging = false;
  }
);

/* =========================
   TOUCH HINT
========================= */

if (isMobile && touchHint) {

  setTimeout(() => {

    touchHint.classList.add(
      "show"
    );

  }, 2200);

  setTimeout(() => {

    touchHint.classList.remove(
      "show"
    );

  }, 6500);
}

/* =========================
   SECTION REVEALS
========================= */

const observer =
  new IntersectionObserver(
    (entries) => {

      entries.forEach(
        (entry) => {

          if (
            entry.isIntersecting
          ) {

            entry.target.classList.add(
              "visible"
            );

          }

        }
      );

    },
    {
      threshold: 0.18
    }
  );

document
  .querySelectorAll(".reveal")
  .forEach(
    (element) => {

      observer.observe(
        element
      );

    }
  );

/* =========================
   ANIMATION
========================= */

const clock =
  new THREE.Clock();

let smoothP = 0;

let smoothAngle = 0;

let cameraRadius =
  isMobile ? 7 : 8.2;

let cameraHeight = 2.2;

function animate() {

  requestAnimationFrame(
    animate
  );

  const time =
    clock.getElapsedTime();

  /* -------------------------
     SMOOTH SCROLL
  ------------------------- */

  smoothP +=
    (scrollP - smoothP) *
    0.055;

  smoothDrag +=
    (targetDrag - smoothDrag) *
    0.08;

  /* -------------------------
     CAMERA ORBIT
  ------------------------- */

  const desiredAngle =
    -Math.PI * 0.25 +
    smoothP *
    Math.PI *
    2;

  smoothAngle +=
    (desiredAngle -
      smoothAngle) *
    0.055;

  const x =
    Math.sin(
      smoothAngle
    ) *
    cameraRadius;

  const z =
    Math.cos(
      smoothAngle
    ) *
    cameraRadius;

  const targetY =
    1.9 +
    Math.sin(
      smoothP * Math.PI
    ) *
    0.95;

  cameraHeight +=
    (targetY -
      cameraHeight) *
    0.05;

  camera.position.x +=
    (x -
      camera.position.x) *
    0.055;

  camera.position.z +=
    (z -
      camera.position.z) *
    0.055;

  camera.position.y +=
    (cameraHeight -
      camera.position.y) *
    0.055;

  camera.lookAt(
    0,
    -0.35,
    0
  );

  /* -------------------------
     CAR ROTATION
  ------------------------- */

  if (car) {

    const targetRotation =
      smoothDrag +
      Math.sin(
        smoothP *
        Math.PI *
        2
      ) *
      0.07;

    car.rotation.y +=
      (targetRotation -
        car.rotation.y) *
      0.07;

  }

  /* -------------------------
     HEADLIGHT ANIMATION
  ------------------------- */

  const introLight =
    THREE.MathUtils.smoothstep(
      smoothP,
      0.015,
      0.18
    );

  const pulse =
    1 +
    Math.sin(
      time * 1.7
    ) *
    0.025;

  headlightSpots.forEach(
    (light) => {

      light.intensity =
        introLight *
        18 *
        pulse;

    }
  );

  headlightGlow.forEach(
    (light) => {

      light.intensity =
        introLight *
        2.2 *
        pulse;

    }
  );

  renderer.render(
    scene,
    camera
  );
}

animate();

/* =========================
   RESIZE
========================= */

window.addEventListener(
  "resize",
  () => {

    camera.aspect =
      window.innerWidth /
      window.innerHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(
      window.innerWidth,
      window.innerHeight
    );

    renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio,
        window.innerWidth < 768
          ? 1.25
          : 1.7
      )
    );

  }
);
