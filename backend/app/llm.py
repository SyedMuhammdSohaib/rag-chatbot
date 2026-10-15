"""
All model calls live here, so the rest of the app never touches a provider.

Chat goes through a chain of free models. If one hits its rate limit (429)
or is not available, the next one is tried automatically:
    Groq models  ->  Gemini models (if GEMINI_API_KEY is set)  ->  local Ollama (if running)
LLM_PROVIDER=ollama skips the online models completely (no limits at all).

Embeddings always run locally (fastembed): no key, no limits.
"""
import asyncio
import hashlib
import json
from collections import OrderedDict
from collections.abc import AsyncIterator

from openai import (
    APIConnectionError,
    APITimeoutError,
    AsyncOpenAI,
    AuthenticationError,
    BadRequestError,
    InternalServerError,
    NotFoundError,
    PermissionDeniedError,
    RateLimitError,
)

from app.config import get_settings

settings = get_settings()

_clients: dict[str, AsyncOpenAI] = {}
_embedder = None
_answer_cache: "OrderedDict[str, str]" = OrderedDict()

# Short waits are worth doing in place (per-minute limits reset quickly);
# anything longer means a daily limit, so we move to the next model.
MAX_INLINE_WAIT_SECONDS = 20

BASE_URLS = {
    "groq": "https://api.groq.com/openai/v1",
    "gemini": "https://generativelanguage.googleapis.com/v1beta/openai/",
}


def _client(provider: str) -> AsyncOpenAI:
    if provider not in _clients:
        if provider == "ollama":
            _clients[provider] = AsyncOpenAI(api_key="ollama", base_url=f"{settings.ollama_base_url}/v1", timeout=600)
        else:
            key = settings.groq_api_key if provider == "groq" else settings.gemini_api_key
            # max_retries=0: we handle failures ourselves so we can switch models
            _clients[provider] = AsyncOpenAI(api_key=key, base_url=BASE_URLS[provider], max_retries=0, timeout=120)
    return _clients[provider]


def _get_embedder():
    """Loads the embedding model once. The files are cached under
    backend/data/models (on this drive), so they download only one time."""
    global _embedder
    if _embedder is None:
        from fastembed import TextEmbedding

        _embedder = TextEmbedding(model_name=settings.local_embedding_model, cache_dir=settings.model_cache_dir)
    return _embedder


async def get_embeddings(texts: list[str]) -> list[list[float]]:
    """Embeds many texts in one go (much faster than one at a time)."""

    def _run():
        return [v.tolist() for v in _get_embedder().embed(texts)]

    return await asyncio.to_thread(_run)


async def get_embedding(text: str) -> list[float]:
    return (await get_embeddings([text]))[0]


def _split(models: str) -> list[str]:
    return [m.strip() for m in models.split(",") if m.strip()]


def _candidates() -> list[tuple[str, str]]:
    """(provider, model) pairs in the order they should be tried."""
    if settings.llm_provider != "groq":
        return [("ollama", settings.ollama_chat_model)]
    out: list[tuple[str, str]] = []
    if settings.groq_api_key:
        for m in [settings.groq_chat_model, *_split(settings.groq_fallback_models)]:
            if ("groq", m) not in out:
                out.append(("groq", m))
    if settings.gemini_api_key:
        for m in _split(settings.gemini_models):
            out.append(("gemini", m))
    return out


def _retry_after_seconds(exc: RateLimitError) -> float:
    try:
        return float(exc.response.headers.get("retry-after", "0"))
    except (TypeError, ValueError, AttributeError):
        return 0.0


async def _stream_one(provider: str, model: str, messages: list[dict]) -> AsyncIterator[str]:
    kwargs = dict(model=model, messages=messages, stream=True, temperature=0.2, max_tokens=settings.max_answer_tokens)
    if provider == "groq" and model.startswith("openai/gpt-oss"):
        # These models "think" before answering; low effort uses far fewer tokens
        kwargs["extra_body"] = {"reasoning_effort": "low"}
    stream = await _client(provider).chat.completions.create(**kwargs)
    async for chunk in stream:
        delta = chunk.choices[0].delta.content if chunk.choices else None
        if delta:
            yield delta


async def _ollama_is_up() -> bool:
    try:
        await asyncio.wait_for(_client("ollama").models.list(), timeout=3)
        return True
    except Exception:  # noqa: BLE001
        return False


def _cache_key(messages: list[dict]) -> str:
    return hashlib.sha256(json.dumps(messages, ensure_ascii=False, sort_keys=True).encode()).hexdigest()


async def stream_chat_completion(system_prompt: str, history: list[dict], user_message: str) -> AsyncIterator[str]:
    messages = [{"role": "system", "content": system_prompt}, *history, {"role": "user", "content": user_message}]

    key = _cache_key(messages)
    if key in _answer_cache:
        _answer_cache.move_to_end(key)
        yield _answer_cache[key]
        return

    answer_parts: list[str] = []
    tried: list[str] = []
    problems: list[str] = []
    shortest_wait = None

    async def run(provider: str, model: str):
        async for token in _stream_one(provider, model, messages):
            answer_parts.append(token)
            yield token

    chain = _candidates()
    if settings.llm_provider == "groq" and settings.fallback_to_ollama:
        chain.append(("ollama", settings.ollama_chat_model))

    for provider, model in chain:
        if provider == "ollama" and settings.llm_provider == "groq" and not await _ollama_is_up():
            continue
        tried.append(f"{provider}:{model}")
        waited = False
        while True:
            try:
                async for token in run(provider, model):
                    yield token
                answer = "".join(answer_parts)
                if answer.strip():
                    _answer_cache[key] = answer
                    while len(_answer_cache) > settings.answer_cache_size:
                        _answer_cache.popitem(last=False)
                    return
                problems.append(f"{model}: empty answer")
                break
            except RateLimitError as exc:
                if answer_parts:
                    raise RuntimeError("The free limit was reached in the middle of the answer. Please ask again.") from exc
                wait = _retry_after_seconds(exc)
                shortest_wait = wait if shortest_wait is None else min(shortest_wait, wait)
                if not waited and 0 < wait <= MAX_INLINE_WAIT_SECONDS:
                    waited = True
                    await asyncio.sleep(wait)
                    continue  # same model, once more
                problems.append(f"{model}: rate limit")
                break
            except (NotFoundError, PermissionDeniedError, BadRequestError):
                problems.append(f"{model}: not available")
                break
            except AuthenticationError:
                problems.append(f"{provider}: API key is wrong")
                break
            except (APIConnectionError, APITimeoutError, InternalServerError) as exc:
                if answer_parts:
                    raise RuntimeError("The connection dropped in the middle of the answer. Please ask again.") from exc
                if not waited:
                    waited = True
                    await asyncio.sleep(2)
                    continue  # one quick retry for a flaky connection
                problems.append(f"{provider}: no connection")
                break

    if not tried:
        if settings.llm_provider == "groq":
            raise RuntimeError("No chat model is set up. Put GROQ_API_KEY (and optionally GEMINI_API_KEY) in backend\\.env.")
        raise RuntimeError("Ollama is not running. Run start.bat.")

    if all("no connection" in p for p in problems):
        raise RuntimeError("No internet connection right now. Check your Wi-Fi and ask again.")
    hint = f" Try again in about {int(shortest_wait) + 1} seconds." if shortest_wait else " Try again in a minute."
    if any("API key is wrong" in p for p in problems):
        hint += " Also check the API keys in backend\\.env."
    raise RuntimeError(f"All free models are busy right now ({'; '.join(problems)}).{hint}")
