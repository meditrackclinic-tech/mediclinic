import os
from functools import lru_cache

from fastapi import FastAPI
from pydantic import BaseModel, Field
from transformers import pipeline


MODEL_ID = os.getenv("HF_NLP_MODEL", "d4data/biomedical-ner-all")
MODEL_REVISION = os.getenv(
    "HF_NLP_REVISION",
    "015a4050c9ac99722e61c547aa9b4282bcbedc7f",
)

app = FastAPI(
    title="MediTrack Local Clinical NLP",
    version="1.0.0",
    docs_url=None,
    redoc_url=None,
)


class AnalyzeRequest(BaseModel):
    text: str = Field(min_length=1, max_length=4000)


class Entity(BaseModel):
    label: str
    text: str
    score: float
    start: int
    end: int


class AnalyzeResponse(BaseModel):
    model: str
    revision: str
    entities: list[Entity]


@lru_cache(maxsize=1)
def get_pipeline():
    return pipeline(
        "token-classification",
        model=MODEL_ID,
        revision=MODEL_REVISION,
        aggregation_strategy="simple",
    )


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": MODEL_ID,
        "revision": MODEL_REVISION,
        "loaded": get_pipeline.cache_info().currsize > 0,
    }


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(request: AnalyzeRequest):
    predictions = get_pipeline()(request.text)
    entities = [
        Entity(
            label=str(item.get("entity_group") or item.get("entity") or ""),
            text=request.text[int(item["start"]): int(item["end"])],
            score=float(item["score"]),
            start=int(item["start"]),
            end=int(item["end"]),
        )
        for item in predictions
    ]
    return AnalyzeResponse(model=MODEL_ID, revision=MODEL_REVISION, entities=entities)
