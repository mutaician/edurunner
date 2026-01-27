export interface Question {
    question: string;
    answers: string[];
    correctIndex: number;
}

export interface QuestionsResponse {
    questions: Question[];
}
