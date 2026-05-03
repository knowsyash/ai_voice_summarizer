# Echo Archive ML Service

Local, free, open-source transcription and summarization service.

## Setup

1. Create a Python environment.
2. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

3. Start the service:

   ```bash
   python -m uvicorn app.main:app --app-dir ml-service --reload --port 8000
   ```

## Environment

- `WHISPER_MODEL_SIZE` (default: `base`)
- `SUMMARIZER_MODEL` (default: `google/flan-t5-base`)

The first run downloads models from Hugging Face. Everything stays local after that.
