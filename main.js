// Importing necessary libraries
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import CANNON from 'cannon';

// Create materials for the physics engine
const material = new CANNON.Material('material'); // Basic physics material
const threearray = []; // Array to store names of 3D objects

// Define contact materials for friction and restitution
const contactMaterial = new CANNON.ContactMaterial(material, material, {
  friction: 1, // High friction for realistic block interaction
  restitution: 0 // No bounciness
});

// Set up Three.js rendering environment
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement); // Append the canvas to the webpage

// Set up CANNON.js physics world
const world = new CANNON.World();
world.gravity.set(0, -9.82, 0); // Gravity pointing down
world.solver.iterations = 20; // Increase iterations for stable physics
world.solver.tolerance = 0.1; // Adjust tolerance for better precision

// Create a plane for the ground
const planeGeometry = new THREE.PlaneGeometry(2, 2);
const planeMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff, transparent: true, opacity: 1 });
const plane = new THREE.Mesh(planeGeometry, planeMaterial);
plane.rotation.x = -Math.PI / 2; // Rotate to make it horizontal
plane.position.y = 0.9; // Position it slightly above the origin

// Create a physics body for the plane
const planeShape = new CANNON.Plane();
const planeBody = new CANNON.Body({
  mass: 0, // Static body (mass = 0)
  position: new CANNON.Vec3(0, 0.9, 0),
  material: contactMaterial
});
planeBody.addShape(planeShape);
planeBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // Align with the Three.js plane
world.addBody(planeBody);

let blocks = []; // Array to store physics bodies for the blocks

// Function to add physics to the model and position it in the scene
function addPhysicsToModel(model, isStatic = false, id) {
  const mass = isStatic ? 0 : 1; // Static blocks have zero mass
  const layer = Math.floor(id / 3); // Determine which layer the block belongs to
  const rotate = layer % 2 === 0; // Alternate rotation per layer

  // Compute the bounding box of the model to determine its size
  const boundingBox = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  boundingBox.getSize(size);

  // Use the size to create a CANNON.Box shape
  const halfExtents = new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2);
  const shape = new CANNON.Box(halfExtents);

  // Create the corresponding physics body
  const body = new CANNON.Body({
    mass: mass,
    position: new CANNON.Vec3(
      rotate ? -0.06 + ((id % 3) * size.x) : 0, // Position blocks horizontally or vertically
      0.9 + size.y / 2 + (layer * size.y), // Stack blocks layer by layer
      rotate ? 0 : -0.06 + ((id % 3) * size.x)
    ),
    material: contactMaterial
  });

  // Apply rotation for alternate layers
  if (!rotate) {
    body.quaternion.setFromEuler(0, Math.PI / 2, 0, "XYZ");
  }

  // Apply damping for realistic block movement
  body.linearDamping = 0.05;
  body.angularDamping = 0.05;

  body.addShape(shape);
  world.addBody(body);

  // Store physics body and its ID in the model's user data
  model.userData.physicsBody = body;
  model.userData.id = id;
  body.userData = { id };
  blocks.push(body);
}

// Set up the camera
camera.position.set(5, 1, 6);

// Add lights to the scene
const ambientLight = new THREE.AmbientLight(0xffffff, 1);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
directionalLight.position.set(3, 3, 3);
directionalLight.castShadow = true;
scene.add(directionalLight);

const loader = new GLTFLoader(); // GLTF loader to import models
const models = []; // Array to store 3D models

// Load the ground plane model
loader.load('/assets/groundplane.glb', (gltf) => {
  const model = gltf.scene;
  scene.add(model);
  model.scale.set(1, 1, 1);
  model.position.set(-0.45, 0.035, -0.45);
}, undefined, (error) => {
  console.error('An error occurred loading the model:', error);
});

// Load the blocks and add physics to them
async function generateBlock(){
  for (let i = 0; i < 10 * 3; i++) {
    let promise = new Promise ((resolve, reject) => {
      loader.load('/assets/block.glb', (gltf) => {
        const model = gltf.scene;
        model.scale.set(0.03, 0.03, 0.03);
    
        // Assign unique names to each block for identification
        model.traverse((child) => {
          if (child.isMesh) {
            child.name = `block_${i}`;
            threearray.push(child.name);
          }
        });
    
        scene.add(model);
        models.push(model);
        addPhysicsToModel(model, false, i);
  
        resolve()
      }, undefined, (error) => {
        reject(new Error("failed"))
      });
    })
    await promise
  }
} 
generateBlock()


// Mouse interaction setup
let clickedObject = null;
let intersects = [];
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const initMouse = new THREE.Vector2();
let originalPosition = [];

// Handle mouse click events
function onMouseClick(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  console.log(intersects)
  originalPosition = [event.clientX, event.clientY];

  raycaster.setFromCamera(mouse, camera);
  intersects = raycaster.intersectObjects(models);
  if (clickedObject){
    clickedObject = null;
  }
  else if (intersects.length > 0 && intersects[0].object.name.includes("block")) {
    clickedObject = intersects[0].object;
    
    // Get block index from its name
    const nums = clickedObject.name.match(/\d+/g);
    if (nums && nums.length > 0) {
      const blockIndex = parseInt(nums[0], 10);
      const body = blocks[blockIndex];

      // Make the block static by turning off physics
      // body.mass = 0;
      body.updateMassProperties();
      body.velocity.set(0, 0, 0);
      body.angularVelocity.set(0, 0, 0);

      
      console.log(blockIndex);
    }
  } else {
    clickedObject = null;
  }
}

function onMouseMove(event) {
  if (clickedObject) {
    const nums = clickedObject.name.match(/\d+/g);
    const blockIndex = parseInt(nums[0], 10);
    const body = blocks[blockIndex];
    console.log(body)
    // Calculate the distance moved in screen space
    const distanceMoved = [
      originalPosition[0] - event.clientX,
      originalPosition[1] - event.clientY,
    ];
    originalPosition = [event.clientX, event.clientY]; // Update original position

    // Scale mouse movement to 3D world movement
    const moveFactor = 0.001; // Adjust sensitivity
    const movement3D = new THREE.Vector3(
      -distanceMoved[0] * moveFactor,
      0, // No vertical movement for now
      distanceMoved[1] * moveFactor
    );

    // Get the camera's orientation (forward vector)
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection); // Unit vector pointing forward from the camera
    cameraDirection.y = 0; // Ignore vertical component to keep movement in the horizontal plane
    cameraDirection.normalize();

    // Calculate right direction (camera's local x-axis)
    const cameraRight = new THREE.Vector3();
    cameraRight.crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0)); // Perpendicular to forward and up
    cameraRight.normalize();

    // Convert 2D movement to world space
    const worldMovement = new THREE.Vector3()
      .addScaledVector(cameraRight, movement3D.x) // Horizontal movement
      .addScaledVector(cameraDirection, movement3D.z); // Forward/backward movement

    // Apply the movement to the physics body's position
    body.position.x += worldMovement.x;
    body.position.z += worldMovement.z;

    // Sync the Three.js object's position with the Cannon.js body
    clickedObject.position.copy(body.position);
  }
}




// Add scroll functionality to orbit the camera
function onScroll() {
  const scrollAmount = window.scrollY;
  const angle = scrollAmount * 0.0009;
  const radius = 0.8;

  camera.position.x = radius * Math.cos(angle);
  camera.position.z = radius * Math.sin(angle);
  camera.lookAt(new THREE.Vector3(0, 1, 0));
}

// Add event listeners for interactivity
window.addEventListener('mousemove', onMouseMove);
window.addEventListener('click', onMouseClick);
window.addEventListener('scroll', onScroll);

// Resize handler
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation loop
function animate() {
  requestAnimationFrame(animate);

  // Step the physics world
  world.step(1 / 600);

  // Sync the position of Three.js models with CANNON.js bodies
  models.forEach((model) => {
    if (model) { // Skip null entries
      const body = model.userData.physicsBody;
      if (body) {
        model.position.copy(body.position);
        model.quaternion.copy(body.quaternion);
      }
    }
  });

  // Render the scene
  renderer.render(scene, camera);
}


animate(); // Start the animation loop
