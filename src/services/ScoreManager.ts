// Score Manager - handles scoring, statistics, and localStorage persistence

export interface GameScore {
    topic: string;
    difficulty: string;
    score: number;
    totalQuestions: number;
    percentage: number;
    timestamp: number;
    wrongAnswers: WrongAnswer[];
}

export interface WrongAnswer {
    question: string;
    yourAnswer: string;
    correctAnswer: string;
}

export interface PlayerStats {
    totalGamesPlayed: number;
    totalQuestionsAnswered: number;
    totalCorrect: number;
    averagePercentage: number;
    bestScore: GameScore | null;
    recentScores: GameScore[];
    topicStats: Record<string, { played: number; avgScore: number }>;
}

const STORAGE_KEY = 'edurunner_scores';
const MAX_RECENT_SCORES = 20;

export class ScoreManager {
    // Current game state
    private currentScore: number = 0;
    private totalQuestions: number = 0;
    private answeredQuestions: number = 0;
    private wrongAnswers: WrongAnswer[] = [];
    private currentTopic: string = '';
    private currentDifficulty: string = 'medium';

    // Event callbacks
    public onScoreChange: ((score: number, total: number) => void) | null = null;

    /**
     * Start a new game session
     */
    startGame(topic: string, difficulty: string, questionCount: number): void {
        this.currentScore = 0;
        this.totalQuestions = questionCount;
        this.answeredQuestions = 0;
        this.wrongAnswers = [];
        this.currentTopic = topic;
        this.currentDifficulty = difficulty;
        
        this.notifyScoreChange();
    }

    /**
     * Record a correct answer
     */
    addCorrect(): void {
        this.currentScore++;
        this.answeredQuestions++;
        this.notifyScoreChange();
    }

    /**
     * Record a wrong answer
     */
    addWrong(question: string, yourAnswer: string, correctAnswer: string): void {
        this.answeredQuestions++;
        this.wrongAnswers.push({ question, yourAnswer, correctAnswer });
        this.notifyScoreChange();
    }

    /**
     * Get current score
     */
    getScore(): number {
        return this.currentScore;
    }

    /**
     * Get total questions
     */
    getTotalQuestions(): number {
        return this.totalQuestions;
    }

    /**
     * Get answered count
     */
    getAnsweredCount(): number {
        return this.answeredQuestions;
    }

    /**
     * Get current percentage
     */
    getPercentage(): number {
        if (this.answeredQuestions === 0) return 0;
        return Math.round((this.currentScore / this.answeredQuestions) * 100);
    }

    /**
     * Get wrong answers for review
     */
    getWrongAnswers(): WrongAnswer[] {
        return this.wrongAnswers;
    }

    /**
     * Check if game is complete
     */
    isGameComplete(): boolean {
        return this.answeredQuestions >= this.totalQuestions;
    }

    /**
     * Save completed game to localStorage
     */
    saveGame(): GameScore {
        const gameScore: GameScore = {
            topic: this.currentTopic,
            difficulty: this.currentDifficulty,
            score: this.currentScore,
            totalQuestions: this.totalQuestions,
            percentage: this.getPercentage(),
            timestamp: Date.now(),
            wrongAnswers: this.wrongAnswers,
        };

        // Load existing scores
        const scores = this.loadAllScores();
        
        // Add new score
        scores.unshift(gameScore);
        
        // Keep only recent scores
        if (scores.length > MAX_RECENT_SCORES) {
            scores.length = MAX_RECENT_SCORES;
        }

        // Save to localStorage
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
            console.log('💾 Score saved to localStorage');
        } catch (error) {
            console.error('Failed to save score:', error);
        }

        return gameScore;
    }

    /**
     * Load all scores from localStorage
     */
    loadAllScores(): GameScore[] {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            if (data) {
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('Failed to load scores:', error);
        }
        return [];
    }

    /**
     * Get player statistics
     */
    getPlayerStats(): PlayerStats {
        const scores = this.loadAllScores();
        
        if (scores.length === 0) {
            return {
                totalGamesPlayed: 0,
                totalQuestionsAnswered: 0,
                totalCorrect: 0,
                averagePercentage: 0,
                bestScore: null,
                recentScores: [],
                topicStats: {},
            };
        }

        // Calculate statistics
        const totalGamesPlayed = scores.length;
        const totalQuestionsAnswered = scores.reduce((sum, s) => sum + s.totalQuestions, 0);
        const totalCorrect = scores.reduce((sum, s) => sum + s.score, 0);
        const averagePercentage = Math.round(
            scores.reduce((sum, s) => sum + s.percentage, 0) / scores.length
        );
        
        // Find best score
        const bestScore = scores.reduce((best, current) => 
            !best || current.percentage > best.percentage ? current : best
        , null as GameScore | null);

        // Calculate topic stats
        const topicStats: Record<string, { played: number; avgScore: number; total: number }> = {};
        for (const score of scores) {
            if (!topicStats[score.topic]) {
                topicStats[score.topic] = { played: 0, avgScore: 0, total: 0 };
            }
            topicStats[score.topic].played++;
            topicStats[score.topic].total += score.percentage;
        }
        
        // Calculate averages per topic
        for (const topic of Object.keys(topicStats)) {
            topicStats[topic].avgScore = Math.round(
                topicStats[topic].total / topicStats[topic].played
            );
        }

        return {
            totalGamesPlayed,
            totalQuestionsAnswered,
            totalCorrect,
            averagePercentage,
            bestScore,
            recentScores: scores.slice(0, 5),
            topicStats,
        };
    }

    /**
     * Clear all saved data
     */
    clearAllData(): void {
        try {
            localStorage.removeItem(STORAGE_KEY);
            console.log('🗑️ All score data cleared');
        } catch (error) {
            console.error('Failed to clear data:', error);
        }
    }

    /**
     * Notify listeners of score change
     */
    private notifyScoreChange(): void {
        if (this.onScoreChange) {
            this.onScoreChange(this.currentScore, this.totalQuestions);
        }
    }

    /**
     * Get performance message based on percentage
     */
    static getPerformanceMessage(percentage: number): string {
        if (percentage >= 90) return "🌟 Outstanding! You're a genius!";
        if (percentage >= 80) return "🎉 Excellent work! Keep it up!";
        if (percentage >= 70) return "👍 Good job! You're doing great!";
        if (percentage >= 60) return "💪 Nice effort! Room to improve!";
        if (percentage >= 50) return "📚 Keep practicing, you'll get there!";
        return "🔄 Don't give up! Try again!";
    }
}

// Export singleton instance
export const scoreManager = new ScoreManager();

/*
 * Future multiplayer score sync suggestions:
 * 
 * 1. WebSocket Real-time Leaderboard
 *    - Connect to a WebSocket server
 *    - Push scores on game complete
 *    - Receive live updates for global leaderboard
 * 
 * 2. Cloudflare Durable Objects
 *    - Use Durable Objects for persistent state
 *    - Store user profiles and scores
 *    - Enable real-time collaboration
 * 
 * 3. Supabase Integration
 *    - Free tier supports realtime subscriptions
 *    - Built-in auth (Google, GitHub, etc.)
 *    - PostgreSQL for flexible queries
 *    - Example:
 *      const { data, error } = await supabase
 *        .from('scores')
 *        .insert({ user_id, topic, score, percentage })
 * 
 * 4. Firebase Realtime Database
 *    - Easy setup, real-time sync
 *    - Good for leaderboards
 *    - Free tier available
 * 
 * 5. REST API with Cloudflare Workers + KV
 *    - Use Workers KV for simple key-value storage
 *    - Create API endpoints for CRUD operations
 *    - Implement user auth with JWT tokens
 */
