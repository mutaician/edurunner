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

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
		};

		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		if (request.method !== 'POST') {
			return new Response('Only POST requests allowed', { status: 405, headers: corsHeaders });
		}

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
				reasoning: {effort: "minimal"},
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
	},
} satisfies ExportedHandler<Env>;
