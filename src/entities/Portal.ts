import {
    Scene,
    Mesh,
    MeshBuilder,
    Vector3,
    Color3,
    Color4,
    PBRMaterial,
    GlowLayer,
    TransformNode,
    ParticleSystem,
    Texture,
    DynamicTexture,
    StandardMaterial
} from '@babylonjs/core';

export type PortalState = 'neutral' | 'correct' | 'wrong' | 'revealed';

export interface PortalConfig {
    answerText: string;
    isCorrect: boolean;
    laneIndex: number;
    lanePosition: number;
}

export class Portal {
    private scene: Scene;
    private glowLayer: GlowLayer;
    private parent: TransformNode;
    private particles: ParticleSystem;
    private material: PBRMaterial;
    private innerMaterial: PBRMaterial;
    
    public answerText: string;
    public isCorrect: boolean;
    public laneIndex: number;
    private state: PortalState = 'neutral';
    private baseColor: Color3;
    private pulseTime: number = 0;

    constructor(scene: Scene, glowLayer: GlowLayer, config: PortalConfig) {
        this.scene = scene;
        this.glowLayer = glowLayer;
        this.answerText = config.answerText;
        this.isCorrect = config.isCorrect;
        this.laneIndex = config.laneIndex;
        
        // Neutral color - softer purple/blue
        this.baseColor = new Color3(0.25, 0.15, 0.5);
        
        this.parent = new TransformNode(`portal_${config.laneIndex}`, scene);
        this.parent.position.x = config.lanePosition;
        
        this.material = this.createMaterial();
        this.innerMaterial = this.createInnerMaterial();
        
        this.createArch();
        this.createInnerGlow();
        this.createTextPlane();
        this.particles = this.createParticles();
        
        this.startPulseAnimation();
    }

    private createMaterial(): PBRMaterial {
        const mat = new PBRMaterial(`portalMat_${this.laneIndex}`, this.scene);
        mat.albedoColor = this.baseColor;
        mat.emissiveColor = this.baseColor.scale(0.3); // Much less glow
        mat.metallic = 0.6;
        mat.roughness = 0.3;
        return mat;
    }

    private createInnerMaterial(): PBRMaterial {
        const mat = new PBRMaterial(`portalInnerMat_${this.laneIndex}`, this.scene);
        mat.albedoColor = this.baseColor.scale(0.3);
        mat.emissiveColor = this.baseColor.scale(0.15); // Much less glow
        mat.metallic = 0.1;
        mat.roughness = 0.9;
        mat.alpha = 0.25;
        return mat;
    }

    private createArch(): void {
        const height = 4;
        const width = 2.4;
        const thickness = 0.25;
        const depth = 0.3;

        // Left pillar
        const left = MeshBuilder.CreateBox(`archLeft_${this.laneIndex}`, {
            width: thickness,
            height: height,
            depth: depth
        }, this.scene);
        left.position.x = -width / 2;
        left.position.y = height / 2;
        left.material = this.material;
        left.parent = this.parent;
        this.glowLayer.addIncludedOnlyMesh(left);

        // Right pillar
        const right = MeshBuilder.CreateBox(`archRight_${this.laneIndex}`, {
            width: thickness,
            height: height,
            depth: depth
        }, this.scene);
        right.position.x = width / 2;
        right.position.y = height / 2;
        right.material = this.material;
        right.parent = this.parent;
        this.glowLayer.addIncludedOnlyMesh(right);

        // Top arch (rounded corners effect with multiple segments)
        const top = MeshBuilder.CreateBox(`archTop_${this.laneIndex}`, {
            width: width + thickness,
            height: thickness,
            depth: depth
        }, this.scene);
        top.position.y = height;
        top.material = this.material;
        top.parent = this.parent;
        this.glowLayer.addIncludedOnlyMesh(top);

        // Add decorative spheres at corners
        const cornerRadius = 0.2;
        const corners = [
            new Vector3(-width / 2, height, 0),
            new Vector3(width / 2, height, 0),
            new Vector3(-width / 2, 0, 0),
            new Vector3(width / 2, 0, 0)
        ];

        corners.forEach((pos, i) => {
            const sphere = MeshBuilder.CreateSphere(`corner_${this.laneIndex}_${i}`, {
                diameter: cornerRadius * 2
            }, this.scene);
            sphere.position = pos;
            sphere.material = this.material;
            sphere.parent = this.parent;
            this.glowLayer.addIncludedOnlyMesh(sphere);
        });
    }

    private createInnerGlow(): Mesh {
        // Create a glowing plane inside the portal
        const plane = MeshBuilder.CreatePlane(`portalInner_${this.laneIndex}`, {
            width: 2.2,
            height: 3.8
        }, this.scene);
        plane.position.y = 2;
        plane.position.z = 0.05;
        plane.material = this.innerMaterial;
        plane.parent = this.parent;
        
        return plane;
    }

    private createTextPlane(): Mesh {
        // Dynamic texture for text - larger for better visibility
        const textureWidth = 512;
        const textureHeight = 160;
        const texture = new DynamicTexture(`textTexture_${this.laneIndex}`, {
            width: textureWidth,
            height: textureHeight
        }, this.scene);
        
        // Draw background first for better contrast
        const ctx = texture.getContext();
        ctx.fillStyle = 'rgba(20, 10, 40, 0.85)';
        ctx.fillRect(10, 10, textureWidth - 20, textureHeight - 20);
        
        // Draw border
        ctx.strokeStyle = 'rgba(150, 100, 255, 0.6)';
        ctx.lineWidth = 3;
        ctx.strokeRect(10, 10, textureWidth - 20, textureHeight - 20);
        texture.update();
        
        // Draw text - bright and bold
        const fontSize = this.calculateFontSize(this.answerText);
        texture.drawText(
            this.answerText,
            null, // centered horizontally
            textureHeight / 2 + fontSize / 3, // vertical center
            `bold ${fontSize}px Arial`,
            '#FFFFFF', // Pure white for best visibility
            null, // Don't clear background
            true
        );

        // Create material - brighter emission
        const textMat = new StandardMaterial(`textMat_${this.laneIndex}`, this.scene);
        textMat.diffuseTexture = texture;
        textMat.emissiveTexture = texture;
        textMat.emissiveColor = new Color3(0.5, 0.5, 0.5); // Brighter text
        textMat.diffuseTexture.hasAlpha = true;
        textMat.useAlphaFromDiffuseTexture = true;
        textMat.backFaceCulling = false;

        // Create plane above portal - larger
        const plane = MeshBuilder.CreatePlane(`textPlane_${this.laneIndex}`, {
            width: 2.8,
            height: 0.9
        }, this.scene);
        plane.position.y = 5;
        plane.billboardMode = Mesh.BILLBOARDMODE_Y;
        plane.material = textMat;
        plane.parent = this.parent;

        return plane;
    }

    private calculateFontSize(text: string): number {
        if (text.length <= 5) return 64;
        if (text.length <= 10) return 48;
        if (text.length <= 15) return 36;
        return 28;
    }

    private createParticles(): ParticleSystem {
        const particles = new ParticleSystem(`particles_${this.laneIndex}`, 100, this.scene);
        
        // Use a simple texture for particles
        particles.particleTexture = new Texture("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAABNklEQVR4nO2WMU4DMRBF3yKltKRNN8UWKaigSw8lHdyAI+QEnIMbcBO6VJRwD0q2QwqCgpRYst1kF6/xbESx/JE7jf+bGXvGhkKh8J+wAJ4BDdwCZ8CnBxyK78ALcJERbzLiTUa8yYg3GfEhI36QEQ8y4kVGvMqI5xnxNCPepMZd+qGYpR+K+e/r+AvYAs9ATUQ8Bx6BOxXx8+TdJu9u+qFYpR+K2Z5VcNIPxSz9UMz0Q/EgI56mxBbAPXCtIt4lxJr9UFzoj2YCruGnM+AB+FDxbkK8AF6BdxXvJsRr4B1YU/FuQrwB3oA1Fe8mxDvgFVhT8W5CvAdegDUV7ybEB+AZWFPxbkJ8BJ6ANRXvJsQn4BF4VPFuQnwBHoCHlNhFfwQ+gMOU2EV/lBK76I9SYhf9Y+jP4BstWGYhI3pG0wAAAABJRU5ErkJggg==", this.scene);
        
        // Use Vector3 for emitter position (will be updated manually)
        particles.emitter = new Vector3(0, 2, 0);
        particles.minEmitBox = new Vector3(-1, -2, -0.2);
        particles.maxEmitBox = new Vector3(1, 2, 0.2);
        
        particles.color1 = new Color4(0.6, 0.3, 1, 1);
        particles.color2 = new Color4(0.3, 0.6, 1, 1);
        particles.colorDead = new Color4(0.2, 0.1, 0.5, 0);
        
        particles.minSize = 0.05;
        particles.maxSize = 0.15;
        
        particles.minLifeTime = 0.5;
        particles.maxLifeTime = 1.5;
        
        particles.emitRate = 30;
        
        particles.direction1 = new Vector3(-0.2, 1, -0.1);
        particles.direction2 = new Vector3(0.2, 2, 0.1);
        
        particles.minEmitPower = 0.5;
        particles.maxEmitPower = 1;
        
        particles.gravity = new Vector3(0, -0.5, 0);
        
        particles.start();
        
        return particles;
    }

    private startPulseAnimation(): void {
        // Create subtle pulsing effect
        this.scene.onBeforeRenderObservable.add(() => {
            this.pulseTime += 0.03;
            const pulse = 0.8 + Math.sin(this.pulseTime) * 0.2;
            
            if (this.state === 'neutral') {
                this.material.emissiveColor = this.baseColor.scale(0.7 * pulse);
                this.innerMaterial.alpha = 0.3 + Math.sin(this.pulseTime * 0.5) * 0.15;
            }
        });
    }

    public setPosition(z: number): void {
        this.parent.position.z = z;
        // Update particle emitter position
        if (this.particles.emitter instanceof Vector3) {
            this.particles.emitter.x = this.parent.position.x;
            this.particles.emitter.z = z;
        }
    }

    public getPosition(): Vector3 {
        return this.parent.position.clone();
    }

    public reveal(): void {
        this.state = 'revealed';
        
        if (this.isCorrect) {
            // Correct - bright green
            const correctColor = new Color3(0.2, 1, 0.3);
            this.material.albedoColor = correctColor;
            this.material.emissiveColor = correctColor.scale(0.8);
            this.innerMaterial.albedoColor = correctColor.scale(0.5);
            this.innerMaterial.emissiveColor = correctColor.scale(0.5);
            this.particles.color1 = new Color4(0.2, 1, 0.3, 1);
            this.particles.color2 = new Color4(0.5, 1, 0.5, 1);
        } else {
            // Wrong - red
            const wrongColor = new Color3(1, 0.2, 0.2);
            this.material.albedoColor = wrongColor;
            this.material.emissiveColor = wrongColor.scale(0.8);
            this.innerMaterial.albedoColor = wrongColor.scale(0.5);
            this.innerMaterial.emissiveColor = wrongColor.scale(0.5);
            this.particles.color1 = new Color4(1, 0.2, 0.2, 1);
            this.particles.color2 = new Color4(1, 0.5, 0.3, 1);
        }
    }

    public setCorrectHighlight(): void {
        // Highlight correct answer green after wrong choice
        const correctColor = new Color3(0.2, 1, 0.3);
        this.material.albedoColor = correctColor;
        this.material.emissiveColor = correctColor.scale(0.8);
    }

    public dispose(): void {
        this.particles.stop();
        this.particles.dispose();
        this.parent.dispose();
    }
}

// Manager class for spawning and managing portal sets
export class PortalManager {
    private scene: Scene;
    private glowLayer: GlowLayer;
    private activePortals: Portal[] = [];
    private lanePositions: number[];
    private readonly despawnDistance: number = -15;

    constructor(scene: Scene, glowLayer: GlowLayer, lanePositions: number[]) {
        this.scene = scene;
        this.glowLayer = glowLayer;
        this.lanePositions = lanePositions;
    }

    public spawnPortalSet(question: { answers: string[], correctIndex: number }, zPosition: number): { portals: Portal[], displayAnswers: string[] } {
        // Shuffle answers to random lanes while tracking correct index
        const shuffled = this.shuffleAnswers(question.answers, question.correctIndex);
        
        const portals: Portal[] = [];
        
        for (let i = 0; i < 3; i++) {
            const portal = new Portal(this.scene, this.glowLayer, {
                answerText: shuffled.answers[i],
                isCorrect: i === shuffled.correctLane,
                laneIndex: i,
                lanePosition: this.lanePositions[i]
            });
            portal.setPosition(zPosition);
            portals.push(portal);
        }
        
        this.activePortals.push(...portals);
        
        // Return both portals and the shuffled answers (in lane order: Left, Center, Right)
        return { portals, displayAnswers: shuffled.answers };
    }

    private shuffleAnswers(answers: string[], correctIndex: number): { answers: string[], correctLane: number } {
        const result = [...answers];
        let newCorrectIndex = correctIndex;
        
        // Fisher-Yates shuffle while tracking correct answer
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
            
            // Update correct index if it was involved in swap
            if (correctIndex === i) newCorrectIndex = j;
            else if (correctIndex === j) newCorrectIndex = i;
            correctIndex = newCorrectIndex;
        }
        
        return { answers: result, correctLane: newCorrectIndex };
    }

    public update(deltaTime: number, speed: number): void {
        const moveDistance = speed * (deltaTime / 1000);
        
        // Move and cleanup portals
        for (let i = this.activePortals.length - 1; i >= 0; i--) {
            const portal = this.activePortals[i];
            const pos = portal.getPosition();
            portal.setPosition(pos.z - moveDistance);
            
            if (pos.z < this.despawnDistance) {
                portal.dispose();
                this.activePortals.splice(i, 1);
            }
        }
    }

    public getActivePortals(): Portal[] {
        return this.activePortals;
    }

    public clearAll(): void {
        for (const portal of this.activePortals) {
            portal.dispose();
        }
        this.activePortals = [];
    }
}