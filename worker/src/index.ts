import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';

export interface Env {
	OPENAI_API_KEY: string;
}

const QuestionSchema = z.object({
	question: z.string(),
	answers: z.array(z.string()).length(3),
	correctIndex: z.number().min(0).max(2),
});

const QuestionsResponseSchema = z.object({
	questions: z.array(QuestionSchema),
});

// Types for chat
interface ChatMessage {
	role: 'user' | 'assistant' | 'system';
	content: string;
}

interface QuizQuestion {
	question: string;
	answers: string[];
	correctIndex: number;
	userAnswer?: string;
	wasCorrect?: boolean;
}

interface ChatRequest {
	message: string;
	conversationHistory: ChatMessage[];
	quizContext?: {
		topic: string;
		difficulty: string;
		questions: QuizQuestion[];
		wrongAnswers: { question: string; yourAnswer: string; correctAnswer: string }[];
	};
}

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		if (request.method !== 'POST') {
			return new Response('Only POST requests allowed', { status: 405, headers: corsHeaders });
		}

		const url = new URL(request.url);
		
		// Route to appropriate handler
		if (url.pathname === '/chat') {
			return handleChat(request, env);
		} else {
			return handleQuestions(request, env);
		}
	},
} satisfies ExportedHandler<Env>;

// Handler for generating quiz questions
async function handleQuestions(request: Request, env: Env): Promise<Response> {
	try {
		const body: any = await request.json();
		const { topic, difficulty, count = 10 } = body;

		if (!topic) {
			return new Response(JSON.stringify({ error: 'Topic is required' }), {
				status: 400,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		if (!env.OPENAI_API_KEY) {
			return new Response(JSON.stringify({ error: 'OPENAI_API_KEY is not configured' }), {
				status: 500,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		const openai = new OpenAI({
			apiKey: env.OPENAI_API_KEY,
		});

		const response = await openai.responses.parse({
			model: 'gpt-5-mini',
			reasoning: { effort: "minimal" },
			instructions: 'You are a helpful assistant that generates educational quiz questions.',
			input: `Generate a set of ${count} educational multiple-choice questions about the topic: "${topic}" at a ${difficulty} difficulty level.
Each question must have exactly 3 answer options to match a 3-lane runner game.
Keep question text under 100 characters. Make the wrong answers plausible.`,
			text: {
				format: zodTextFormat(QuestionsResponseSchema, 'questions_response'),
			},
		});

		if (response.output_parsed) {
			return new Response(JSON.stringify(response.output_parsed), {
				headers: {
					...corsHeaders,
					'Content-Type': 'application/json',
				},
			});
		} else {
			return new Response(JSON.stringify({ error: 'No questions generated' }), {
				status: 500,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

	} catch (error: any) {
		return new Response(JSON.stringify({ error: error.message }), {
			status: 500,
			headers: {
				...corsHeaders,
				'Content-Type': 'application/json',
			},
		});
	}
}

// Handler for AI tutor chat with streaming
async function handleChat(request: Request, env: Env): Promise<Response> {
	try {
		const body: ChatRequest = await request.json();
		const { message, conversationHistory, quizContext } = body;

		if (!message) {
			return new Response(JSON.stringify({ error: 'Message is required' }), {
				status: 400,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		if (!env.OPENAI_API_KEY) {
			return new Response(JSON.stringify({ error: 'OPENAI_API_KEY is not configured' }), {
				status: 500,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			});
		}

		const openai = new OpenAI({
			apiKey: env.OPENAI_API_KEY,
		});

		// Build context-aware system prompt
		let systemPrompt = `You are a friendly, encouraging educational tutor helping a student learn through an educational runner game called EduRunner.

Your role:
- Explain concepts clearly and at the appropriate level
- Use analogies and real-world examples to make ideas stick
- Break down complex topics into digestible pieces
- Encourage the student and celebrate their progress
- If they got something wrong, don't just give the answer - help them understand WHY
- Keep responses concise but helpful (aim for 2-4 short paragraphs max)
- Use simple language and avoid jargon unless explaining it

Teaching approach:
- Ask guiding questions to help them discover answers
- Connect new concepts to things they might already know
- Provide memory tricks or mnemonics when helpful
- If they're struggling, try a different explanation angle`;

		// Add quiz context if available
		if (quizContext) {
			systemPrompt += `\n\nCurrent Quiz Context:
- Topic: ${quizContext.topic}
- Difficulty: ${quizContext.difficulty}
- Questions attempted: ${quizContext.questions.length}`;

			if (quizContext.wrongAnswers && quizContext.wrongAnswers.length > 0) {
				systemPrompt += `\n\nQuestions they got wrong (use these to help explain):`;
				quizContext.wrongAnswers.forEach((wa, i) => {
					systemPrompt += `\n${i + 1}. Q: "${wa.question}"
   Their answer: "${wa.yourAnswer}" (incorrect)
   Correct answer: "${wa.correctAnswer}"`;
				});
			}
		}

		// Build messages array with conversation history
		const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
			{ role: 'system', content: systemPrompt },
			...conversationHistory.map(msg => ({
				role: msg.role as 'user' | 'assistant',
				content: msg.content
			})),
			{ role: 'user', content: message }
		];

		// Create streaming response
		const stream = await openai.chat.completions.create({
			model: 'gpt-5-mini',
			messages,
			stream: true,
		});

		// Create a readable stream for the response
		const encoder = new TextEncoder();
		const readable = new ReadableStream({
			async start(controller) {
				try {
					for await (const chunk of stream) {
						const content = chunk.choices[0]?.delta?.content;
						if (content) {
							// Send as Server-Sent Events format
							controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
						}
					}
					controller.enqueue(encoder.encode('data: [DONE]\n\n'));
					controller.close();
				} catch (error) {
					controller.error(error);
				}
			}
		});

		return new Response(readable, {
			headers: {
				...corsHeaders,
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				'Connection': 'keep-alive',
			},
		});

	} catch (error: any) {
		return new Response(JSON.stringify({ error: error.message }), {
			status: 500,
			headers: {
				...corsHeaders,
				'Content-Type': 'application/json',
			},
		});
	}
}
