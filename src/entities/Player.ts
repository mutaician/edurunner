import {
    Scene,
    SceneLoader,
    Vector3,
    Mesh,
    Animation,
    QuadraticEase,
    EasingFunction,
    AnimationGroup,
    ParticleSystem,
    Color4,
    Texture,
    GlowLayer,
    TrailMesh,
    MeshBuilder,
    PBRMaterial,
    Color3,
    TransformNode
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';

export class Player {
    private scene: Scene;
    private glowLayer: GlowLayer;
    private rootNode: TransformNode;
    private mesh: Mesh | null = null;
    private currentLane: number = 1; // 0=Left, 1=Center, 2=Right
    private lanePositions: number[] = [-3, 0, 3];
    private isMoving: boolean = false;
    private animationGroups: AnimationGroup[] = [];
    private trailMesh: TrailMesh | null = null;
    private footParticles: ParticleSystem | null = null;
    private glowOrb: Mesh;
    private isLoaded: boolean = false;

    // Callbacks
    public onLaneChange: ((lane: number) => void) | null = null;

    constructor(scene: Scene, glowLayer: GlowLayer, lanePositions?: number[]) {
        this.scene = scene;
        this.glowLayer = glowLayer;
        if (lanePositions) {
            this.lanePositions = lanePositions;
        }
        
        // Create root node for player - positioned forward so camera can see it
        this.rootNode = new TransformNode("playerRoot", scene);
        this.rootNode.position = new Vector3(this.lanePositions[this.currentLane], 0, 5);
        
        // Create glow orb that follows player (visible before model loads)
        this.glowOrb = this.createGlowOrb();
        
        // Load the character model
        this.loadModel();
        
        // Setup input handling
        this.setupInput();
        
        // Create trail effect
        this.createTrailEffect();
        
        // Create foot particles
        this.createFootParticles();
    }

    private createGlowOrb(): Mesh {
        // Create a visible capsule-like player shape as fallback/placeholder
        const orb = MeshBuilder.CreateCapsule("playerOrb", { 
            height: 2.5, 
            radius: 0.4 
        }, this.scene);
        orb.position.y = 1.25;
        orb.parent = this.rootNode;
        
        const orbMat = new PBRMaterial("orbMat", this.scene);
        orbMat.albedoColor = new Color3(0.3, 0.7, 1);
        orbMat.emissiveColor = new Color3(0.1, 0.3, 0.5);
        orbMat.metallic = 0.5;
        orbMat.roughness = 0.3;
        orb.material = orbMat;
        
        this.glowLayer.addIncludedOnlyMesh(orb);
        
        return orb;
    }

    private async loadModel(): Promise<void> {
        try {
            const result = await SceneLoader.ImportMeshAsync(
                "",
                "/assets/models/",
                "hypercasual_stickman.glb",
                this.scene
            );
            
            this.mesh = result.meshes[0] as Mesh;
            this.animationGroups = result.animationGroups;
            
            // Configure mesh
            this.mesh.parent = this.rootNode;
            this.mesh.position = new Vector3(0, 0, 0);
            
            // Scale appropriately - larger for visibility
            this.mesh.scaling = new Vector3(1,1,1);
            
            // Rotate to face forward
            this.mesh.rotationQuaternion = null;
            this.mesh.rotation.y = Math.PI / 9;
            
            // Ensure all child meshes are visible
            result.meshes.forEach(m => {
                m.isVisible = true;
                m.visibility = 1;
            });

            // Play running animation if available
            if (this.animationGroups.length > 0) {
                // Find running animation by name, or use first one
                let runAnim = this.animationGroups.find(ag => 
                    ag.name.toLowerCase().includes('run') || 
                    ag.name.toLowerCase().includes('walk')
                );
                if (!runAnim) {
                    runAnim = this.animationGroups[0];
                }
                runAnim.play(true);
                runAnim.speedRatio = 1.5; // Speed up animation
            }

            // Add subtle bounce while running
            this.addRunningBounce();
            
            this.isLoaded = true;
            console.log('✅ Player model loaded successfully');
            
            // Hide the fallback capsule
            this.glowOrb.isVisible = false;
            
        } catch (error) {
            console.error('❌ Failed to load player model, using fallback shape:', error);
            // Keep the capsule visible as fallback - it's already visible
            this.isLoaded = true;
        }
    }

    private addRunningBounce(): void {
        let bounceTime = 0;
        this.scene.onBeforeRenderObservable.add(() => {
            if (this.mesh) {
                bounceTime += 0.15;
                // Subtle vertical bounce
                this.mesh.position.y = Math.abs(Math.sin(bounceTime)) * 0.05;
                // Subtle side-to-side sway
                this.mesh.rotation.z = Math.sin(bounceTime * 0.5) * 0.02;
            }
        });
    }

    private createTrailEffect(): void {
        // Create a trail source mesh (invisible small sphere at player's feet)
        const trailSource = MeshBuilder.CreateSphere("trailSource", { diameter: 0.3 }, this.scene);
        trailSource.position.y = 0.15;
        trailSource.parent = this.rootNode;
        trailSource.isVisible = false;
        
        // Create trail mesh
        this.trailMesh = new TrailMesh("playerTrail", trailSource, this.scene, 0.2, 30, true);
        
        const trailMat = new PBRMaterial("trailMat", this.scene);
        trailMat.albedoColor = new Color3(0, 0.8, 1);
        trailMat.emissiveColor = new Color3(0, 0.5, 0.8);
        trailMat.alpha = 0.4;
        trailMat.metallic = 1;
        trailMat.roughness = 0.3;
        
        this.trailMesh.material = trailMat;
        this.glowLayer.addIncludedOnlyMesh(this.trailMesh);
    }

    private createFootParticles(): void {
        this.footParticles = new ParticleSystem("footParticles", 50, this.scene);
        
        // Simple particle texture
        this.footParticles.particleTexture = new Texture(
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAABNklEQVR4nO2WMU4DMRBF3yKltKRNN8UWKaigSw8lHdyAI+QEnIMbcBO6VJRwD0q2QwqCgpRYst1kF6/xbESx/JE7jf+bGXvGhkKh8J+wAJ4BDdwCZ8CnBxyK78ALcJERbzLiTUa8yYg3GfEhI36QEQ8y4kVGvMqI5xnxNCPepMZd+qGYpR+K+e/r+AvYAs9ATUQ8Bx6BOxXx8+TdJu9u+qFYpR+K2Z5VcNIPxSz9UMz0Q/EgI56mxBbAPXCtIt4lxJr9UFzoj2YCruGnM+AB+FDxbkK8AF6BdxXvJsRr4B1YU/FuQrwB3oA1Fe8mxDvgFVhT8W5CvAdegDUV7ybEB+AZWFPxbkJ8BJ6ANRXvJsQn4BF4VPFuQnwBHoCHlNhFfwQ+gMOU2EV/lBK76I9SYhf9Y+jP4BstWGYhI3pG0wAAAABJRU5ErkJggg==",
            this.scene
        );
        
        // Use the root node position as Vector3 emitter
        this.footParticles.emitter = this.rootNode.position;
        this.footParticles.minEmitBox = new Vector3(-0.2, 0, -0.2);
        this.footParticles.maxEmitBox = new Vector3(0.2, 0.1, 0.2);
        
        this.footParticles.color1 = new Color4(0.3, 0.8, 1, 0.5);
        this.footParticles.color2 = new Color4(0.5, 0.5, 1, 0.3);
        this.footParticles.colorDead = new Color4(0.1, 0.2, 0.5, 0);
        
        this.footParticles.minSize = 0.05;
        this.footParticles.maxSize = 0.15;
        
        this.footParticles.minLifeTime = 0.3;
        this.footParticles.maxLifeTime = 0.6;
        
        this.footParticles.emitRate = 20;
        
        this.footParticles.direction1 = new Vector3(-0.3, 0.5, -1);
        this.footParticles.direction2 = new Vector3(0.3, 1, -0.5);
        
        this.footParticles.minEmitPower = 0.5;
        this.footParticles.maxEmitPower = 1;
        
        this.footParticles.gravity = new Vector3(0, -2, 0);
        
        this.footParticles.start();
    }

    private setupInput(): void {
        window.addEventListener("keydown", (e) => {
            if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
                this.moveLeft();
            } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
                this.moveRight();
            }
        });

        // Touch controls for mobile
        let touchStartX: number | null = null;
        
        window.addEventListener("touchstart", (e) => {
            touchStartX = e.touches[0].clientX;
        });
        
        window.addEventListener("touchend", (e) => {
            if (touchStartX === null) return;
            
            const touchEndX = e.changedTouches[0].clientX;
            const deltaX = touchEndX - touchStartX;
            
            // Swipe threshold
            if (Math.abs(deltaX) > 50) {
                if (deltaX < 0) {
                    this.moveLeft();
                } else {
                    this.moveRight();
                }
            }
            
            touchStartX = null;
        });
    }

    public moveLeft(): void {
        if (this.currentLane > 0 && !this.isMoving) {
            this.currentLane--;
            this.animateToLane();
            this.spawnLaneChangeParticles(-1);
        }
    }

    public moveRight(): void {
        if (this.currentLane < 2 && !this.isMoving) {
            this.currentLane++;
            this.animateToLane();
            this.spawnLaneChangeParticles(1);
        }
    }

    private animateToLane(): void {
        this.isMoving = true;
        const targetX = this.lanePositions[this.currentLane];
        
        const animation = new Animation(
            "laneMove",
            "position.x",
            60,
            Animation.ANIMATIONTYPE_FLOAT,
            Animation.ANIMATIONLOOPMODE_CONSTANT
        );

        const keys = [
            { frame: 0, value: this.rootNode.position.x },
            { frame: 10, value: targetX } // ~166ms at 60fps - snappier
        ];

        animation.setKeys(keys);

        const easing = new QuadraticEase();
        easing.setEasingMode(EasingFunction.EASINGMODE_EASEOUT);
        animation.setEasingFunction(easing);

        this.rootNode.animations = [animation];
        this.scene.beginAnimation(this.rootNode, 0, 10, false, 1, () => {
            this.isMoving = false;
            if (this.onLaneChange) {
                this.onLaneChange(this.currentLane);
            }
        });

        // Add a tilt during lane change
        this.addLaneChangeTilt(targetX > this.rootNode.position.x ? 1 : -1);
    }

    private addLaneChangeTilt(direction: number): void {
        if (!this.mesh) return;
        
        const tiltAnimation = new Animation(
            "tilt",
            "rotation.z",
            60,
            Animation.ANIMATIONTYPE_FLOAT,
            Animation.ANIMATIONLOOPMODE_CONSTANT
        );

        const tiltAmount = direction * -0.2; // Tilt opposite to movement direction
        
        const keys = [
            { frame: 0, value: 0 },
            { frame: 5, value: tiltAmount },
            { frame: 10, value: 0 }
        ];

        tiltAnimation.setKeys(keys);
        
        const easing = new QuadraticEase();
        easing.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);
        tiltAnimation.setEasingFunction(easing);

        this.mesh.animations = [tiltAnimation];
        this.scene.beginAnimation(this.mesh, 0, 10, false);
    }

    private spawnLaneChangeParticles(direction: number): void {
        // Burst of particles when changing lanes
        const burst = new ParticleSystem("laneChangeBurst", 30, this.scene);
        
        burst.particleTexture = new Texture(
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAABNklEQVR4nO2WMU4DMRBF3yKltKRNN8UWKaigSw8lHdyAI+QEnIMbcBO6VJRwD0q2QwqCgpRYst1kF6/xbESx/JE7jf+bGXvGhkKh8J+wAJ4BDdwCZ8CnBxyK78ALcJERbzLiTUa8yYg3GfEhI36QEQ8y4kVGvMqI5xnxNCPepMZd+qGYpR+K+e/r+AvYAs9ATUQ8Bx6BOxXx8+TdJu9u+qFYpR+K2Z5VcNIPxSz9UMz0Q/EgI56mxBbAPXCtIt4lxJr9UFzoj2YCruGnM+AB+FDxbkK8AF6BdxXvJsRr4B1YU/FuQrwB3oA1Fe8mxDvgFVhT8W5CvAdegDUV7ybEB+AZWFPxbkJ8BJ6ANRXvJsQn4BF4VPFuQnwBHoCHlNhFfwQ+gMOU2EV/lBK76I9SYhf9Y+jP4BstWGYhI3pG0wAAAABJRU5ErkJggg==",
            this.scene
        );
        
        burst.emitter = this.rootNode.position.clone();
        burst.minEmitBox = new Vector3(-0.3, 0, -0.3);
        burst.maxEmitBox = new Vector3(0.3, 0.5, 0.3);
        
        burst.color1 = new Color4(0, 0.8, 1, 1);
        burst.color2 = new Color4(0.5, 0.5, 1, 1);
        burst.colorDead = new Color4(0, 0.3, 0.5, 0);
        
        burst.minSize = 0.1;
        burst.maxSize = 0.25;
        
        burst.minLifeTime = 0.2;
        burst.maxLifeTime = 0.4;
        
        burst.manualEmitCount = 30;
        
        burst.direction1 = new Vector3(direction * 2, 0.5, -0.5);
        burst.direction2 = new Vector3(direction * 3, 1, 0.5);
        
        burst.minEmitPower = 2;
        burst.maxEmitPower = 4;
        
        burst.gravity = new Vector3(0, -5, 0);
        
        burst.start();
        
        // Auto dispose after particles die
        setTimeout(() => burst.dispose(), 1000);
    }

    public getCurrentLane(): number {
        return this.currentLane;
    }

    public getPosition(): Vector3 {
        return this.rootNode.position.clone();
    }

    public setLanePositions(positions: number[]): void {
        this.lanePositions = positions;
        // Update current position to match new lane width
        this.rootNode.position.x = this.lanePositions[this.currentLane];
    }

    public resetPosition(): void {
        // Reset to center lane
        this.currentLane = 1;
        this.rootNode.position.x = this.lanePositions[this.currentLane];
        this.rootNode.position.z = 5; // Player Z position
        this.isMoving = false;
    }

    public dispose(): void {
        if (this.trailMesh) this.trailMesh.dispose();
        if (this.footParticles) this.footParticles.dispose();
        this.rootNode.dispose();
    }
}
