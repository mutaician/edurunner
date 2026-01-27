import {
    Engine,
    Scene,
    ArcRotateCamera,
    Vector3,
    Color4
} from '@babylonjs/core';
import { Track } from './entities/Track';
import { Player } from './entities/Player';
import { Portal, PortalManager } from './entities/Portal';
import { Environment } from './entities/Environment';

export type GameState = 'menu' | 'loading' | 'playing' | 'paused' | 'results';

export class Game {
    private canvas: HTMLCanvasElement;
    private engine: Engine;
    private scene: Scene;
    private environment: Environment;
    private track: Track;
    private player: Player;
    private portalManager: PortalManager;
    private camera: ArcRotateCamera;
    
    private state: GameState = 'playing'; // For now, start in playing state
    private score: number = 0;
    private currentQuestionIndex: number = 0;
    
    // Demo questions for testing visuals
    private demoQuestions = [
        { question: "What is 2 + 2?", answers: ["3", "4", "5"], correctIndex: 1 },
        { question: "Capital of France?", answers: ["London", "Berlin", "Paris"], correctIndex: 2 },
        { question: "Largest planet?", answers: ["Jupiter", "Saturn", "Earth"], correctIndex: 0 },
    ];
    
    private nextPortalSpawnZ: number = 40; // Spawn portals ahead of player (player at Z=5)
    private readonly portalSpacing: number = 35; // Spacing between portal sets
    private activePortalSet: Portal[] = [];
    private waitingForNextQuestion: boolean = false;
    private questionDisplay: HTMLDivElement | null = null;

    constructor() {
        this.canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
        
        // Create question display UI
        this.createQuestionUI();
        
        this.engine = new Engine(this.canvas, true, {
            preserveDrawingBuffer: true,
            stencil: true,
            antialias: true
        });
        
        // Create scene
        this.scene = new Scene(this.engine);
        this.scene.clearColor = new Color4(0.02, 0.02, 0.06, 1);
        
        // Create environment first (sets up glow layer)
        this.environment = new Environment(this.scene);
        
        // Setup camera
        this.camera = this.createCamera();
        
        // Create track with glow layer reference
        this.track = new Track(this.scene, this.environment.getGlowLayer());
        
        // Create player with glow layer reference
        const lanePositions = this.track.getLanePositions();
        this.player = new Player(this.scene, this.environment.getGlowLayer(), lanePositions);
        
        // Create portal manager
        this.portalManager = new PortalManager(
            this.scene,
            this.environment.getGlowLayer(),
            lanePositions
        );
        
        // Spawn first set of portals
        this.spawnNextPortals();

        // Start render loop
        this.engine.runRenderLoop(() => {
            const deltaTime = this.engine.getDeltaTime();
            this.update(deltaTime);
            this.scene.render();
        });

        // Handle resize
        window.addEventListener('resize', () => {
            this.engine.resize();
        });

        // Debug info
        console.log('🎮 EduRunner initialized!');
        console.log('Controls: Arrow keys or A/D to move, Swipe on mobile');
    }

    private createCamera(): ArcRotateCamera {
        // Camera positioned behind and above the player
        // Player is at Z=5, camera target slightly ahead of player
        const camera = new ArcRotateCamera(
            "camera",
            -Math.PI / 2,    // Alpha: directly behind
            Math.PI / 2.8,   // Beta: slight tilt down
            15,              // Radius: distance from target
            new Vector3(0, 2, 10), // Target: ahead of player (player at Z=5)
            this.scene
        );
        
        // Lock camera to prevent user rotation
        camera.lowerAlphaLimit = camera.upperAlphaLimit = -Math.PI / 2;
        camera.lowerBetaLimit = camera.upperBetaLimit = Math.PI / 2.8;
        camera.lowerRadiusLimit = camera.upperRadiusLimit = 15;
        
        // Standard FOV
        camera.fov = 0.8;
        
        // Add subtle camera movement
        let cameraTime = 0;
        this.scene.onBeforeRenderObservable.add(() => {
            cameraTime += 0.01;
            // Very subtle floating motion
            camera.target.y = 2 + Math.sin(cameraTime * 0.3) * 0.05;
        });
        
        return camera;
    }

    private update(deltaTime: number): void {
        if (this.state !== 'playing') return;
        
        // Update track
        this.track.update(deltaTime);
        
        // Update portals
        this.portalManager.update(deltaTime, this.track.getSpeed());
        
        // Check for portal collision
        this.checkPortalCollision();
        
        // Spawn next portals if needed
        this.checkSpawnPortals();
    }

    private checkPortalCollision(): void {
        if (this.waitingForNextQuestion) return;
        
        const playerPos = this.player.getPosition();
        const playerLane = this.player.getCurrentLane();
        
        for (const portal of this.activePortalSet) {
            const portalPos = portal.getPosition();
            
            // Check if player has passed this portal set (Z-crossing)
            if (portalPos.z < playerPos.z - 1) {
                // Player has passed the portals - determine which one they went through
                this.handlePortalPassed(playerLane);
                return;
            }
        }
    }

    private handlePortalPassed(playerLane: number): void {
        this.waitingForNextQuestion = true;
        
        // Find which portal was selected and reveal all
        let selectedPortal: Portal | null = null;
        let correctPortal: Portal | null = null;
        
        for (const portal of this.activePortalSet) {
            portal.reveal();
            if (portal.laneIndex === playerLane) {
                selectedPortal = portal;
            }
            if (portal.isCorrect) {
                correctPortal = portal;
            }
        }
        
        // Update score
        if (selectedPortal?.isCorrect) {
            this.score++;
            console.log(`✅ Correct! Score: ${this.score}`);
            this.showCorrectFeedback();
        } else {
            console.log(`❌ Wrong! The correct answer was: ${correctPortal?.answerText}`);
            this.showWrongFeedback();
            // Highlight correct portal
            if (correctPortal && !correctPortal.isCorrect) {
                correctPortal.setCorrectHighlight();
            }
        }
        
        // Clear active set and prepare for next question
        setTimeout(() => {
            this.activePortalSet = [];
            this.currentQuestionIndex++;
            this.waitingForNextQuestion = false;
            
            // Check if game is over
            if (this.currentQuestionIndex >= this.demoQuestions.length) {
                this.currentQuestionIndex = 0; // Loop for demo
                console.log(`🎮 Game complete! Final score: ${this.score}/${this.demoQuestions.length}`);
                this.score = 0; // Reset for demo
            }
        }, 1500);
    }

    private showCorrectFeedback(): void {
        // Green flash effect
        const originalClearColor = this.scene.clearColor.clone();
        this.scene.clearColor = new Color4(0.1, 0.4, 0.1, 1);
        
        setTimeout(() => {
            this.scene.clearColor = originalClearColor;
        }, 150);
        
        // Camera shake (subtle)
        this.cameraShake(0.1, 200);
    }

    private showWrongFeedback(): void {
        // Red flash effect
        const originalClearColor = this.scene.clearColor.clone();
        this.scene.clearColor = new Color4(0.4, 0.1, 0.1, 1);
        
        setTimeout(() => {
            this.scene.clearColor = originalClearColor;
        }, 150);
        
        // Camera shake (more intense)
        this.cameraShake(0.3, 300);
    }

    private cameraShake(intensity: number, duration: number): void {
        const startTime = performance.now();
        const originalTarget = this.camera.target.clone();
        
        const shake = () => {
            const elapsed = performance.now() - startTime;
            if (elapsed > duration) {
                this.camera.target = originalTarget;
                return;
            }
            
            const remaining = 1 - (elapsed / duration);
            const offsetX = (Math.random() - 0.5) * intensity * remaining;
            const offsetY = (Math.random() - 0.5) * intensity * remaining;
            
            this.camera.target.x = originalTarget.x + offsetX;
            this.camera.target.y = originalTarget.y + offsetY;
            
            requestAnimationFrame(shake);
        };
        
        shake();
    }

    private checkSpawnPortals(): void {
        if (this.activePortalSet.length === 0 && !this.waitingForNextQuestion) {
            this.spawnNextPortals();
        }
    }

    private spawnNextPortals(): void {
        const question = this.demoQuestions[this.currentQuestionIndex];
        this.activePortalSet = this.portalManager.spawnPortalSet(question, this.nextPortalSpawnZ);
        this.nextPortalSpawnZ += this.portalSpacing;
        
        // Show question in UI
        this.showQuestion(question.question);
        console.log(`📝 Question: ${question.question}`);
    }

    private createQuestionUI(): void {
        // Create question display overlay
        this.questionDisplay = document.createElement('div');
        this.questionDisplay.id = 'questionDisplay';
        this.questionDisplay.style.cssText = `
            position: fixed;
            top: 40px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(15, 10, 35, 0.9);
            border: 2px solid rgba(100, 150, 255, 0.5);
            border-radius: 12px;
            padding: 15px 30px;
            color: white;
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 22px;
            font-weight: bold;
            text-align: center;
            z-index: 1000;
            box-shadow: 0 4px 20px rgba(0, 100, 255, 0.3);
            min-width: 300px;
            max-width: 80%;
        `;
        document.body.appendChild(this.questionDisplay);
    }

    private showQuestion(text: string): void {
        if (this.questionDisplay) {
            this.questionDisplay.textContent = text;
            this.questionDisplay.style.opacity = '1';
        }
    }

    public getScore(): number {
        return this.score;
    }

    public getState(): GameState {
        return this.state;
    }

    public setState(state: GameState): void {
        this.state = state;
    }
}
