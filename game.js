import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import CANNON from 'cannon';

const planeHeight = 0.867
let blocks = []

function setup (){
    const material = new CANNON.Material('material');
    const contactMaterial = new CANNON.ContactMaterial(material, material, {
        friction: 0.4, 
        restitution: 0.2
    });

    // Set up CANNON.js world
    const world = new CANNON.World();
    world.gravity.set(0, -9.82, 0);
    // world.solver.iterations = 10;
    // world.solver.tolerance = 0

    // Set up Three.js scene
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Set up camera
    camera.position.set(5, 1, 6);
    const ambientLight = new THREE.AmbientLight(0xffffff, 1);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
    directionalLight.position.set(3, 3, 3);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

}

function addPhysicsToModel(model, isStatic = false, id) {
    const mass = isStatic ? 0 : 1;
  
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
        model.position.x,
        model.position.y,
        model.position.z
      ),
      material: contactMaterial
    });
  
    // Apply damping to the body
    body.linearDamping = 0.05; // Realistic linear damping
    body.angularDamping = 0.05; // Realistic angular damping
  
    if (Math.floor(id / 3) % 2 === 0) {
      body.quaternion.setFromEuler(0, Math.PI / 2, 0, "XYZ");
    }
  
    body.addShape(shape);
    world.addBody(body);
  
    model.userData.physicsBody = body;
    model.userData.id = id; // Store the ID in the model's userData
    body.userData = { id }; // Store the ID in the body's userData
    blocks.push(body);
    console.log(blocks);
  
    const debugGeometry = new THREE.BoxGeometry(size.x, size.y, size.z);
    const debugMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: true });
    const debugMesh = new THREE.Mesh(debugGeometry, debugMaterial);
    debugMesh.position.copy(model.position);
    debugMesh.rotation.copy(model.rotation);
    scene.add(debugMesh);
  
    model.userData.debugMesh = debugMesh;
}
  

function loadModels(){
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

    //add ground plane 
    const planeGeometry = new THREE.PlaneGeometry(2, 2); 
    const planeMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff, transparent: true, opacity: 1 });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = planeHeight;
    scene.add(plane);
    const planeShape = new CANNON.Plane();
    const planeBody = new CANNON.Body({
    mass: 0,
    position: new CANNON.Vec3(0, planeHeight, 0),
    material: contactMaterial
    });
    planeBody.addShape(planeShape);
    planeBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(planeBody);

    for (let i = 0; i < 10 * 3; i++) {
    loader.load('/assets/block.glb', (gltf) => {
        const model = gltf.scene;
        model.scale.set(0.03, 0.03, 0.03);
        
        const layer = Math.floor(i / 3);
        const x = -0.06 + ((i % 3) * 0.06);
        const y = 0.95 + (layer * 0.0655);
        model.position.set(x, y, 0);
    
        model.traverse((child) => {
        if (child.isMesh) {
            child.name = `block_${i}`;
            console.log("Model name set:", child.name);
        }
        });
    
        if (!layerGroups[layer]) {
        layerGroups[layer] = new THREE.Group();
        scene.add(layerGroups[layer]);
        }
        layerGroups[layer].add(model);
        let boundingBox = new THREE.Box3().setFromObject(model)
        
        models.push(model);
        addPhysicsToModel(model, false, i);
    }, undefined, (error) => {
        console.error('An error occurred loading the model:', error);
    });
    }


}