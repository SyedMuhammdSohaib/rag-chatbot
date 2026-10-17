"""Turns a web page or YouTube link into a document: its readable text
(or the PDF it points to) plus a file name."""
import asyncio
import re
from html.parser import HTMLParser
from urllib.parse import parse_qs, urlparse

import httpx

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ReadingRoom/1.0"


class _TextExtractor(HTMLParser):
    SKIP = {"script", "style", "noscript", "svg", "nav", "footer", "header", "form", "aside", "button", "iframe"}
    BLOCK = {
        "p", "div", "br", "li", "tr", "section", "article", "blockquote", "pre", "table",
        "h1", "h2", "h3", "h4", "h5", "h6",
    }

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.title = ""
        self._skip = 0
        self._in_title = False

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self._skip += 1
        elif tag == "title":
            self._in_title = True
        if tag in self.BLOCK:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in self.SKIP and self._skip:
            self._skip -= 1
        elif tag == "title":
            self._in_title = False
        if tag in self.BLOCK:
            self.parts.append("\n")

    def handle_data(self, data):
        if self._in_title:
            self.title += data
        elif not self._skip:
            self.parts.append(data)


def html_to_text(html: str) -> tuple[str, str]:
    """(title, readable text) of an HTML page, without menus and scripts."""
    parser = _TextExtractor()
    parser.feed(html)
    lines = [re.sub(r"\s+", " ", line).strip() for line in "".join(parser.parts).split("\n")]
    text = "\n".join(line for line in lines if line)
    return re.sub(r"\s+", " ", parser.title).strip(), text


def safe_filename(name: str, fallback: str) -> str:
    """A title cleaned up so Windows accepts it as a file name."""
    cleaned = re.sub(r"\s+", " ", re.sub(r'[\\/:*?"<>|]+', " ", name)).strip(" .")
    return (cleaned or fallback)[:100]


def youtube_id(url: str) -> str | None:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    if host.endswith("youtu.be"):
        return parsed.path.strip("/").split("/")[0] or None
    if host.endswith("youtube.com"):
        if parsed.path == "/watch":
            return parse_qs(parsed.query).get("v", [None])[0]
        match = re.match(r"/(?:shorts|embed|live)/([\w-]{11})", parsed.path)
        return match.group(1) if match else None
    return None


def _youtube_transcript(video_id: str) -> str:
    from youtube_transcript_api import YouTubeTranscriptApi

    transcripts = YouTubeTranscriptApi().list(video_id)
    try:
        transcript = transcripts.find_transcript(["en", "ur", "hi"])
    except Exception:  # noqa: BLE001  (no preferred language: take whatever exists)
        transcript = next(iter(transcripts))
    snippets = [s["text"].strip() for s in transcript.fetch().to_raw_data() if s["text"].strip()]
    # Captions come as short fragments; group them into paragraphs for chunking
    return "\n\n".join(" ".join(snippets[i : i + 30]) for i in range(0, len(snippets), 30))


async def fetch_link(url: str) -> tuple[str, bytes, str]:
    """(file name, file bytes, content type) for a link. Raises ValueError
    with a message that can be shown to the user."""
    if not re.match(r"https?://", url, re.I):
        raise ValueError("Please paste a full link starting with http:// or https://")

    async with httpx.AsyncClient(follow_redirects=True, timeout=30, headers={"User-Agent": USER_AGENT}) as client:
        video = youtube_id(url)
        if video:
            try:
                text = await asyncio.to_thread(_youtube_transcript, video)
            except Exception as exc:  # noqa: BLE001
                raise ValueError(
                    "Couldn't get captions for this video. It may have no subtitles, "
                    "or YouTube blocked the request."
                ) from exc
            title = f"YouTube {video}"
            try:
                meta = await client.get("https://www.youtube.com/oembed", params={"url": url, "format": "json"})
                title = meta.json().get("title") or title
            except Exception:  # noqa: BLE001  (the title is a nice-to-have)
                pass
            return f"{safe_filename(title, video)}.txt", text.encode(), "text/plain"

        try:
            res = await client.get(url)
            res.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise ValueError(f"The site answered with error {exc.response.status_code}.") from exc
        except httpx.HTTPError as exc:
            raise ValueError(f"Couldn't open that link ({exc.__class__.__name__}).") from exc

        host = urlparse(str(res.url)).hostname or "page"
        content_type = res.headers.get("content-type", "").split(";")[0].strip().lower()
        if content_type == "application/pdf" or str(res.url).lower().endswith(".pdf"):
            name = urlparse(str(res.url)).path.rsplit("/", 1)[-1] or f"{host}.pdf"
            if not name.lower().endswith(".pdf"):
                name += ".pdf"
            return safe_filename(name, f"{host}.pdf"), res.content, "application/pdf"

        if "html" not in content_type and not content_type.startswith("text/"):
            raise ValueError(f"That link is a {content_type or 'unknown'} file, not a web page or PDF.")

        title, text = html_to_text(res.text) if "html" in content_type else ("", res.text)
        if len(text) < 200:
            raise ValueError(
                "Found almost no text on that page. It may need a login or be built with JavaScript."
            )
        return f"{safe_filename(title, host)}.txt", text.encode(), "text/plain"
