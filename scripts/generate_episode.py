import asyncio
import json
import os
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

async def build_episode():
    os.makedirs("public", exist_ok=True)
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=PROMPT,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.8,
        ),
    )
    episode = json.loads(response.text)

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
