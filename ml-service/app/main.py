import logging
import os
from typing import List

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from faster_whisper import WhisperModel
from transformers import pipeline

from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("echo-archive-ml")

app = FastAPI(title="Echo Archive ML Service")

WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "base")
SUMMARIZER_MODEL = os.getenv("SUMMARIZER_MODEL", "google/flan-t5-base")

_whisper_model: WhisperModel | None = None
_text_tokenizer = None
_text_model = None


def get_whisper_model() -> WhisperModel:
    global _whisper_model
    if _whisper_model is None:
        logger.info("Loading Whisper model: %s", WHISPER_MODEL_SIZE)
        _whisper_model = WhisperModel(
            WHISPER_MODEL_SIZE,
            device="cpu",
            compute_type="int8",
        )
    return _whisper_model


def get_text_model():
    global _text_tokenizer, _text_model
    if _text_model is None:
        logger.info("Loading text model: %s", SUMMARIZER_MODEL)
        _text_tokenizer = AutoTokenizer.from_pretrained(SUMMARIZER_MODEL)
        _text_model = AutoModelForSeq2SeqLM.from_pretrained(SUMMARIZER_MODEL)
    return _text_tokenizer, _text_model


def chunk_text(text: str, max_chars: int = 1500) -> List[str]:
    chunks: List[str] = []
    buffer: List[str] = []
    count = 0
    for line in text.splitlines():
        line_len = len(line) + 1
        if count + line_len > max_chars and buffer:
            chunks.append("\n".join(buffer))
            buffer = []
            count = 0
        buffer.append(line)
        count += line_len
    if buffer:
        chunks.append("\n".join(buffer))
    return chunks


def generate_text(prompt: str, max_new_tokens: int = 256) -> str:
    tokenizer, model = get_text_model()
    inputs = tokenizer(prompt, return_tensors="pt")
    outputs = model.generate(
        **inputs,
        max_new_tokens=max_new_tokens,
        do_sample=False,
        num_beams=4,
    )
    return tokenizer.decode(outputs[0], skip_special_tokens=True).strip()


def summarize_text(text: str) -> str:
    chunks = chunk_text(text)
    summaries: List[str] = []
    for chunk in chunks:
        prompt = (
            "Summarize the following transcript in 5 short bullet points. "
            "Keep names and key facts.\n\n"
            f"{chunk}\n\nSummary:"
        )
        summaries.append(generate_text(prompt, max_new_tokens=200))
    if len(summaries) == 1:
        return summaries[0]
    combined = "\n".join(summaries)
    final_prompt = (
        "Combine these partial summaries into one concise summary with bullets.\n\n"
        f"{combined}\n\nSummary:"
    )
    return generate_text(final_prompt, max_new_tokens=200)


class AnalyzeRequest(BaseModel):
    file_path: str = Field(..., alias="filePath")
    language: str | None = None


class AnalyzeResponse(BaseModel):
    transcript: str
    summary: str


class ChatRequest(BaseModel):
    question: str
    context: str


class ChatResponse(BaseModel):
    answer: str


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "whisper_model": WHISPER_MODEL_SIZE,
        "summarizer_model": SUMMARIZER_MODEL,
    }


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze_audio(request: AnalyzeRequest):
    file_path = request.file_path
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Audio file not found")

    model = get_whisper_model()
    segments, _info = model.transcribe(file_path, language=request.language)

    transcript_parts: List[str] = []
    for segment in segments:
        transcript_parts.append(segment.text.strip())
    transcript = " ".join(part for part in transcript_parts if part)

    if not transcript:
        raise HTTPException(status_code=422, detail="No speech detected")

    summary = summarize_text(transcript)
    return AnalyzeResponse(transcript=transcript, summary=summary)


@app.post("/chat", response_model=ChatResponse)
async def chat_with_context(request: ChatRequest):
    if not request.context.strip():
        raise HTTPException(status_code=400, detail="Missing context")

    prompt = (
        "You are a helpful assistant. Answer the question using the context. "
        "If the answer is not in the context, say you do not know.\n\n"
        f"Context:\n{request.context}\n\n"
        f"Question: {request.question}\n"
        "Answer:"
    )
    answer = generate_text(prompt, max_new_tokens=256)
    return ChatResponse(answer=answer)
