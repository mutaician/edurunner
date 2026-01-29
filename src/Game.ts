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
import { questionService } from './services/QuestionService';
import type { Question } from './services/QuestionService';
import { scoreManager } from './services/ScoreManager';
import { UIManager } from './services/UIManager';
import { initAudioManager } from './services/AudioManager';
import type { AudioManager } from './services/AudioManager';

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
    private ui: UIManager;
    private audioManager: AudioManager;
    
    private state: GameState = 'menu';
    private currentQuestionIndex: number = 0;
    private questions: Question[] = [];
    
    // Game settings
    private currentTopic: string = '';
    private currentDifficulty: string = 'medium';
    private questionsPerGame: number = 10;
    
    private nextPortalSpawnZ: number = 70; // Spawn first portal further ahead for reading time
    private readonly portalSpacing: number = 45; // Consistent spacing between portals
    private activePortalSet: Portal[] = [];
    private waitingForNextQuestion: boolean = false;

    constructor() {
        this.canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
        
        this.engine = new Engine(this.canvas, true, {
            preserveDrawingBuffer: true,
            stencil: true,
            antialias: true,
            audioEngine: true  // Required for Babylon.js 8.0+
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
        
        // Initialize audio manager
        this.audioManager = initAudioManager(this.scene);
        
        // Create UI Manager with callbacks
        this.ui = new UIManager({
            onStartGame: (topic, difficulty, questionCount) => this.startGame(topic, difficulty, questionCount),
            onResumeGame: () => this.togglePause(),
            onRestartGame: () => this.restartGame(),
            onBackToMenu: () => this.backToMenu(),
            onMoveLeft: () => this.player?.moveLeft(),
            onMoveRight: () => this.player?.moveRight(),
            onToggleMute: () => {
                const isMuted = this.audioManager?.toggleMute() ?? false;
                this.ui.updateMuteButton(isMuted);
            },
            onSpeedUp: () => {
                if (this.state === 'playing') {
                    this.track.increaseSpeed();
                    this.showSpeedIndicator();
                    this.syncAnimationSpeed();
                }
            },
            onSpeedDown: () => {
                if (this.state === 'playing') {
                    this.track.decreaseSpeed();
                    this.showSpeedIndicator();
                    this.syncAnimationSpeed();
                }
            },
        });
        
        // Connect score manager to UI
        scoreManager.onScoreChange = (score, total) => {
            this.ui.updateScore(score, total);
        };

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
        
        // Setup speed control
        this.setupSpeedControl();
        
        // Debug info
        console.log('EduRunner initialized!');
        console.log('Controls: A/D or ←→ to move, ↑↓ to adjust speed, ESC to pause');
    }

    private setupSpeedControl(): void {
        window.addEventListener('keydown', (e) => {
            if (this.state !== 'playing') return;
            
            if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
                this.track.increaseSpeed();
                this.showSpeedIndicator();
                this.syncAnimationSpeed();
            } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
                this.track.decreaseSpeed();
                this.showSpeedIndicator();
                this.syncAnimationSpeed();
            }
        });
    }

    private showSpeedIndicator(): void {
        const limits = this.track.getSpeedLimits();
        this.ui.showSpeedIndicator(limits.current, limits.min, limits.max);
    }

    private syncAnimationSpeed(): void {
        const limits = this.track.getSpeedLimits();
        this.player.setAnimationSpeed(limits.current, limits.min, limits.max);
    }

    private async startGame(topic: string, difficulty: string, questionCount: number = 10): Promise<void> {
        this.currentTopic = topic;
        this.currentDifficulty = difficulty;
        this.questionsPerGame = questionCount;
        
        // Show loading screen
        this.ui.showScreen('loading');
        
        try {
            // Fetch questions from API (or fallback)
            this.questions = await questionService.fetchQuestions({
                topic,
                difficulty: difficulty as 'easy' | 'medium' | 'hard',
                count: this.questionsPerGame
            });
            
            console.log(`Loaded ${this.questions.length} questions on "${topic}"`);
            
            // Initialize game state
            this.resetGameState();
            
            // Initialize score manager
            scoreManager.startGame(topic, difficulty, this.questions.length);
            
            // Show game UI and spawn first portals
            this.ui.showScreen('game');
            this.state = 'playing';
            this.spawnNextPortals();
            
            // Start background music
            this.audioManager.startMusic();
            
        } catch (error) {
            console.error('Failed to load questions:', error);
            // Show error and go back to menu
            alert('Failed to load questions. Please try again.');
            this.ui.showScreen('menu');
        }
    }

    private resetGameState(): void {
        this.currentQuestionIndex = 0;
        this.nextPortalSpawnZ = 70; // Give player time to read first question
        this.waitingForNextQuestion = false;
        
        // Clear any existing portals
        this.portalManager.clearAll();
        this.activePortalSet = [];
        
        // Reset player position
        this.player.resetPosition();
        
        // Clear chat history for new game
        this.ui.clearChatHistory();
    }

    private togglePause(): void {
        if (this.state === 'playing') {
            this.state = 'paused';
            this.ui.showScreen('paused');
            this.audioManager.pauseMusic();
            console.log('Game paused');
        } else if (this.state === 'paused') {
            this.state = 'playing';
            this.ui.showScreen('game');
            this.audioManager.resumeMusic();
            console.log('Game resumed');
        }
    }

    private restartGame(): void {
        // Restart with same settings
        this.startGame(this.currentTopic, this.currentDifficulty);
    }

    private backToMenu(): void {
        this.state = 'menu';
        this.portalManager.clearAll();
        this.activePortalSet = [];
        this.ui.showScreen('menu');
        this.ui.hideQuestion();
        this.audioManager.stopMusic();
    }

    private createCamera(): ArcRotateCamera {
        const camera = new ArcRotateCamera(
            "camera",
            -Math.PI / 2,
            Math.PI / 2.8,
            15,
            new Vector3(0, 2, 10),
            this.scene
        );
        
        // Lock camera
        camera.lowerAlphaLimit = camera.upperAlphaLimit = -Math.PI / 2;
        camera.lowerBetaLimit = camera.upperBetaLimit = Math.PI / 2.8;
        camera.lowerRadiusLimit = camera.upperRadiusLimit = 15;
        
        // Adjust FOV based on screen aspect ratio for mobile
        this.adjustCameraForScreen(camera);
        
        // Re-adjust on resize
        window.addEventListener('resize', () => {
            this.adjustCameraForScreen(camera);
        });
        
        // Subtle camera movement
        let cameraTime = 0;
        this.scene.onBeforeRenderObservable.add(() => {
            cameraTime += 0.01;
            camera.target.y = 2 + Math.sin(cameraTime * 0.3) * 0.05;
        });
        
        return camera;
    }

    private adjustCameraForScreen(camera: ArcRotateCamera): void {
        const aspectRatio = window.innerWidth / window.innerHeight;
        
        // For portrait/mobile screens, use wider FOV to see all lanes
        if (aspectRatio < 1) {
            // Portrait mode - need much wider FOV
            camera.fov = 1.2;
        } else if (aspectRatio < 1.5) {
            // Narrow screens
            camera.fov = 1.0;
        } else {
            // Normal desktop
            camera.fov = 0.8;
        }
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
            
            // Check if player has passed this portal set
            if (portalPos.z < playerPos.z - 1) {
                this.handlePortalPassed(playerLane);
                return;
            }
        }
    }

    private handlePortalPassed(playerLane: number): void {
        this.waitingForNextQuestion = true;
        
        // Find selected and correct portals
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
        
        const currentQuestion = this.questions[this.currentQuestionIndex];
        
        // Update score and show feedback
        if (selectedPortal?.isCorrect) {
            scoreManager.addCorrect();
            this.showCorrectFeedback();
            console.log(`Correct! Score: ${scoreManager.getScore()}`);
        } else {
            scoreManager.addWrong(
                currentQuestion.question,
                selectedPortal?.answerText || 'None',
                correctPortal?.answerText || ''
            );
            this.showWrongFeedback();
            console.log(`Wrong! Correct: ${correctPortal?.answerText}`);
            
            // Highlight correct portal
            correctPortal?.setCorrectHighlight();
        }
        
        // Prepare for next question
        setTimeout(() => {
            this.activePortalSet = [];
            this.currentQuestionIndex++;
            this.waitingForNextQuestion = false;
            
            // Check if game is over
            if (this.currentQuestionIndex >= this.questions.length) {
                this.endGame();
            }
        }, 1500);
    }

    private endGame(): void {
        this.state = 'results';
        
        // Stop background music
        this.audioManager.stopMusic();
        
        // Save score and show results
        const gameScore = scoreManager.saveGame();
        
        // Set chat context with quiz data for AI tutor
        this.ui.setChatContext({
            topic: this.currentTopic,
            difficulty: this.currentDifficulty,
            questions: this.questions,
            wrongAnswers: gameScore.wrongAnswers
        });
        
        this.ui.showResults(gameScore);
        
        console.log(`Game complete! Final score: ${gameScore.score}/${gameScore.totalQuestions} (${gameScore.percentage}%)`);
    }

    private showCorrectFeedback(): void {
        this.ui.showFeedbackFlash(true);
        this.audioManager.playCorrect();
        this.cameraShake(0.1, 200);
    }

    private showWrongFeedback(): void {
        this.ui.showFeedbackFlash(false);
        this.audioManager.playWrong();
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
            if (this.currentQuestionIndex < this.questions.length) {
                this.spawnNextPortals();
            }
        }
    }

    private spawnNextPortals(): void {
        const question = this.questions[this.currentQuestionIndex];
        
        // Spawn portals and get shuffled answers (in lane order: Left, Center, Right)
        const { portals, displayAnswers } = this.portalManager.spawnPortalSet({
            answers: question.answers,
            correctIndex: question.correctIndex
        }, this.nextPortalSpawnZ);
        
        this.activePortalSet = portals;
        this.nextPortalSpawnZ += this.portalSpacing;
        
        // Show question with answers matching portal positions (A=Left, B=Center, C=Right)
        this.ui.showQuestion(this.currentQuestionIndex ,question.question, displayAnswers);
        console.log(`Q${this.currentQuestionIndex + 1}: ${question.question}`);
    }

    public getState(): GameState {
        return this.state;
    }
}
