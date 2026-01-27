import {
    Scene,
    Color3,
    Color4,
    Vector3,
    HemisphericLight,
    DirectionalLight,
    MeshBuilder,
    StandardMaterial,
    Texture,
    GlowLayer,
    DefaultRenderingPipeline,
    Mesh,
    PBRMaterial,
    ParticleSystem
} from '@babylonjs/core';

export class Environment {
    private scene: Scene;
    public glowLayer: GlowLayer;
    private pipeline: DefaultRenderingPipeline;
    private ambientParticles: ParticleSystem;

    constructor(scene: Scene) {
        this.scene = scene;
        
        // Set scene background
        this.scene.clearColor = new Color4(0.02, 0.02, 0.06, 1);
        
        // Create glow layer first (needed by other elements)
        this.glowLayer = this.createGlowLayer();
        
        // Setup lighting
        this.createLighting();
        
        // Create stylized skybox/environment
        this.createSkybox();
        
        // Setup fog for depth
        this.createFog();
        
        // Create post-processing pipeline
        this.pipeline = this.createPostProcessing();
        
        // Add ambient floating particles
        this.ambientParticles = this.createAmbientParticles();
        
        // Create distant environment elements
        this.createEnvironmentProps();
    }

    private createGlowLayer(): GlowLayer {
        const gl = new GlowLayer("glow", this.scene, {
            mainTextureFixedSize: 256,
            blurKernelSize: 32
        });
        gl.intensity = 0.6; // Much softer glow
        return gl;
    }

    private createLighting(): void {
        // Main ambient light from above - soft blue tint
        const ambient = new HemisphericLight("ambient", new Vector3(0, 1, 0), this.scene);
        ambient.intensity = 0.6;
        ambient.diffuse = new Color3(0.7, 0.8, 1);
        ambient.specular = new Color3(0.5, 0.6, 0.8);
        ambient.groundColor = new Color3(0.1, 0.1, 0.2);

        // Directional "sun" light for dramatic shadows and highlights
        const sun = new DirectionalLight("sun", new Vector3(-0.5, -1, 0.5), this.scene);
        sun.intensity = 0.8;
        sun.diffuse = new Color3(1, 0.95, 0.8);
        sun.specular = new Color3(1, 0.9, 0.7);

        // Rim light from behind for character pop
        const rim = new DirectionalLight("rim", new Vector3(0, -0.3, -1), this.scene);
        rim.intensity = 0.3;
        rim.diffuse = new Color3(0.5, 0.7, 1);
    }

    private createSkybox(): Mesh {
        // Create gradient skybox using a large sphere with custom material
        const skybox = MeshBuilder.CreateSphere("skybox", {
            diameter: 500,
            sideOrientation: Mesh.BACKSIDE
        }, this.scene);

        const skyMaterial = new StandardMaterial("skyMat", this.scene);
        skyMaterial.backFaceCulling = false;
        skyMaterial.disableLighting = true;
        
        // Create gradient texture procedurally
        const gradientTexture = this.createGradientTexture();
        skyMaterial.emissiveTexture = gradientTexture;
        
        skybox.material = skyMaterial;
        skybox.infiniteDistance = true;
        
        return skybox;
    }

    private createGradientTexture(): Texture {
        // Create a vertical gradient from dark blue to purple to dark
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        
        // Create gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, size);
        gradient.addColorStop(0, '#0a0a1a');      // Top - very dark blue
        gradient.addColorStop(0.3, '#1a1030');    // Upper - dark purple
        gradient.addColorStop(0.5, '#2d1b4e');    // Middle - purple
        gradient.addColorStop(0.7, '#1a1030');    // Lower - dark purple
        gradient.addColorStop(1, '#050510');       // Bottom - near black
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
        
        // Add some stars - dimmer and fewer
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'; // Dimmer stars
        for (let i = 0; i < 80; i++) { // Fewer stars
            const x = Math.random() * size;
            const y = Math.random() * size * 0.6; // Stars in upper portion
            const radius = Math.random() * 1;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Add some nebula-like glow spots - very subtle
        const addNebula = (x: number, y: number, r: number, color: string) => {
            const nebulaGrad = ctx.createRadialGradient(x, y, 0, x, y, r);
            nebulaGrad.addColorStop(0, color);
            nebulaGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = nebulaGrad;
            ctx.fillRect(x - r, y - r, r * 2, r * 2);
        };
        
        addNebula(100, 150, 80, 'rgba(80, 40, 120, 0.15)');
        addNebula(400, 100, 60, 'rgba(40, 80, 120, 0.1)');
        addNebula(300, 200, 70, 'rgba(120, 40, 80, 0.1)');
        
        const texture = new Texture(canvas.toDataURL(), this.scene);
        return texture;
    }

    private createFog(): void {
        // Exponential fog for depth effect
        this.scene.fogMode = Scene.FOGMODE_EXP2;
        this.scene.fogDensity = 0.008;
        this.scene.fogColor = new Color3(0.05, 0.05, 0.15);
    }

    private createPostProcessing(): DefaultRenderingPipeline {
        const pipeline = new DefaultRenderingPipeline(
            "defaultPipeline",
            true, // HDR
            this.scene,
            this.scene.cameras
        );

        // Bloom for glowing effects - reduced for comfort
        pipeline.bloomEnabled = true;
        pipeline.bloomThreshold = 0.5;
        pipeline.bloomWeight = 0.2;
        pipeline.bloomKernel = 32;
        pipeline.bloomScale = 0.3;

        // Chromatic aberration - very subtle
        pipeline.chromaticAberrationEnabled = true;
        pipeline.chromaticAberration.aberrationAmount = 5;

        // Vignette - subtle
        if (pipeline.imageProcessing) {
            pipeline.imageProcessing.vignetteEnabled = true;
            pipeline.imageProcessing.vignetteWeight = 0.8;
            pipeline.imageProcessing.vignetteCameraFov = 0.9;
        }

        // Tone mapping for better colors
        pipeline.imageProcessingEnabled = true;
        pipeline.imageProcessing.contrast = 1.2;
        pipeline.imageProcessing.exposure = 1.1;

        // FXAA anti-aliasing
        pipeline.fxaaEnabled = true;

        // Sharpen
        pipeline.sharpenEnabled = true;
        pipeline.sharpen.edgeAmount = 0.2;

        return pipeline;
    }

    private createAmbientParticles(): ParticleSystem {
        // Floating dust/magic particles in the environment
        const particles = new ParticleSystem("ambientParticles", 500, this.scene);
        
        // Simple particle texture
        particles.particleTexture = new Texture("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAABNklEQVR4nO2WMU4DMRBF3yKltKRNN8UWKaigSw8lHdyAI+QEnIMbcBO6VJRwD0q2QwqCgpRYst1kF6/xbESx/JE7jf+bGXvGhkKh8J+wAJ4BDdwCZ8CnBxyK78ALcJERbzLiTUa8yYg3GfEhI36QEQ8y4kVGvMqI5xnxNCPepMZd+qGYpR+K+e/r+AvYAs9ATUQ8Bx6BOxXx8+TdJu9u+qFYpR+K2Z5VcNIPxSz9UMz0Q/EgI56mxBbAPXCtIt4lxJr9UFzoj2YCruGnM+AB+FDxbkK8AF6BdxXvJsRr4B1YU/FuQrwB3oA1Fe8mxDvgFVhT8W5CvAdegDUV7ybEB+AZWFPxbkJ8BJ6ANRXvJsQn4BF4VPFuQnwBHoCHlNhFfwQ+gMOU2EV/lBK76I9SYhf9Y+jP4BstWGYhI3pG0wAAAABJRU5ErkJggg==", this.scene);
        
        // Emit from a large box around the track
        particles.emitter = Vector3.Zero();
        particles.minEmitBox = new Vector3(-30, 0, -20);
        particles.maxEmitBox = new Vector3(30, 15, 100);
        
        // Soft colors
        particles.color1 = new Color4(0.5, 0.5, 1, 0.3);
        particles.color2 = new Color4(1, 0.5, 1, 0.2);
        particles.colorDead = new Color4(0.2, 0.2, 0.5, 0);
        
        particles.minSize = 0.02;
        particles.maxSize = 0.08;
        
        particles.minLifeTime = 3;
        particles.maxLifeTime = 6;
        
        particles.emitRate = 50;
        
        // Slow floating motion
        particles.direction1 = new Vector3(-0.1, 0.2, -0.5);
        particles.direction2 = new Vector3(0.1, 0.4, -0.3);
        
        particles.minEmitPower = 0.2;
        particles.maxEmitPower = 0.5;
        
        particles.gravity = new Vector3(0, 0.02, 0);
        
        particles.start();
        
        return particles;
    }

    private createEnvironmentProps(): void {
        // Create some distant floating geometric shapes for visual interest
        const propMaterial = new PBRMaterial("propMat", this.scene);
        propMaterial.albedoColor = new Color3(0.1, 0.1, 0.2);
        propMaterial.emissiveColor = new Color3(0.05, 0.1, 0.2);
        propMaterial.metallic = 0.8;
        propMaterial.roughness = 0.2;

        // Floating cubes/pyramids in the distance
        const positions = [
            { pos: new Vector3(-40, 20, 100), type: 'box', scale: 5 },
            { pos: new Vector3(50, 15, 80), type: 'box', scale: 3 },
            { pos: new Vector3(-60, 25, 150), type: 'tetra', scale: 8 },
            { pos: new Vector3(70, 30, 200), type: 'tetra', scale: 6 },
            { pos: new Vector3(-30, 40, 180), type: 'box', scale: 4 },
            { pos: new Vector3(40, 35, 250), type: 'box', scale: 7 },
        ];

        positions.forEach((prop, i) => {
            let mesh: Mesh;
            if (prop.type === 'box') {
                mesh = MeshBuilder.CreateBox(`prop_${i}`, { size: prop.scale }, this.scene);
            } else {
                mesh = MeshBuilder.CreatePolyhedron(`prop_${i}`, { type: 1, size: prop.scale }, this.scene);
            }
            mesh.position = prop.pos;
            mesh.rotation.x = Math.random() * Math.PI;
            mesh.rotation.y = Math.random() * Math.PI;
            mesh.material = propMaterial;
            
            // Slow rotation animation
            this.scene.onBeforeRenderObservable.add(() => {
                mesh.rotation.x += 0.001;
                mesh.rotation.y += 0.002;
            });
        });

        // Create glowing rings in the distance
        const ringMaterial = new PBRMaterial("ringMat", this.scene);
        ringMaterial.albedoColor = new Color3(0, 0.5, 1);
        ringMaterial.emissiveColor = new Color3(0, 0.3, 0.6);
        ringMaterial.metallic = 1;
        ringMaterial.roughness = 0.1;

        const ringPositions = [
            new Vector3(0, 20, 300),
            new Vector3(-80, 30, 400),
            new Vector3(100, 25, 350),
        ];

        ringPositions.forEach((pos, i) => {
            const ring = MeshBuilder.CreateTorus(`ring_${i}`, {
                diameter: 30 + i * 10,
                thickness: 0.5,
                tessellation: 64
            }, this.scene);
            ring.position = pos;
            ring.rotation.x = Math.PI / 2 + Math.random() * 0.3;
            ring.material = ringMaterial;
            this.glowLayer.addIncludedOnlyMesh(ring);
            
            // Slow rotation
            this.scene.onBeforeRenderObservable.add(() => {
                ring.rotation.z += 0.003;
            });
        });
    }

    public getGlowLayer(): GlowLayer {
        return this.glowLayer;
    }

    public dispose(): void {
        this.ambientParticles.dispose();
        this.glowLayer.dispose();
        this.pipeline.dispose();
    }
}
