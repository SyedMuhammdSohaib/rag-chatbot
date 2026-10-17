"""Answer language. Added to the end of the system prompt for one request
only, so it never changes the prompt saved on a conversation."""

LANGUAGE_INSTRUCTIONS = {
    "en": "",
    "ur": (
        "Always write your answer in Urdu, using Urdu script (اردو). "
        "Keep [Source N] labels and technical terms as they are."
    ),
    "roman_ur": (
        "Always write your answer in Roman Urdu: Urdu words written with English letters, "
        "the way people type on WhatsApp (for example: 'Yeh document batata hai ke...'). "
        "Do not use Urdu script. Keep [Source N] labels and technical terms as they are."
    ),
}


def with_language(system_prompt: str, language: str | None) -> str:
    instruction = LANGUAGE_INSTRUCTIONS.get(language or "en", "")
    return f"{system_prompt}\n\n{instruction}" if instruction else system_prompt
