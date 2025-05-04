import GUI from "lil-gui";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import firefliesVertexShader from "./shaders/fireflies/vertex.glsl";
import firefliesFragmentShader from "./shaders/fireflies/fragment.glsl";
import portalVertexShader from "./shaders/portal/vertex.glsl";
import portalFragmentShader from "./shaders/portal/fragment.glsl";
import * as CANNON from "cannon-es";

const pixelRatio = Math.min(window.devicePixelRatio, 2);

/**
 * Physics
 */
// cannon: World
const world = new CANNON.World();
world.broadphase = new CANNON.SAPBroadphase(world);
world.allowSleep = true;
world.gravity.set(0, -9.82, 0);

// cannon: Materials
const defaultMaterial = new CANNON.Material("default");

const defaultContactMaterial = new CANNON.ContactMaterial(
  defaultMaterial,
  defaultMaterial,
  {
    friction: 3,
    restitution: 0.7,
  },
);
world.addContactMaterial(defaultContactMaterial);
// With this line bellow I won't have to add material property to each Body
world.defaultContactMaterial = defaultContactMaterial;

/**
 * Keys
 */
const keys = {};

window.addEventListener("keydown", (event) => {
  keys[event.key] = true;
});

window.addEventListener("keyup", (event) => {
  keys[event.key] = false;
});

/**
 * Base
 */
// Debug
const debugObject = {
  clearColor: "#201919",
};
const gui = new GUI({
  width: 400,
});

// Canvas
const canvas = document.querySelector("canvas.webgl");

// Scene
const scene = new THREE.Scene();

/**
 * Loaders
 */
// Texture loader
const textureLoader = new THREE.TextureLoader();

// Draco loader
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("draco/");

// GLTF loader
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

/**
 * Textures
 */
const bakedTexture = textureLoader.load("baked.jpg");
bakedTexture.colorSpace = THREE.SRGBColorSpace;
bakedTexture.flipY = false;

/**
 * Materials
 */
// Baked material
const bakedMaterial = new THREE.MeshBasicMaterial({ map: bakedTexture });

// Portal light material
const portalLightMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
  },
  vertexShader: portalVertexShader,
  fragmentShader: portalFragmentShader,
});

// Pale light material
const poleLightMaterial = new THREE.MeshBasicMaterial({ color: 0xffffe5 });

/**
 * Model
 */
let ballMesh = null;
let ballBody = null;
gltfLoader.load("portal.glb", (gltf) => {
  const bakedMesh = gltf.scene.children.find((child) => child.name === "baked");
  bakedMesh.material = bakedMaterial;

  const portalLightMesh = gltf.scene.children.find(
    (child) => child.name === "portalLight",
  );
  const poleLightAMesh = gltf.scene.children.find(
    (child) => child.name === "poleLightA",
  );
  const poleLightBMesh = gltf.scene.children.find(
    (child) => child.name === "poleLightB",
  );

  portalLightMesh.material = portalLightMaterial;
  poleLightAMesh.material = poleLightMaterial;
  poleLightBMesh.material = poleLightMaterial;
  scene.add(gltf.scene);

  /**
   * Physics
   */
  // cannon: floorBody
  const floorShape = new CANNON.Box(new CANNON.Vec3(2, 0.1, 2));
  const floorBody = new CANNON.Body({
    mass: 0,
    position: new THREE.Vector3(0, -0.1, 0),
    shape: floorShape,
  });
  world.addBody(floorBody);

  // cannon: leftFence
  const leftFenceShape = new CANNON.Box(new CANNON.Vec3(0.1, 0.3, 2));
  const leftFenceBody = new CANNON.Body({
    mass: 0,
    position: new THREE.Vector3(-0.8, 0.15, 0),
    shape: leftFenceShape,
  });
  world.addBody(leftFenceBody);

  // cannon: rightFence
  const rightFenceShape = new CANNON.Box(new CANNON.Vec3(0.1, 0.3, 2));
  const rightFenceBody = new CANNON.Body({
    mass: 0,
    position: new THREE.Vector3(0.8, 0.15, 0),
    shape: rightFenceShape,
  });
  world.addBody(rightFenceBody);

  // cannon: firstStep
  const firstStepShape = new CANNON.Box(new CANNON.Vec3(0.5, 0.05, 0.1));
  const firstStepBody = new CANNON.Body({
    mass: 0,
    position: new THREE.Vector3(0, 0, -1.2),
    shape: firstStepShape,
  });
  world.addBody(firstStepBody);

  // cannon: secondStep
  const secondStepShape = new CANNON.Box(new CANNON.Vec3(0.5, 0.1, 0.1));
  const secondStepBody = new CANNON.Body({
    mass: 0,
    position: new THREE.Vector3(0, 0, -1.4),
    shape: secondStepShape,
  });
  world.addBody(secondStepBody);

  // cannon: thirdStep
  const thirdStepShape = new CANNON.Box(new CANNON.Vec3(0.5, 0.15, 0.1));
  const thirdStepBody = new CANNON.Body({
    mass: 0,
    position: new THREE.Vector3(0, 0, -1.6),
    shape: thirdStepShape,
  });
  world.addBody(thirdStepBody);

  // threejs: BallMesh
  const ballRadius = 0.2;

  ballMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, 20, 20),
    new THREE.MeshBasicMaterial({
      // metalness: 0.3,
      // roughness: 0.4,
      // color: "#af4f5c",
      color: "#5e5c64",
    }),
  );
  ballMesh.scale.set(ballRadius, ballRadius, ballRadius);
  ballMesh.castShadow = true;
  // ballMesh.position.copy(position);
  scene.add(ballMesh);

  // cannon: BallBody
  const ballShape = new CANNON.Sphere(ballRadius);
  ballBody = new CANNON.Body({
    mass: 1,
    shape: ballShape,
    position: new THREE.Vector3(0, 1, 0), // Start above the floor
  });
  world.addBody(ballBody);
});

/**
 * Fireflies
 */
// Geometry
const firefliesGeometry = new THREE.BufferGeometry();
const firefliesCount = 30;
const positionArray = new Float32Array(firefliesCount * 3);
const scaleArray = new Float32Array(firefliesCount);

for (let i = 0; i < positionArray.length; i++) {
  positionArray[i * 3 + 0] = (Math.random() - 0.5) * 4;
  positionArray[i * 3 + 1] = Math.random() * 1.5;
  positionArray[i * 3 + 2] = (Math.random() - 0.5) * 4;

  scaleArray[i] = Math.random();
}

firefliesGeometry.setAttribute(
  "position",
  new THREE.BufferAttribute(positionArray, 3),
);
firefliesGeometry.setAttribute(
  "aScale",
  new THREE.BufferAttribute(scaleArray, 1),
);

// Material
const firefliesMaterial = new THREE.ShaderMaterial({
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  uniforms: {
    uPixelRatio: { value: pixelRatio },
    uSize: { value: 100 },
    uTime: { value: 0 },
  },
  vertexShader: firefliesVertexShader,
  fragmentShader: firefliesFragmentShader,
});

gui
  .add(firefliesMaterial.uniforms.uSize, "value", 0, 500, 1)
  .name("firefliesSize");

// Points
const fireflies = new THREE.Points(firefliesGeometry, firefliesMaterial);
scene.add(fireflies);

/**
 * Sizes
 */
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
};

window.addEventListener("resize", () => {
  // Update sizes
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;

  // Update camera
  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  // Update renderer
  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(pixelRatio);
});

/**
 * Camera
 */
// Base camera
const camera = new THREE.PerspectiveCamera(
  45,
  sizes.width / sizes.height,
  0.1,
  100,
);
camera.position.x = 4;
camera.position.y = 2;
camera.position.z = 4;
scene.add(camera);

// Controls
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
});
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(pixelRatio);

renderer.setClearColor(debugObject.clearColor);
gui.addColor(debugObject, "clearColor").onChange(() => {
  renderer.setClearColor(debugObject.clearColor);
});

// Move the ball based on key input
function updateBallMovement(ballBody) {
  const forceMagnitude = 3; // Adjust force magnitude for smoother movement
  const force = new CANNON.Vec3(0, 0, 0);

  if (keys["ArrowUp"]) {
    force.z = -forceMagnitude;
  }
  if (keys["ArrowDown"]) {
    force.z = forceMagnitude;
  }
  if (keys["ArrowLeft"]) {
    force.x = -forceMagnitude;
  }
  if (keys["ArrowRight"]) {
    force.x = forceMagnitude;
  }

  // Apply force to the ball
  ballBody.applyForce(force, ballBody.position);
}

/**
 * Animate
 */
const clock = new THREE.Clock();
let oldElapsedTime = 0;

const tick = () => {
  const elapsedTime = clock.getElapsedTime();
  const deltaTime = elapsedTime - oldElapsedTime;
  oldElapsedTime = elapsedTime;

  // Update physics world
  world.step(1 / 60, deltaTime, 3);

  if (ballBody) {
    updateBallMovement(ballBody);
    // if (ballBody.position.z == -2) {
    //   ballBody.applyForce(new CANNON.Vec3(0, 0, 100), ballBody.position);
    // }
    if (Math.round(ballBody.position.z) === -2) {
      ballBody.applyForce(new CANNON.Vec3(0, 0, -1000), ballBody.position);
    }

    if (ballBody.position.y < -30) {
      ballBody.velocity.set(0, 0, 0);
      ballBody.force.set(0, 0, 0);
      ballBody.torque.set(0, 0, 0);
      ballBody.angularVelocity.set(0, 0, 0);

      ballBody.position.set(0, 0.1, 0);
    }

    ballMesh.position.copy(ballBody.position);
  }

  // Update materials
  firefliesMaterial.uniforms.uTime.value = elapsedTime;
  portalLightMaterial.uniforms.uTime.value = elapsedTime;

  // Move the ball based on key input

  // Update controls
  controls.update();

  // Render
  renderer.render(scene, camera);

  // Call tick again on the next frame
  window.requestAnimationFrame(tick);

  // Update fireflies
  window.addEventListener("resize", () => {
    firefliesMaterial.uniforms.uPixelRatio.value = pixelRatio;
  });
};

tick();
