# Reading Room (no Docker) - chat with your documents

Fully free and local. No Docker, no API key, nothing is sent to any company.
Everything lives inside this folder, so it all stays on the E: drive.

- Chat model: Ollama (llama3.2:1b) running on your PC
- Embeddings: local model (fastembed)
- Database: SQLite file (backend\data\app.db) - nothing to install
- Backend: FastAPI | Frontend: Next.js (dark theme) | System-prompt practice panel included

## Folder layout (Roman Urdu: kya kahan hai)

    E:\rag-chatbot-local\
      setup.bat   <- ek dafa chalana
      start.bat   <- roz isay chalana
      stop.bat    <- band karne ke liye
      ollama\     <- yahan ollama.exe rakhna hai (neeche Step 2)
      backend\    <- Python server (backend\data mein database, uploads, models)
      frontend\   <- website
      ollama-models\ , cache\   <- downloads (sab isi folder mein)

## Steps

### 1. Folder
Zip ko E: drive pe extract karo taake ye file yahan ho: `E:\rag-chatbot-local\setup.bat`

### 2. Zaroori programs (pehle check karo, shayad pehle se hain)
Command Prompt mein:

    python --version     (3.10, 3.11 ya 3.12 chahiye. 3.13 nahi chalega)
    node --version       (18 ya 20 ya usse naya)

Agar Python 3.13 ya naya hai (sirf wohi) to **Python 3.12 alag se E: pe install karo** (3.13 ko hatana nahi hai):
1. https://www.python.org/downloads/release/python-31210/ se "Windows installer (64-bit)" download karo.
2. Installer chalao > **Customize installation** > Next > "Customize install location" mein likho `E:\Python312` > Install.
3. "Add python.exe to PATH" tick karna zaroori nahi. setup.bat `E:\Python312` khud dhoond leta hai.

Node.js na ho to Node.js 20 LTS install karo (nodejs.org).

**Ollama (C: pe kuch install nahi hoga):**
1. https://github.com/ollama/ollama/releases kholo, latest release mein `ollama-windows-amd64.zip` download karo.
2. Usay `E:\rag-chatbot-local\ollama\` mein extract karo, taake `E:\rag-chatbot-local\ollama\ollama.exe` bane.

### 2b. SHORTCUT: Ollama download bohot slow ho to Groq use karo (free, online)
Ollama (1-2 GB) + chat model (1.3 GB) ka download slow internet pe bohot waqt leta hai. Iska free alternative:
1. https://console.groq.com/keys pe free account banao, "Create API Key" dabao, key (`gsk_...`) copy karo.
2. `backend\.env` ko Notepad mein kholo (na ho to `backend\.env.example` ki copy banake naam `.env` rakho).
3. Is tarah likho aur save karo:

       LLM_PROVIDER=groq
       GROQ_API_KEY=gsk_apni_key_yahan

4. Ab Ollama ka zip rakhne ki zaroorat nahi, `setup.bat` aur `start.bat` khud Ollama skip kar dete hain.
Jawab Groq ke online Llama model se aayenge (documents ka text bhi us ko jata hai). Baad mein chaho to `LLM_PROVIDER=ollama` karke local pe wapas aa sakte ho.

### 3. Setup (ek dafa)
`setup.bat` pe double-click karo. Ye Python packages, embedding model (130 MB), frontend aur chat model (1.3 GB) download karta hai.
Internet slow ho to wo khud dobara koshish karta hai. Beech mein fail ho jaye to bas `setup.bat` dobara chalao, wo wahin se aage barhta hai.
Aakhir mein "SETUP DONE" likha aana chahiye.

### 4. Chalao
`start.bat` pe double-click karo. 3 windows khulengi (Ollama, Backend, Frontend) aur browser `http://localhost:3000` khulega.
Backend aur Frontend wali windows khuli rakhna.

### 5. Use
1. Sidebar mein **Documents** > PDF/TXT/DOCX upload karo, status **Ready** hone ka wait karo.
2. Wapas chat mein sawal poochho. Jawab ke neeche sources dikhenge.
3. Upar **System Prompt** button se system prompt likho, save karo, presets banao.
   Practice ka tareeqa: ek hi sawal alag conversations mein alag system prompts ke sath poochho.

### 6. Band karna / dobara chalana
`stop.bat` se band. Agli baar sirf `start.bat` (setup dobara nahi chalana).

## Problems

- **Jawab nahi aata / "Could not reach Ollama"**: Ollama wali window khuli hai? `start.bat` dobara chalao.
- **Pehla jawab slow**: normal hai, model RAM mein load hota hai (30-120 sec). Chhota PC hai to sabar karo.
- **"port already in use"**: purani Backend/Frontend window band karo (ya stop.bat chalao).
- **Chat model badalna**: `backend\.env` mein `OLLAMA_CHAT_MODEL=` badlo aur `ollama\ollama.exe pull <model>` chalao.
- **Free hosted model (Groq)** chahiye to `backend\.env` mein `LLM_PROVIDER=groq` aur `GROQ_API_KEY=` likho.
- **Docker ab zaroori nahi.** Chaho to Docker Desktop uninstall kar sakte ho, C: aur E: pe jagah wapas mil jayegi.

## Rate limits kam karna (free models ki chain)
Jawab ke liye app models ko is tarteeb se try karti hai. Ek ki limit lage to agla khud chal jata hai:
1. Groq: `GROQ_CHAT_MODEL`, phir `GROQ_FALLBACK_MODELS` (har model ki apni alag limit)
2. Gemini: `GEMINI_MODELS` (sirf agar `GEMINI_API_KEY` diya ho; free key: https://aistudio.google.com/apikey)
3. Ollama (agar computer pe chal raha ho; iski koi limit nahi)

Chhoti (per-minute) limit pe app chand second ruk ke khud dobara try karti hai. Same sawal + same documents + same prompt dobara poochho to jawab memory se aata hai, koi API call nahi hoti.
`.env` badalne ke baad: stop.bat, phir start.bat.
