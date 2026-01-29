// Chat Service - handles AI tutor chat with streaming and conversation memory

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'http://localhost:8787';

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

export interface QuizContext {
    topic: string;
    difficulty: string;
    questions: Array<{
        question: string;
        answers: string[];
        correctIndex: number;
    }>;
    wrongAnswers: Array<{
        question: string;
        yourAnswer: string;
        correctAnswer: string;
    }>;
}

export class ChatService {
    private conversationHistory: ChatMessage[] = [];
    private quizContext: QuizContext | null = null;
    private isStreaming: boolean = false;

    /**
     * Set the quiz context for the AI to reference
     */
    setQuizContext(context: QuizContext): void {
        this.quizContext = context;
    }

    /**
     * Update wrong answers (call after each question)
     */
    updateWrongAnswers(wrongAnswers: QuizContext['wrongAnswers']): void {
        if (this.quizContext) {
            this.quizContext.wrongAnswers = wrongAnswers;
        }
    }

    /**
     * Get conversation history
     */
    getHistory(): ChatMessage[] {
        return [...this.conversationHistory];
    }

    /**
     * Clear conversation history (e.g., for new game)
     */
    clearHistory(): void {
        this.conversationHistory = [];
    }

    /**
     * Check if currently streaming
     */
    getIsStreaming(): boolean {
        return this.isStreaming;
    }

    /**
     * Send a message and get streamed response
     * @param message User's message
     * @param onChunk Callback for each streamed chunk
     * @param onComplete Callback when stream is complete
     * @param onError Callback for errors
     */
    async sendMessage(
        message: string,
        onChunk: (content: string) => void,
        onComplete: (fullResponse: string) => void,
        onError: (error: string) => void
    ): Promise<void> {
        if (this.isStreaming) {
            onError('Already streaming a response');
            return;
        }

        this.isStreaming = true;

        // Add user message to history
        const userMessage: ChatMessage = {
            role: 'user',
            content: message,
            timestamp: Date.now()
        };
        this.conversationHistory.push(userMessage);

        try {
            const response = await fetch(`${WORKER_URL}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message,
                    conversationHistory: this.conversationHistory.slice(0, -1).map(m => ({
                        role: m.role,
                        content: m.content
                    })),
                    quizContext: this.quizContext
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to get response');
            }

            // Handle Server-Sent Events stream
            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('No response body');
            }

            const decoder = new TextDecoder();
            let fullResponse = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const text = decoder.decode(value, { stream: true });
                const lines = text.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        
                        if (data === '[DONE]') {
                            // Stream complete
                            const assistantMessage: ChatMessage = {
                                role: 'assistant',
                                content: fullResponse,
                                timestamp: Date.now()
                            };
                            this.conversationHistory.push(assistantMessage);
                            onComplete(fullResponse);
                            this.isStreaming = false;
                            return;
                        }

                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.content) {
                                fullResponse += parsed.content;
                                onChunk(parsed.content);
                            }
                        } catch {
                            // Ignore parse errors for incomplete chunks
                        }
                    }
                }
            }

            // If we get here without [DONE], still complete
            if (fullResponse) {
                const assistantMessage: ChatMessage = {
                    role: 'assistant',
                    content: fullResponse,
                    timestamp: Date.now()
                };
                this.conversationHistory.push(assistantMessage);
                onComplete(fullResponse);
            }

        } catch (error: any) {
            // Remove the user message if request failed
            this.conversationHistory.pop();
            onError(error.message || 'Failed to send message');
        } finally {
            this.isStreaming = false;
        }
    }
}

// Export singleton instance
export const chatService = new ChatService();
