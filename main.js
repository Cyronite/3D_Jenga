import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import CANNON from 'cannon';

// Create materials for physics
const material = new CANNON.Material('material');
const threearray =[]
// Create contact materials with friction and restitution
const contactMaterial = new CANNON.ContactMaterial(material, material, {
  friction: 1, 
  restitution: 0
});


// Set up Three.js scene
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Set up CANNON.js world
const world = new CANNON.World();
world.gravity.set(0, -9.82, 0);
world.solver.iterations = 20; // Increase this from the default (10) if needed
world.solver.tolerance = 0.0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001; // Lowering this can help with precision


// Define ground plane
const planeGeometry = new THREE.PlaneGeometry(2, 2); 
const planeMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff, transparent: true, opacity: 1 });
const plane = new THREE.Mesh(planeGeometry, planeMaterial);
plane.rotation.x = -Math.PI / 2;
plane.position.y = 0.9;
// scene.add(plane);

// Create CANNON.js plane body
const planeShape = new CANNON.Plane();
const planeBody = new CANNON.Body({
  mass: 0,
  position: new CANNON.Vec3(0, 0.9, 0),
  material: contactMaterial
});
planeBody.addShape(planeShape);
planeBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(planeBody);

let blocks = []
// Function to add physics to models
function addPhysicsToModel(model, isStatic = false, id) {
  const mass = isStatic ? 0 : 1;
  const layer = Math.floor(id/3)
  const rotate = layer%2 == 0

  // Calculate the bounding box of the model
  const boundingBox = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  boundingBox.getSize(size);

  // Calculate half-extents for CANNON.Box
  const halfExtents = new CANNON.Vec3(
    size.x / 2,
    size.y / 2,
    size.z / 2
  );

  // Create the physics box with exact dimensions
  const shape = new CANNON.Box(halfExtents);
  const body = new CANNON.Body({
    mass: mass,
    position: new CANNON.Vec3(
      rotate ? -0.06 + ((id % 3) * size.x ) : 0,
      0.9 + size.y/2 + (layer * size.y),
      rotate ? 0 : -0.06 + ((id % 3) * size.x ) 
    ),
    material: contactMaterial
  });

  // Apply damping to the body
  body.linearDamping = 0.05; // Realistic linear damping
  body.angularDamping = 0.05; // Realistic angular damping

  if (!rotate) {
    body.quaternion.setFromEuler(0, Math.PI / 2, 0, "XYZ");
  }

  body.addShape(shape);
  world.addBody(body);

  model.userData.physicsBody = body;
  model.userData.id = id; // Store the ID in the model's userData
  body.userData = { id }; // Store the ID in the body's userData
  blocks.push(body);
  // console.log(blocks);

  // const debugGeometry = new THREE.BoxGeometry(size.x, size.y, size.z);
  // const debugMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: true });
  // const debugMesh = new THREE.Mesh(debugGeometry, debugMaterial);
  // debugMesh.position.copy(model.position);
  // debugMesh.rotation.copy(model.rotation);
  // scene.add(debugMesh);

  // model.userData.debugMesh = debugMesh;
}



// Set up camera
camera.position.set(5, 1, 6);
const ambientLight = new THREE.AmbientLight(0xffffff, 1);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
directionalLight.position.set(3, 3, 3);
directionalLight.castShadow = true;
scene.add(directionalLight);

// Load models
const loader = new GLTFLoader();
  const layerGroups = [];
  const models = [];

loader.load('/assets/groundplane.glb', (gltf) => {
  const model = gltf.scene;
  scene.add(model);
  model.scale.set(1, 1, 1);
  model.position.set(-0.45, 0, -0.45);
}, undefined, (error) => {
  console.error('An error occurred loading the model:', error);
});

for (let i = 0; i < 10 * 3; i++) {
  
  loader.load('/assets/block.glb', (gltf) => {
    const model = gltf.scene;
    model.scale.set(0.03, 0.03, 0.03);

    model.traverse((child) => {
      if (child.isMesh) {
          child.name = `block_${i}`; 
          threearray.push(child.name)  ///name
          // console.log("Model name set:", child.name);
      }
      });

    scene.add(model)
    
    models.push(model);
    addPhysicsToModel(model, false, i);
  }, undefined, (error) => {
    console.error('An error occurred loading the model:', error);
  });
}











let clickedObject = "random";
let intersects = [];
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const initMouse = new THREE.Vector2();

function onMouseClick(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  intersects = raycaster.intersectObjects(models);

  if (intersects.length > 0 && intersects[0].object.name.includes("block")) {
    clickedObject = intersects[0].object;
    // console.log(clickedObject.name);

    // Extract the block number from the name
    let nums = clickedObject.name.match(/\d+/g);
    if (nums && nums.length > 0) {
      let blockIndex = parseInt(nums[0], 10);
      let body = blocks[blockIndex];
      
      // Turn off physics for the clicked block
      body.mass = 0; // Set mass to 0 to make the block static
      body.updateMassProperties(); // Update the mass properties to apply the change
      body.velocity.set(0, 0, 0); // Set velocity to 0
      body.angularVelocity.set(0, 0, 0); // Set angular velocity to 0

      // Optionally, remove the body from the world
      // world.removeBody(body);

      console.log(`Physics turned off for block ${blockIndex}`);
    }

    initMouse = mouse;
  } else {
    clickedObject = "random";
  }
}


function getMousePositionIn3D() {
  if (clickedObject && typeof clickedObject === 'object' && clickedObject.name && clickedObject.name.includes("block")) {
    // Extract the block number from the name
    let nums = clickedObject.name.match(/\d+/g);
    if (nums && nums.length > 0) {
      let blockIndex = parseInt(nums[0], 10);
      if (intersects.length > 0) {
        // Get the intersected point's position
        
        let amount = [initMouse.x - mouse.x, initMouse.y - mouse.y]
        // Update the block's position (assuming blocks[blockIndex] is a CANNON.Body)
        blocks[blockIndex].position.set(blocks[blockIndex].initPosition.z + amount[1], blocks[blockIndex].position.y, blocks[blockIndex].initPosition.x + amount[0]);
         console.log(blocks[blockIndex])
        // console.log(blocks)
        // console.log(threearray)
        // Return the intersected object
        return intersects[0];
      }
    }
  }
  return null;
}



// Event listener for mouse movement
function onMouseMove(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

window.addEventListener('mousemove', onMouseMove);
window.addEventListener('click', onMouseClick);













function onScroll() {
  const scrollAmount = window.scrollY;
  const angle = scrollAmount * 0.00074;
  const radius = 1;

  camera.position.x = radius * Math.cos(angle);
  camera.position.z = radius * Math.sin(angle);
  camera.lookAt(new THREE.Vector3(0, 1, 0));
}


window.addEventListener('scroll', onScroll);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});




function animate() {
  requestAnimationFrame(animate);

  world.step(1 / 900); // Use a smaller timestep for more stable physics

  models.forEach((model) => {
    const body = model.userData.physicsBody;
    if (body) {
      model.position.copy(body.position);
      model.quaternion.copy(body.quaternion);
    }
  });

  models.forEach((model) => {
    const body = model.userData.physicsBody;
    if (body) {
      const debugMesh = model.userData.debugMesh;
      if (debugMesh) {
        debugMesh.position.copy(body.position);
        debugMesh.quaternion.copy(body.quaternion);
      }
    }
  });

  const mousePosition3D = getMousePositionIn3D();

  
  

  renderer.render(scene, camera);
}

animate();
