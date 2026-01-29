// UI Manager - handles all HTML overlay UI (Menu, Pause, Results, HUD)

import { questionService } from './QuestionService';
import { scoreManager, ScoreManager } from './ScoreManager';
import type { GameScore } from './ScoreManager';
import { chatService } from './ChatService';
import type { QuizContext } from './ChatService';

export type UIScreen = 'menu' | 'loading' | 'game' | 'paused' | 'results';

export interface UICallbacks {
    onStartGame: (topic: string, difficulty: string, questionCount: number) => void;
    onResumeGame: () => void;
    onRestartGame: () => void;
    onBackToMenu: () => void;
}

export class UIManager {
    private container: HTMLDivElement;
    private currentScreen: UIScreen = 'menu';
    private callbacks: UICallbacks;
    
    // UI Elements
    private menuScreen: HTMLDivElement | null = null;
    private loadingScreen: HTMLDivElement | null = null;
    private pauseScreen: HTMLDivElement | null = null;
    private resultsScreen: HTMLDivElement | null = null;
    private hudElement: HTMLDivElement | null = null;
    private questionDisplay: HTMLDivElement | null = null;
    private pauseButton: HTMLButtonElement | null = null;
    private chatPanel: HTMLDivElement | null = null;
    
    // Current selection
    private selectedTopic: string = 'Programming';
    private selectedDifficulty: string = 'medium';
    private questionCount: number = 10;
    private customTopic: string = '';
    private useCustomTopic: boolean = false;

    constructor(callbacks: UICallbacks) {
        this.callbacks = callbacks;
        
        // Create main container
        this.container = document.createElement('div');
        this.container.id = 'ui-container';
        this.container.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 1000;
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
        `;
        document.body.appendChild(this.container);
        
        // Create all screens
        this.createMenuScreen();
        this.createLoadingScreen();
        this.createPauseScreen();
        this.createResultsScreen();
        this.createHUD();
        this.createQuestionDisplay();
        this.createChatPanel();
        
        // Setup keyboard shortcuts
        this.setupKeyboardShortcuts();
        
        // Show menu initially
        this.showScreen('menu');
    }

    private createMenuScreen(): void {
        this.menuScreen = document.createElement('div');
        this.menuScreen.className = 'ui-screen';
        this.menuScreen.style.cssText = this.getScreenStyle();
        
        const topics = questionService.getAvailableTopics();
        
        this.menuScreen.innerHTML = `
            <div style="max-width: 550px; width: 90%; text-align: center; max-height: 90vh; overflow-y: auto;">
                <h1 style="font-size: 48px; margin-bottom: 10px; color: #fff; text-shadow: 0 0 20px rgba(100, 200, 255, 0.8);">
                    🎮 EduRunner
                </h1>
                <p style="color: #aaa; margin-bottom: 25px; font-size: 16px;">
                    Learn while you run! Choose a topic and test your knowledge.
                </p>
                
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 10px; color: #ccc; font-size: 14px;">SELECT TOPIC</label>
                    <div id="topic-buttons" style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-bottom: 12px;">
                        ${topics.map(topic => `
                            <button class="topic-btn" data-topic="${topic}" style="${this.getTopicButtonStyle(topic === this.selectedTopic && !this.useCustomTopic)}">
                                ${topic}
                            </button>
                        `).join('')}
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px; justify-content: center;">
                        <span style="color: #888; font-size: 13px;">or enter your own:</span>
                        <input type="text" id="custom-topic" placeholder="e.g., Space Exploration" 
                            style="padding: 8px 12px; border: 2px solid rgba(100, 200, 255, 0.3); background: rgba(0,0,0,0.4); 
                            color: #fff; border-radius: 8px; font-size: 14px; width: 180px; outline: none;"
                            value="${this.customTopic}">
                    </div>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 10px; color: #ccc; font-size: 14px;">DIFFICULTY</label>
                    <div id="difficulty-buttons" style="display: flex; gap: 10px; justify-content: center;">
                        <button class="diff-btn" data-diff="easy" style="${this.getDifficultyButtonStyle('easy', 'easy' === this.selectedDifficulty)}">Easy</button>
                        <button class="diff-btn" data-diff="medium" style="${this.getDifficultyButtonStyle('medium', 'medium' === this.selectedDifficulty)}">Medium</button>
                        <button class="diff-btn" data-diff="hard" style="${this.getDifficultyButtonStyle('hard', 'hard' === this.selectedDifficulty)}">Hard</button>
                    </div>
                </div>
                
                <div style="margin-bottom: 25px;">
                    <label style="display: block; margin-bottom: 10px; color: #ccc; font-size: 14px;">
                        NUMBER OF QUESTIONS: <span id="question-count-display" style="color: #64c8ff; font-weight: bold;">${this.questionCount}</span>
                    </label>
                    <input type="range" id="question-count" min="5" max="50" value="${this.questionCount}" 
                        style="width: 200px; cursor: pointer;">
                </div>
                
                <button id="start-btn" style="${this.getStartButtonStyle()}">
                    ▶ START GAME
                </button>
                
                <button id="chat-menu-btn" style="margin-top: 15px; padding: 12px 30px; background: rgba(156, 39, 176, 0.3); border: 2px solid rgba(156, 39, 176, 0.5); border-radius: 10px; color: #ce93d8; font-size: 16px; cursor: pointer; transition: all 0.2s;">
                    💬 AI Tutor (Review Past Games)
                </button>
                
                <div id="stats-preview" style="margin-top: 25px; padding: 15px; background: rgba(0,0,0,0.3); border-radius: 10px;">
                    ${this.getStatsPreviewHTML()}
                </div>
                
                <p style="color: #666; font-size: 12px; margin-top: 15px;">
                    Controls: A/D or ←→ to move • ↑↓ to adjust speed • ESC to pause
                </p>
            </div>
        `;
        
        this.container.appendChild(this.menuScreen);
        
        // Setup event listeners
        this.setupMenuListeners();
    }

    private setupMenuListeners(): void {
        if (!this.menuScreen) return;
        
        // Topic buttons
        const topicBtns = this.menuScreen.querySelectorAll('.topic-btn');
        topicBtns.forEach(btn => {
            (btn as HTMLElement).style.pointerEvents = 'auto';
            btn.addEventListener('click', (e) => {
                const topic = (e.target as HTMLElement).dataset.topic!;
                this.selectedTopic = topic;
                this.useCustomTopic = false;
                this.updateTopicButtons();
                // Clear custom topic input
                const customInput = this.menuScreen?.querySelector('#custom-topic') as HTMLInputElement;
                if (customInput) customInput.value = '';
                this.customTopic = '';
            });
        });
        
        // Custom topic input
        const customTopicInput = this.menuScreen.querySelector('#custom-topic') as HTMLInputElement;
        if (customTopicInput) {
            customTopicInput.style.pointerEvents = 'auto';
            customTopicInput.addEventListener('input', (e) => {
                this.customTopic = (e.target as HTMLInputElement).value;
                this.useCustomTopic = this.customTopic.trim().length > 0;
                this.updateTopicButtons();
            });
            customTopicInput.addEventListener('focus', () => {
                if (this.customTopic.trim().length > 0) {
                    this.useCustomTopic = true;
                    this.updateTopicButtons();
                }
            });
        }
        
        // Difficulty buttons
        const diffBtns = this.menuScreen.querySelectorAll('.diff-btn');
        diffBtns.forEach(btn => {
            (btn as HTMLElement).style.pointerEvents = 'auto';
            btn.addEventListener('click', (e) => {
                const diff = (e.target as HTMLElement).dataset.diff!;
                this.selectedDifficulty = diff;
                this.updateDifficultyButtons();
            });
        });
        
        // Question count slider
        const questionSlider = this.menuScreen.querySelector('#question-count') as HTMLInputElement;
        const questionDisplay = this.menuScreen.querySelector('#question-count-display');
        if (questionSlider) {
            questionSlider.style.pointerEvents = 'auto';
            questionSlider.addEventListener('input', (e) => {
                this.questionCount = parseInt((e.target as HTMLInputElement).value);
                if (questionDisplay) questionDisplay.textContent = this.questionCount.toString();
            });
        }
        
        // Start button
        const startBtn = this.menuScreen.querySelector('#start-btn') as HTMLButtonElement;
        startBtn.style.pointerEvents = 'auto';
        startBtn.addEventListener('click', () => {
            const topic = this.useCustomTopic && this.customTopic.trim() 
                ? this.customTopic.trim() 
                : this.selectedTopic;
            this.callbacks.onStartGame(topic, this.selectedDifficulty, this.questionCount);
        });
        
        // Chat tutor button from menu
        const chatMenuBtn = this.menuScreen.querySelector('#chat-menu-btn') as HTMLButtonElement;
        if (chatMenuBtn) {
            chatMenuBtn.style.pointerEvents = 'auto';
            chatMenuBtn.addEventListener('click', () => {
                // Set context with past game history
                this.setChatContextWithHistory();
                this.openChat();
            });
        }
    }

    private updateTopicButtons(): void {
        if (!this.menuScreen) return;
        const btns = this.menuScreen.querySelectorAll('.topic-btn');
        btns.forEach(btn => {
            const topic = (btn as HTMLElement).dataset.topic!;
            const isSelected = topic === this.selectedTopic && !this.useCustomTopic;
            (btn as HTMLElement).style.cssText = this.getTopicButtonStyle(isSelected);
            (btn as HTMLElement).style.pointerEvents = 'auto';
        });
        
        // Update custom input border if active
        const customInput = this.menuScreen.querySelector('#custom-topic') as HTMLInputElement;
        if (customInput) {
            customInput.style.borderColor = this.useCustomTopic 
                ? '#64c8ff' 
                : 'rgba(100, 200, 255, 0.3)';
        }
    }

    private updateDifficultyButtons(): void {
        if (!this.menuScreen) return;
        const btns = this.menuScreen.querySelectorAll('.diff-btn');
        btns.forEach(btn => {
            const diff = (btn as HTMLElement).dataset.diff!;
            (btn as HTMLElement).style.cssText = this.getDifficultyButtonStyle(diff, diff === this.selectedDifficulty);
            (btn as HTMLElement).style.pointerEvents = 'auto';
        });
    }

    private createLoadingScreen(): void {
        this.loadingScreen = document.createElement('div');
        this.loadingScreen.className = 'ui-screen';
        this.loadingScreen.style.cssText = this.getScreenStyle();
        this.loadingScreen.innerHTML = `
            <div style="text-align: center;">
                <div class="spinner" style="
                    width: 60px;
                    height: 60px;
                    border: 4px solid rgba(100, 200, 255, 0.2);
                    border-top-color: #64c8ff;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin: 0 auto 20px;
                "></div>
                <h2 style="color: #fff; margin-bottom: 10px;">Generating Questions...</h2>
                <p style="color: #aaa;">AI is creating your quiz</p>
            </div>
            <style>
                @keyframes spin { to { transform: rotate(360deg); } }
            </style>
        `;
        this.loadingScreen.style.display = 'none';
        this.container.appendChild(this.loadingScreen);
    }

    private createPauseScreen(): void {
        this.pauseScreen = document.createElement('div');
        this.pauseScreen.className = 'ui-screen';
        this.pauseScreen.style.cssText = this.getScreenStyle();
        this.pauseScreen.innerHTML = `
            <div style="text-align: center; max-width: 400px;">
                <h1 style="font-size: 48px; color: #fff; margin-bottom: 20px;">⏸️ PAUSED</h1>
                
                <button id="resume-btn" style="${this.getMenuButtonStyle('#4CAF50')}">
                    ▶ Resume
                </button>
                
                <button id="restart-btn" style="${this.getMenuButtonStyle('#2196F3')}">
                    🔄 Restart
                </button>
                
                <button id="menu-btn" style="${this.getMenuButtonStyle('#f44336')}">
                    🏠 Main Menu
                </button>
                
                <p style="color: #666; font-size: 14px; margin-top: 20px;">
                    Press ESC or click Resume to continue
                </p>
            </div>
        `;
        this.pauseScreen.style.display = 'none';
        this.container.appendChild(this.pauseScreen);
        
        // Setup listeners
        const resumeBtn = this.pauseScreen.querySelector('#resume-btn') as HTMLButtonElement;
        const restartBtn = this.pauseScreen.querySelector('#restart-btn') as HTMLButtonElement;
        const menuBtn = this.pauseScreen.querySelector('#menu-btn') as HTMLButtonElement;
        
        [resumeBtn, restartBtn, menuBtn].forEach(btn => btn.style.pointerEvents = 'auto');
        
        resumeBtn.addEventListener('click', () => this.callbacks.onResumeGame());
        restartBtn.addEventListener('click', () => this.callbacks.onRestartGame());
        menuBtn.addEventListener('click', () => this.callbacks.onBackToMenu());
    }

    private createResultsScreen(): void {
        this.resultsScreen = document.createElement('div');
        this.resultsScreen.className = 'ui-screen';
        this.resultsScreen.style.cssText = this.getScreenStyle();
        this.resultsScreen.style.display = 'none';
        this.container.appendChild(this.resultsScreen);
    }

    showResults(gameScore: GameScore): void {
        if (!this.resultsScreen) return;
        
        const message = ScoreManager.getPerformanceMessage(gameScore.percentage);
        const hasWrongAnswers = gameScore.wrongAnswers.length > 0;
        
        const wrongAnswersHTML = hasWrongAnswers 
            ? `
                <div style="margin-top: 20px; text-align: left; max-height: 200px; overflow-y: auto;">
                    <h3 style="color: #f44336; margin-bottom: 10px;">Review Mistakes:</h3>
                    ${gameScore.wrongAnswers.map(w => `
                        <div style="background: rgba(244,67,54,0.1); padding: 10px; border-radius: 8px; margin-bottom: 8px; border-left: 3px solid #f44336;">
                            <p style="color: #fff; margin: 0 0 5px 0; font-weight: bold;">${w.question}</p>
                            <p style="color: #f44336; margin: 0; font-size: 14px;">Your answer: ${w.yourAnswer}</p>
                            <p style="color: #4CAF50; margin: 0; font-size: 14px;">Correct: ${w.correctAnswer}</p>
                        </div>
                    `).join('')}
                </div>
            `
            : '<p style="color: #4CAF50; margin-top: 20px;">🎯 Perfect score! No mistakes!</p>';
        
        this.resultsScreen.innerHTML = `
            <div style="text-align: center; max-width: 500px; width: 90%;">
                <h1 style="font-size: 36px; color: #fff; margin-bottom: 10px;">🏁 Game Complete!</h1>
                
                <div style="background: linear-gradient(135deg, rgba(100,200,255,0.2), rgba(150,100,255,0.2)); padding: 30px; border-radius: 20px; margin-bottom: 20px;">
                    <div style="font-size: 72px; color: #fff; font-weight: bold;">
                        ${gameScore.score}/${gameScore.totalQuestions}
                    </div>
                    <div style="font-size: 24px; color: #64c8ff;">${gameScore.percentage}%</div>
                    <p style="color: #aaa; margin-top: 10px;">${message}</p>
                </div>
                
                <p style="color: #888; font-size: 14px;">
                    Topic: ${gameScore.topic} • Difficulty: ${gameScore.difficulty}
                </p>
                
                ${wrongAnswersHTML}
                
                ${hasWrongAnswers ? `
                    <button id="chat-tutor-btn" style="${this.getMenuButtonStyle('#9C27B0')}">
                        💬 Ask AI Tutor About Mistakes
                    </button>
                ` : ''}
                
                <div style="margin-top: 15px; display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
                    <button id="playagain-btn" style="${this.getMenuButtonStyle('#4CAF50')}">
                        🔄 Play Again
                    </button>
                    <button id="newgame-btn" style="${this.getMenuButtonStyle('#2196F3')}">
                        🏠 New Topic
                    </button>
                </div>
            </div>
        `;
        
        // Setup listeners
        const playAgainBtn = this.resultsScreen.querySelector('#playagain-btn') as HTMLButtonElement;
        const newGameBtn = this.resultsScreen.querySelector('#newgame-btn') as HTMLButtonElement;
        const chatTutorBtn = this.resultsScreen.querySelector('#chat-tutor-btn') as HTMLButtonElement;
        
        [playAgainBtn, newGameBtn].forEach(btn => btn.style.pointerEvents = 'auto');
        
        playAgainBtn.addEventListener('click', () => this.callbacks.onRestartGame());
        newGameBtn.addEventListener('click', () => this.callbacks.onBackToMenu());
        
        if (chatTutorBtn) {
            chatTutorBtn.style.pointerEvents = 'auto';
            chatTutorBtn.addEventListener('click', () => {
                this.openChat();
                // Auto-send initial message about wrong answers
                const wrongCount = gameScore.wrongAnswers.length;
                const firstWrong = gameScore.wrongAnswers[0];
                this.sendChatMessage(`I got ${wrongCount} question${wrongCount > 1 ? 's' : ''} wrong. Can you help me understand why "${firstWrong.correctAnswer}" is the correct answer for: "${firstWrong.question}"?`);
            });
        }
        
        this.showScreen('results');
    }

    private createHUD(): void {
        this.hudElement = document.createElement('div');
        this.hudElement.id = 'game-hud';
        this.hudElement.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            display: flex;
            gap: 15px;
            align-items: center;
            pointer-events: auto;
        `;
        this.hudElement.innerHTML = `
            <div id="score-display" style="
                background: rgba(15, 10, 35, 0.9);
                border: 2px solid rgba(100, 200, 255, 0.5);
                border-radius: 10px;
                padding: 8px 16px;
                color: #fff;
                font-size: 18px;
                font-weight: bold;
            ">
                Score: <span id="score-value">0</span>/<span id="score-total">10</span>
            </div>
            <button id="pause-btn" style="
                background: rgba(15, 10, 35, 0.9);
                border: 2px solid rgba(255, 200, 100, 0.5);
                border-radius: 10px;
                padding: 8px 14px;
                color: #fff;
                font-size: 18px;
                cursor: pointer;
                transition: all 0.2s;
            ">⏸️</button>
        `;
        this.hudElement.style.display = 'none';
        this.container.appendChild(this.hudElement);
        
        // Setup pause button
        this.pauseButton = this.hudElement.querySelector('#pause-btn') as HTMLButtonElement;
        this.pauseButton.addEventListener('click', () => {
            this.showScreen('paused');
            // Game.ts will handle the actual pause
        });
    }

    private createQuestionDisplay(): void {
        this.questionDisplay = document.createElement('div');
        this.questionDisplay.id = 'question-display';
        this.questionDisplay.style.cssText = `
            position: fixed;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(15, 10, 35, 0.9);
            border: 2px solid rgba(100, 150, 255, 0.5);
            border-radius: 12px;
            padding: 12px 25px;
            color: white;
            font-size: 20px;
            font-weight: bold;
            text-align: center;
            z-index: 1000;
            box-shadow: 0 4px 20px rgba(0, 100, 255, 0.3);
            max-width: 70%;
            display: none;
        `;
        this.container.appendChild(this.questionDisplay);
    }

    updateScore(score: number, total: number): void {
        const scoreValue = this.hudElement?.querySelector('#score-value');
        const scoreTotal = this.hudElement?.querySelector('#score-total');
        if (scoreValue) scoreValue.textContent = score.toString();
        if (scoreTotal) scoreTotal.textContent = total.toString();
    }

    showQuestion(id: number, text: string, answers?: string[]): void {
        if (this.questionDisplay) {
            // Build question HTML with answer options if provided
            let html = `<div style="margin-bottom: ${answers ? '10px' : '0'}">${id + 1}. ${text}</div>`;
            
            if (answers && answers.length > 0) {
                // Labels match portal positions: Left (A), Center (B), Right (C)
                const labels = ['A', 'B', 'C'];
                html += `<div style="display: flex; justify-content: center; gap: 15px; font-size: 13px; font-weight: normal; color: #aaa; margin-top: 8px; flex-wrap: wrap;">`;
                answers.forEach((answer, i) => {
                    const label = labels[i] || `${i + 1}`;
                    html += `<span style="background: rgba(100, 200, 255, 0.15); padding: 4px 8px; border-radius: 6px;"><span style="color: #64c8ff; font-weight: bold;">${label}:</span> ${answer}</span>`;
                });
                html += `</div>`;
            }
            
            this.questionDisplay.innerHTML = html;
            this.questionDisplay.style.display = 'block';
        }
    }

    hideQuestion(): void {
        if (this.questionDisplay) {
            this.questionDisplay.style.display = 'none';
        }
    }

    showScreen(screen: UIScreen): void {
        this.currentScreen = screen;
        
        // Hide all screens
        if (this.menuScreen) this.menuScreen.style.display = 'none';
        if (this.loadingScreen) this.loadingScreen.style.display = 'none';
        if (this.pauseScreen) this.pauseScreen.style.display = 'none';
        if (this.resultsScreen) this.resultsScreen.style.display = 'none';
        if (this.hudElement) this.hudElement.style.display = 'none';
        if (this.questionDisplay) this.questionDisplay.style.display = 'none';
        
        // Show appropriate screen
        switch (screen) {
            case 'menu':
                if (this.menuScreen) {
                    this.menuScreen.style.display = 'flex';
                    // Update stats preview
                    const statsPreview = this.menuScreen.querySelector('#stats-preview');
                    if (statsPreview) statsPreview.innerHTML = this.getStatsPreviewHTML();
                }
                break;
            case 'loading':
                if (this.loadingScreen) this.loadingScreen.style.display = 'flex';
                break;
            case 'game':
                if (this.hudElement) this.hudElement.style.display = 'flex';
                if (this.questionDisplay) this.questionDisplay.style.display = 'block';
                break;
            case 'paused':
                if (this.pauseScreen) this.pauseScreen.style.display = 'flex';
                if (this.hudElement) this.hudElement.style.display = 'flex';
                break;
            case 'results':
                if (this.resultsScreen) this.resultsScreen.style.display = 'flex';
                break;
        }
    }

    getCurrentScreen(): UIScreen {
        return this.currentScreen;
    }

    private setupKeyboardShortcuts(): void {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.currentScreen === 'game') {
                    // Pause the game
                    this.callbacks.onResumeGame(); // This triggers togglePause in Game.ts
                } else if (this.currentScreen === 'paused') {
                    // Resume the game
                    this.callbacks.onResumeGame();
                }
            }
        });
    }

    // Style helpers
    private getScreenStyle(): string {
        return `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(5, 5, 15, 0.95);
            display: flex;
            justify-content: center;
            align-items: center;
            pointer-events: auto;
        `;
    }

    private getTopicButtonStyle(selected: boolean): string {
        return `
            padding: 10px 18px;
            border: 2px solid ${selected ? '#64c8ff' : 'rgba(100, 200, 255, 0.3)'};
            background: ${selected ? 'rgba(100, 200, 255, 0.2)' : 'rgba(0, 0, 0, 0.3)'};
            color: ${selected ? '#fff' : '#aaa'};
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s;
        `;
    }

    private getDifficultyButtonStyle(diff: string, selected: boolean): string {
        const colors: Record<string, string> = {
            easy: '#4CAF50',
            medium: '#FF9800',
            hard: '#f44336'
        };
        const color = colors[diff] || '#64c8ff';
        return `
            padding: 10px 25px;
            border: 2px solid ${selected ? color : 'rgba(150, 150, 150, 0.3)'};
            background: ${selected ? `${color}33` : 'rgba(0, 0, 0, 0.3)'};
            color: ${selected ? '#fff' : '#aaa'};
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            transition: all 0.2s;
        `;
    }

    private getStartButtonStyle(): string {
        return `
            padding: 15px 50px;
            background: linear-gradient(135deg, #4CAF50, #45a049);
            border: none;
            border-radius: 12px;
            color: white;
            font-size: 20px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s;
            box-shadow: 0 4px 15px rgba(76, 175, 80, 0.4);
        `;
    }

    private getMenuButtonStyle(color: string): string {
        return `
            display: block;
            width: 100%;
            padding: 15px 30px;
            margin: 10px 0;
            background: ${color};
            border: none;
            border-radius: 10px;
            color: white;
            font-size: 18px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.2s;
        `;
    }

    private getStatsPreviewHTML(): string {
        const stats = scoreManager.getPlayerStats();
        
        if (stats.totalGamesPlayed === 0) {
            return `
                <p style="color: #888; font-size: 14px; margin: 0;">
                    No games played yet. Start your first game!
                </p>
            `;
        }
        
        return `
            <div style="display: flex; justify-content: space-around; color: #aaa; font-size: 14px;">
                <div>
                    <div style="font-size: 24px; color: #64c8ff; font-weight: bold;">${stats.totalGamesPlayed}</div>
                    <div>Games</div>
                </div>
                <div>
                    <div style="font-size: 24px; color: #4CAF50; font-weight: bold;">${stats.averagePercentage}%</div>
                    <div>Avg Score</div>
                </div>
                <div>
                    <div style="font-size: 24px; color: #FF9800; font-weight: bold;">${stats.bestScore?.percentage || 0}%</div>
                    <div>Best</div>
                </div>
            </div>
        `;
    }

    // Show feedback flash
    showFeedbackFlash(correct: boolean): void {
        const flash = document.createElement('div');
        flash.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: ${correct ? 'rgba(76, 175, 80, 0.3)' : 'rgba(244, 67, 54, 0.3)'};
            pointer-events: none;
            z-index: 999;
            animation: flashFade 0.3s ease-out forwards;
        `;
        document.body.appendChild(flash);
        
        // Add animation style if not exists
        if (!document.querySelector('#flash-style')) {
            const style = document.createElement('style');
            style.id = 'flash-style';
            style.textContent = `
                @keyframes flashFade {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
        
        setTimeout(() => flash.remove(), 300);
    }

    // Show speed indicator when speed changes
    private speedIndicatorTimeout: ReturnType<typeof setTimeout> | null = null;
    
    showSpeedIndicator(current: number, min: number, max: number): void {
        // Remove existing indicator
        const existing = document.querySelector('#speed-indicator');
        if (existing) existing.remove();
        
        if (this.speedIndicatorTimeout) {
            clearTimeout(this.speedIndicatorTimeout);
        }
        
        const percentage = ((current - min) / (max - min)) * 100;
        
        const indicator = document.createElement('div');
        indicator.id = 'speed-indicator';
        indicator.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(15, 10, 35, 0.9);
            border: 2px solid rgba(100, 200, 255, 0.5);
            border-radius: 10px;
            padding: 10px 20px;
            color: white;
            font-size: 14px;
            z-index: 1000;
            display: flex;
            align-items: center;
            gap: 15px;
            pointer-events: none;
        `;
        
        indicator.innerHTML = `
            <span style="color: #aaa;">Speed:</span>
            <div style="width: 100px; height: 6px; background: rgba(255,255,255,0.2); border-radius: 3px; overflow: hidden;">
                <div style="width: ${percentage}%; height: 100%; background: linear-gradient(90deg, #4CAF50, #FF9800, #f44336); border-radius: 3px;"></div>
            </div>
            <span style="color: #64c8ff; font-weight: bold;">${current.toFixed(0)}</span>
        `;
        
        document.body.appendChild(indicator);
        
        // Auto-hide after 1.5 seconds
        this.speedIndicatorTimeout = setTimeout(() => {
            indicator.style.transition = 'opacity 0.3s';
            indicator.style.opacity = '0';
            setTimeout(() => indicator.remove(), 300);
        }, 1500);
    }

    // ============ CHAT PANEL ============
    
    private createChatPanel(): void {
        this.chatPanel = document.createElement('div');
        this.chatPanel.id = 'chat-panel';
        this.chatPanel.style.cssText = `
            position: fixed;
            top: 0;
            right: -400px;
            width: 400px;
            height: 100%;
            background: rgba(10, 10, 25, 0.98);
            border-left: 2px solid rgba(100, 200, 255, 0.3);
            display: flex;
            flex-direction: column;
            z-index: 1001;
            transition: right 0.3s ease;
            pointer-events: auto;
        `;
        
        this.chatPanel.innerHTML = `
            <div style="padding: 15px; border-bottom: 1px solid rgba(100, 200, 255, 0.2); display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; color: #fff; font-size: 18px;">💬 AI Tutor</h3>
                <button id="close-chat" style="background: none; border: none; color: #aaa; font-size: 24px; cursor: pointer; padding: 5px;">&times;</button>
            </div>
            
            <div id="chat-messages" style="flex: 1; overflow-y: auto; padding: 15px; display: flex; flex-direction: column; gap: 12px;">
                <div class="chat-message assistant" style="background: rgba(100, 200, 255, 0.1); padding: 12px; border-radius: 12px; color: #ddd; font-size: 14px; line-height: 1.5;">
                    Hi! I'm your AI tutor. Ask me anything about any topic, review past questions, or get help understanding concepts! 🎓
                </div>
            </div>
            
            <div style="padding: 15px; border-top: 1px solid rgba(100, 200, 255, 0.2); display: flex; gap: 10px;">
                <input type="text" id="chat-input" placeholder="Ask a question..." 
                    style="flex: 1; padding: 12px; border: 2px solid rgba(100, 200, 255, 0.3); background: rgba(0,0,0,0.3); 
                    color: #fff; border-radius: 8px; font-size: 14px; outline: none;">
                <button id="chat-send" style="padding: 12px 20px; background: #9C27B0; border: none; border-radius: 8px; 
                    color: white; font-size: 14px; cursor: pointer; font-weight: bold;">Send</button>
            </div>
        `;
        
        document.body.appendChild(this.chatPanel);
        this.setupChatListeners();
    }
    
    private setupChatListeners(): void {
        if (!this.chatPanel) return;
        
        const closeBtn = this.chatPanel.querySelector('#close-chat') as HTMLButtonElement;
        const input = this.chatPanel.querySelector('#chat-input') as HTMLInputElement;
        const sendBtn = this.chatPanel.querySelector('#chat-send') as HTMLButtonElement;
        
        closeBtn.addEventListener('click', () => this.closeChat());
        
        sendBtn.addEventListener('click', () => {
            const message = input.value.trim();
            if (message) {
                this.sendChatMessage(message);
                input.value = '';
            }
        });
        
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const message = input.value.trim();
                if (message) {
                    this.sendChatMessage(message);
                    input.value = '';
                }
            }
        });
    }
    
    openChat(): void {
        if (this.chatPanel) {
            this.chatPanel.style.right = '0';
        }
    }
    
    closeChat(): void {
        if (this.chatPanel) {
            this.chatPanel.style.right = '-400px';
        }
    }
    
    private sendChatMessage(message: string): void {
        const messagesContainer = this.chatPanel?.querySelector('#chat-messages');
        const sendBtn = this.chatPanel?.querySelector('#chat-send') as HTMLButtonElement;
        const input = this.chatPanel?.querySelector('#chat-input') as HTMLInputElement;
        
        if (!messagesContainer) return;
        
        // Add user message
        const userDiv = document.createElement('div');
        userDiv.className = 'chat-message user';
        userDiv.style.cssText = 'background: rgba(156, 39, 176, 0.2); padding: 12px; border-radius: 12px; color: #fff; font-size: 14px; align-self: flex-end; max-width: 85%;';
        userDiv.textContent = message;
        messagesContainer.appendChild(userDiv);
        
        // Add assistant message placeholder
        const assistantDiv = document.createElement('div');
        assistantDiv.className = 'chat-message assistant';
        assistantDiv.style.cssText = 'background: rgba(100, 200, 255, 0.1); padding: 12px; border-radius: 12px; color: #ddd; font-size: 14px; line-height: 1.5;';
        assistantDiv.innerHTML = '<span class="typing-indicator" style="color: #888;">Thinking...</span>';
        messagesContainer.appendChild(assistantDiv);
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // Disable input while streaming
        if (sendBtn) sendBtn.disabled = true;
        if (input) input.disabled = true;
        
        // Send to AI
        chatService.sendMessage(
            message,
            // onChunk
            (content) => {
                const indicator = assistantDiv.querySelector('.typing-indicator');
                if (indicator) {
                    assistantDiv.innerHTML = '';
                }
                assistantDiv.innerHTML += content.replace(/\n/g, '<br>');
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            },
            // onComplete
            () => {
                if (sendBtn) sendBtn.disabled = false;
                if (input) input.disabled = false;
                input?.focus();
            },
            // onError
            (error) => {
                assistantDiv.innerHTML = `<span style="color: #f44336;">Error: ${error}</span>`;
                if (sendBtn) sendBtn.disabled = false;
                if (input) input.disabled = false;
            }
        );
    }
    
    // Set chat context from game
    setChatContext(context: QuizContext): void {
        chatService.setQuizContext(context);
    }
    
    // Set chat context with past game history from localStorage
    private setChatContextWithHistory(): void {
        const stats = scoreManager.getPlayerStats();
        const recentGames = stats.recentScores || [];
        
        // Build a context with past game history
        const historyContext: QuizContext = {
            topic: 'General Review',
            difficulty: 'mixed',
            questions: [],
            wrongAnswers: []
        };
        
        // Collect wrong answers from recent games
        recentGames.forEach(game => {
            game.wrongAnswers.forEach(wa => {
                historyContext.wrongAnswers.push({
                    question: `[${game.topic}] ${wa.question}`,
                    yourAnswer: wa.yourAnswer,
                    correctAnswer: wa.correctAnswer
                });
            });
        });
        
        chatService.setQuizContext(historyContext);
    }
    
    // Clear chat history (for new game)
    clearChatHistory(): void {
        chatService.clearHistory();
        
        // Reset chat messages UI
        const messagesContainer = this.chatPanel?.querySelector('#chat-messages');
        if (messagesContainer) {
            messagesContainer.innerHTML = `
                <div class="chat-message assistant" style="background: rgba(100, 200, 255, 0.1); padding: 12px; border-radius: 12px; color: #ddd; font-size: 14px; line-height: 1.5;">
                    Hi! I'm your AI tutor. Ask me anything about any topic, review past questions, or get help understanding concepts! 🎓
                </div>
            `;
        }
    }
}
