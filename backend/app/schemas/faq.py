from pydantic import BaseModel, ConfigDict, Field

from app.models.faq import FaqCategory


class FaqRead(BaseModel):
    id: int
    category: FaqCategory
    question: str
    answer: str
    order_index: int
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class FaqCreate(BaseModel):
    category: FaqCategory
    question: str = Field(min_length=1, max_length=500)
    answer: str = Field(min_length=1)
    order_index: int = 0
    is_active: bool = True


class FaqPatch(BaseModel):
    category: FaqCategory | None = None
    question: str | None = Field(default=None, min_length=1, max_length=500)
    answer: str | None = Field(default=None, min_length=1)
    order_index: int | None = None
    is_active: bool | None = None
