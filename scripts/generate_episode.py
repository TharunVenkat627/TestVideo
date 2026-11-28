import asyncio
import json
import os
import re
from google import genai
from google.genai import types
import edge_tts
from mutagen.mp3 import MP3

PROMPT = """
Write an engaging, fast-paced 90-second original story (around 220 words) about an everyday relatable struggle or funny mind-bending thought experiment.
Break the story into 6 to 8 distinct visual scenes for a 2D hand-drawn stickman animation.
Return ONLY valid JSON matching this exact schema:
{
  "title": "Catchy YouTube Title",
  "description": "Short 2-sentence YouTube description with 3 hashtags",
  "scenes": [
    {
      "narration": "Spoken lines for this scene.",
      "caption": "Short punchy 4-6 word on-screen headline",
      "action": "run | jump_flip | think | celebrate",
      "setting": "paper_gap | apartment | blank_spotlight"
    }
  ]
}
"""

def get_candidate_models(client: genai.Client) -> list[str]:
    """Fetch available text-generation models dynamically and prioritize fast Flash/Gemma models."""
    preferred = [
        "gemini-3.8-flash",
        "gemini-3.7-flash",
        "gemini-3.6-flash",
        "gemini-3.5-flash",
        "gemini-3.5-flash-lite",
        "gemini-3.1-flash-lite",
        "gemini-2.5-flash-lite",
        "gemini-2.5-pro",
        "gemma-4-31b-it",
        "gemma-4-26b-a4b-it",
    ]
    available = []
    for m in client.models.list():
        actions = m.supported_actions or []
        if "generateContent" not in actions:
            continue
        name = m.name.replace("models/", "")
        # Exclude image-only, research, and deprecated 2.5-flash endpoints
        if any(skip in name for skip in ["image", "deep-research", "antigravity"]) or name == "gemini-2.5-flash":
            continue
        available.append(name)

    ordered = [m for m in preferred if m in available]
    for m in available:
        if m not in ordered:
            ordered.append(m)
    return ordered or preferred

def parse_json_safely(raw_text: str) -> dict:
    """Strip markdown code fences if a fallback model (like Gemma) wraps its JSON output."""
    cleaned = raw_text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    return json.loads(cleaned)

async def build_episode():
    os.makedirs("public", exist_ok=True)
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY secret is empty or missing in GitHub Actions.")

    client = genai.Client(api_key=api_key)
    models_to_try = get_candidate_models(client)
    print(f"Candidate models found for this API key: {models_to_try}")

    episode = None
    errors = []

    for model_name in models_to_try:
        try:
            # Gemma models do not always support response_mime_type="application/json"
            is_gemma = model_name.startswith("gemma")
            config = types.GenerateContentConfig(
                temperature=0.8,
                **({} if is_gemma else {"response_mime_type": "application/json"}),
            )
            response = client.models.generate_content(
                model=model_name,
                contents=PROMPT,
                config=config,
            )
            episode = parse_json_safely(response.text)
            print(f"SUCCESS: Script generated using {model_name}")
            break
        except Exception as e:
            err_msg = f"{model_name} -> {type(e).__name__}: {e}"
            print(err_msg)
            errors.append(err_msg)

    if episode is None:
        raise RuntimeError("All candidate models failed:\n" + "\n".join(errors))

    # Combine narration and generate neural voiceover
    full_script = " ".join(s["narration"] for s in episode["scenes"])
    audio_path = "public/voiceover.mp3"
    communicate = edge_tts.Communicate(full_script, voice="en-US-AndrewNeural", rate="+5%")
    await communicate.save(audio_path)

    # Calculate exact duration in frames (30 fps) + 1.5s buffer
    audio_len = MP3(audio_path).info.length
    total_frames = int((audio_len + 1.5) * 30)

    # Distribute frame ranges proportionally by word count per scene
    total_words = max(1, sum(len(s["narration"].split()) for s in episode["scenes"]))
    cursor = 0
    for scene in episode["scenes"]:
        words = len(scene["narration"].split())
        dur = max(60, int((words / total_words) * total_frames))
        scene["startFrame"] = cursor
        scene["durationInFrames"] = dur
        cursor += dur

    episode["totalFrames"] = cursor
    with open("public/episode.json", "w", encoding="utf-8") as f:
        json.dump(episode, f, indent=2)

    print(f"Generated '{episode['title']}' ({cursor} frames / {cursor/30:.1f}s)")

if __name__ == "__main__":
    asyncio.run(build_episode())
