// Importing necessary libraries
import * as Modules from './modules.js';
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
  userData: {
    id: 'plane'
  },
  mass: 0, // Static body (mass = 0)
  position: new CANNON.Vec3(0, 0.9, 0),
  material: contactMaterial
});
planeBody.addShape(planeShape);
planeBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0); // Align with the Three.js plane
world.addBody(planeBody);

let blocks = []; // Array to store physics bodies for the blocks

// Function to add physics to the model and position it in the scene

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

export function addPhysicsToModel(model, isStatic = false, id) {
  const mass = isStatic ? 0 : 1; 
  const layer = Math.floor(id / 3); 
  const rotate = layer % 2 === 0; 

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
    // position the body
    position: new CANNON.Vec3(
      rotate ? -0.06 + ((id % 3) * size.x) : 0, 
      0.9 + size.y / 2 + (layer * size.y), 
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

  // adding the shape to the body
  body.addShape(shape);
  world.addBody(body);

  // Store physics body and its ID in the model's user data
  model.userData.physicsBody = body;
  model.userData.id = id;
  body.userData = { id };
  blocks.push(body);
}
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
// Function to check if block is completely outside tower bounds
function isBlockOutsideTower(position) {
  // Calculate tower dimensions based on block generation loop
  // 3 blocks wide/deep, each block is 0.03 scale
  const towerWidth = 0.1;  // 3 blocks * 0.03 scale
  const towerDepth = 0.1;  // 3 blocks * 0.03 scale
  
  // Block dimensions at 0.03 scale
  const blockSize = 0.03;

  // Calculate tower boundaries (centered at origin)
  const towerMinX = -towerWidth;
  const towerMaxX = towerWidth;
  const towerMinZ = -towerDepth;
  const towerMaxZ = towerDepth;

  // Calculate block corner positions from its center position (ignoring height)
  const blockCorners = [
    {x: position.x + blockSize/2, z: position.z + blockSize/2}, // front right
    {x: position.x + blockSize/2, z: position.z - blockSize/2}, // back right
    {x: position.x - blockSize/2, z: position.z + blockSize/2}, // front left
    {x: position.x - blockSize/2, z: position.z - blockSize/2}  // back left
  ];

  // Check if ALL corners are outside ANY SINGLE boundary on X or Z axis
  const allCornersOutsideRight = blockCorners.every(corner => corner.x > towerMaxX);
  const allCornersOutsideLeft = blockCorners.every(corner => corner.x < towerMinX);
  const allCornersOutsideFront = blockCorners.every(corner => corner.z > towerMaxZ);
  const allCornersOutsideBack = blockCorners.every(corner => corner.z < towerMinZ);

  // Block is only considered outside if ALL corners are beyond ANY single boundary
  const isCompletelyOutside = allCornersOutsideRight || allCornersOutsideLeft || 
                             allCornersOutsideFront || allCornersOutsideBack;

  if (isCompletelyOutside) {
    return true;
  }
  return false;
}



// Mouse interaction setup
let clickedObject = null;
let intersects = [];
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let originalPosition = [];
let currentBlock = null;
let selectedBlocks = [];

function areBlocksAtRest() {
  const velocityThreshold = 0.1; // Try lowering this threshold
  for (const body of blocks) {
    // Log velocities to debug
     
  //  console.log(body)

   
   if(selectedBlocks.includes("block_"+body.id))
    if (body.velocity.length() > velocityThreshold || body.angularVelocity.length() > velocityThreshold) {
      return false; // At least one block is still moving
    }
  }
  return true; // All blocks are at rest
}

let currentPlayer = 1; // Track current player (1 or 2)
let canSwitchPlayer = false;

// Handle mouse click events
function onMouseClick(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  originalPosition = [event.clientX, event.clientY];

  raycaster.setFromCamera(mouse, camera);
  intersects = raycaster.intersectObjects(models);

  // Case 1: Unselecting currently clicked object
  if (clickedObject) {
    // Only switch players if the block was moved outside the tower
    if (isBlockOutsideTower(clickedObject.position) && canSwitchPlayer) {
      // Make the currently selected block invisible
      if (clickedObject) {
        const nums = clickedObject.name.match(/\d+/g);
        if (nums && nums.length > 0) {
          const blockIndex = parseInt(nums[0], 10);
          const body = blocks[blockIndex];

          // Make the block invisible in Three.js
          clickedObject.visible = false;

          // Disable the physics body in Cannon.js
          body.mass = 0; // Set mass to 0 to make it static
          body.updateMassProperties(); // Update the body's properties
          body.velocity.set(0, 0, 0); // Reset velocity
          body.angularVelocity.set(0, 0, 0); // Reset angular velocity
          body.position.set(-100, -100, -100); // Move it far away to avoid collisions
        }
      }

      // Switch players after making the block invisible
      switchPlayer(); // This will now wait for blocks to stabilize
      canSwitchPlayer = false; // Reset flag
    }
    clickedObject = null;
    return;
  }

  // Case 2: Trying to select a new object
  if (intersects.length > 0 && intersects[0].object.name.includes("block")) {
    const newBlock = intersects[0].object;

    if (currentBlock === null) {
      currentBlock = newBlock;
      clickedObject = newBlock;
      canSwitchPlayer = true; // Enable player switching for this move
    } else if (currentBlock === newBlock || isBlockOutsideTower(currentBlock.position)) {
      if (isBlockOutsideTower(currentBlock.position)) {
       
        currentBlock = newBlock;
        canSwitchPlayer = true; // Enable player switching for new block
      }
      clickedObject = newBlock;
    }

    // Add the selected block to the list
   

    if (clickedObject) {
      if (!selectedBlocks.includes(newBlock)) {
        selectedBlocks.push(newBlock);
      }
      const nums = clickedObject.name.match(/\d+/g);
      if (nums && nums.length > 0) {
        const blockIndex = parseInt(nums[0], 10);
        const body = blocks[blockIndex];

        body.updateMassProperties();
        body.velocity.set(0, 0, 0);
        body.angularVelocity.set(0, 0, 0);
      }
    }
  }
}

// Add new function to switch players
function switchPlayer() {
  const checkInterval = 1; // Check every 100ms
  
  const intervalId = setInterval(() => {
    if (areBlocksAtRest()) { // Check if all blocks are at rest
        clearInterval(intervalId); // Stop checking once blocks are at rest
      currentPlayer = currentPlayer === 1 ? 2 : 1; // Switch player
      updatePlayerDisplay(); // Update the UI to reflect the current player
    }
          

        // Iterate through all blocks
  for (let body of blocks) {
    const isBlockOutside = isBlockOutsideTower(body.position);

    // Check if the block is outside the bounds and not part of the selected blocks
    const blockName = `block_${body.id - 1}`;
    const isBlockSelected = selectedBlocks.some(block => block.name && block.name.includes(blockName));

    // If the block is outside and not selected, trigger the game over function
    if (isBlockOutside && !isBlockSelected) {
      endGame(); // Trigger the game over function
      return; // Exit the function once game over is triggered
    }
  }
  }, checkInterval); // Check every 100ms
}


// Add function to update player display (you'll need to add corresponding HTML elements)
function updatePlayerDisplay() {
  if (areBlocksAtRest()) {
    document.getElementById("player-turn").textContent = `Player ${currentPlayer}'s Turn`;
  } else {
    document.getElementById("player-turn").textContent = "Waiting for blocks to stabilize...";
  }
}


function onMouseMove(event) {
  if (clickedObject) {
   
    const nums = clickedObject.name.match(/\d+/g);
    const blockIndex = parseInt(nums[0], 10);
    const body = blocks[blockIndex];
    
    
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
    if (clickedObject && clickedObject.position) {
      // Convert CANNON.Vec3 to THREE.Vector3 before copying
      const cannonPosition = body.position;
      const threePosition = new THREE.Vector3(cannonPosition.x, cannonPosition.y, cannonPosition.z);
      clickedObject.position.copy(threePosition);
    }

    
  }
}


function onScroll() {
  const maxScroll = document.body.scrollHeight - window.innerHeight;
  
  const scrollAmount = window.scrollY;

  // Calculate base radius using aspect ratio instead of screen dimensions
  const aspectRatio = window.innerWidth / window.innerHeight;
  const baseRadius = 0.9; // Reduced from 8 to 4 to zoom in closer
  const radius = baseRadius * (aspectRatio / (16/9));

  // Map scroll amount to angle, clamping to a maximum of 90 degrees
  const maxAngle = Math.PI / 2;
  const angle = (scrollAmount / maxScroll) * maxAngle;

  // Update camera position
  camera.position.x = radius * Math.cos(angle);
  camera.position.z = radius * Math.sin(angle);
  camera.lookAt(new THREE.Vector3(0, 1, 0));
}

let autoScrollInterval;
let scrollingDown = true;
let isAutoScrolling = false; // Flag to track if auto-scrolling is active

function autoScroll() {
  const maxScroll = document.body.scrollHeight - window.innerHeight; // Use the correct max scroll value
  const scrollStep = 5; // Adjust the scroll speed
  isAutoScrolling = true; // Set flag when auto-scrolling starts

  autoScrollInterval = setInterval(() => {
    if (scrollingDown) {
      window.scrollBy(0, scrollStep);
      if (window.scrollY >= maxScroll) {
        scrollingDown = false;
      }
    } else {
      window.scrollBy(0, -scrollStep);
      if (window.scrollY <= 0) {
        scrollingDown = true;
      }
    }
  }, 20); // Adjust the interval for smoother scrolling
}

window.addEventListener('load', autoScroll);

window.addEventListener('click', ()=>{
  if(isAutoScrolling){
    isAutoScrolling = false
    clearInterval(autoScrollInterval)
  }
});

// Update initial camera position to match the new radius calculation
const initialAspectRatio = window.innerWidth / window.innerHeight;
const initialRadius = 0. * (initialAspectRatio / (16/9)); // Also reduced from 8 to 4
camera.position.set(initialRadius, 1, 6);

// Set the height of the body to match maxScroll
document.body.style.height = `${3000 + window.innerHeight}px`; // Add window height to ensure full scroll

// Add event listener for scroll
window.addEventListener('scroll', onScroll);

document.getElementById('start-button').addEventListener('click', () => {
  setTimeout(() => {
    document.getElementById('ui').style.display = 'block'
    document.getElementById('overlay').style.display = 'none';
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('click', onMouseClick);
    window.addEventListener('scroll', onScroll);
      
  }, 1); // Delay is in milliseconds
 
});

// Assuming currentPlayer is a variable that stores the current player's number (1 or 2)
function handlePlayerLoss(currentPlayer) {
  // Log the player who lost
  console.log("Player " + currentPlayer + " loses");

  // Display the "You Lose" message
  document.getElementById('game-over').style.display = 'block'; // Show the game-over screen
  document.getElementById('game-over-h1').innerText ="player "+currentPlayer+" lost"
  // Optionally, hide other UI elements like the start button, player turn, etc.
  document.getElementById('overlay').style.display = 'none'; // Hide the overlay
  document.getElementById('ui').style.display = 'none'; // Hide the player turn UI
}

// Restart the game when the "Restart Game" button is clicked
document.getElementById('restart-button').addEventListener('click', function() {
  // Reload the page to restart the game
  window.location.reload();
});

// Resize handler
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
function handletie() {
  // Log the player who lost
  console.log("tie");

  // Display the "You Lose" message
  document.getElementById('game-over').style.display = 'block'; // Show the game-over screen
  document.getElementById('game-over-h1').innerText ="Tie!"
  // Optionally, hide other UI elements like the start button, player turn, etc.
  document.getElementById('overlay').style.display = 'none'; // Hide the overlay
  document.getElementById('ui').style.display = 'none'; // Hide the player turn UI
}

let running = true
function endGame() {
  if (!running) return;
  running = false;
  // Optional: Disable user interactions
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('click', onMouseClick);
  handlePlayerLoss(currentPlayer);
}


function checkGameOver() {
  if((blocks.length == selectedBlocks.length)&&(blocks.length !==0 )){
    handletie();
  }
  if (!running) return;
  if (!clickedObject) return; // Exit if clickedObject is null or undefined

  const clickedBlockIndex = parseInt(clickedObject.name.match(/\d+/)?.[0], 10);

  for (let body of blocks) {
    const isClickedBlock = clickedBlockIndex === body.id - 1;
    const isBlockOutside = isBlockOutsideTower(body.position);

    // Skip the clicked block since it's still being interacted with
    if (isClickedBlock) continue;

    // Check if the block is outside the bounds and not part of the selected blocks
    if (isBlockOutside) {
      const blockName = `block_${body.id - 1}`;
      const isBlockSelected = selectedBlocks.some(block => block.name && block.name.includes(blockName));

      if (!isBlockSelected) {
        console.log("A block has fallen out of bounds.");
        endGame(); // Trigger the game over function
        return; // Exit the function once game over is triggered
      }
    }
  }
}

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

  checkGameOver(); // Check for game-over conditions

  // Render the scene
  renderer.render(scene, camera);
}


animate(); // Start the animation loop

