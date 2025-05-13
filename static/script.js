// Global variables
let scene, camera, renderer, controls, composer;
let molecules = {};
let atomObjects = {};
let bondObjects = {};

// Animation system variables
let animationTimelines = {};
let particleGroups = {};
let cameraAnimations = {};
let transitionEffects = new THREE.Group(); // For transition effects like particles
let raycaster, mouse;
let currentStep = 0;
const totalSteps = 3; // 0-indexed, so 4 steps total (0,1,2,3)
let animationPlaying = false;
let originalPositions = {};
let bloomPass, effectFXAA;

// molecule data with enhanced clinical relevance for medical presentation
const SCIENTIFIC_DATA = {
  sodiumNitrite: {
    formula: "NaNO₂",
    molecularWeight: "68.99 g/mol",
    density: "2.17 g/cm³",
    meltingPoint: "271°C",
    solubility: "84.8 g/100mL at 20°C in water",
    role: "Food preservative, curing agent in processed meats",
    chemical_properties: "Oxidizing agent, weak base",
    health_concerns: "Forms carcinogenic nitrosamines under acidic conditions when exposed to secondary amines",
    daily_intake: "ADI of 0-0.07 mg/kg body weight (WHO/FAO)",
    product_levels: "Up to 200 ppm in cured meats (bacon, hot dogs, ham)",
    medical_significance: "Linked to increased colorectal cancer risk in epidemiological studies",
  },
  nitrousAcid: {
    formula: "HNO₂",
    molecularWeight: "47.01 g/mol",
    pKa: "3.16 at 25°C",
    stability: "Unstable in solution, half-life of minutes at gastric pH",
    properties: "Weak acid, exists mainly in solution",
    formation: "Forms when nitrites encounter gastric acid (pH 1.5-3.5)",
    structure: "Planar molecule with sp² hybridized nitrogen",
    medical_relevance: "Intermediate in N-nitrosation reactions in the human stomach",
    concentration: "Variable depending on nitrite intake, estimated 1-5 µM in gastric fluid after nitrite consumption",
  },
  nitrosoniumIon: {
    formula: "NO⁺",
    molecularWeight: "30.01 g/mol",
    properties: "Highly electrophilic, strong nitrosating agent",
    stability: "Transient species, exists in strongly acidic solutions",
    reactivity: "Reacts readily with nucleophiles, especially secondary amines within 30-90 seconds",
    significance: "Key intermediate in nitrosation reactions",
    structure: "Linear molecule with triple bond character",
    formation_rate: "pH-dependent, maximal at pH 2-3",
    detection: "Challenging in vivo due to short half-life (<1 second in aqueous solution)",
  },
  nitrosamine: {
    formula: "R₂N-N=O",
    properties: "Generally stable compounds, lipophilic, readily absorbed in GI tract",
    examples: "Dimethylnitrosamine (NDMA), N-nitrosopyrrolidine (NPYR)",
    carcinogenicity: "Group 2A probable human carcinogens (IARC classification)",
    mechanism: "Metabolically activated by cytochrome P450 2E1 to form alkylating agents that cause DNA adducts",
    formation_conditions: "Form when secondary amines react with nitrosating agents under acidic conditions (pH 2-4 optimal)",
    regulation: "Strictly regulated in food and pharmaceuticals (<0.03-1.0 ppm depending on compound)",
    research: "Current research focuses on inhibition by antioxidants like vitamin C and E",
    tissue_specificity: "Primarily affects liver, kidney, esophagus, bladder, and colorectal tissues",
    biomarkers: "DNA adducts (O⁶-alkylguanine) and urinary metabolites serve as exposure biomarkers",
    epidemiology: "Associated with 18% increased risk of colorectal cancer per 50g daily processed meat consumption",
    detection_methods: "GC-MS, LC-MS/MS with detection limits of 0.1-1.0 ng/g in biological samples",
  },
};

// atom colors with enhanced scientific accuracy (using standard CPK coloring scheme for chemistry)
const atomColors = {
  Na: 0x1976D2, // Bright blue for Sodium (more vibrant for better visibility)
  K: 0x8E24AA,  // Purple for Potassium (standard CPK color with better visibility)
  N: 0x3F51B5, // Royal blue for Nitrogen (better contrast)
  O: 0xF44336, // Bright red for Oxygen (more vibrant)
  H: 0xEEEEEE, // Off-white for Hydrogen (better against dark background)
  C: 0x616161, // Darker gray for Carbon (better definition)
  Cl: 0x4CAF50, // Emerald green for Chlorine (more vibrant)
  Protein: 0x8BC34A, // Brighter green for protein environment
  Stomach: 0xFFCCBC, // Peach for stomach environment
  
  // Adding highlights and electron cloud effects with enhanced visibility
  NaHighlight: 0x29B6F6, // Bright highlight color for sodium reactions
  NitriteHighlight: 0xFFA726, // Vibrant orange for nitrite functional group
  NitrosoHighlight: 0xFF5252, // Vivid red for nitroso functional group
};

// sizes based on accurate van der Waals radii and adjusted for visual clarity
const atomSizes = {
  Na: 2.2, // Increased for better visibility (van der Waals radius ~2.27Å)
  K: 2.5,  // Potassium is larger than sodium (van der Waals radius ~2.75Å)
  N: 1.55, // Accurate nitrogen radius (van der Waals radius ~1.55Å)
  O: 1.52, // Accurate oxygen radius (van der Waals radius ~1.52Å)
  H: 1.1, // Slightly larger than vdW (1.1 vs 1.2Å) for visibility
  C: 1.7, // Accurate carbon radius (van der Waals radius ~1.7Å)
  Cl: 1.75, // Accurate chlorine radius
  Protein: 2.0,
  Stomach: 2.0,
};

// Animation utility functions for smooth transitions
function createParticleSystem(origin, color, count = 20, spread = 3, size = 0.1) {
  const particleGroup = new THREE.Group();
  const particleMaterial = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
  });

  for (let i = 0; i < count; i++) {
    const particleGeometry = new THREE.SphereGeometry(size * (0.6 + Math.random() * 0.8), 8, 8);
    const particle = new THREE.Mesh(particleGeometry, particleMaterial.clone());
    
    // Random positions within spread range
    particle.position.set(
      origin.x + (Math.random() - 0.5) * spread,
      origin.y + (Math.random() - 0.5) * spread,
      origin.z + (Math.random() - 0.5) * spread
    );
    
    // Store velocity for animation
    particle.userData.velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 0.05,
      (Math.random() - 0.5) * 0.05,
      (Math.random() - 0.5) * 0.05
    );
    
    particleGroup.add(particle);
  }
  
  return particleGroup;
}

function createGlowEffect(object, color, intensity = 1.0) {
  // This function is simplified to avoid material compatibility issues
  // It just temporarily changes the color of any material, regardless of type
  if (object.material) {
    if (Array.isArray(object.material)) {
      object.material.forEach(mat => {
        if (mat.color) {
          // Store original color if not already saved
          if (!mat.userData) mat.userData = {};
          if (!mat.userData.originalColor) mat.userData.originalColor = mat.color.clone();
          
          // Temporarily change to highlight color
          mat.color.set(color);
        }
      });
    } else {
      if (object.material.color) {
        // Store original color if not already saved
        if (!object.material.userData) object.material.userData = {};
        if (!object.material.userData.originalColor) object.material.userData.originalColor = object.material.color.clone();
        
        // Temporarily change to highlight color
        object.material.color.set(color);
      }
    }
  }
  
  // For groups, apply to all children with materials
  if (object.children && object.children.length > 0) {
    object.children.forEach(child => {
      createGlowEffect(child, color, intensity);
    });
  }
}

function smoothCameraTransition(target, duration = 2, distance = 15) {
  // Save current camera position and target
  const startPosition = camera.position.clone();
  const startTarget = controls.target.clone();
  
  // Calculate new camera position based on target
  const newPosition = target.clone().add(new THREE.Vector3(0, 0, distance));
  
  // Create a timeline for smooth camera movement
  const timeline = gsap.timeline();
  
  timeline.to(camera.position, {
    x: newPosition.x,
    y: newPosition.y,
    z: newPosition.z,
    duration: duration,
    ease: "power2.inOut",
    onUpdate: () => {
      camera.lookAt(controls.target);
    }
  }, 0);
  
  timeline.to(controls.target, {
    x: target.x,
    y: target.y,
    z: target.z,
    duration: duration,
    ease: "power2.inOut",
  }, 0);
  
  return timeline;
}

function transitionMolecules(fromMolecule, toMolecule, duration = 1.5, includeParticles = true) {
  // Create a timeline for the transition
  const tl = gsap.timeline();
  
  // Store initial properties
  const fromPosition = fromMolecule.position.clone();
  const toPosition = toMolecule.position.clone();
  
  // Reset target molecule position and make it invisible initially
  toMolecule.position.copy(fromPosition);
  toMolecule.visible = false;
  
  // Ensure stomach is visible during the entire transition
  if (molecules.stomach) {
    molecules.stomach.visible = true;
    molecules.stomach.group.visible = true;
  }
  
  // Fade out source molecule
  fromMolecule.traverse(object => {
    if (object.material) {
      // Ensure material is set to transparent
      object.material.transparent = true;
      tl.to(object.material, {
        opacity: 0,
        duration: duration * 0.8,
        ease: "power2.inOut"
      }, 0);
    }
  });
  
  // Optional particle effect during transition
  if (includeParticles) {
    const particles = createParticleSystem(
      fromPosition,
      0xffffff, // White particles
      30,       // More particles
      3,        // Broader spread
      0.12      // Slightly larger particles
    );
    scene.add(particles);
    
    // Animate particles
    particles.children.forEach(particle => {
      const randomDuration = duration * (0.7 + Math.random() * 0.6);
      
      tl.to(particle.position, {
        x: particle.position.x + particle.userData.velocity.x * 20,
        y: particle.position.y + particle.userData.velocity.y * 20,
        z: particle.position.z + particle.userData.velocity.z * 20,
        duration: randomDuration,
        ease: "power2.out",
      }, 0);
      
      tl.to(particle.material, {
        opacity: 0,
        duration: randomDuration * 0.8,
        ease: "power2.in",
      }, randomDuration * 0.2);
    });
    
    // Clean up particles after animation
    tl.add(() => {
      scene.remove(particles);
      particles.traverse(object => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) object.material.dispose();
      });
    }, duration);
  }
  
  // Show destination molecule after a delay
  tl.add(() => {
    fromMolecule.visible = false;
    toMolecule.visible = true;
    
    // Reset the opacity on the source molecule for future use
    fromMolecule.traverse(object => {
      if (object.material) {
        object.material.opacity = 1;
      }
    });
    
    // Add subtle entrance animation for destination molecule
    toMolecule.scale.set(0.95, 0.95, 0.95);
    toMolecule.traverse(object => {
      if (object.material) {
        object.material.transparent = true;
        object.material.opacity = 0;
      }
    });
  }, duration * 0.8);
  
  // Animate destination molecule appearing
  tl.to(toMolecule.scale, {
    x: 1, y: 1, z: 1,
    duration: duration * 0.5,
    ease: "back.out(1.7)"
  }, duration * 0.8);
  
  // Fade in destination molecule
  toMolecule.traverse(object => {
    if (object.material) {
      tl.to(object.material, {
        opacity: 1,
        duration: duration * 0.5,
        ease: "power2.out"
      }, duration * 0.8);
    }
  });
  
  return tl;
}

// Switch tab function to handle tab changes
function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab-button').forEach(button => {
    if (button.getAttribute('data-tab') === tabName) {
      button.classList.add('bg-blue-900', 'text-white');
      button.classList.remove('bg-gray-800', 'text-gray-300');
    } else {
      button.classList.remove('bg-blue-900', 'text-white');
      button.classList.add('bg-gray-800', 'text-gray-300');
    }
  });
  
  // Update tab contents
  document.querySelectorAll('.tab-content').forEach(content => {
    if (content.getAttribute('data-tab') === tabName) {
      content.classList.remove('hidden');
    } else {
      content.classList.add('hidden');
    }
  });
  
  // Hide UI elements when info tab is active
  const stepNavigator = document.getElementById('step-navigator');
  const infoButton = document.getElementById('toggle-info-panel');
  const resetCameraBtn = document.getElementById('reset-camera-btn');
  const toggleFullscreenBtn = document.getElementById('toggle-fullscreen');
  
  if (tabName === 'info') {
    // Hide elements when info tab is active
    if (stepNavigator) stepNavigator.classList.add('hidden');
    if (infoButton) infoButton.classList.add('hidden');
    if (resetCameraBtn) resetCameraBtn.classList.add('hidden');
    if (toggleFullscreenBtn) toggleFullscreenBtn.classList.add('hidden');
  } else {
    // Show elements when other tabs are active
    if (stepNavigator) stepNavigator.classList.remove('hidden');
    if (infoButton) infoButton.classList.remove('hidden');
    if (resetCameraBtn) resetCameraBtn.classList.remove('hidden');
    if (toggleFullscreenBtn) toggleFullscreenBtn.classList.remove('hidden');
  }
}

function init() {
  setTimeout(hideLoading, 1800); // Slightly longer loading for all enhanced components

  // Add medical report title to document
  document.title = "Sodium Nitrite to Nitrosamine: A Medical Visualization of Carcinogenic Transformation";
  
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();
  scene = new THREE.Scene();
  // Add the transition effects group to the scene
  scene.add(transitionEffects);
  
  // Use a more clinical/medical color scheme - darker for better contrast
  scene.background = new THREE.Color(0x030308);
  scene.fog = new THREE.FogExp2(0x030308, 0.01);
  
  // Wider field of view for better visualization of medical details
  camera = new THREE.PerspectiveCamera(
    65,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 0, 20);
  
  // Setup initial rendering configuration
  // Note: Using standard rendering approach to avoid compatibility issues
  
  // Add subtle post-processing effects for medical presentation quality

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
    alpha: true,
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile() ? 2 : 3)); // Limit pixel ratio on mobile
  renderer.physicallyCorrectLights = true;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById("canvas-container").appendChild(renderer.domElement);
  setupPostProcessing();

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.25;
  controls.rotateSpeed = isMobile() ? 0.7 : 0.5; // Faster rotation on mobile
  controls.enableZoom = true;
  controls.zoomSpeed = isMobile() ? 1.2 : 1.0; // Slightly faster zoom on mobile
  controls.autoRotate = false;
  controls.autoRotateSpeed = 0.5;
  controls.enablePan = !isMobile(); // Disable panning on mobile to prevent accidental gestures
  controls.screenSpacePanning = true;
  controls.minDistance = isMobile() ? 7 : 5; // Prevent zooming in too close on mobile
  controls.maxDistance = 50;
  controls.maxPolarAngle = Math.PI * 0.95;

  setupLighting();
  createMolecules();
  // step 0
  updateMoleculeData("sodiumNitrite");
  updateScientificContext(0);
  showStep(0);

  addEventListeners();
  animate();
  
  // Set up initial panel state and add desktop styles immediately
  const style = document.createElement('style');
  style.textContent = `
    @media (min-width: 768px) {
      #info-panel {
        transform: translateX(0) !important;
        visibility: visible !important;
        opacity: 1 !important;
        left: 0 !important;
        display: block !important;
      }
    }
  `;
  document.head.appendChild(style);
  
  setTimeout(() => {
    const infoPanel = document.getElementById('info-panel');
    
    if (!isMobile()) {
      // On desktop, show the panel by default
      infoPanel.classList.remove('-translate-x-full');
      infoPanel.classList.add('translate-x-0');
      infoPanel.classList.add('visible');
      
      // Add a CSS class to ensure it's always visible on desktop
      document.body.classList.add('desktop-mode');
      
      // Add an inline style to force visibility
      infoPanel.style.transform = 'translateX(0)';
      infoPanel.style.visibility = 'visible';
      infoPanel.style.opacity = '1';
    }
  }, 500); // Short delay to ensure DOM is fully loaded
}

function hideLoading() {
  const loadingScreen = document.getElementById("loading");
  loadingScreen.style.opacity = "0";
  setTimeout(() => {
    loadingScreen.style.display = "none";
    
    // Show mobile instructions if on mobile
    if (isMobile()) {
      // Create a brief tutorial message for mobile users
      const mobileHint = document.createElement('div');
      mobileHint.className = 'fixed bottom-[80px] left-1/2 transform -translate-x-1/2 bg-[rgba(0,0,0,0.7)] text-white py-2 px-4 rounded-lg text-center text-sm z-50 backdrop-blur-sm';
      mobileHint.innerHTML = 'Tap the <i class="fas fa-info"></i> button for molecular details. Pinch to zoom, drag to rotate.';
      document.body.appendChild(mobileHint);
      
      // Remove after 5 seconds
      setTimeout(() => {
        mobileHint.style.opacity = '0';
        setTimeout(() => mobileHint.remove(), 500);
      }, 5000);
    }
  }, 500);
}

function setupPostProcessing() {
  composer = new THREE.EffectComposer(renderer);
  const renderPass = new THREE.RenderPass(scene, camera);
  composer.addPass(renderPass);

  effectFXAA = new THREE.ShaderPass(THREE.FXAAShader);
  effectFXAA.uniforms.resolution.value.set(
    1 / window.innerWidth,
    1 / window.innerHeight
  );
  composer.addPass(effectFXAA);

  // bloom for glowing effect with mobile optimization
  const bloomStrength = isMobile() ? 0.4 : 0.5; // Reduce bloom strength on mobile
  const bloomRadius = isMobile() ? 0.3 : 0.4;   // Smaller radius on mobile
  bloomPass = new THREE.UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    bloomStrength,
    bloomRadius,
    0.85 // threshold
  );
  composer.addPass(bloomPass);
}

function setupLighting() {
  // Ambient light for base illumination
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
  scene.add(ambientLight);

  // Main directional light
  const mainLight = new THREE.DirectionalLight(0xffffff, 1.0);
  mainLight.position.set(10, 10, 10);
  mainLight.castShadow = true;
  mainLight.shadow.mapSize.width = 2048;
  mainLight.shadow.mapSize.height = 2048;
  mainLight.shadow.camera.near = 0.5;
  mainLight.shadow.camera.far = 50;
  mainLight.shadow.bias = -0.0001;
  scene.add(mainLight);

  // Fill light from the corners
  const fillLight = new THREE.DirectionalLight(0xffffee, 0.4);
  fillLight.position.set(-10, 5, -10);
  scene.add(fillLight);

  // Rim light for edge definition
  const rimLight = new THREE.DirectionalLight(0x8080ff, 0.3);
  rimLight.position.set(0, -10, -10);
  scene.add(rimLight);

  // Point lights for accents
  const pointLight1 = new THREE.PointLight(0xffaa00, 0.8, 30);
  pointLight1.position.set(5, 10, 5);
  scene.add(pointLight1);

  const pointLight2 = new THREE.PointLight(0x0088ff, 0.6, 30);
  pointLight2.position.set(-5, -5, -5);
  scene.add(pointLight2);
}

// Helper function to detect mobile devices
function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
}

function addEventListeners() {
  // Events for next/previous buttons
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");
  
  // Clean up old listeners to avoid duplicates
  const newPrevBtn = prevBtn.cloneNode(true);
  const newNextBtn = nextBtn.cloneNode(true);
  prevBtn.parentNode.replaceChild(newPrevBtn, prevBtn);
  nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);
  
  // Add fresh event listeners
  newPrevBtn.addEventListener("click", function(e) {
    e.preventDefault();
    previousStep();
  });
  
  newNextBtn.addEventListener("click", function(e) {
    e.preventDefault();
    nextStep();
  });

  // Add tab button functionality
  const tabButtons = document.querySelectorAll('.tab-button');
  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      const tabName = this.getAttribute('data-tab');
      switchTab(tabName);
    });
  });

  // Add floating info panel toggle button for mobile and desktop
  const toggleInfoBtn = document.getElementById("toggle-info-panel");
  if (toggleInfoBtn) {
    toggleInfoBtn.addEventListener("click", function() {
      const panel = document.getElementById("info-panel");
      
      if (isMobile()) {
        // For mobile: make the panel visible and ensure info tab is shown
        if (panel.classList.contains('-translate-y-full')) {
          panel.classList.add("translate-y-0");
          panel.classList.remove("-translate-y-full");
          switchTab('info'); // This will handle hiding the UI elements
        } else {
          panel.classList.remove("translate-y-0");
          panel.classList.add("-translate-y-full");
          
          // Show all UI elements when panel is closed
          const stepNavigator = document.getElementById('step-navigator');
          const resetCameraBtn = document.getElementById('reset-camera-btn');
          const toggleFullscreenBtn = document.getElementById('toggle-fullscreen');
          
          if (stepNavigator) stepNavigator.classList.remove('hidden');
          if (toggleInfoBtn) toggleInfoBtn.classList.remove('hidden');
          if (resetCameraBtn) resetCameraBtn.classList.remove('hidden');
          if (toggleFullscreenBtn) toggleFullscreenBtn.classList.remove('hidden');
        }
      } else {
        // For desktop: toggle the panel
        if (panel.classList.contains('-translate-x-full')) {
          panel.classList.add("translate-x-0");
          panel.classList.remove("-translate-x-full");
          switchTab('info'); // This will handle hiding the UI elements
        } else {
          panel.classList.remove("translate-x-0");
          panel.classList.add("-translate-x-full");
          
          // Show all UI elements when panel is closed
          const stepNavigator = document.getElementById('step-navigator');
          const resetCameraBtn = document.getElementById('reset-camera-btn');
          const toggleFullscreenBtn = document.getElementById('toggle-fullscreen');
          
          if (stepNavigator) stepNavigator.classList.remove('hidden');
          if (toggleInfoBtn) toggleInfoBtn.classList.remove('hidden');
          if (resetCameraBtn) resetCameraBtn.classList.remove('hidden');
          if (toggleFullscreenBtn) toggleFullscreenBtn.classList.remove('hidden');
        }
      }
    });
  }
  
  // Close panel button (mobile only)
  const closePanelBtn = document.getElementById("close-panel");
  if (closePanelBtn) {
    closePanelBtn.addEventListener("click", function() {
      const panel = document.getElementById("info-panel");
      panel.classList.add("-translate-y-full");
      panel.classList.remove("translate-y-0");
      
      // Show all UI elements when panel is closed
      const stepNavigator = document.getElementById('step-navigator');
      const toggleInfoBtn = document.getElementById("toggle-info-panel");
      const resetCameraBtn = document.getElementById('reset-camera-btn');
      const toggleFullscreenBtn = document.getElementById('toggle-fullscreen');
      
      if (stepNavigator) stepNavigator.classList.remove('hidden');
      if (toggleInfoBtn) toggleInfoBtn.classList.remove('hidden');
      if (resetCameraBtn) resetCameraBtn.classList.remove('hidden');
      if (toggleFullscreenBtn) toggleFullscreenBtn.classList.remove('hidden');
    });
  }
  
  // Add reset camera view button functionality
  const resetCameraBtn = document.getElementById("reset-camera-btn");
  if (resetCameraBtn) {
    resetCameraBtn.addEventListener("click", function() {
      resetCameraView();
    });
  }

  // mouse interactions with appropriate handling for mobile
  if (isMobile()) {
    window.addEventListener("touchstart", onTouchStart, { passive: false });
  } else {
    window.addEventListener("mousemove", onMouseMove);
  }
  
  window.addEventListener("resize", onWindowResize);
}

function createAtom(
  type,
  position,
  label = true,
  moleculeType = "",
  atomIndex = 0
) {
  const group = new THREE.Group();
  group.position.copy(position);
  group.name = `${type}_${atomIndex}`;
  group.userData = { atomType: type, moleculeType, atomIndex };

  // Create sphere with physically-accurate van der Waals radius
  const size = atomSizes[type] || 1.0;
  const geometry = new THREE.SphereGeometry(size * 0.8, 36, 36); // Slightly smaller core with higher polygon count
  
  // Create material with more realistic properties based on atom type
  let roughness = 0.3;
  let metalness = 0.2;
  let emissiveIntensity = 0.05;
  
  // Adjust material properties based on atom type
  switch(type) {
    case "Na":
      // Sodium is a metal with more reflective properties
      roughness = 0.2;
      metalness = 0.7;
      break;
    case "N":
      // Nitrogen is relatively smooth with low metalness
      roughness = 0.25;
      metalness = 0.1;
      emissiveIntensity = 0.08;
      break; 
    case "O":
      // Oxygen is slightly glossy
      roughness = 0.2;
      metalness = 0.1;
      emissiveIntensity = 0.08;
      break;
    case "H":
      // Hydrogen is small and less reflective
      roughness = 0.4;
      metalness = 0.1;
      break;
    case "C":
      // Carbon is matte
      roughness = 0.5;
      metalness = 0.1;
      break;
  }
  
  // Enhance shader settings for focus atoms (N, O in nitrite/nitrosamine) 
  const isKeyAtom = (type === "N" || type === "O") && 
                    (moleculeType === "sodiumNitrite" || 
                     moleculeType === "nitrousAcid" || 
                     moleculeType === "decomposed" ||
                     moleculeType === "nitrosamine");
  
  // Create material with enhanced properties for key atoms - using compatible properties
  const material = new THREE.MeshStandardMaterial({
    color: atomColors[type] || 0xffffff,
    roughness: roughness,
    metalness: metalness,
    emissive: atomColors[type],
    emissiveIntensity: isKeyAtom ? 0.15 : emissiveIntensity
  });
  
  const atom = new THREE.Mesh(geometry, material);
  atom.castShadow = true;
  atom.receiveShadow = true;
  atom.userData = { isAtom: true, elementType: type, parent: group };
  group.add(atom);

  // Add glow effect and electron cloud
  const cloudGeometry = new THREE.SphereGeometry(atomSizes[type] * 1.1, 32, 32);
  const cloudMaterial = new THREE.MeshBasicMaterial({
    color: atomColors[type],
    transparent: true,
    opacity: 0.15,
    side: THREE.BackSide,
  });
  const cloud = new THREE.Mesh(cloudGeometry, cloudMaterial);
  group.add(cloud);

  // add animated electon shell
  if (["Na", "N"].includes(type) && Math.random() > 0.5) {
    const electronShell = createElectronShell(type, atomSizes[type] * 1.7);
    group.add(electronShell);
  }

  // add lable if hover
  if (label) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext("2d");

    context.beginPath();
    context.arc(128, 128, 75, 0, Math.PI * 2);
    context.fillStyle = "rgba(0, 0, 0, 0.7)";
    context.fill();

    context.fillStyle = "#ffffff";
    context.font = "Bold 100px Arial";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(type, 128, 128);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(1.5, 1.5, 1);
    sprite.position.set(0, 0, 0);
    sprite.userData = { isLabel: true };
    group.add(sprite);

    group.userData.label = sprite;
  }

  originalPositions[`${moleculeType}_${atomIndex}`] = position.clone();

  group.position.copy(position);

  if (!atomObjects[moleculeType]) {
    atomObjects[moleculeType] = [];
  }
  atomObjects[moleculeType].push(group);

  return group;
}

function createElectronShell(atomType, radius) {
  const group = new THREE.Group();

  // create orbit path
  const orbitGeometry = new THREE.TorusGeometry(radius, 0.03, 16, 100);
  const orbitMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.2,
  });
  const orbit = new THREE.Mesh(orbitGeometry, orbitMaterial);
  orbit.rotation.x = Math.PI / 2;
  group.add(orbit);

  // make electrons
  const electronCount = atomType === "Na" ? 1 : 5;
  for (let i = 0; i < electronCount; i++) {
    // Use enhanced electron creation with proper parameters
    const electron = createElectron(radius, 0.5 + Math.random() * 0.5, atomType);
    group.add(electron);
  }

  return group;
}

// Create optimized electrons with proper tagging for animation system
function createElectron(radius, speed, parentAtom) {
  const geometry = new THREE.SphereGeometry(0.15, 16, 16);
  const material = new THREE.MeshPhongMaterial({
    color: 0x88ccff,
    emissive: 0x88ccff,
    emissiveIntensity: 1.0,
    transparent: true,
    opacity: 0.9
  });
  const electron = new THREE.Mesh(geometry, material);
  
  // Set initial position with slight randomization for natural look
  const angle = Math.random() * Math.PI * 2;
  electron.position.x = Math.cos(angle) * radius;
  electron.position.z = Math.sin(angle) * radius;
  
  // Store animation data with isElectron tag for optimized animation loop
  electron.userData = {
    radius: radius,
    angle: angle,
    speed: speed || 1,
    isElectron: true // Tag for optimized animation system
  };
  
  return electron;
}

// create bonds
function createBond(
  start,
  end,
  bondType = "single",
  moleculeType = "",
  startAtomType = "",
  endAtomType = "",
  bondIndex = 0
) {
  const bondGroup = new THREE.Group();
  bondGroup.userData = {
    isBond: true,
    bondType: bondType,
    moleculeType: moleculeType,
  };

  // get direction and length
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  const center = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

  // determine color based on atom
  let color;
  if (startAtomType && endAtomType) {
    const startColor = new THREE.Color(atomColors[startAtomType]);
    const endColor = new THREE.Color(atomColors[endAtomType]);
    color = new THREE.Color()
      .addColors(startColor, endColor)
      .multiplyScalar(0.5);
  } else {
    // Default color if atom types not provided
    color = new THREE.Color(0xcccccc);
  }

  // create different bond types
  switch (bondType) {
    case "single":
      createSingleBond(bondGroup, start, end, direction, length, color);
      break;
    case "double":
      createDoubleBond(bondGroup, start, end, direction, length, color);
      break;
    case "triple":
      createTripleBond(bondGroup, start, end, direction, length, color);
      break;
    case "dashed":
      // For dashed bonds, create and add to the bond group
      const dashedBond = createDashedBond(start, end, moleculeType, bondIndex);
      bondGroup.add(dashedBond);
      break;
    default:
      createSingleBond(bondGroup, start, end, direction, length, color);
  }

  // store the bond in the tracking objects
  if (!bondObjects[moleculeType]) {
    bondObjects[moleculeType] = [];
  }
  bondObjects[moleculeType].push(bondGroup);

  return bondGroup;
}

function createSingleBond(group, start, end, direction, length, color) {
  const normal = new THREE.Vector3(0, 1, 0);

  // Create standard bond cylinder
  const geometry = new THREE.CylinderGeometry(0.1, 0.1, length, 16, 1);
  const material = new THREE.MeshStandardMaterial({
    color: color,
    roughness: 0.5,
    metalness: 0.2,
  });

  const bond = new THREE.Mesh(geometry, material);
  bond.position.copy(
    new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5)
  );

  // align with direction
  const quaternion = new THREE.Quaternion();
  quaternion.setFromUnitVectors(normal, direction.clone().normalize());
  bond.setRotationFromQuaternion(quaternion);

  bond.castShadow = true;
  bond.receiveShadow = true;

  group.add(bond);
}

function createDoubleBond(group, start, end, direction, length, color) {
  // calculate offset direction perpendicular to bond
  const normalizedDir = direction.clone().normalize();
  const perpendicular = new THREE.Vector3(1, 0, 0);

  // make sure perpendicular is actually perpendicular to the bond direction
  if (Math.abs(normalizedDir.dot(perpendicular)) > 0.9) {
    perpendicular.set(0, 1, 0);
  }

  perpendicular.cross(normalizedDir).normalize();
  const offset = perpendicular.clone().multiplyScalar(0.15);

  // create first
  const geometry1 = new THREE.CylinderGeometry(0.07, 0.07, length, 12, 1);
  const material = new THREE.MeshStandardMaterial({
    color: color,
    roughness: 0.5,
    metalness: 0.2,
  });

  const bond1 = new THREE.Mesh(geometry1, material);
  const pos1 = new THREE.Vector3()
    .addVectors(start, end)
    .multiplyScalar(0.5)
    .add(offset);
  bond1.position.copy(pos1);

  // create second
  const geometry2 = new THREE.CylinderGeometry(0.07, 0.07, length, 12, 1);
  const bond2 = new THREE.Mesh(geometry2, material);
  const pos2 = new THREE.Vector3()
    .addVectors(start, end)
    .multiplyScalar(0.5)
    .sub(offset);
  bond2.position.copy(pos2);

  // rotate to align with direction of the atom
  const quaternion = new THREE.Quaternion();
  quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normalizedDir);
  bond1.setRotationFromQuaternion(quaternion);
  bond2.setRotationFromQuaternion(quaternion);

  bond1.castShadow = true;
  bond1.receiveShadow = true;
  bond2.castShadow = true;
  bond2.receiveShadow = true;

  group.add(bond1);
  group.add(bond2);
}

// Create triple bond
function createTripleBond(group, start, end, direction, length, color) {
  // Calculate perpendicular vector for offset
  const normalizedDir = direction.clone().normalize();
  const perpendicular = new THREE.Vector3(1, 0, 0);

  // Ensure perpendicular is actually perpendicular
  if (Math.abs(normalizedDir.dot(perpendicular)) > 0.9) {
    perpendicular.set(0, 1, 0);
  }

  perpendicular.cross(normalizedDir).normalize();
  const offset = perpendicular.clone().multiplyScalar(0.2);

  // Common material for all bonds
  const material = new THREE.MeshStandardMaterial({
    color: color,
    roughness: 0.5,
    metalness: 0.2,
  });

  // Create center bond
  const geometry1 = new THREE.CylinderGeometry(0.07, 0.07, length, 12, 1);
  const bond1 = new THREE.Mesh(geometry1, material);
  const pos1 = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  bond1.position.copy(pos1);

  // Create side bonds
  const sideGeometry = new THREE.CylinderGeometry(0.05, 0.05, length, 12, 1);
  const bond2 = new THREE.Mesh(sideGeometry, material);
  const pos2 = pos1.clone().add(offset);
  bond2.position.copy(pos2);

  const bond3 = new THREE.Mesh(sideGeometry, material);
  const pos3 = pos1.clone().sub(offset);
  bond3.position.copy(pos3);

  // Align all bonds with the direction
  const quaternion = new THREE.Quaternion();
  quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normalizedDir);
  
  [bond1, bond2, bond3].forEach(bond => {
    bond.setRotationFromQuaternion(quaternion);
    bond.castShadow = true;
    bond.receiveShadow = true;
    group.add(bond);
  });
}

// Create a dashed bond for partial/ionic bonds or reaction intermediates
function createDashedBond(start, end, parentType, bondIndex) {
  // Create a group to hold all parts of the dashed bond
  const bondGroup = new THREE.Group();
  bondGroup.name = `${parentType}_dashedBond_${bondIndex}`;
  
  // Calculate direction and length from start to end positions
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  const normalizedDir = direction.clone().normalize();
  const segments = 7; // number of dashes
  const dashLength = length / (segments * 2 - 1); // length of each dash

  // Determine color based on parent type
  const color = parentType === "pepsin" ? 0x9C27B0 : 0x8BC34A;

  const material = new THREE.MeshStandardMaterial({
    color: color,
    roughness: 0.6,
    metalness: 0.1,
  });

  // create dash segments
  for (let i = 0; i < segments; i++) {
    const geometry = new THREE.CylinderGeometry(0.08, 0.08, dashLength, 12, 1);
    const dash = new THREE.Mesh(geometry, material);

    // position along bond length
    const t = i / (segments - 1); // 0 to 1
    const segmentPos = new THREE.Vector3().lerpVectors(start, end, t);

    // adjust for dash length
    const offset = normalizedDir.clone().multiplyScalar(dashLength * 0.5);
    dash.position.copy(segmentPos);

    // Align with bond direction
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normalizedDir);
    dash.setRotationFromQuaternion(quaternion);

    dash.castShadow = true;
    dash.receiveShadow = true;

    bondGroup.add(dash);
  }
  
  return bondGroup;
}

// Function to add a charge indicator (+ or -) to an atom
function addChargeIndicator(atom, chargeSymbol) {
  // Create a small sprite to display the charge
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  
  // Draw the charge symbol
  context.fillStyle = '#ffffff';
  context.font = 'bold 48px Arial';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(chargeSymbol, 32, 32);
  
  // Create texture from canvas
  const texture = new THREE.CanvasTexture(canvas);
  
  // Create sprite material
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0.9
  });
  
  // Create sprite
  const sprite = new THREE.Sprite(material);
  
  // Scale and position the charge indicator
  const scale = 0.7; // Adjust size as needed
  sprite.scale.set(scale, scale, scale);
  
  // Position slightly offset from atom center
  const offset = 0.8; // Adjust this value for different offsets
  if (chargeSymbol === '+') {
    sprite.position.set(offset, offset, offset);
  } else {
    sprite.position.set(-offset, offset, offset);
  }
  
  // Add charge indicator to atom
  atom.add(sprite);
  
  return sprite;
}

function createMolecules() {
  console.log('Creating molecules...');
  // Create molecule containers to ensure proper structure
  molecules.sodiumNitrite = { group: new THREE.Group(), visible: true };
  molecules.nitrousAcid = { group: new THREE.Group(), visible: false };
  molecules.decomposed = { group: new THREE.Group(), visible: false };
  molecules.nitrosamine = { group: new THREE.Group(), visible: false };
  
  // Add all molecule groups to the scene
  scene.add(molecules.sodiumNitrite.group);
  scene.add(molecules.nitrousAcid.group);
  scene.add(molecules.decomposed.group);
  scene.add(molecules.nitrosamine.group);
  
  // Create stomach environment with physiologically accurate pH gradient visualization
  molecules.stomach = { group: new THREE.Group(), visible: true };
  molecules.stomach.group.name = "stomach";
  // Add stomach to scene immediately
  scene.add(molecules.stomach.group);

  // Increase stomach size for better spacing and focus on nitrite
  const stomachShapeGeometry = new THREE.SphereGeometry(40, 64, 48);

  // Create a material for the stomach wall with slight transparency
  const stomachMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xe57373,         // Reddish color for stomach lining
    roughness: 0.5,
    metalness: 0.1,
    transparent: true,
    opacity: 0.45,           // Make it semi-transparent
    side: THREE.DoubleSide,  // Render both sides
    flatShading: false       // Smooth shading
  });

  // Create stomach mesh
  const stomachMesh = new THREE.Mesh(stomachShapeGeometry, stomachMaterial);
  stomachMesh.castShadow = true;
  stomachMesh.receiveShadow = true;

  // Add mesh to stomach group
  molecules.stomach.group.add(stomachMesh);
  
  // Add realistic stomach molecules (gastric acid components and digestive substances)
  
  // 1. Add several water molecules (H2O) distributed throughout the stomach
  for (let i = 0; i < 15; i++) {
    const waterGroup = new THREE.Group();
    waterGroup.name = "water_" + i;
    
    // Random position within stomach space (smaller radius than stomach)
    const radius = 25 + Math.random() * 10;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.sin(phi) * Math.sin(theta);
    const z = radius * Math.cos(phi);
    
    waterGroup.position.set(x, y, z);
    
    // Create water molecule (H2O)
    const oPos = new THREE.Vector3(0, 0, 0);
    const h1Pos = new THREE.Vector3(0.5, 0.3, 0);
    const h2Pos = new THREE.Vector3(-0.5, 0.3, 0);
    
    const o = createAtom("O", oPos, false, "water", i);
    const h1 = createAtom("H", h1Pos, false, "water", i+100);
    const h2 = createAtom("H", h2Pos, false, "water", i+200);
    
    const h1ToO = createBond(h1Pos, oPos, "single", "water", "H", "O", i);
    const h2ToO = createBond(h2Pos, oPos, "single", "water", "H", "O", i+100);
    
    waterGroup.add(o);
    waterGroup.add(h1);
    waterGroup.add(h2);
    waterGroup.add(h1ToO);
    waterGroup.add(h2ToO);
    
    // Scale down water molecules for better appearance
    waterGroup.scale.set(0.6, 0.6, 0.6);
    
    // Random rotation for natural appearance
    waterGroup.rotation.x = Math.random() * Math.PI * 2;
    waterGroup.rotation.y = Math.random() * Math.PI * 2;
    waterGroup.rotation.z = Math.random() * Math.PI * 2;
    
    molecules.stomach.group.add(waterGroup);
  }
  
  // 2. Add bicarbonate ions (HCO3-) that help protect stomach lining
  for (let i = 0; i < 4; i++) {
    const bicarb = new THREE.Group();
    bicarb.name = "bicarbonate_" + i;
    
    // Position near stomach lining to show protective function
    const radius = 35;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.sin(phi) * Math.sin(theta);
    const z = radius * Math.cos(phi);
    
    bicarb.position.set(x, y, z);
    
    // Create bicarbonate ion structure (HCO3-)
    const cPos = new THREE.Vector3(0, 0, 0);
    const o1Pos = new THREE.Vector3(0.8, 0, 0);
    const o2Pos = new THREE.Vector3(-0.4, 0.7, 0);
    const o3Pos = new THREE.Vector3(-0.4, -0.7, 0);
    const hPos = new THREE.Vector3(1.6, 0, 0);
    
    const c = createAtom("C", cPos, false, "bicarbonate", i);
    const o1 = createAtom("O", o1Pos, false, "bicarbonate", i+10);
    const o2 = createAtom("O", o2Pos, false, "bicarbonate", i+20);
    const o3 = createAtom("O", o3Pos, false, "bicarbonate", i+30);
    const h = createAtom("H", hPos, false, "bicarbonate", i+40);
    
    const cToO1 = createBond(cPos, o1Pos, "single", "bicarbonate", "C", "O", i);
    const cToO2 = createBond(cPos, o2Pos, "single", "bicarbonate", "C", "O", i+10);
    const cToO3 = createBond(cPos, o3Pos, "double", "bicarbonate", "C", "O", i+20);
    const o1ToH = createBond(o1Pos, hPos, "single", "bicarbonate", "O", "H", i+30);
    
    bicarb.add(c);
    bicarb.add(o1);
    bicarb.add(o2);
    bicarb.add(o3);
    bicarb.add(h);
    bicarb.add(cToO1);
    bicarb.add(cToO2);
    bicarb.add(cToO3);
    bicarb.add(o1ToH);
    
    // Scale to appropriate size
    bicarb.scale.set(0.7, 0.7, 0.7);
    
    // Random rotation
    bicarb.rotation.x = Math.random() * Math.PI * 2;
    bicarb.rotation.y = Math.random() * Math.PI * 2;
    bicarb.rotation.z = Math.random() * Math.PI * 2;
    
    molecules.stomach.group.add(bicarb);
  }
  
  // 4. Add potassium ions (K+) important in gastric fluid
  for (let i = 0; i < 6; i++) {
    // Random position within stomach
    const radius = 15 + Math.random() * 20;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.sin(phi) * Math.sin(theta);
    const z = radius * Math.cos(phi);
    
    const k = createAtom("K", new THREE.Vector3(x, y, z), false, "potassium", i);
    molecules.stomach.group.add(k);
  }
  
  // Add the stomach to the scene
  // Already added to the scene above

  // Initially hide the stomach - it will be shown at the appropriate step
  molecules.stomach.visible = false;
  molecules.stomach.group.visible = false;

  // create initial sodium nitrite with enhanced visual importance
  // Use the group property already created at the beginning of the function
  // Don't overwrite the entire object structure
  molecules.sodiumNitrite.group = new THREE.Group();
  molecules.sodiumNitrite.group.name = "sodiumNitrite";

  // More accurate geometry for nitrite ion based on molecular modeling data
  // N-O bond length ~1.24Å, O-N-O angle ~115°
  const naPos = new THREE.Vector3(-3.5, 0, 0); // Increased spacing to better show ionic nature
  const nPos = new THREE.Vector3(0, 0, 0);
  
  // More accurate bond angle (115° instead of arbitrary positions)
  const angle = 115 * (Math.PI / 180); // Convert degrees to radians
  const bondLength = 1.24; // Approximate N-O bond length in angstroms
  const scaleFactor = 2.2; // Increased scale factor for better visibility
  
  // Calculate oxygen positions based on accurate molecular geometry
  const o1Pos = new THREE.Vector3(
    scaleFactor * bondLength * Math.cos(angle/2),
    scaleFactor * bondLength * Math.sin(angle/2),
    0
  );
  
  const o2Pos = new THREE.Vector3(
    scaleFactor * bondLength * Math.cos(angle/2),
    -scaleFactor * bondLength * Math.sin(angle/2),
    0
  );

  // Create atoms with enhanced visual properties
  const na = createAtom("Na", naPos, true, "sodiumNitrite", 0);
  const n = createAtom("N", nPos, true, "sodiumNitrite", 1);
  const o1 = createAtom("O", o1Pos, true, "sodiumNitrite", 2);
  const o2 = createAtom("O", o2Pos, true, "sodiumNitrite", 3);
  
  // Add subtle glow to the nitrite group to emphasize it as the focus
  n.children[0].material.emissive = new THREE.Color(0x221111);
  n.children[0].material.emissiveIntensity = 0.2;
  
  o1.children[0].material.emissive = new THREE.Color(0x330000);
  o1.children[0].material.emissiveIntensity = 0.15;
  
  o2.children[0].material.emissive = new THREE.Color(0x330000);
  o2.children[0].material.emissiveIntensity = 0.15;

  // These atoms have already been added to the group in the updated code below
  // Removing these redundant lines to avoid duplication

  // add ionic bond between Na and nitrite group (dashed bond to represent ionic nature)
  const naToBond = createBond(
    naPos,
    nPos,
    "dashed",
    "sodiumNitrite",
    "Na",
    "N",
    0
  );

  // add bonds between N and oxygen atoms (double bond to one O, single to other)
  const nToO1Bond = createBond(
    nPos,
    o1Pos,
    "double",
    "sodiumNitrite",
    "N",
    "O",
    1
  );
  const nToO2Bond = createBond(
    nPos,
    o2Pos,
    "single",
    "sodiumNitrite",
    "N",
    "O",
    2
  );

  molecules.sodiumNitrite.group.add(na);
  molecules.sodiumNitrite.group.add(n);
  molecules.sodiumNitrite.group.add(o1);
  molecules.sodiumNitrite.group.add(o2);
  molecules.sodiumNitrite.group.add(naToBond);
  molecules.sodiumNitrite.group.add(nToO1Bond);
  molecules.sodiumNitrite.group.add(nToO2Bond);

  // Make sure we're using the group structure consistently
  scene.add(molecules.sodiumNitrite.group);
  molecules.sodiumNitrite.group.visible = true;

  // create nitrous acid (HNO₂)
  // Use the group property already created at the beginning of the function
  molecules.nitrousAcid.group = new THREE.Group();
  molecules.nitrousAcid.group.name = "nitrousAcid";

  // Increased spacing for better focus on nitrite/nitrous acid
  const naPos2 = new THREE.Vector3(-7, 0, 0);
  const nPos2 = new THREE.Vector3(0, 0, 0);
  const o1Pos2 = new THREE.Vector3(1.2, 1.8, 0);
  const o2Pos2 = new THREE.Vector3(1.2, -1.8, 0);
  const hPos = new THREE.Vector3(2.4, -1.8, 0);

  const na2 = createAtom("Na", naPos2, true, "nitrousAcid", 0);
  const n2 = createAtom("N", nPos2, true, "nitrousAcid", 1);
  const o3 = createAtom("O", o1Pos2, true, "nitrousAcid", 2);
  const o4 = createAtom("O", o2Pos2, true, "nitrousAcid", 3);
  const h = createAtom("H", hPos, true, "nitrousAcid", 4);

  molecules.nitrousAcid.group.add(na2);
  molecules.nitrousAcid.group.add(n2);
  molecules.nitrousAcid.group.add(o3);
  molecules.nitrousAcid.group.add(o4);
  molecules.nitrousAcid.group.add(h);

  // add bonds with appropriate types
  const nToO1Bond2 = createBond(
    nPos2,
    o1Pos2,
    "double",
    "nitrousAcid",
    "N",
    "O",
    0
  );
  const nToO2Bond2 = createBond(
    nPos2,
    o2Pos2,
    "single",
    "nitrousAcid",
    "N",
    "O",
    1
  );
  const oToHBond = createBond(
    o2Pos2,
    hPos,
    "single",
    "nitrousAcid",
    "O",
    "H",
    2
  );

  molecules.nitrousAcid.group.add(nToO1Bond2);
  molecules.nitrousAcid.group.add(nToO2Bond2);
  molecules.nitrousAcid.group.add(oToHBond);

  scene.add(molecules.nitrousAcid.group);
  molecules.nitrousAcid.group.visible = false;

  // create nitrosonium ion (NO⁺) and OH⁻
  // Use the group property already created at the beginning of the function
  molecules.decomposed.group = new THREE.Group();
  molecules.decomposed.group.name = "decomposed";

  // Increased spacing for better visibility of key components
  const nPos3 = new THREE.Vector3(-1.5, 0, 0);
  const oPos3 = new THREE.Vector3(0, 1.8, 0);
  const oHPos = new THREE.Vector3(5, -1.5, 0);
  const hPos2 = new THREE.Vector3(5, 0, 0);

  const n3 = createAtom("N", nPos3, true, "decomposed", 0);
  const o5 = createAtom("O", oPos3, true, "decomposed", 1);
  const o6 = createAtom("O", oHPos, true, "decomposed", 2);
  const h2 = createAtom("H", hPos2, true, "decomposed", 3);

  molecules.decomposed.group.add(n3);
  molecules.decomposed.group.add(o5);
  molecules.decomposed.group.add(o6);
  molecules.decomposed.group.add(h2);

  // add bonds with triple bond for nitrosonium ion to show the stronger bond
  const nToOBond = createBond(
    nPos3,
    oPos3,
    "triple",
    "decomposed",
    "N",
    "O",
    0
  );
  const oToHBond2 = createBond(
    oHPos,
    hPos2,
    "single",
    "decomposed",
    "O",
    "H",
    1
  );

  molecules.decomposed.group.add(nToOBond);
  molecules.decomposed.group.add(oToHBond2);

  // add charge indicators
  addChargeIndicator(n3, "+");
  addChargeIndicator(o6, "-");

  scene.add(molecules.decomposed.group);
  molecules.decomposed.group.visible = false;

  // create nitrosamine
  // Use the group property already created at the beginning of the function
  molecules.nitrosamine.group = new THREE.Group();
  molecules.nitrosamine.group.name = "nitrosamine";

  // positions for the protein part - increased spacing
  const c1Pos = new THREE.Vector3(-4.5, 0, 0);
  const c2Pos = new THREE.Vector3(-4.5, 3, 0);
  const nAminPos = new THREE.Vector3(-2.3, 1.5, 0);

  // positions for the NO part - better spacing for focus
  const nNitroPos = new THREE.Vector3(0, 1.5, 0);
  const oNitroPos = new THREE.Vector3(1.5, 3, 0);

  const c1 = createAtom("C", c1Pos, true, "nitrosamine", 0);
  const c2 = createAtom("C", c2Pos, true, "nitrosamine", 1);
  const nAmin = createAtom("N", nAminPos, true, "nitrosamine", 2);
  const nNitro = createAtom("N", nNitroPos, true, "nitrosamine", 3);
  const oNitro = createAtom("O", oNitroPos, true, "nitrosamine", 4);

  molecules.nitrosamine.group.add(c1);
  molecules.nitrosamine.group.add(c2);
  molecules.nitrosamine.group.add(nAmin);
  molecules.nitrosamine.group.add(nNitro);
  molecules.nitrosamine.group.add(oNitro);

  // add bonds with appropriate types
  const c1ToNBond = createBond(
    c1Pos,
    nAminPos,
    "single",
    "nitrosamine",
    "C",
    "N",
    0
  );
  const c2ToNBond = createBond(
    c2Pos,
    nAminPos,
    "single",
    "nitrosamine",
    "C",
    "N",
    1
  );
  const nToNBond = createBond(
    nAminPos,
    nNitroPos,
    "single",
    "nitrosamine",
    "N",
    "N",
    2
  );
  const nToOBond2 = createBond(
    nNitroPos,
    oNitroPos,
    "double",
    "nitrosamine",
    "N",
    "O",
    3
  );

  molecules.nitrosamine.group.add(c1ToNBond);
  molecules.nitrosamine.group.add(c2ToNBond);
  molecules.nitrosamine.group.add(nToNBond);
  molecules.nitrosamine.group.add(nToOBond2);

  scene.add(molecules.nitrosamine.group);
  molecules.nitrosamine.group.visible = false;

  // create realistic protein environment (representing meat proteins in digestive tract)
  molecules.protein = { group: new THREE.Group(), visible: false };
  molecules.protein.group.name = "protein";
  
  // Create a more realistic protein structure resembling myoglobin/hemoglobin (common meat proteins)
  // Alpha helices and beta sheets represented in a globular protein fold
  
  // Create amino acid positions in a helical pattern (alpha helix)
  const aminoAcids = [];
  const helixRadius = 2.5;
  const helixTurns = 3;
  const aminoAcidsPerTurn = 5;
  const helixPitch = 1.5;
  const totalAminoAcids = helixTurns * aminoAcidsPerTurn;
  
  // Create amino acid positions in a helical pattern
  for (let i = 0; i < totalAminoAcids; i++) {
    const angle = (i * 2 * Math.PI) / aminoAcidsPerTurn;
    const x = helixRadius * Math.cos(angle);
    const y = (i * helixPitch) / aminoAcidsPerTurn - 5; // Centered vertically
    const z = helixRadius * Math.sin(angle);
    
    const position = new THREE.Vector3(x, y, z);
    aminoAcids.push(position);
  }
  
  // Create amino acid representation (carbon alpha positions)
  for (let i = 0; i < aminoAcids.length; i++) {
    // Use different atoms for different amino acids to show variety
    let atomType = "C";
    let labelShown = false;
    
    // Make secondary amine positions (every 5th position) highlighted
    if (i % 5 === 0) {
      atomType = "N";
      labelShown = true;
    }
    
    const atom = createAtom(atomType, aminoAcids[i], labelShown, "protein", i);
    molecules.protein.group.add(atom);
    
    // Connect amino acids with bonds
    if (i > 0) {
      const direction = new THREE.Vector3().subVectors(aminoAcids[i], aminoAcids[i-1]);
      const distance = direction.length();
      
      const bond = createBond(
        aminoAcids[i-1],
        aminoAcids[i],
        "single",
        "protein",
        i % 5 === 0 ? "N" : "C",
        (i-1) % 5 === 0 ? "N" : "C"
      );
      molecules.protein.group.add(bond);
    }
  }
  
  // Create beta sheet structure (second part of protein)
  const betaSheetStart = new THREE.Vector3(-4, 0, 3);
  const betaStrandLength = 4;
  const betaStrands = 3;
  const betaStrandSpacing = 1.5;
  
  for (let strand = 0; strand < betaStrands; strand++) {
    const strandOffset = new THREE.Vector3(0, 0, strand * betaStrandSpacing);
    const strandStart = new THREE.Vector3().addVectors(betaSheetStart, strandOffset);
    
    const strandAtoms = [];
    
    // Create atoms for this strand
    for (let i = 0; i < betaStrandLength; i++) {
      const position = new THREE.Vector3(
        strandStart.x + i * 1.5, 
        strandStart.y + (strand % 2 === 0 ? 0 : 0.5), // Alternating strands slightly offset
        strandStart.z
      );
      
      let atomType = "C";
      let labelShown = false;
      
      // Add nitrogen positions (secondary amines) at specific positions
      if (i === 1 || i === betaStrandLength - 1) {
        atomType = "N";
        labelShown = true;
      }
      
      const atom = createAtom(atomType, position, labelShown, "protein", totalAminoAcids + strand * betaStrandLength + i);
      molecules.protein.group.add(atom);
      strandAtoms.push({
        position: position,
        type: atomType
      });
      
      // Create bonds within the strand
      if (i > 0) {
        const prevAtom = strandAtoms[i-1];
        const bond = createBond(
          prevAtom.position,
          position,
          "single",
          "protein",
          prevAtom.type,
          atomType
        );
        molecules.protein.group.add(bond);
      }
    }
  }
  
  // Position the protein appropriately
  molecules.protein.group.position.set(-8, 0, 2);
  
  // Add the protein structure to the scene
  scene.add(molecules.protein.group);
  
  // Initially hide it - it will be shown at the appropriate step
  molecules.protein.visible = false;
  molecules.protein.group.visible = false;
  
  // Function to create hydrogen ions
  function createHydrogenIons(count) {
    const hIons = [];
    
    for (let i = 0; i < count; i++) {
      // Distribute H+ ions in a spherical pattern
      const radius = 15; // Distribution radius
      const phi = Math.random() * Math.PI;
      const theta = Math.random() * 2 * Math.PI;
      
      // Convert spherical to cartesian coordinates
      const position = new THREE.Vector3(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta)
      );
      
      const hIon = createAtom(
        "H",
        position,
        true,
        "stomach",
        i
      );
      
      // Make H+ ions subtly visible but not distracting from main reaction
      const ionScale = 0.9; // Slightly smaller to be less visually dominant
      hIon.children[0].scale.set(ionScale, ionScale, ionScale);
      
      // Make H+ ions slightly translucent so they don't obstruct the view
      hIon.children[0].material.transparent = true;
      hIon.children[0].material.opacity = 0.8;
      
      molecules.stomach.group.add(hIon);
      hIons.push(hIon);
    }
    
    return hIons;
  }
  
  // Create hydrogen ions
  createHydrogenIons(15);
} // End of createMolecules function

// add HCl molecules to represent stomach acid
function createHClMolecules(count) {
  // Track existing positions to prevent clumping
  const occupiedPositions = [];
  const minDistanceBetweenMolecules = 2.5; // Minimum distance between molecules to prevent clumping
  
  // Create a wider distribution that avoids the center area completely
  // This ensures no large clump of atoms and better spacing
  const zones = [
    { min: 18, max: 40, percent: 0.7 }, // Far from center (70% of molecules) - even further out
    { min: 12, max: 18, percent: 0.3 },  // Middle zone (30% of molecules) - no molecules near center
  ];
  
  // Reduce the overall opacity and size of stomach environment molecules
  const stomachMoleculeOpacity = 0.35; // Even more transparent
  const scaleFactor = 0.65; // Smaller size
  
  let positioned = 0;
  
  // Helper function to check if a position is too close to existing molecules
  const isTooClose = (pos) => {
    return occupiedPositions.some(existing => {
      const distance = pos.distanceTo(existing);
      return distance < minDistanceBetweenMolecules;
    });
  };
  
  // Place molecules in a more distributed pattern
  for (const zone of zones) {
    const zoneCount = Math.floor(count * zone.percent);
    let attempts = 0;
    let placedInZone = 0;
    
    // Try to place molecules with proper spacing
    while (placedInZone < zoneCount && attempts < zoneCount * 10) {
      attempts++;
      
      // Use polar coordinates for better distribution
      const radius = zone.min + Math.random() * (zone.max - zone.min);
      const theta = Math.random() * Math.PI * 2;
      
      // Avoid the central area completely by biasing towards the outer sphere
      // This creates more of a shell-like distribution
      const phi = Math.acos(1 - 2 * Math.random());
      
      const position = new THREE.Vector3(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi) + (Math.random() * 6 - 3), // Add slight vertical variability
        radius * Math.sin(phi) * Math.sin(theta)
      );
      
      // Check if position is too close to existing molecules
      if (!isTooClose(position)) {
        const hcl = createHClMolecule(position);
        
        // Make stomach environment molecules more transparent and smaller
        hcl.traverse(obj => {
          if (obj.material) {
            obj.material.transparent = true;
            obj.material.opacity = stomachMoleculeOpacity;
            // Scale down size significantly to reduce visual interference
            obj.scale.set(scaleFactor, scaleFactor, scaleFactor);
          }
        });
        
        // Randomly rotate each molecule for more natural appearance
        hcl.rotation.set(
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2
        );
        
        molecules.stomach.group.add(hcl);
        occupiedPositions.push(position.clone());
        positioned++;
        placedInZone++;
      }
    }
  }
  
  // Add a small number of water molecules and other gastric components
  // in a more distributed pattern to represent the realistic stomach environment
  const remainingCount = count - positioned;
  let attempts = 0;
  
  while (positioned < count && attempts < remainingCount * 5) {
    attempts++;
    
    // Ensure remaining molecules are far from the center
    const radius = 15 + Math.random() * 30; // Minimum radius of 15
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(1 - 2 * Math.random());
    
    const position = new THREE.Vector3(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi) + (Math.random() * 10 - 5), // More vertical spread
      radius * Math.sin(phi) * Math.sin(theta)
    );
    
    // Only place if not too close to other molecules
    if (!isTooClose(position)) {
      const hcl = createHClMolecule(position);
      
      // Make these even more transparent
      hcl.traverse(obj => {
        if (obj.material) {
          obj.material.transparent = true;
          obj.material.opacity = stomachMoleculeOpacity - 0.1; // Even more transparent
          obj.scale.set(scaleFactor, scaleFactor, scaleFactor);
        }
      });
      
      // Random rotation
      hcl.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      );
      
      molecules.stomach.add(hcl);
      occupiedPositions.push(position.clone());
      positioned++;
    }
  }
  
  console.log(`Created ${positioned} stomach environment molecules with better spacing`);
}

// Function to show a specific step in the visualization process with enhanced animations
function showStep(step) {
  // Validate step is within bounds
  if (step < 0 || step > totalSteps) return;
  
  console.log('showStep called for step:', step, 'current animation flag:', animationPlaying);
  
  // Reset animation flag - it may be stuck
  animationPlaying = true;
  
  // Add a safety timeout to prevent animations from getting stuck
  if (window.animationResetTimeout) {
    clearTimeout(window.animationResetTimeout);
  }
  
  // Safety mechanism: if animation gets stuck, reset after 10 seconds
  window.animationResetTimeout = setTimeout(() => {
    console.log('Animation safety timeout triggered - resetting animation flag');
    animationPlaying = false;
  }, 10000);
  
  // Create a master timeline for the entire transition
  // Create timestamp for debugging
const startTime = Date.now();
console.log(`Starting animation at ${startTime} for step ${step}`);

// Hide all molecules first to prevent showing final state too early
hideAllMolecules();

// Only show the starting molecules for each transition, not the end state
switch(step) {
  case 0:
    molecules.sodiumNitrite.visible = true;
    molecules.sodiumNitrite.group.visible = true;
    break;
  case 1:
    molecules.stomach.visible = true;
    molecules.stomach.group.visible = true;
    // For step 1, we start with sodiumNitrite and animate to nitrousAcid
    // nitrousAcid will be shown during the transition, not at the start
    if (currentStep === 0) {
      molecules.sodiumNitrite.visible = true;
    molecules.sodiumNitrite.group.visible = true;
    } else {
      molecules.nitrousAcid.visible = true;
      molecules.nitrousAcid.group.visible = true;
    }
    break;
  case 2:
    molecules.stomach.visible = true;
    molecules.stomach.group.visible = true;
    // For step 2, we start with nitrousAcid and animate to decomposed
    // decomposed will be shown during the transition, not at the start
    if (currentStep === 1) {
      molecules.nitrousAcid.visible = true;
      molecules.nitrousAcid.group.visible = true;
    } else {
      molecules.decomposed.visible = true;
      molecules.decomposed.group.visible = true;
    }
    break;
  case 3:
    molecules.stomach.visible = true;
    molecules.stomach.group.visible = true;
    // For step 3, we start with decomposed and animate to nitrosamine
    // protein and nitrosamine will be shown during the transition
    if (currentStep === 2) {
      molecules.decomposed.visible = true;
      molecules.decomposed.group.visible = true;
    } else {
      // Only show the protein when it's actually needed
      // This helps avoid visual clutter
      if (step === 3) {
        molecules.protein.visible = true;
        molecules.protein.group.visible = true;
      }
      molecules.nitrosamine.visible = true;
      molecules.nitrosamine.group.visible = true;
    }
    break;
}

// Create timeline with improved callbacks
const masterTimeline = gsap.timeline({
    onComplete: () => {
      console.log('Animation complete, setting animationPlaying to false');
      animationPlaying = false;
      // Clear the safety timeout since animation completed properly
      if (window.animationResetTimeout) {
        clearTimeout(window.animationResetTimeout);
      }
      // Update data panels after animation completes
      const dataKey = getDataKeyForStep(step);
      updateMoleculeData(dataKey);
      updateScientificContext(step);
      
      // Update current step AFTER animation is complete
      currentStep = step;
    }
  });
  
  // Clear any previous transition effects
  while (transitionEffects.children.length > 0) {
    const child = transitionEffects.children[0];
    if (child.geometry) child.geometry.dispose();
    if (child.material) child.material.dispose();
    transitionEffects.remove(child);
  }
  
  // Make sure we're not hiding molecules before showing new ones
  // This ensures transitions are visible
  // hideAllMolecules(); - Commented out to fix transition visibility
  
  // Update button states based on current step
  updateNavigationButtons(step);

  // Configure molecule visibility and transitions based on current step
  if (currentStep !== step) {
    // Transition from one state to another
    if (currentStep === 0 && step === 1) {
      // Transition: Sodium nitrite entering stomach acid with realistic dissociation
      molecules.stomach.visible = true;
    molecules.stomach.group.visible = true;
      molecules.sodiumNitrite.visible = true;
    molecules.sodiumNitrite.group.visible = true;
      
      // Create stomach acid particles for a more immersive environment
      const acidParticles = createParticleSystem(
        new THREE.Vector3(0, 0, 0),
        0x88ff99,  // Subtle greenish for acid
        50,        // More particles for rich environment
        10,        // Wider spread
        0.08       // Smaller particles
      );
      transitionEffects.add(acidParticles);
      
      // Animate stomach acid particles
      acidParticles.children.forEach(particle => {
        const floatDuration = 3 + Math.random() * 2;
        masterTimeline.to(particle.position, {
          x: particle.position.x + (Math.random() - 0.5) * 2,
          y: particle.position.y + (Math.random() - 0.5) * 2,
          z: particle.position.z + (Math.random() - 0.5) * 2,
          duration: floatDuration,
          ease: "sine.inOut",
          repeat: 1,
          yoyo: true
        }, 0);
      });
      
      // First animate sodium nitrite moving into stomach acid environment with more fluid motion
      masterTimeline.to(molecules.sodiumNitrite.position, {
        x: 0, y: 0, z: 0,
        duration: 1.8,
        ease: "power3.out"
      }, 0);
      
      // Add smooth camera movement to follow the molecule
      masterTimeline.add(smoothCameraTransition(
        new THREE.Vector3(0, 0, 0),
        2,
        18
      ), 0.3);
      
      // Show realistic dissociation of Na+ from NO2- in acidic environment after entry
      masterTimeline.add(() => {
        // Create dissociation particles
        const dissociationParticles = createParticleSystem(
          molecules.sodiumNitrite.position.clone(),
          0x6699ff,  // Blue for ionic dissociation
          25,        // Enough particles to show reaction
          2,         // Localized effect
          0.15       // Slightly larger particles
        );
        transitionEffects.add(dissociationParticles);
        
        // Animate dissociation particles outward
        dissociationParticles.children.forEach(particle => {
          masterTimeline.to(particle.position, {
            x: particle.position.x + particle.userData.velocity.x * 15,
            y: particle.position.y + particle.userData.velocity.y * 15,
            z: particle.position.z + particle.userData.velocity.z * 15,
            duration: 1.2,
            ease: "power2.out"
          }, 1.8);
          
          masterTimeline.to(particle.material, {
            opacity: 0,
            duration: 0.8,
            ease: "power2.in"
          }, 2.2);
        });
        
        // Get the sodium atom and add glow effect
        const sodiumAtom = molecules.sodiumNitrite.children.find(c => c.userData.atomType === "Na");
        if (sodiumAtom && sodiumAtom.children[0]) {
          createGlowEffect(sodiumAtom, atomColors.NaHighlight || 0xffaa33, 0.6);
        }
      }, 1.5);
      
      // Animate sodium separating from nitrite with beautiful interpolation
      const sodiumAtom = molecules.sodiumNitrite.children.find(c => c.userData.atomType === "Na");
      const targetPosition = new THREE.Vector3(-4, 1, 2);
      
      masterTimeline.to(sodiumAtom.position, {
        x: targetPosition.x,
        y: targetPosition.y,
        z: targetPosition.z,
        duration: 1.5,
        ease: "elastic.out(1, 0.8)", // More dramatic elastic motion for ionic separation
      }, 2.0);
      
      // Show H+ approaching NO2- (protonation) with improved animation
      masterTimeline.add(() => {
        const tempPosition = new THREE.Vector3(5, 0, -3);
        const proton = createAtom(
          "H",
          tempPosition, // Start position away from nitrite
          true,
          "temp",
          0
        );
        addChargeIndicator(proton, "+");
        transitionEffects.add(proton);
        
        // Create proton trail particles
        const protonTrail = createParticleSystem(
          tempPosition.clone(),
          0xff6666, // Reddish for acid proton
          15,       // Fewer particles for trail
          1,        // Tight spread
          0.05      // Small particles
        );
        transitionEffects.add(protonTrail);
        
        // Animate proton trail along with proton
        masterTimeline.to(proton.position, {
          x: 1.5, // Position near oxygen
          y: -1.2,
          z: 0,
          duration: 1.8,
          ease: "power2.inOut",
          onUpdate: () => {
            // Update trail particles to follow proton
            protonTrail.position.copy(proton.position);
          }
        }, 3.0);
        
        // Fade out trail gradually
        protonTrail.children.forEach(particle => {
          masterTimeline.to(particle.material, {
            opacity: 0,
            duration: 1.0,
            ease: "power1.in"
          }, 3.8);
        });
      }, 2.8);
      
      // Final transition to nitrous acid with beautiful morphing effect
      masterTimeline.add(() => {
        // Add reaction flash effect
        const reactionFlash = createParticleSystem(
          new THREE.Vector3(1, -1, 0),
          0xffdd44, // Warm yellow for reaction
          35,       // More particles for dramatic effect
          3,        // Wider spread
          0.18      // Larger particles
        );
        transitionEffects.add(reactionFlash);
        
        // Expand and fade reaction particles
        reactionFlash.children.forEach(particle => {
          masterTimeline.to(particle.position, {
            x: particle.position.x + particle.userData.velocity.x * 25,
            y: particle.position.y + particle.userData.velocity.y * 25,
            z: particle.position.z + particle.userData.velocity.z * 25,
            duration: 0.9,
            ease: "power3.out"
          }, 4.8);
          
          masterTimeline.to(particle.material, {
            opacity: 0,
            duration: 0.8,
            ease: "power2.in"
          }, 5.0);
        });
        
        // Use transition function for smooth molecule swap
        const transitionTL = transitionMolecules(
          molecules.sodiumNitrite,
          molecules.nitrousAcid,
          1.2,
          false // No additional particles needed since we have our custom ones
        );
        
        masterTimeline.add(transitionTL, 5.2);
      }, 4.8);
    } 
    else if (currentStep === 1 && step === 2) {
      // Transition: Nitrous acid decomposing to nitrosonium ion
      molecules.stomach.visible = true;
    molecules.stomach.group.visible = true;
      molecules.nitrousAcid.visible = true;
      molecules.nitrousAcid.group.visible = true;
      
      // Add ripple effect for acidic environment
      const acidRipples = createParticleSystem(
        new THREE.Vector3(0, 0, 0),
        0xaaff88,  // Acid green
        40,        // More ripple particles
        8,         // Wide spread
        0.06       // Smaller particles for bubbling effect
      );
      transitionEffects.add(acidRipples);
      
      // Animate acid ripples to show chemical reaction environment
      acidRipples.children.forEach(particle => {
        // Random starting delays for organic effect
        const startDelay = Math.random() * 0.5;
        
        // Bubble-like movement
        masterTimeline.to(particle.position, {
          y: particle.position.y + (1 + Math.random() * 2),
          x: particle.position.x + (Math.random() - 0.5) * 1.5,
          z: particle.position.z + (Math.random() - 0.5) * 1.5,
          duration: 1.8 + Math.random() * 1.2,
          ease: "sine.inOut",
          delay: startDelay
        }, 0);
        
        // Fade out gradually
        masterTimeline.to(particle.material, {
          opacity: 0,
          duration: 1.2,
          delay: startDelay + 0.8,
          ease: "power1.in"
        }, 0);
      });
      
      // Smoother camera transition for this step
      masterTimeline.add(smoothCameraTransition(
        molecules.nitrousAcid.position.clone(),
        1.5,
        16
      ), 0.2);
      
      // Add heat distortion effect on nitrous acid
      masterTimeline.add(() => {
        // Create heat distortion effect with glowing atoms
        molecules.nitrousAcid.children.forEach(child => {
          if (child.userData && child.userData.atomType) {
            // Apply stronger glow to oxygen atoms - representing the decomposition
            if (child.userData.atomType === "O") {
              createGlowEffect(child, 0xff8866, 0.8);
            } else {
              createGlowEffect(child, 0xffaa44, 0.4);
            }
          }
        });
        
        // Add decomposition particles
        const decompositionParticles = createParticleSystem(
          molecules.nitrousAcid.position.clone(),
          0xff6644,  // Orange-red for decomposition
          30,        // Good number of particles
          2.5,       // Focused on molecule
          0.12       // Medium particles
        );
        transitionEffects.add(decompositionParticles);
        
        // Expand particles outward with beautiful pulsing effect
        decompositionParticles.children.forEach(particle => {
          // Calculate a unique outward direction vector for each particle
          const direction = particle.position.clone()(molecules.nitrousAcid.position).normalize();
          const distance = 2 + Math.random() * 4;
          
          masterTimeline.to(particle.position, {
            x: particle.position.x + direction.x * distance,
            y: particle.position.y + direction.y * distance,
            z: particle.position.z + direction.z * distance,
            duration: 1.5,
            ease: "power2.out"
          }, 1.8);
          
          // Pulsing size effect
          masterTimeline.to(particle.scale, {
            x: 1.8, y: 1.8, z: 1.8,
            duration: 0.8,
            ease: "power1.inOut",
            yoyo: true,
            repeat: 1
          }, 1.8);
          
          // Fade out
          masterTimeline.to(particle.material, {
            opacity: 0,
            duration: 0.7,
            ease: "power2.in"
          }, 3.0);
        });
      }, 1.0);
      
      // Use our transitionMolecules function for smooth morphing between states
      masterTimeline.add(() => {
        // Transition from nitrous acid to decomposed state
        const transitionTL = transitionMolecules(
          molecules.nitrousAcid,
          molecules.decomposed,
          1.5,
          false // Using custom particles instead
        );
        masterTimeline.add(transitionTL, 3.2);
      }, 2.8);
    } 
    else if (currentStep === 2 && step === 3) {
      // Transition: Nitrosonium ion approaching protein with secondary amines
      molecules.stomach.visible = true;
    molecules.stomach.group.visible = true;
      molecules.decomposed.visible = true;
      molecules.decomposed.group.visible = true;
      
      // Add protein environment particles
      const proteinEnvironment = createParticleSystem(
        new THREE.Vector3(-5, 0, 0), // Protein area 
        0x99ccff, // Soft blue for cellular environment
        60,       // More particles for rich environment
        10,       // Wide spread
        0.1       // Medium particles
      );
      transitionEffects.add(proteinEnvironment);
      
      // Animate protein environment particles with gentle waves
      proteinEnvironment.children.forEach(particle => {
        // Create gentle wave motion
        masterTimeline.to(particle.position, {
          x: particle.position.x + (Math.random() - 0.5) * 2,
          y: particle.position.y + (Math.random() - 0.5) * 2,
          z: particle.position.z + (Math.random() - 0.5) * 2,
          duration: 4,
          ease: "sine.inOut",
          repeat: 1,
          yoyo: true
        }, 0);
      });
      
      // Show protein environment appearing with beautiful transition
      molecules.protein.visible = true;
      molecules.protein.scale.set(0.01, 0.01, 0.01); // Start even smaller for more dramatic reveal
      
      // Protein appearance with dramatic scaling and material transition
      masterTimeline.to(molecules.protein.scale, {
        x: 1, y: 1, z: 1,
        duration: 2.2,
        ease: "elastic.out(1, 0.5)" // More dramatic elastic motion
      }, 1.0);
      
      // Add beautiful glow to protein as it appears
      masterTimeline.add(() => {
        // Highlight potential binding sites on protein
        molecules.protein.traverse(child => {
          if (child.userData && child.userData.atomType === "N") {
            // Highlight nitrogen atoms as reactive sites
            createGlowEffect(child, 0x88aaff, 0.7);
          }
        });
      }, 2.2);
      
      // Move nitrosonium ion toward amine group with fluid motion and particle trail
      // Create a beautiful path for the molecule with emission particles
      masterTimeline.add(() => {
        // Create nitrosonium trail effect
        const trail = createParticleSystem(
          molecules.decomposed.position.clone(),
          0xff8866, // Warm color for reactive species
          25,      // Good number of particles
          1.5,     // Tight spread
          0.08     // Small particles
        );
        transitionEffects.add(trail);
        
        // Create curve points for beautiful arc motion toward protein
        const startPos = molecules.decomposed.position.clone();
        const endPos = new THREE.Vector3(-2, 0.5, 0);
        const controlPoint = new THREE.Vector3(
          (startPos.x + endPos.x) * 0.5,
          (startPos.y + endPos.y) * 0.5 + 3, // Arc upward
          (startPos.z + endPos.z) * 0.5
        );
        
        // Follow molecule with camera
        masterTimeline.add(smoothCameraTransition(
          molecules.decomposed.position.clone(),
          1.8,
          15
        ), 2.8);
        
        // Animate along curve with trail following
        let progress = { value: 0 };
        masterTimeline.to(progress, {
          value: 1,
          duration: 2.5,
          ease: "power2.inOut",
          onUpdate: () => {
            // Calculate position along quadratic curve
            const t = progress.value;
            const pos = new THREE.Vector3();
            pos.x = Math.pow(1-t, 2) * startPos.x + 2 * (1-t) * t * controlPoint.x + Math.pow(t, 2) * endPos.x;
            pos.y = Math.pow(1-t, 2) * startPos.y + 2 * (1-t) * t * controlPoint.y + Math.pow(t, 2) * endPos.y;
            pos.z = Math.pow(1-t, 2) * startPos.z + 2 * (1-t) * t * controlPoint.z + Math.pow(t, 2) * endPos.z;
            
            // Update molecule position
            molecules.decomposed.position.copy(pos);
            
            // Update trail position
            trail.position.copy(pos);
          }
        }, 3.0);
      }, 2.5);
      
      // Final reaction with beautiful particle explosion
      masterTimeline.add(() => {
        // Create reaction flash
        const reactionFlash = createParticleSystem(
          new THREE.Vector3(-2, 0.5, 0),
          0xffcc44, // Bright reaction color
          45,       // Lots of particles
          4,        // Wide spread
          0.15      // Medium-large particles
        );
        transitionEffects.add(reactionFlash);
        
        // Explosive expansion of particles
        reactionFlash.children.forEach(particle => {
          masterTimeline.to(particle.position, {
            x: particle.position.x + particle.userData.velocity.x * 30,
            y: particle.position.y + particle.userData.velocity.y * 30,
            z: particle.position.z + particle.userData.velocity.z * 30,
            duration: 1.2,
            ease: "power3.out"
          }, 5.8);
          
          // Fade out particles
          masterTimeline.to(particle.material, {
            opacity: 0,
            duration: 0.9,
            ease: "power2.in"
          }, 6.1);
        });
        
        // Transition to final nitrosamine product
        const transitionTL = transitionMolecules(
          molecules.decomposed,
          molecules.nitrosamine,
          1.5,
          false
        );
        masterTimeline.add(transitionTL, 6.0);
      }, 5.7);
    }
    else if (currentStep === 3 && step === 0) {
      // Reset back to initial state with a beautiful camera zoom out and fade effect
      
      // Add transition particles for the reset
      const resetParticles = createParticleSystem(
        new THREE.Vector3(0, 0, 0),
        0xffffff, // White particles
        80,       // Many particles
        15,       // Very wide spread
        0.1       // Medium particles
      );
      transitionEffects.add(resetParticles);
      
      // Fade out all visible molecules
      Object.keys(molecules).forEach(key => {
        if (molecules[key] && molecules[key].visible) {
          molecules[key].traverse(object => {
            if (object.material) {
              object.material.transparent = true;
              masterTimeline.to(object.material, {
                opacity: 0,
                duration: 1.5,
                ease: "power2.inOut"
              }, 0);
            }
          });
        }
      });
      
      // Camera transition to zoomed out view
      masterTimeline.to(camera.position, {
        x: 0, y: 5, z: 30,
        duration: 2.5,
        ease: "power2.inOut"
      }, 0);
      
      // Reset to original state
      masterTimeline.add(() => {
        // Hide all molecules
        hideAllMolecules();
        
        // Reset positions
        Object.keys(molecules).forEach(key => {
          if (molecules[key] && originalPositions[key]) {
            molecules[key].position.copy(originalPositions[key]);
          }
        });
        
        // Show only sodium nitrite
        molecules.sodiumNitrite.visible = true;
    molecules.sodiumNitrite.group.visible = true;
        
        // Reset material opacity
        Object.keys(molecules).forEach(key => {
          if (molecules[key]) {
            molecules[key].traverse(object => {
              if (object.material) {
                object.material.opacity = 1;
              }
            });
          }
        });
      }, 1.8);
    }
    else {
      // Direct state changes with smoother transitions for non-sequential jumps
      hideAllMolecules();
      
      // Add transition fade effect
      const transitionFade = createParticleSystem(
        new THREE.Vector3(0, 0, 0),
        0xffffff, // White particles
        50,       // Moderate number of particles
        10,       // Wide spread
        0.12      // Medium particles
      );
      transitionEffects.add(transitionFade);
      
      // Animate transition particles
      transitionFade.children.forEach(particle => {
        masterTimeline.to(particle.position, {
          x: particle.position.x + particle.userData.velocity.x * 15,
          y: particle.position.y + particle.userData.velocity.y * 15,
          z: particle.position.z + particle.userData.velocity.z * 15,
          duration: 1.5,
          ease: "power2.out"
        }, 0);
        
        masterTimeline.to(particle.material, {
          opacity: 0,
          duration: 1.2,
          ease: "power1.in"
        }, 0.3);
      });
      
      // Show appropriate molecules with fade-in effect
      masterTimeline.add(() => {
        if (step === 0) {
          molecules.sodiumNitrite.visible = true;
    molecules.sodiumNitrite.group.visible = true;
          molecules.sodiumNitrite.traverse(object => {
            if (object.material) {
              object.material.transparent = true;
              object.material.opacity = 0;
            }
          });
        } else if (step === 1) {
          molecules.stomach.visible = true;
    molecules.stomach.group.visible = true;
          molecules.nitrousAcid.visible = true;
      molecules.nitrousAcid.group.visible = true;
          [molecules.stomach, molecules.nitrousAcid].forEach(molecule => {
            molecule.traverse(object => {
              if (object.material) {
                object.material.transparent = true;
                object.material.opacity = 0;
              }
            });
          });
        } else if (step === 2) {
          molecules.stomach.visible = true;
    molecules.stomach.group.visible = true;
          molecules.decomposed.visible = true;
      molecules.decomposed.group.visible = true;
          [molecules.stomach, molecules.decomposed].forEach(molecule => {
            molecule.traverse(object => {
              if (object.material) {
                object.material.transparent = true;
                object.material.opacity = 0;
              }
            });
          });
        } else if (step === 3) {
          molecules.stomach.visible = true;
    molecules.stomach.group.visible = true;
          molecules.protein.visible = true;
        molecules.protein.group.visible = true;
          molecules.nitrosamine.visible = true;
      molecules.nitrosamine.group.visible = true;
          [molecules.stomach, molecules.protein, molecules.nitrosamine].forEach(molecule => {
            molecule.traverse(object => {
              if (object.material) {
                object.material.transparent = true;
                object.material.opacity = 0;
              }
            });
          });
        }
        
        // Fade in all visible molecules
        scene.traverse(object => {
          if (object.material && object.material.transparent && object.visible) {
            masterTimeline.to(object.material, {
              opacity: 1,
              duration: 1.5,
              ease: "power2.out"
            }, 1.0);
          }
        });
      }, 0.8);
      
      // Focus the camera on relevant molecules
      masterTimeline.add(() => {
        focusCameraOnCurrentMolecule(step);
      }, 1.0);
    }

    // Don't update current step here - it happens in the timeline callback
    // This line is handled in the timeline's onComplete callback
  } 
  else {
    // If we're just showing the same step again, do a simple reset
    const stepConfig = {
      0: () => { 
          molecules.sodiumNitrite.visible = true;
          molecules.sodiumNitrite.group.visible = true; 
        },
      1: () => {
        molecules.stomach.visible = true;
    molecules.stomach.group.visible = true;
        molecules.nitrousAcid.visible = true;
      molecules.nitrousAcid.group.visible = true;
      },
      2: () => {
        molecules.stomach.visible = true;
    molecules.stomach.group.visible = true;
        molecules.decomposed.visible = true;
      molecules.decomposed.group.visible = true;
      },
      3: () => {
        molecules.stomach.visible = true;
    molecules.stomach.group.visible = true;
        // Don't show the large clump of atoms (protein) as it's visually confusing
        // molecules.protein.visible = true;
        // molecules.protein.group.visible = true; 
        molecules.nitrosamine.visible = true;
      molecules.nitrosamine.group.visible = true;
      }
    };
    
    if (stepConfig[step]) {
      stepConfig[step]();
    }
    
    // Enhanced animation for redisplaying the same step
    // Add subtle molecule rotation for visual feedback
    const currentMolecule = {
      0: molecules.sodiumNitrite,
      1: molecules.nitrousAcid,
      2: molecules.decomposed,
      3: molecules.nitrosamine
    }[step];
    
    if (currentMolecule) {
      // Add a gentle pulsing effect for better visual feedback
      const originalScale = currentMolecule.scale.clone();
      
      masterTimeline.to(currentMolecule.scale, {
        x: originalScale.x * 1.1,
        y: originalScale.y * 1.1,
        z: originalScale.z * 1.1,
        duration: 0.4,
        ease: "power2.out"
      }, 0);
      
      masterTimeline.to(currentMolecule.scale, {
        x: originalScale.x,
        y: originalScale.y,
        z: originalScale.z,
        duration: 0.4,
        ease: "elastic.out(1, 0.5)"
      }, 0.4);
      
      // Add a gentle rotation
      const currentRotation = currentMolecule.rotation.clone();
      masterTimeline.to(currentMolecule.rotation, {
        y: currentRotation.y + Math.PI * 2,
        duration: 1.2,
        ease: "power2.inOut"
      }, 0);
    }
    
    // Camera focus for better visualization
    masterTimeline.add(() => {
      focusCameraOnCurrentMolecule(step);
    }, 0);
    
    // Short timeline for redisplaying the same step, but with nicer effects
    masterTimeline.duration(1.2);
  }

  // Update step title in UI - with enhanced step descriptions
  const stepTitles = [
    "Dietary Sodium Nitrite (Food Preservative)",
    "Gastric Acid Protonation to Nitrous Acid (Stomach Environment)",
    "Formation of Carcinogenic Nitrosonium Ion in Acidic Conditions", 
    "Reaction with Meat Proteins to Form Nitrosamine"
  ];
  
  // Always update the title for better user feedback
  if (document.querySelector(".step-title")) {
    const titleElement = document.querySelector(".step-title");
    
    // Animate the title change for better visual feedback
    gsap.to(titleElement, {
      opacity: 0,
      duration: 0.3,
      onComplete: () => {
        titleElement.textContent = stepTitles[step] || `Step ${step}`;
        gsap.to(titleElement, {
          opacity: 1,
          duration: 0.3
        });
      }
    });
  }
}

// Function to hide all molecules
function hideAllMolecules() {
  // Hide all molecule groups
  for (const key in molecules) {
    if (molecules.hasOwnProperty(key) && molecules[key]) {
      molecules[key].visible = false;
    }
  }
}

// Get the data key for a specific step
function getDataKeyForStep(step) {
  switch (step) {
    case 0:
      return "sodiumNitrite";
    case 1:
      return "nitrousAcid";
    case 2:
      return "decomposed";  // This is actually the nitrosonium ion in the code
    case 3:
      return "nitrosamine";
    case 4:
      return "nitrosamine";
    default:
      return "sodiumNitrite";
  }
}

// Focus camera on the current molecule
function focusCameraOnCurrentMolecule(step) {
  // Get the data key for the current step
  const dataKey = getDataKeyForStep(step);
  
  // Create a default target position
  let targetPosition = new THREE.Vector3(0, 0, 0);
  
  // Try to get accurate position from molecule if it exists
  if (molecules[dataKey] && molecules[dataKey].group) {
    // Use the molecule's position if available
    targetPosition.copy(molecules[dataKey].group.position);
    
    // Apply specific offset adjustments based on step
    if (step === 3) { // Nitrosamine step needs a specific offset
      targetPosition.add(new THREE.Vector3(-1, 1, 0));
    }
  } else {
    console.warn(`Molecule group for camera focus at step ${step} (${dataKey}) not found, using default position.`);
  }
  
  // Animate camera to focus on target
  gsap.to(controls.target, {
    x: targetPosition.x,
    y: targetPosition.y,
    z: targetPosition.z,
    duration: 1,
    ease: "power2.inOut",
    onUpdate: () => controls.update(),
  });
}

// Function to reset camera view to default position for current step
function resetCameraView() {
  // Get the current step's target position
  const lookAtTarget = new THREE.Vector3(0, 0, 0);
  const zoomDistance = isMobile() ? 18 : 15;
  
  // Determine which molecule to focus on based on current step - with safety checks
  const dataKey = getDataKeyForStep(currentStep);
  
  // Safely access molecule groups with proper error checking
  if (molecules[dataKey] && molecules[dataKey].group) {
    lookAtTarget.copy(molecules[dataKey].group.position);
  } else {
    console.warn(`Molecule group for step ${currentStep} (${dataKey}) not found, using default position.`);
    // Use a default position if the molecule doesn't exist
    lookAtTarget.set(0, 0, 0);
  }
  
  // Add a subtle shake animation to indicate reset
  const originalPos = camera.position.clone();
  
  // Quick subtle shake
  gsap.timeline()
    .to(camera.position, {
      x: originalPos.x + 0.2,
      y: originalPos.y - 0.2,
      duration: 0.1
    })
    .to(camera.position, {
      x: originalPos.x - 0.2,
      y: originalPos.y + 0.2,
      duration: 0.1
    })
    // Then smoothly move to the target position
    .to(controls.target, {
      x: lookAtTarget.x,
      y: lookAtTarget.y,
      z: lookAtTarget.z,
      duration: 1.0,
      ease: "power2.inOut"
    })
    .to(camera.position, {
      x: lookAtTarget.x,
      y: lookAtTarget.y,
      z: lookAtTarget.z + zoomDistance,
      duration: 1.0,
      ease: "power2.inOut"
    }, "<");
  
  // Reset camera rotation and controls
  controls.reset();
}

// Update molecular properties panel with scientific data in table format - more concise
function updateMoleculeData(dataKey) {
  const propertiesContainer = document.getElementById("molecular-properties");
  const data = SCIENTIFIC_DATA[dataKey];

  if (!data) {
    propertiesContainer.innerHTML = "<p>No data available</p>";
    return;
  }

  // Create a table for better readability
  let html = `
    <div class="overflow-x-auto">
      <table class="w-full text-left border-collapse">
        <tbody>
  `;

  // List of essential properties to show (in order)
  const essentialProps = [
    'formula',
    'molecular_weight',
    'role',
    'health_concerns',
    'properties',
    'formation',
    'reactivity',
    'mechanism',
    'carcinogenicity'
  ];
  
  // Filter to include only essential properties
  let displayedProps = [];
  
  // Ensure we don't display more than 4 properties to keep it concise
  for (const prop of essentialProps) {
    if (data[prop] && displayedProps.length < 3) {
      displayedProps.push([prop, data[prop]]);
    }
  }
  
  // Add formula as the most important property if it exists and isn't already included
  if (data['formula'] && !displayedProps.some(item => item[0] === 'formula')) {
    displayedProps.unshift(['formula', data['formula']]);
  }

  // Create formatted property rows for filtered properties
  for (const [key, value] of displayedProps) {
    const formattedKey = key
      .replace(/_/g, " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    html += `
      <tr class="border-b border-gray-700 border-opacity-50">
        <td class="py-1.5 pr-3 font-medium text-blue-300 whitespace-nowrap">${formattedKey}</td>
        <td class="py-1.5 text-gray-100">${value}</td>
      </tr>
    `;
  }
  
  html += `
        </tbody>
      </table>
    </div>
  `;
  
  propertiesContainer.innerHTML = html;
}

// Update scientific context information with concise content
function updateScientificContext(step) {
  const contextContainer = document.getElementById("context-content");

  if (!contextContainer) return;

  let html = "";

  // Concise content for each step with improved styling
  switch (step) {
    case 0:
      html = `
        <div class="bg-gray-800 bg-opacity-30 rounded-lg p-4 border border-gray-700 border-opacity-50">
          <h4 class="text-blue-300 font-medium mb-2">About Sodium Nitrite</h4>
          <p>Sodium nitrite (NaNO₂) is a food preservative used in processed meats to prevent bacterial growth and maintain color. When consumed, it can react in the acidic environment of the stomach to form potentially harmful compounds.</p>
        </div>
      `;
      break;
    case 1:
      html = `
        <div class="bg-gray-800 bg-opacity-30 rounded-lg p-4 border border-gray-700 border-opacity-50">
          <h4 class="text-blue-300 font-medium mb-2">Nitrous Acid Formation</h4>
          <p>In the acidic stomach environment, sodium nitrite reacts with stomach acid to form nitrous acid (HNO₂). This unstable intermediate is the first step in a chain of reactions that can lead to nitrosamine formation.</p>
        </div>
      `;
      break;
    case 2:
      html = `
        <div class="bg-gray-800 bg-opacity-30 rounded-lg p-4 border border-gray-700 border-opacity-50">
          <h4 class="text-blue-300 font-medium mb-2">Nitrosonium Ion</h4>
          <p>Nitrous acid breaks down to form the highly reactive nitrosonium ion (NO⁺), a strong nitrosating agent that can react with compounds in the digestive system, particularly secondary amines from protein breakdown.</p>
        </div>
      `;
      break;
    case 3:
      html = `
        <div class="bg-gray-800 bg-opacity-30 rounded-lg p-4 border border-gray-700 border-opacity-50">
          <h4 class="text-blue-300 font-medium mb-2">Nitrosamine Formation</h4>
          <p>When the nitrosonium ion reacts with secondary amines, it forms nitrosamines (R₂N-N=O). These compounds are classified as probable human carcinogens that can cause DNA mutations after being metabolically activated in the body.</p>
        </div>
      `;
      break;
    default:
      html = `<div class="bg-gray-800 bg-opacity-30 rounded-lg p-4 border border-gray-700 border-opacity-50"><p>No scientific context available for this step.</p></div>`;
  }

  contextContainer.innerHTML = html;
}

// Update the step indicator in the sidebar
function updateStepIndicator(step) {
  const stepIndicator = document.getElementById("molecule-step-indicator");
  if (stepIndicator) {
    // Steps are 0-indexed in code but 1-indexed for display
    stepIndicator.textContent = `Step ${step + 1}/${totalSteps + 1}`;
    
    // Change color based on step
    const colors = [
      "bg-blue-500",   // Sodium Nitrite
      "bg-green-500",  // Nitrous Acid
      "bg-yellow-500", // Nitrosonium Ion
      "bg-red-500"     // Nitrosamine
    ];
    
    // Remove existing color classes
    stepIndicator.className = stepIndicator.className.replace(/bg-\w+-\d+/g, '');
    
    // Add current color class
    stepIndicator.classList.add(colors[step] || colors[0]);
  }
}

// Update the step title in the bottom indicator
function updateStepTitle(step) {
  const stepTitle = document.querySelector(".step-title");
  if (!stepTitle) return;
  
  let title = "";
  switch(step) {
    case 0:
      title = "Initial State: Sodium Nitrite";
      break;
    case 1:
      title = "Acid Reaction: Nitrous Acid Formation";
      break;
    case 2:
      title = "Decomposition: Nitrosonium Ion";
      break;
    case 3:
      title = "Final Product: Nitrosamine Formation";
      break;
    default:
      title = "Sodium Nitrite to Nitrosamine";
  }
  
  stepTitle.textContent = title;
}

// Update navigation button states based on current step
function updateNavigationButtons(step) {
  const prevButton = document.getElementById("prev-btn");
  const nextButton = document.getElementById("next-btn");
    
  // Disable previous button on first step
  if (step === 0) {
    prevButton.classList.add('disabled');
    prevButton.setAttribute('disabled', 'disabled');
  } else {
    prevButton.classList.remove('disabled');
    prevButton.removeAttribute('disabled');
  }
    
  // Disable next button on last step
  if (step === totalSteps) {
    nextButton.classList.add('disabled');
    nextButton.setAttribute('disabled', 'disabled');
  } else {
    nextButton.classList.remove('disabled');
    nextButton.removeAttribute('disabled');
  }
    
  // Update step indicator
  updateStepIndicator(step);
}

// Show the current step with enhanced animation transitions
function showStepImplementation(step) {
  // Validate step is within bounds
  if (step < 0 || step > totalSteps) return;
  
  console.log('showStep called for step:', step, 'current animation flag:', animationPlaying);
  
  // Set animation flag
  animationPlaying = true;
  
  // Get previous and current data keys for the transition
  const prevDataKey = getDataKeyForStep(currentStep);
  const newDataKey = getDataKeyForStep(step);
  
  console.log(`Transitioning from ${prevDataKey} to ${newDataKey}`);
  
  // Ensure proper molecule objects structure
  const moleculeKeys = ['sodiumNitrite', 'nitrousAcid', 'decomposed', 'nitrosamine'];
  moleculeKeys.forEach(key => {
    if (!molecules[key]) {
      molecules[key] = { 
        group: new THREE.Group(), 
        visible: false 
      };
      molecules[key].group.name = key;
      scene.add(molecules[key].group);
    } else if (!molecules[key].group) {
      molecules[key].group = new THREE.Group();
      molecules[key].group.name = key;
      scene.add(molecules[key].group);
    }
  });
  
  // Make sure stomach environment is visible for all steps
  if (molecules.stomach) {
    molecules.stomach.visible = true;
    molecules.stomach.group.visible = true;
  } else {
    console.warn('Stomach environment not found!');
    // Try to recreate it if missing
    createStomachEnvironment();
  }
  
  // Add a safety timeout to prevent animations from getting stuck
  if (window.animationResetTimeout) {
    clearTimeout(window.animationResetTimeout);
  }
  
  // Safety mechanism: if animation gets stuck, reset after 10 seconds
  window.animationResetTimeout = setTimeout(() => {
    console.log('Animation safety timeout triggered after 10 seconds');
    animationPlaying = false;
  }, 10000);
  
  // Update UI elements
  updateStepTitle(step);
  updateStepIndicator(step);
  updateNavigationButtons(step);
  
  // Create a GSAP timeline for all animations
  const masterTimeline = gsap.timeline({
    onComplete: () => {
      console.log('Animation complete, setting animationPlaying to false');
      // Hide previous molecule
      if (molecules[prevDataKey] && molecules[prevDataKey].group) {
        molecules[prevDataKey].group.visible = false;
      }
      // Make sure new molecule is visible
      if (molecules[newDataKey] && molecules[newDataKey].group) {
        molecules[newDataKey].group.visible = true;
      }
      // Update the data panels after animation completes
      updateMoleculeData(newDataKey);
      updateScientificContext(step);
      // Animation is done
      animationPlaying = false;
      // Update current step
      currentStep = step;
      // Clear the safety timeout since animation completed properly
      if (window.animationResetTimeout) {
        clearTimeout(window.animationResetTimeout);
      }
    }
  });
  
  // Handle transition effects between molecules
  if (prevDataKey !== newDataKey) {
    console.log(`Animating transition from ${prevDataKey} to ${newDataKey}`);
    
    // Simple transition directly from one molecule to another
    if (molecules[prevDataKey] && molecules[prevDataKey].group && 
        molecules[newDataKey] && molecules[newDataKey].group) {
      
      // STEP 1: Setup - Make sure source is visible and target is hidden
      molecules[prevDataKey].group.visible = true;
      molecules[newDataKey].group.visible = false;
      
      // Reset opacity on all materials
      molecules[prevDataKey].group.traverse(object => {
        if (object.material) {
          object.material.transparent = true;
          object.material.opacity = 1.0;
        }
      });
      
      // STEP 2: Create particles for visual effect if needed
      const particleColor = step === 1 ? 0xFFFFFF : // white for acid
                            step === 2 ? 0xFFA726 : // orange for decomposition
                            step === 3 ? 0xFF5252 : // red for nitrosamine 
                            0xFFFFFF;  // default
      
      const particles = new THREE.Points(
        new THREE.BufferGeometry().setFromPoints(
          Array(20).fill().map(() => new THREE.Vector3(
            (Math.random() - 0.5) * 5,
            (Math.random() - 0.5) * 5,
            (Math.random() - 0.5) * 5
          ))
        ),
        new THREE.PointsMaterial({
          color: particleColor,
          size: 0.2,
          transparent: true,
          opacity: 0.7
        })
      );
      
      particles.position.copy(molecules[prevDataKey].group.position);
      scene.add(particles);
      
      // STEP 3: Define the animation timeline
      // Create a very simple timeline
      masterTimeline.add(() => {
        // Fade out the source molecule
        gsap.to(molecules[prevDataKey].group.children, {
          opacity: 0,
          duration: 0.8,
          stagger: 0.02,
          ease: 'power2.in',
          onComplete: () => {
            // After fade out, hide source and show target
            molecules[prevDataKey].group.visible = false;
            molecules[newDataKey].group.visible = true;
            
            // Animate particles
            gsap.to(particles.material, {
              opacity: 0,
              duration: 0.5,
              delay: 0.8,
              onComplete: () => {
                scene.remove(particles);
              }
            });
            
            // Fade in target molecule
            molecules[newDataKey].group.children.forEach(child => {
              if (child.material) {
                child.material.transparent = true;
                child.material.opacity = 0;
              }
            });
            
            gsap.to(molecules[newDataKey].group.children, {
              opacity: 1,
              duration: 0.8,
              stagger: 0.03,
              ease: 'power2.out'
            });
          }
        });
      });
      }
      else if (step === 2 && currentStep === 1) { // Nitrous Acid to Nitrosonium Ion
        console.log('Animating: Nitrous Acid decomposing to form Nitrosonium Ion');
        
        // Make sure source and target molecules are properly prepared
        molecules[prevDataKey].group.visible = true;
        molecules[newDataKey].group.visible = false;
        
        // Create decomposition particles
        const decompParticles = createParticleSystem(
          molecules[prevDataKey].group.position, 
          atomColors.NitriteHighlight, // Yellow-orange for decomposition
          20, // particle count
          4,  // spread
          0.2 // size
        );
        transitionParticles.add(decompParticles);
        
        // Create water molecules that split off
        const waterParticle = createParticleSystem(
          molecules[prevDataKey].group.position, 
          atomColors.O, // Oxygen color for water
          5, // particle count
          3, // spread
          0.3 // size
        );
        transitionParticles.add(waterParticle);
        
        // Animate particles moving outward
        waterParticle.children.forEach(particle => {
          const randomAngle = Math.random() * Math.PI * 2;
          const randomDistance = 3 + Math.random() * 3;
          masterTimeline.to(particle.position, {
            x: particle.position.x + Math.cos(randomAngle) * randomDistance,
            y: particle.position.y + Math.sin(randomAngle) * randomDistance,
            z: particle.position.z + (Math.random() - 0.5) * randomDistance,
            duration: 1.2,
            ease: 'power2.out'
          }, 0.3);
        });
        
        // Create a simpler fade transition
        // Fade out source molecule
        molecules[prevDataKey].group.traverse(object => {
          if (object.material) {
            if (object.material.transparent === undefined) {
              object.material.transparent = true;
            }
            masterTimeline.to(object.material, {
              opacity: 0,
              duration: 1.0,
              ease: 'power2.inOut'
            }, 0.5);
          }
        });
        
        // After source fades, show target
        masterTimeline.call(() => {
          molecules[prevDataKey].group.visible = false;
          molecules[newDataKey].group.visible = true;
          // Reset opacity on source for future use
          molecules[prevDataKey].group.traverse(object => {
            if (object.material) {
              object.material.opacity = 1;
            }
          });
        }, null, 1.5);
        
        // Fade in the target molecule
        molecules[newDataKey].group.traverse(object => {
          if (object.material) {
            object.material.transparent = true;
            object.material.opacity = 0;
            masterTimeline.to(object.material, {
              opacity: 1,
              duration: 0.8,
              ease: 'power2.inOut'
            }, 1.6);
          }
        });
      }
      else if (step === 3 && currentStep === 2) { // Nitrosonium Ion to Nitrosamine
        console.log('Animating: Nitrosonium Ion combining with amine to form Nitrosamine');
        
        // Make sure source and target molecules are properly prepared
        molecules[prevDataKey].group.visible = true;
        molecules[newDataKey].group.visible = false;
        
        // Create amine particles that will combine with the nitrosonium ion
        const amineParticles = createParticleSystem(
          new THREE.Vector3(5, 0, 0), // Approach from right side
          atomColors.N, // Nitrogen color for amine particles
          12, // particle count
          3,  // spread
          0.3 // size
        );
        transitionParticles.add(amineParticles);
        
        // Create bonding effect particles
        const bondingParticles = createParticleSystem(
          molecules[prevDataKey].group.position, 
          atomColors.NitrosoHighlight, // Red for nitrosamine formation
          15, // particle count
          3,  // spread
          0.15 // size
        );
        transitionParticles.add(bondingParticles);
        
        // Animate amine particles moving toward nitrosonium ion
        masterTimeline.to(amineParticles.position, {
          x: molecules[prevDataKey].group.position.x,
          y: molecules[prevDataKey].group.position.y,
          z: molecules[prevDataKey].group.position.z,
          duration: 1,
          ease: "power2.inOut"
        }, 0);
        
        // Create a flash at the collision point when amine reaches nitrosonium
        const flashGeometry = new THREE.SphereGeometry(3, 24, 24);
        const flashMaterial = new THREE.MeshBasicMaterial({
          color: atomColors.NitrosoHighlight,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide
        });
        const flash = new THREE.Mesh(flashGeometry, flashMaterial);
        flash.position.copy(molecules[prevDataKey].group.position);
        transitionParticles.add(flash);
        
        // Flash when amine hits nitrosonium
        masterTimeline.to(flash.material, {
          opacity: 0.5,
          duration: 0.2,
          ease: 'power2.in'
        }, 1.0);
        
        // Create a simpler fade transition
        // Fade out source molecule
        molecules[prevDataKey].group.traverse(object => {
          if (object.material) {
            if (object.material.transparent === undefined) {
              object.material.transparent = true;
            }
            masterTimeline.to(object.material, {
              opacity: 0,
              duration: 0.8,
              ease: 'power2.inOut'
            }, 1.1);
          }
        });
        
        // After source fades, show target
        masterTimeline.call(() => {
          molecules[prevDataKey].group.visible = false;
          molecules[newDataKey].group.visible = true;
          // Reset opacity on source for future use
          molecules[prevDataKey].group.traverse(object => {
            if (object.material) {
              object.material.opacity = 1;
            }
          });
        }, null, 1.9);
        
        // Fade in the target molecule
        molecules[newDataKey].group.traverse(object => {
          if (object.material) {
            object.material.transparent = true;
            object.material.opacity = 0;
            masterTimeline.to(object.material, {
              opacity: 1,
              duration: 0.8,
              ease: 'power2.inOut'
            }, 2.0);
          }
        });
        
        // Fade out the flash
        masterTimeline.to(flash.material, {
          opacity: 0,
          duration: 0.5,
          ease: 'power2.out'
        }, 2.0);
      }
      else { // Default transition for any other cases
        console.log('Using default transition animation');
        
        // Make sure source and target molecules are properly prepared
        molecules[prevDataKey].group.visible = true;
        molecules[newDataKey].group.visible = false;
        
        // Create simple transition particles
        const defaultParticles = createParticleSystem(
          molecules[prevDataKey].group.position, 
          0xFFFFFF, // White particles for generic transition
          15, // particle count
          4,  // spread
          0.2 // size
        );
        transitionParticles.add(defaultParticles);
        
        // Create a simpler fade transition
        // Fade out source molecule
        molecules[prevDataKey].group.traverse(object => {
          if (object.material) {
            if (object.material.transparent === undefined) {
              object.material.transparent = true;
            }
            masterTimeline.to(object.material, {
              opacity: 0,
              duration: 0.8,
              ease: 'power2.inOut'
            }, 0.3);
          }
        });
        
        // After source fades, show target
        masterTimeline.call(() => {
          molecules[prevDataKey].group.visible = false;
          molecules[newDataKey].group.visible = true;
          // Reset opacity on source for future use
          molecules[prevDataKey].group.traverse(object => {
            if (object.material) {
              object.material.opacity = 1;
            }
          });
        }, null, 1.1);
        
        // Fade in the target molecule
        molecules[newDataKey].group.traverse(object => {
          if (object.material) {
            object.material.transparent = true;
            object.material.opacity = 0;
            masterTimeline.to(object.material, {
              opacity: 1,
              duration: 0.8,
              ease: 'power2.inOut'
            }, 1.2);
          }
        });
      }
      
      // Cleanup - remove particles at the end of the animation
      masterTimeline.call(() => {
        scene.remove(transitionParticles);
      }, null, 2.5);
    } else {
      console.error(`Missing molecule group: ${!molecules[prevDataKey] ? prevDataKey : ''} ${!molecules[newDataKey] ? newDataKey : ''}`);
      // Fallback - just show the new molecule without animation
      if (molecules[prevDataKey] && molecules[prevDataKey].group) {
        molecules[prevDataKey].group.visible = false;
      }
      if (molecules[newDataKey] && molecules[newDataKey].group) {
        molecules[newDataKey].group.visible = true;
      }
      // End animation immediately since we can't animate
      animationPlaying = false;
      currentStep = step;
    }
  
  // If no direct change needed
  if (!isDirectChange) {
    // No transition needed, just simple display of the current step
    console.log(`Simple display of step ${step} (${newDataKey})`);
    
    // Hide all molecules except for the current one
    moleculeKeys.forEach(key => {
      if (molecules[key] && molecules[key].group) {
        molecules[key].group.visible = (key === newDataKey);
      }
    });
    
    // Update UI
    updateMoleculeData(newDataKey);
    updateScientificContext(step);
    
    // End animation
    animationPlaying = false;
    // Update current step
    currentStep = step;
  }
  
  // Focus camera on the target molecule
  try {
    focusCameraOnCurrentMolecule(step);
  } catch (error) {
    console.error('Error focusing camera:', error);
    // Use default camera position as fallback
  }
}

// Create or recreate the stomach environment
function createStomachEnvironment() {
  if (molecules.stomach) {
    // If it exists but might be invisible, make sure it's visible
    molecules.stomach.visible = true;
    molecules.stomach.group.visible = true;
    return;
  }
  
  console.log('Creating stomach environment...');
  // Create a new stomach environment with consistent object structure
  molecules.stomach = { group: new THREE.Group(), visible: true };
  molecules.stomach.group.name = "stomach";
  
  // Create a sphere to represent the stomach wall
  const stomachGeometry = new THREE.SphereGeometry(40, 64, 48);
  const stomachMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xe57373,
    roughness: 0.5,
    metalness: 0.1,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide
  });
  
  const stomachMesh = new THREE.Mesh(stomachGeometry, stomachMaterial);
  stomachMesh.castShadow = true;
  stomachMesh.receiveShadow = true;
  stomachMesh.name = "stomach_wall";
  
  molecules.stomach.group.add(stomachMesh);
  scene.add(molecules.stomach.group);
  
  // Add some acid particles for visual effect
  for (let i = 0; i < 20; i++) {
    const radius = 25 + Math.random() * 10;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    
    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.sin(phi) * Math.sin(theta);
    const z = radius * Math.cos(phi);
    
    const particleGroup = new THREE.Group();
    particleGroup.position.set(x, y, z);
    particleGroup.name = `acid_particle_${i}`;
    
    // Create a small sphere for each acid particle
    const particleGeometry = new THREE.SphereGeometry(0.4, 12, 12);
    const particleMaterial = new THREE.MeshStandardMaterial({
      color: 0xaaff00,
      emissive: 0x44aa00,
      transparent: true,
      opacity: 0.7
    });
    
    const particleMesh = new THREE.Mesh(particleGeometry, particleMaterial);
    particleGroup.add(particleMesh);
    molecules.stomach.group.add(particleGroup);
  }
}

// Create a particle system for transitions
function createParticleSystem(center, color = 0xffffff, count = 20, spread = 5, size = 0.1) {
  // Create a more dramatic particle system with brighter particles and more of them
  const particleGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  
  // Convert main color to RGB components
  const color1 = new THREE.Color(color);
  const color2 = new THREE.Color(0xffffff); // Secondary color for variation
  
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    // Random position with weighted distribution toward center
    const distance = Math.pow(Math.random(), 2) * spread; // More particles near center
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    
    positions[i3] = center.x + distance * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = center.y + distance * Math.sin(phi) * Math.sin(theta);
    positions[i3 + 2] = center.z + distance * Math.cos(phi);
    
    // Gradient color effect - center particles have main color, outer ones fade to secondary
    const colorMix = Math.random();
    const particleColor = new THREE.Color().lerpColors(color1, color2, colorMix);
    
    colors[i3] = particleColor.r;
    colors[i3 + 1] = particleColor.g;
    colors[i3 + 2] = particleColor.b;
  }
  
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  
  const particleMaterial = new THREE.PointsMaterial({
    size: size,
    transparent: true,
    opacity: 0.9,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    depthWrite: false // Prevents z-fighting and makes particles more visible
  });
  
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  return particles;
}

// ...

// Show the current step with enhanced animation transitions
function showStepImplementation(step) {
  // Validate step is within bounds
  if (step < 0 || step > totalSteps) return;
  
  console.log('showStep called for step:', step, 'current animation flag:', animationPlaying);
  
  // Set animation flag
  animationPlaying = true;
  
  // Ensure proper molecule objects structure
  const moleculeKeys = ['sodiumNitrite', 'nitrousAcid', 'decomposed', 'nitrosamine'];
  moleculeKeys.forEach(key => {
    if (!molecules[key]) {
      molecules[key] = { 
        group: new THREE.Group(), 
        visible: false 
      };
      molecules[key].group.name = key;
      scene.add(molecules[key].group);
    } else if (!molecules[key].group) {
      molecules[key].group = new THREE.Group();
      molecules[key].group.name = key;
      scene.add(molecules[key].group);
    }
  });
  
  // Make sure stomach environment is visible for all steps
  if (molecules.stomach) {
    molecules.stomach.visible = true;
    molecules.stomach.group.visible = true;
  } else {
    console.warn('Stomach environment not found!');
    // Try to recreate it if missing
    createStomachEnvironment();
  }
  
  // Add a safety timeout to prevent animations from getting stuck
  if (window.animationResetTimeout) {
    clearTimeout(window.animationResetTimeout);
  }
  
  // Safety mechanism: if animation gets stuck, reset after 10 seconds
  window.animationResetTimeout = setTimeout(() => {
    console.log('Animation safety timeout triggered after 10 seconds');
    animationPlaying = false;
  }, 10000);
  
  // Get the data keys for the previous and current steps
  let prevDataKey = getDataKeyForStep(currentStep);
  let newDataKey = getDataKeyForStep(step);
  
  // Check if this is a direct step change (e.g., via next/prev buttons)
  const isDirectChange = step !== currentStep;
  
  console.log(`Transitioning from ${prevDataKey} to ${newDataKey}`);
  
  // IMPORTANT: Ensure all molecules are properly initialized and have groups
  const ensureMoleculeExists = (key) => {
    if (!molecules[key]) {
      console.log(`Creating molecule container for ${key}`);
      molecules[key] = { group: new THREE.Group(), visible: false };
      scene.add(molecules[key].group);
      return false;
    }
    
    if (!molecules[key].group) {
      console.log(`Creating group for ${key}`);
      molecules[key].group = new THREE.Group();
      scene.add(molecules[key].group);
      return false;
    }
    
    return true;
  };
  
  // Make sure all molecule types exist
  const prevExists = ensureMoleculeExists(prevDataKey);
  const newExists = ensureMoleculeExists(newDataKey);
  
  // Ensure stomach is visible during transitions
  if (molecules.stomach) {
    molecules.stomach.visible = true;
    molecules.stomach.group.visible = true;
  }
  
  // Make sure transition particles are shown regardless
  const showTransition = true;
  
  // Only do full animation if actually changing steps
  if (isDirectChange) {
    // Create a particle effect for the transition at stomach center
    const stomachCenter = new THREE.Vector3(0, 0, 0);
    const transitionParticles = createParticleSystem(
      stomachCenter,
      0x66ccff, // Blue particles
      40,        // More particles for better effect
      12,        // Broader spread
      0.2        // Larger particles
    );
    scene.add(transitionParticles);
    
    // Make sure both molecules are properly positioned and visible
    if (molecules[prevDataKey] && molecules[prevDataKey].group) {
      molecules[prevDataKey].group.visible = true;
    }
    
    if (molecules[newDataKey] && molecules[newDataKey].group) {
      // Position new molecule at same position initially
      if (molecules[prevDataKey] && molecules[prevDataKey].group) {
        molecules[newDataKey].group.position.copy(molecules[prevDataKey].group.position);
      }
      // Initially hide the target molecule
      molecules[newDataKey].group.visible = false;
      // Prepare scale for animation
      molecules[newDataKey].group.scale.set(0.8, 0.8, 0.8);
    }
    
    // Set up a timeline for a smooth transition with more effects
    const timeline = gsap.timeline({
      onComplete: () => {
        console.log('Animation complete, setting animationPlaying to false');
        // Hide previous molecule
        if (molecules[prevDataKey] && molecules[prevDataKey].group) {
          molecules[prevDataKey].group.visible = false;
        }
        // Make sure new molecule is visible
        if (molecules[newDataKey] && molecules[newDataKey].group) {
          molecules[newDataKey].group.visible = true;
        }
        // Remove particles
        scene.remove(transitionParticles);
        // Animation is done
        animationPlaying = false;
        // Update current step
        currentStep = step;
      }
    });
    
    // Focus camera on the target molecule
    try {
      focusCameraOnCurrentMolecule(step);
    } catch (error) {
      console.error('Error focusing camera:', error);
      // Use default camera position as fallback
      controls.target.set(0, 0, 0);
    }
    
    // Ensure molecules are visible during transition
    if (molecules[prevDataKey] && molecules[prevDataKey].group) {
      molecules[prevDataKey].group.visible = true;
    }
    
    if (molecules[newDataKey] && molecules[newDataKey].group) {
      // Initially hide target molecule
      molecules[newDataKey].group.visible = false;
    }
    
    // Create center point for transition effects
    const centerPoint = new THREE.Vector3(0, 0, 0);
    
    // Create transition particles at the center point with more dramatic colors and sizes
    const centerParticles = createParticleSystem(
      centerPoint,
      0x00ffff, // Bright cyan glow
      60, // Many more particles for better visibility
      15, // Much wider spread
      0.3 // Larger particles
    );
    scene.add(centerParticles);
    
    // Add a dramatic flash effect with brighter colors and bigger size for more visibility
    const flashGeometry = new THREE.SphereGeometry(5, 32, 32);
    const flashMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0,
      emissive: 0x00ffff,
      emissiveIntensity: 2.0
    });
    const flash = new THREE.Mesh(flashGeometry, flashMaterial);
    flash.scale.set(1, 1, 1);
    flash.position.copy(centerPoint);
    scene.add(flash);
    
    // 1. Start with a much more dramatic flash effect
    timeline.to(flash.scale, {
      x: 30, // Much larger scale for more visibility
      y: 30,
      z: 30,
      duration: 1.0, // Longer duration to be more noticeable
      ease: 'elastic.out(1, 0.5)' // Elastic effect for more drama
    }, 0);
    
    timeline.to(flash.material, {
      opacity: 0.9, // Higher peak opacity
      duration: 0.5,
      ease: 'power1.out',
      onComplete: () => {
        // Create a pulsing effect for the flash
        gsap.to(flash.material, {
          opacity: 0.3,
          duration: 0.3,
          ease: 'power2.in',
          repeat: 2,
          yoyo: true,
          onComplete: () => {
            // Final fade out
            gsap.to(flash.material, {
              opacity: 0,
              duration: 0.7,
              ease: 'power2.in'
            });
          }
        });
      }
    }, 0);
    
    // 2. Fade out previous molecule with scale effect
    if (molecules[prevDataKey] && molecules[prevDataKey].group) {
      timeline.to(molecules[prevDataKey].group.scale, {
        x: 0.7,
        y: 0.7,
        z: 0.7,
        duration: 0.6,
        ease: 'power2.in'
      }, 0.4);
      
      // Traverse all objects and fade their materials
      molecules[prevDataKey].group.traverse(obj => {
        if (obj.material) {
          // Ensure material can fade
          obj.material.transparent = true;
          timeline.to(obj.material, {
            opacity: 0,
            duration: 0.6,
            ease: 'power2.in'
          }, 0.4);
        }
      });
    }
    
    // 3. Animate particles
    centerParticles.children.forEach((particle, i) => {
      const direction = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1
      ).normalize();
      
      const distance = 3 + Math.random() * 7;
      const duration = 0.8 + Math.random() * 0.4;
      const delay = 0.3 + (i / centerParticles.children.length) * 0.3;
      
      timeline.to(particle.position, {
        x: particle.position.x + direction.x * distance,
        y: particle.position.y + direction.y * distance,
        z: particle.position.z + direction.z * distance,
        duration: duration,
        ease: 'power1.out',
        delay: delay
      }, 0.3);
      
      timeline.to(particle.material, {
        opacity: 0,
        duration: duration * 0.7,
        ease: 'power2.in',
        delay: delay + duration * 0.3
      }, 0.3);
    });
    
    // 4. Fade in new molecule
    timeline.add(() => {
      // First hide the old molecule completely
      if (molecules[prevDataKey] && molecules[prevDataKey].group) {
        molecules[prevDataKey].group.visible = false;
      }
      
      // Show the new molecule
      if (molecules[newDataKey] && molecules[newDataKey].group) {
        molecules[newDataKey].group.visible = true;
        molecules[newDataKey].group.scale.set(0.7, 0.7, 0.7);
        
        // Make sure materials are set up for fading in
        molecules[newDataKey].group.traverse(obj => {
          if (obj.material) {
            obj.material.transparent = true;
            obj.material.opacity = 0;
          }
        });
      }
    }, 1.0);
    
    // Scale up the new molecule
    if (molecules[newDataKey] && molecules[newDataKey].group) {
      timeline.to(molecules[newDataKey].group.scale, {
        x: 1,
        y: 1,
        z: 1,
        duration: 0.8,
        ease: 'back.out(1.2)'
      }, 1.2);
      
      // Fade in all materials
      timeline.add(() => {
        molecules[newDataKey].group.traverse(obj => {
          if (obj.material) {
            gsap.to(obj.material, {
              opacity: 1,
              duration: 0.8,
              ease: 'power2.out'
            });
          }
        });
      }, 1.2);
    }
    
    // Clean up effects at the end
    timeline.add(() => {
      scene.remove(flash);
      scene.remove(centerParticles);
    }, 2.0);
  } else {
    // Simple display without transition (first load or step doesn't change)
    console.log(`Simple display of step ${step} (${newDataKey})`);
    
    // Hide all molecules
    hideAllMolecules();
    
    // Show only the current molecule
    if (molecules[newDataKey]) {
      molecules[newDataKey].visible = true;
    } else {
      console.warn(`Molecule for step ${step} (${newDataKey}) not found.`);
    }
    
    // Update camera position
    focusCameraOnCurrentMolecule(step);
    
    // Since there's no transition, end the animation state immediately
    animationPlaying = false;
  }
  
  // Update UI elements
  const dataKey = newDataKey;
  
  // Update molecular properties panel
  updateMoleculeData(dataKey);
  
  // Update scientific context information
  updateScientificContext(step);
  
  // Update navigation buttons
  updateNavigationButtons(step);
  
  // Update the step indicator in the sidebar
  updateStepIndicator(step);
  
  // Update step title in the bottom indicator
  updateStepTitle(step);
} // End of showStepImplementation function

// New function to handle transitions between steps
function transitionBetweenSteps(fromStep, toStep) {
  // Set animation playing flag
  animationPlaying = true;
  
  // Convert steps to data keys
  const fromKey = getDataKeyForStep(fromStep);
  const toKey = getDataKeyForStep(toStep);
  
  console.log(`Transitioning from ${fromKey} (step ${fromStep}) to ${toKey} (step ${toStep})`);
  
  // Make sure the right molecule is visible at the start
  Object.keys(molecules).forEach(key => {
    if (molecules[key] && molecules[key].group) {
      molecules[key].group.visible = (key === fromKey);
      
      // Make sure opacity is reset for all molecules
      molecules[key].group.traverse(object => {
        if (object.material) {
          object.material.transparent = true;
          if (key === fromKey) {
            object.material.opacity = 1.0;
          } else if (key === toKey) {
            object.material.opacity = 0.0;
          }
        }
      });
    }
  });
  
  // Create particles for the transition
  const particles = new THREE.Group();
  scene.add(particles);
  
  // Add different types of particles based on the transition type
  if (fromStep === 0 && toStep === 1) { // Sodium Nitrite to Nitrous Acid
    // Add acid particles
    for (let i = 0; i < 20; i++) {
      const geometry = new THREE.SphereGeometry(0.15, 8, 8);
      const material = new THREE.MeshBasicMaterial({
        color: 0xFFFFFF,
        transparent: true,
        opacity: 0.7
      });
      const particle = new THREE.Mesh(geometry, material);
      
      // Position around the source molecule - with safety checks
      let pos;
      if (molecules[fromKey] && molecules[fromKey].group && molecules[fromKey].group.position) {
        pos = molecules[fromKey].group.position.clone();
      } else {
        // Use a default position if the molecule group doesn't exist yet
        console.warn(`Source molecule ${fromKey} position not available, using default`);
        pos = new THREE.Vector3(0, 0, 0);
      }
      
      pos.x += (Math.random() - 0.5) * 8;
      pos.y += (Math.random() - 0.5) * 8;
      pos.z += (Math.random() - 0.5) * 8;
      particle.position.copy(pos);
      
      particles.add(particle);
    }
  } else if (fromStep === 1 && toStep === 2) { // Nitrous Acid to Nitrosonium Ion
    // Add decomposition particles
    for (let i = 0; i < 15; i++) {
      const geometry = new THREE.SphereGeometry(0.2, 8, 8);
      const material = new THREE.MeshBasicMaterial({
        color: 0xFFA726, // orange
        transparent: true,
        opacity: 0.7
      });
      const particle = new THREE.Mesh(geometry, material);
      
      // Position at the source molecule with safety check
      if (molecules[fromKey] && molecules[fromKey].group && molecules[fromKey].group.position) {
        particle.position.copy(molecules[fromKey].group.position);
      } else {
        console.warn(`Source molecule ${fromKey} position not available, using default`);
        particle.position.set(0, 0, 0);
      }
      
      particles.add(particle);
    }
  } else if (fromStep === 2 && toStep === 3) { // Nitrosonium Ion to Nitrosamine
    // Add amine particles approaching
    for (let i = 0; i < 12; i++) {
      const geometry = new THREE.SphereGeometry(0.2, 8, 8);
      const material = new THREE.MeshBasicMaterial({
        color: 0xFF5252, // red
        transparent: true,
        opacity: 0.7
      });
      const particle = new THREE.Mesh(geometry, material);
      
      // Position to the right of the molecule with safety check
      let pos;
      if (molecules[fromKey] && molecules[fromKey].group && molecules[fromKey].group.position) {
        pos = molecules[fromKey].group.position.clone();
        pos.x += 5 + Math.random() * 3;
        pos.y += (Math.random() - 0.5) * 4;
        pos.z += (Math.random() - 0.5) * 4;
      } else {
        console.warn(`Source molecule ${fromKey} position not available, using default`);
        pos = new THREE.Vector3(
          5 + Math.random() * 3,
          (Math.random() - 0.5) * 4,
          (Math.random() - 0.5) * 4
        );
      }
      particle.position.copy(pos);
      
      particles.add(particle);
    }
  }
  
  // Do the actual transition animation
  const duration = 1.5; // seconds
  
  // Animate the particles
  particles.children.forEach((particle, i) => {
    // Give each particle a random movement
    gsap.to(particle.position, {
      x: particle.position.x + (Math.random() - 0.5) * 5,
      y: particle.position.y + (Math.random() - 0.5) * 5,
      z: particle.position.z + (Math.random() - 0.5) * 5,
      duration: duration * 0.8,
      delay: Math.random() * 0.3,
      ease: 'power1.out'
    });
    
    // Fade out particles at the end
    if (particle.material && particle.material.opacity !== undefined) {
      gsap.to(particle.material, {
        opacity: 0,
        duration: duration * 0.4,
        delay: duration * 0.6,
        ease: 'power1.in'
      });
    }
  });
  
  // Fade out source molecule with safety check
  if (molecules[fromKey] && molecules[fromKey].group && molecules[fromKey].group.children) {
    // We need to animate each child's material opacity individually
    molecules[fromKey].group.traverse(object => {
      if (object.material && object.material.opacity !== undefined) {
        gsap.to(object.material, {
          opacity: 0,
          duration: duration * 0.6,
          delay: Math.random() * 0.1, // Staggered effect
          ease: 'power1.in'
        });
      }
    });
    
    // Set a timeout to hide the source and show target after animation completes
    setTimeout(() => {
      // Hide the source molecule
      if (molecules[fromKey] && molecules[fromKey].group) {
        molecules[fromKey].group.visible = false;
      }
      // Show the target molecule
      if (molecules[toKey] && molecules[toKey].group) {
        molecules[toKey].group.visible = true;
      }
    }, duration * 0.6 * 1000); // Convert to milliseconds
  } else {
    console.warn(`Source molecule ${fromKey} not available for fade out animation`);
    // Still try to show target molecule
    if (molecules[toKey] && molecules[toKey].group) {
      molecules[toKey].group.visible = true;
    }
  }
  
  // Fade in target molecule after a delay with safety check
  if (molecules[toKey] && molecules[toKey].group && molecules[toKey].group.children) {
    // First ensure all materials have proper starting opacity
    molecules[toKey].group.traverse(object => {
      if (object.material) {
        object.material.transparent = true;
        object.material.opacity = 0;
      }
    });
    
    // Delay before starting fade-in
    setTimeout(() => {
      // Animate each child's material opacity individually
      molecules[toKey].group.traverse(object => {
        if (object.material && object.material.opacity !== undefined) {
          gsap.to(object.material, {
            opacity: 1,
            duration: duration * 0.6,
            delay: Math.random() * 0.15, // Staggered effect
            ease: 'power1.out'
          });
        }
      });
      
      // Set completion handler
      setTimeout(() => {
        // Update UI
        updateStepTitle(toStep);
        updateStepIndicator(toStep);
        updateNavigationButtons(toStep);
        updateMoleculeData(toKey);
        updateScientificContext(toStep);
        
        // Clean up
        scene.remove(particles);
        
        // End animation
        animationPlaying = false;
      }, duration * 0.6 * 1000);
    }, duration * 0.5 * 1000);
  } else {
    console.warn(`Target molecule ${toKey} not available for fade in animation`);
    
    // Still update UI and cleanup even if animation fails
    updateStepTitle(toStep);
    updateStepIndicator(toStep);
    updateNavigationButtons(toStep);
    updateMoleculeData(toKey);
    updateScientificContext(toStep);
    
    // Clean up
    scene.remove(particles);
    
    // End animation
    animationPlaying = false;
  }
  
  // Focus camera on the target molecule
  try {
    focusCameraOnCurrentMolecule(toStep);
  } catch (error) {
    console.error('Error focusing camera:', error);
  }
  
  // Safety timeout to prevent stuck animations
  if (window.animationResetTimeout) {
    clearTimeout(window.animationResetTimeout);
  }
  window.animationResetTimeout = setTimeout(() => {
    console.log('Safety timeout triggered - resetting animation state');
    animationPlaying = false;
  }, 5000);
}

// This function is now just used for the initial state setup
function showStep(step) {
  // Prevent animation conflicts
  if (animationPlaying) {
    console.log('Animation already in progress, ignoring');
    return;
  }
  
  // Just directly show the molecule for the given step without animation
  const dataKey = getDataKeyForStep(step);
  
  // Hide all molecules
  Object.keys(molecules).forEach(key => {
    if (molecules[key] && molecules[key].group) {
      molecules[key].group.visible = (key === dataKey);
    }
  });
  
  // Update UI
  currentStep = step;
  updateStepTitle(step);
  updateStepIndicator(step);
  updateNavigationButtons(step);
  updateMoleculeData(dataKey);
  updateScientificContext(step);
  
  // Focus camera
  focusCameraOnCurrentMolecule(step);
}

// Go to next step
function nextStep() {
  console.log('Next step clicked, current step:', currentStep);
  if (animationPlaying) {
    console.log('Animation playing, ignoring click');
    return;
  }
  
  if (currentStep < totalSteps) {
    const targetStep = currentStep + 1;
    console.log('Moving to step:', targetStep);
    // Save previous step before advancing
    const previousStep = currentStep;
    // Update current step
    currentStep = targetStep;
    // Call the transition function with both steps as parameters
    transitionBetweenSteps(previousStep, targetStep);
    
    // Close the sidebar on mobile after changing step
    if (isMobile()) {
      const infoPanel = document.getElementById("info-panel");
      // Check for correct transform class
      if (!infoPanel.classList.contains("-translate-y-full")) {
        // Hide the panel
        infoPanel.classList.add("-translate-y-full");
        infoPanel.classList.remove("translate-y-0");
        
        // Show UI elements when info panel is closed
        const stepNavigator = document.getElementById('step-navigator');
        const toggleInfoBtn = document.getElementById("toggle-info-panel");
        const resetCameraBtn = document.getElementById('reset-camera-btn');
        const toggleFullscreenBtn = document.getElementById('toggle-fullscreen');
        
        if (stepNavigator) stepNavigator.classList.remove('hidden');
        if (toggleInfoBtn) toggleInfoBtn.classList.remove('hidden');
        if (resetCameraBtn) resetCameraBtn.classList.remove('hidden');
        if (toggleFullscreenBtn) toggleFullscreenBtn.classList.remove('hidden');
      }
    }
  } else {
    console.log('Already at last step');
  }
}

// Go to previous step
function previousStep() {
  console.log('Previous step clicked, current step:', currentStep);
  if (animationPlaying) {
    console.log('Animation playing, ignoring click');
    return;
  }
  
  if (currentStep > 0) {
    const targetStep = currentStep - 1;
    console.log('Moving to step:', targetStep);
    // Save previous step before going back
    const previousStep = currentStep;
    // Update current step
    currentStep = targetStep;
    // Call the transition function with both steps as parameters
    transitionBetweenSteps(previousStep, targetStep);
    
    // Close the sidebar on mobile after changing step
    if (isMobile()) {
      const infoPanel = document.getElementById("info-panel");
      // Check for correct transform class
      if (!infoPanel.classList.contains("-translate-y-full")) {
        // Hide the panel
        infoPanel.classList.add("-translate-y-full");
        infoPanel.classList.remove("translate-y-0");
        
        // Show UI elements when info panel is closed
        const stepNavigator = document.getElementById('step-navigator');
        const toggleInfoBtn = document.getElementById("toggle-info-panel");
        const resetCameraBtn = document.getElementById('reset-camera-btn');
        const toggleFullscreenBtn = document.getElementById('toggle-fullscreen');
        
        if (stepNavigator) stepNavigator.classList.remove('hidden');
        if (toggleInfoBtn) toggleInfoBtn.classList.remove('hidden');
        if (resetCameraBtn) resetCameraBtn.classList.remove('hidden');
        if (toggleFullscreenBtn) toggleFullscreenBtn.classList.remove('hidden');
      }
    }
  } else {
    console.log('Already at first step');
  }
}

// Mouse movement handler
function onMouseMove(event) {
// Update mouse position
mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

// Raycasting for object detection
raycaster.setFromCamera(mouse, camera);
}

// Enhanced touch event handlers for mobile devices
function onTouchStart(event) {
  // Prevent default behavior for certain elements but not controls
  if (event.target.tagName !== "BUTTON" && !event.target.closest(".controls")) {
    event.preventDefault(); // Prevent scrolling when interacting with the 3D canvas
  }
  
  // Convert touch to mouse position for raycasting
  if (event.touches && event.touches.length > 0) {
    const touch = event.touches[0];
    mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
    
    // Cast ray to check for intersections with molecules
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);
    
    handleIntersections(intersects, touch.clientX, touch.clientY);
  }
}

// New touch move handler for mobile interactions
function onTouchMove(event) {
  // Only process if we're interacting with the 3D space
  if (event.target.tagName !== "BUTTON" && !event.target.closest(".controls")) {
    event.preventDefault();
  }
  
  if (event.touches && event.touches.length > 0) {
    const touch = event.touches[0];
    mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
  }
}

// New touch end handler for mobile interactions
function onTouchEnd(event) {
  // Hide any tooltips or reactive UI elements
  const tooltip = document.getElementById("molecule-tooltip");
  if (tooltip) {
    tooltip.style.display = "none";
  }
}

// Common function to handle ray intersection for both mouse and touch
function handleIntersections(intersects, clientX, clientY) {
  const tooltip = document.getElementById("molecule-tooltip");
  
  // Find the first object that is part of a molecule
  const moleculeIntersect = intersects.find(intersect => {
    // Traverse up the object hierarchy to find a parent with molecule data
    let current = intersect.object;
    while (current) {
      if (current.userData && (current.userData.moleculeType || current.userData.atomType)) {
        return true;
      }
      current = current.parent;
    }
    return false;
  });
  
  if (moleculeIntersect) {
    // Find the topmost parent with molecule data
    let target = moleculeIntersect.object;
    let moleculeData = null;
    
    while (target) {
      if (target.userData && (target.userData.moleculeType || target.userData.atomType)) {
        moleculeData = target.userData;
      }
      target = target.parent;
    }
    
    if (moleculeData) {
      // Display tooltip with molecule information
      tooltip.style.display = "block";
      tooltip.style.left = (clientX + 15) + "px";
      tooltip.style.top = clientY + "px";
      
      // Set tooltip content based on what was clicked
      if (moleculeData.atomType) {
        tooltip.innerHTML = `<strong>${moleculeData.atomType}</strong>`;
        if (SCIENTIFIC_DATA[moleculeData.moleculeType]) {
          tooltip.innerHTML += `<br>Part of: ${moleculeData.moleculeType}`;
        }
      } else if (moleculeData.moleculeType && SCIENTIFIC_DATA[moleculeData.moleculeType]) {
        const data = SCIENTIFIC_DATA[moleculeData.moleculeType];
        tooltip.innerHTML = `<strong>${moleculeData.moleculeType}</strong><br>${data.formula}`;
      }
    }
  } else {
    // Hide tooltip if not hovering over a molecule
    tooltip.style.display = "none";
  }
}

// Enhanced window resize handler for responsive design
function onWindowResize() {
  // Update camera aspect ratio
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  
  // Update renderer size
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile() ? 2 : 3));
  
  // Update post-processing effects
  effectFXAA.uniforms.resolution.value.set(1 / window.innerWidth, 1 / window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  
  // Get info panel element
  const infoPanel = document.getElementById("info-panel");
  
  // Ensure sidebar is always visible on desktop
  if (!isMobile() && infoPanel) {
    // Make sure the panel is visible on desktop
    infoPanel.classList.remove('-translate-x-full');
    infoPanel.classList.add('translate-x-0');
  } else if (isMobile()) {
    // Handle mobile devices differently
    // Adjust FOV based on orientation
    if (window.innerWidth < window.innerHeight) {
      // Portrait orientation needs wider FOV
      camera.fov = 85;
    } else {
      // Landscape orientation can have normal FOV
      camera.fov = 75;
    }
    camera.updateProjectionMatrix();
    
    // On mobile, sidebar should be hideable
    if (window.innerWidth < 768 && infoPanel && infoPanel.classList.contains("visible")) {
      infoPanel.classList.remove("visible");
    }
  }
}

// Performance-optimized animation loop with mobile considerations
function animate() {
  requestAnimationFrame(animate);
  
  // Update controls with dampening to prevent jitter
  controls.update();
  
  // Use a time-based animation instead of frame-based for smoother motion
  const time = performance.now() * 0.001; // Convert to seconds
  
  // Ensure stomach is always visible
  if (molecules.stomach) {
    molecules.stomach.visible = true;
    molecules.stomach.group.visible = true;
    
    // Animate stomach atoms with random movement
    molecules.stomach.group.children.forEach((child, index) => {
      // Only animate certain atoms (exclude the stomach mesh itself)
      if (child.name && (child.name.includes('water_') || child.name.includes('hcl_') || child.name.includes('bicarb'))) {
        // Create subtle random movements
        const moveFactor = 0.005;
        const rotationFactor = 0.002;
        
        // Use time and index to create different patterns for each atom
        const xMovement = Math.sin(time * 0.5 + index) * moveFactor;
        const yMovement = Math.cos(time * 0.7 + index * 0.3) * moveFactor;
        const zMovement = Math.sin(time * 0.3 + index * 0.7) * moveFactor;
        
        // Apply the movement
        child.position.x += xMovement;
        child.position.y += yMovement;
        child.position.z += zMovement;
        
        // Add subtle rotation
        child.rotation.x += Math.sin(time * 0.2 + index) * rotationFactor;
        child.rotation.y += Math.cos(time * 0.3 + index * 0.5) * rotationFactor;
      }
    });
  }
  
  // Update electron positions in electron shells more efficiently
  // Only traverse objects that need animation
  scene.traverse((object) => {
    if (object.userData && object.userData.isElectron) {
      const userData = object.userData;
      if (userData.angle !== undefined) {
        // Time-based animation for consistent speed across different frame rates
        userData.angle = time * userData.speed;
        object.position.x = Math.cos(userData.angle) * userData.radius;
        object.position.z = Math.sin(userData.angle) * userData.radius;
      }
    }
  });
  
  // Optimize any animated particles or effects based on device capability
  if (transitionEffects.children.length > 0) {
    const maxParticles = isMobile() ? 15 : 50; // Fewer particles on mobile
    
    // If we have too many particles for the device, randomly remove some
    while (transitionEffects.children.length > maxParticles) {
      const randomIndex = Math.floor(Math.random() * transitionEffects.children.length);
      transitionEffects.remove(transitionEffects.children[randomIndex]);
    }
  }
  
  try {
    // Rendering with proper optimization for different devices
    if (isMobile()) {
      // Use standard rendering for better performance on mobile
      renderer.render(scene, camera);
    } else {
      // Use full quality on desktop - only call composer.render() once
      composer.render();
    }
  } catch (error) {
    console.error('Render error:', error);
    // Fallback to standard rendering if composer fails
    renderer.render(scene, camera);
  }
}

// Initialize when the page loads
window.addEventListener("load", init);
