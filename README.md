# Reading Room: Local RAG Chatbot

Chat with your own documents (PDF, TXT, DOCX). It runs **fully on your own PC**: no Docker and no paid API, and your files never leave your machine unless you choose an online model.

Upload documents and ask questions. The bot answers from your files and shows the **sources** it used. A built-in **System Prompt panel** lets you practise prompt engineering by saving prompts and presets and comparing answers.

---

## Features

- 📄 **Document upload**: PDF, TXT and DOCX, chunked and embedded automatically
- 🔎 **Retrieval-Augmented Generation (RAG)**: answers are based on your documents, with sources shown under each reply
- 💬 **Conversations**: multiple chats with history, stored in a local SQLite database
- 🧠 **System prompt panel**: write, save and reuse system-prompt presets
- 🖥️ **Runs locally**: local LLM via [Ollama](https://ollama.com) and local embeddings via [fastembed](https://github.com/qdrant/fastembed)
- 🌐 **Optional free online models**: Groq and Gemini, with automatic fallback when a rate limit is hit
- ⚡ **Answer cache**: the same question with the same documents and prompt is answered from memory, with no new model call
- 🗣️ **Answer language**: English, Urdu (اردو) or Roman Urdu, picked from a dropdown next to the chat box
- 📝 **Quiz mode**: the bot writes multiple-choice questions from your documents, you answer, and it keeps score
- 🔍 **Click a source to see the passage**: opens the exact part of the file the answer used, highlighted, plus a link to the original file
- 🎤 **Voice**: ask by microphone (Chrome/Edge, needs internet) and the answer is read aloud; every answer also has a 🔊 Listen button
- ✨ **Summary and suggested questions**: every new document gets a short summary, key points and 4 questions you can click to ask
- 🆚 **Compare two documents**: what both cover, what is only in one, and where they disagree
- 🔗 **Web pages and YouTube**: paste a link and the page text (or the video's captions, or a linked PDF) becomes a document
- 🖼️ **OCR**: scanned PDFs and photos (PNG/JPG) are read with RapidOCR, on your PC (English print)
- ⬇️ **Export a chat** as Markdown, or as PDF through the browser's print dialog
- ⚖️ **Compare models**: one question, answered by Ollama, Groq and Gemini side by side, with timings
- 👍 / 👎 **Ratings** on every answer, plus which model answered (or "from cache")
- 🎭 **Personas**: Teacher, Dost and Strict Examiner, one click in the System Prompt panel
- 📊 **Stats page**: questions per day, most-cited documents, cache hits and ratings per model
- 🌗 Light and dark themes

## Tech stack

| Layer      | Technology |
|------------|------------|
| Frontend   | Next.js 14, React 18, TypeScript, Tailwind CSS, react-markdown |
| Backend    | Python, FastAPI, SQLAlchemy (async) + SQLite, Pydantic Settings |
| Embeddings | fastembed (`BAAI/bge-small-en-v1.5`, runs on CPU) |
| Chat LLM   | Ollama (`llama3.2:1b` by default), or Groq / Gemini (optional) |

## Project structure

```
rag-chatbot/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app
│   │   ├── config.py        # all settings (read from backend/.env)
│   │   ├── database.py      # SQLite setup
│   │   ├── ingestion.py     # document parsing + chunking
│   │   ├── retrieval.py     # vector search
│   │   ├── llm.py           # Ollama / Groq / Gemini + embeddings
│   │   ├── summary.py       # document summaries + comparing two documents
│   │   ├── web.py           # web page / YouTube links -> documents
│   │   └── routers/         # chat, conversations, documents, presets, quiz, stats
│   ├── requirements.txt
│   └── .env.example         # copy to .env and edit
├── frontend/
│   ├── app/                 # Next.js pages
│   ├── components/          # ChatPane, Sidebar, SourceViewer, ...
│   └── lib/                 # api.ts (backend client), language, speech, theme, export
├── setup.bat                # one-time setup
├── start.bat                # start the app
├── stop.bat                 # stop the app
├── run-backend.bat
└── run-frontend.bat
```

Created at runtime (not in the repo): `backend/data/` (database, uploads, embedding model), `ollama/`, `ollama-models/`, `cache/`.

---

## Requirements

- **Windows 10/11**
- **Python 3.10 to 3.12** (3.13 is not supported yet)
- **Node.js 18+** (20 LTS recommended)
- **Ollama** (for the local model), or a free **Groq** API key instead
- About **3 GB of free disk space** for the local model, packages and caches

## Getting started

### 1. Clone the repo

```bat
git clone https://github.com/SyedMuhammdSohaib/rag-chatbot.git
cd rag-chatbot
```

### 2. Choose a chat model

**Option A: Local with Ollama (private, no internet needed after setup)**

1. Download `ollama-windows-amd64.zip` from the [Ollama releases](https://github.com/ollama/ollama/releases).
2. Extract it into the `ollama\` folder inside the project, so the file `ollama\ollama.exe` exists.

**Option B: Free online model with Groq (good for slow internet or a slow PC)**

1. Create a free key at <https://console.groq.com/keys>.
2. Copy `backend\.env.example` to `backend\.env` and set:

   ```env
   LLM_PROVIDER=groq
   GROQ_API_KEY=gsk_your_key_here
   ```

> With Groq, the text of your question and the matching document chunks are sent to Groq's servers.

### 3. Run setup (once)

Double-click **`setup.bat`**. It will:

1. Create a Python virtual environment and install the backend packages
2. Download the embedding model
3. Install and build the frontend
4. Download the `llama3.2:1b` chat model (Ollama only, about 1.3 GB)

Downloads retry automatically. If setup stops halfway, run it again and it continues where it stopped. Wait until you see **`SETUP DONE`**.

### 4. Start the app

Double-click **`start.bat`**. It starts Ollama, the backend (`http://127.0.0.1:8000`) and the frontend, then opens **<http://localhost:3000>** in your browser.

Keep the minimized *Backend* and *Frontend* windows open while you use the app. To stop everything, run **`stop.bat`**.

## How to use

1. Open **Documents** in the sidebar and upload a PDF, TXT or DOCX. Wait until its status is **Ready**.
2. Go back to the chat and ask a question. Sources appear under each answer.
3. Click **System Prompt** to write and save a system prompt, or to create presets.
   Tip: ask the same question in different conversations with different system prompts and compare the answers.

---

## Configuration

All settings live in `backend\.env`. See `backend/app/config.py` for every option and its default value.

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_PROVIDER` | `ollama` | `ollama` (local) or `groq` (online) |
| `OLLAMA_CHAT_MODEL` | `llama3.2:1b` | Any model you have pulled with Ollama |
| `GROQ_API_KEY` | — | Free key from console.groq.com |
| `GROQ_CHAT_MODEL` | `openai/gpt-oss-20b` | Main Groq model |
| `GROQ_FALLBACK_MODELS` | `openai/gpt-oss-120b,...` | Tried in order when the main model hits its limit |
| `GEMINI_API_KEY` | — | Optional second free provider ([get a key](https://aistudio.google.com/apikey)) |
| `FALLBACK_TO_OLLAMA` | `true` | Use local Ollama if every online model is out of quota |
| `CHUNK_SIZE` / `CHUNK_OVERLAP` | `1000` / `150` | Document chunking |
| `TOP_K` | `4` | Number of chunks retrieved per question |

**Fallback order:** Groq main model → Groq fallback models → Gemini (if a key is set) → Ollama (if it is running). Short per-minute limits are retried automatically after a few seconds.

After changing `.env`, run `stop.bat` and then `start.bat`.

### Changing the local model

```bat
ollama\ollama.exe pull llama3.2:3b
```
Then set `OLLAMA_CHAT_MODEL=llama3.2:3b` in `backend\.env` and restart.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Could not reach Ollama" / no answer | Make sure the *Ollama* window is open, then run `start.bat` again |
| First answer is very slow | Normal: the model loads into RAM first (30 to 120 s) |
| "Port already in use" | Close the old Backend/Frontend windows, or run `stop.bat` |
| "No Python 3.10-3.12 found" | Install Python 3.12 (you can keep 3.13 installed as well) |
| NetworkError in the chat | The backend is not running. Run `start.bat` again |

## License

This project is for personal and educational use. Add a license (for example, MIT) if you want others to reuse it.
