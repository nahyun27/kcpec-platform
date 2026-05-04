from pydantic import BaseModel, ConfigDict


class OptionItem(BaseModel):
    id: int
    option_text: str

    model_config = ConfigDict(from_attributes=True)


class QuestionItem(BaseModel):
    id: int
    question_text: str
    options: list[OptionItem]

    model_config = ConfigDict(from_attributes=True)


class QuizDetail(BaseModel):
    quiz_id: int
    pass_score: int
    questions: list[QuestionItem]


class QuizSubmit(BaseModel):
    # { question_id: option_id }
    answers: dict[int, int]


class QuizResult(BaseModel):
    score: int
    is_passed: bool
    pass_score: int
    correct_count: int
    total_count: int
