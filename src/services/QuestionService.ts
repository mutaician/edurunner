// Question Service - handles API calls to Cloudflare Worker for AI-generated questions

export interface Question {
    question: string;
    answers: string[];
    correctIndex: number;
}

export interface QuestionRequest {
    topic: string;
    difficulty: 'easy' | 'medium' | 'hard';
    count: number;
}

// Worker URL - update this after deploying your Cloudflare Worker
const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'http://localhost:8787';

// Fallback questions for when API is unavailable (demo/offline mode)
const FALLBACK_QUESTIONS: Record<string, Question[]> = {
    mathematics: [
        { question: "What is 7 × 8?", answers: ["54", "56", "58"], correctIndex: 1 },
        { question: "What is 144 ÷ 12?", answers: ["11", "12", "13"], correctIndex: 1 },
        { question: "What is 15²?", answers: ["215", "225", "235"], correctIndex: 1 },
        { question: "What is √81?", answers: ["7", "8", "9"], correctIndex: 2 },
        { question: "What is 3 + 4 × 2?", answers: ["11", "14", "10"], correctIndex: 0 },
        { question: "What is 25% of 80?", answers: ["15", "20", "25"], correctIndex: 1 },
        { question: "What is 2³?", answers: ["6", "8", "9"], correctIndex: 1 },
        { question: "What is 1000 - 573?", answers: ["427", "437", "447"], correctIndex: 0 },
        { question: "What is 17 + 28?", answers: ["45", "44", "46"], correctIndex: 0 },
        { question: "What is 90 ÷ 5?", answers: ["16", "17", "18"], correctIndex: 2 },
    ],
    science: [
        { question: "What planet is closest to the Sun?", answers: ["Venus", "Mercury", "Mars"], correctIndex: 1 },
        { question: "What gas do plants absorb?", answers: ["Oxygen", "Nitrogen", "Carbon Dioxide"], correctIndex: 2 },
        { question: "What is H₂O?", answers: ["Water", "Salt", "Sugar"], correctIndex: 0 },
        { question: "How many bones in adult human?", answers: ["186", "206", "226"], correctIndex: 1 },
        { question: "What is Earth's largest ocean?", answers: ["Atlantic", "Indian", "Pacific"], correctIndex: 2 },
        { question: "What metal is liquid at room temp?", answers: ["Lead", "Mercury", "Tin"], correctIndex: 1 },
        { question: "What organ pumps blood?", answers: ["Liver", "Lungs", "Heart"], correctIndex: 2 },
        { question: "What causes tides?", answers: ["Wind", "Moon", "Sun"], correctIndex: 1 },
        { question: "Diamond is made of?", answers: ["Carbon", "Silicon", "Iron"], correctIndex: 0 },
        { question: "Speed of light is about?", answers: ["300k km/s", "150k km/s", "500k km/s"], correctIndex: 0 },
    ],
    geography: [
        { question: "Capital of Japan?", answers: ["Seoul", "Tokyo", "Beijing"], correctIndex: 1 },
        { question: "Longest river in the world?", answers: ["Amazon", "Nile", "Yangtze"], correctIndex: 1 },
        { question: "Largest country by area?", answers: ["China", "USA", "Russia"], correctIndex: 2 },
        { question: "Which continent is Egypt in?", answers: ["Asia", "Africa", "Europe"], correctIndex: 1 },
        { question: "Capital of Australia?", answers: ["Sydney", "Melbourne", "Canberra"], correctIndex: 2 },
        { question: "Tallest mountain in the world?", answers: ["K2", "Everest", "Kangchenjunga"], correctIndex: 1 },
        { question: "Which ocean is the smallest?", answers: ["Arctic", "Indian", "Atlantic"], correctIndex: 0 },
        { question: "Capital of Brazil?", answers: ["Rio", "São Paulo", "Brasília"], correctIndex: 2 },
        { question: "What country has the most people?", answers: ["India", "China", "USA"], correctIndex: 0 },
        { question: "Sahara Desert is in which continent?", answers: ["Asia", "Africa", "Australia"], correctIndex: 1 },
    ],
    programming: [
        { question: "What does HTML stand for?", answers: ["HyperText Markup Language", "High Tech Modern Language", "Home Tool Markup Language"], correctIndex: 0 },
        { question: "Which is not a programming language?", answers: ["Python", "HTML", "Java"], correctIndex: 1 },
        { question: "What does CSS style?", answers: ["Databases", "Web pages", "Networks"], correctIndex: 1 },
        { question: "JavaScript runs in?", answers: ["Server only", "Browser", "Database"], correctIndex: 1 },
        { question: "What is a variable?", answers: ["A function", "Data storage", "A loop"], correctIndex: 1 },
        { question: "What does API stand for?", answers: ["Application Programming Interface", "Advanced Program Integration", "Automated Protocol Interface"], correctIndex: 0 },
        { question: "Git is used for?", answers: ["Drawing", "Version control", "Email"], correctIndex: 1 },
        { question: "What is a bug?", answers: ["A feature", "An error", "A function"], correctIndex: 1 },
        { question: "What is debugging?", answers: ["Adding bugs", "Fixing errors", "Writing code"], correctIndex: 1 },
        { question: "Array index starts at?", answers: ["0", "1", "-1"], correctIndex: 0 },
    ],
};

export class QuestionService {
    private useOfflineMode: boolean = false;

    /**
     * Fetch questions from the AI API
     * Falls back to offline questions if API unavailable
     */
    async fetchQuestions(request: QuestionRequest): Promise<Question[]> {
        // Try API first
        if (!this.useOfflineMode) {
            try {
                const response = await fetch(WORKER_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(request),
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.questions && Array.isArray(data.questions)) {
                        console.log('Questions loaded from API');
                        return data.questions;
                    }
                }
                
                console.warn('⚠️ API response invalid, using offline questions');
            } catch (error) {
                console.warn('⚠️ API unavailable, using offline questions:', error);
            }
        }

        // Fallback to offline questions
        return this.getOfflineQuestions(request);
    }

    /**
     * Get pre-made questions for offline/demo mode
     */
    private getOfflineQuestions(request: QuestionRequest): Question[] {
        const topicKey = request.topic.toLowerCase().replace(/\s+/g, '');
        
        // Find matching topic or use a random one
        let questions = FALLBACK_QUESTIONS[topicKey];
        
        if (!questions) {
            // Use random topic if requested topic not found
            const topics = Object.keys(FALLBACK_QUESTIONS);
            const randomTopic = topics[Math.floor(Math.random() * topics.length)];
            questions = FALLBACK_QUESTIONS[randomTopic];
            console.log(`Using "${randomTopic}" questions (requested: "${request.topic}")`);
        }

        // Shuffle and return requested count
        const shuffled = [...questions].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, request.count);
    }

    /**
     * Get available topics for the menu
     */
    getAvailableTopics(): string[] {
        return Object.keys(FALLBACK_QUESTIONS).map(
            topic => topic.charAt(0).toUpperCase() + topic.slice(1)
        );
    }

    /**
     * Force offline mode (useful for testing)
     */
    setOfflineMode(offline: boolean): void {
        this.useOfflineMode = offline;
    }
}

// Export singleton instance
export const questionService = new QuestionService();
