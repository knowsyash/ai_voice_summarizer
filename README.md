# Echo Archive

Local, free audio processing with transcription, summarization, and chat.

## Requirements

- Node.js (for the Next.js app and worker)
- Python 3.10+ (for the local ML service)

## Getting Started

### 1) Install Node dependencies

```bash
npm install
```

### 2) Start the Next.js app

```bash
npm run dev
```

### 3) Start the worker (processing queue)

```bash
npm run dev:worker
```

### 4) Start the local ML service (free, open-source)

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r ml-service/requirements.txt
npm run dev:ml
```

The first run downloads open-source models locally (Whisper + Flan-T5).

## Environment

Copy `.env.example` to `.env.local` and adjust as needed. By default, the app
uses `http://localhost:8000` for the ML service.

```
ML_SERVICE_URL=http://localhost:8000
WHISPER_MODEL_SIZE=base
SUMMARIZER_MODEL=google/flan-t5-base
```

## Usage

1. Open the dashboard at `/dashboard`.
2. Upload an audio file.
3. Wait for the transcript + summary to appear.
4. Ask questions in the chat panel to summarize or explore the dataset.
# ai_voice_summarizer
