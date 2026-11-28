import asyncio
import json
import os
import random
import re
from google import genai
from google.genai import types
import edge_tts
from mutagen.mp3 import MP3

OBJECT_POOL = [
    "A ₹10 Note",
    "A Wooden Pencil",
    "A Plastic Water Bottle",
    "A Phone Charger",
    "A School Bag",
    "An Old Umbrella",
    "A Leather Cricket Ball",
    "A Teddy Bear",
    "A School Bench",
    "A Paper Train Ticket",
    "A Street Light",
    "A Worn-Out Slipper",
]

CHAPTER_SPECS = [
    ("0. HOOK", "0:00 - 0:45", "Powerful emotional hook + mystery in first person. Tease a dramatic life without revealing the ending. ~110 words, 3 visual scenes."),
    ("1. BIRTH", "0:45 - 2:00", "How I was made in the factory, raw materials, first moment of consciousness, first sight, and my big dream. Include 1 surprising real-world manufacturing fact. ~200 words, 5 visual scenes."),
    ("2. FIRST HOME", "2:00 - 4:00", "Start with a mini-hook. Who bought me first? First owner, happy early days, funny small details, emotional bonding. ~230 words, 6 visual scenes."),
    ("3. GOLDEN DAYS", "4:00 - 6:00", "Start with a mini-hook. My best life, daily routine, adventures, how I helped my owner. Build deep love for the character. ~230 words, 6 visual scenes."),
    ("4. FIRST CRACK", "6:00 - 8:00", "Start with a mini-hook. First problem—getting old, scratched, damaged, or ignored as newer things replace me. Jealousy, sadness, fear. ~220 words, 6 visual scenes."),
    ("5. THE DARK PHASE", "8:00 - 10:00", "Start with a mini-hook. Worst moment—lost, broken, thrown away, or forgotten in a drawer, dustbin, or rainy street. Loneliness in vivid detail. ~220 words, 6 visual scenes."),
    ("6. JOURNEY AFTER", "10:00 - 11:30", "What happens after being thrown away? Traveling, scrapyard/recycling/new hands. Include 1-2 surprising real facts about decomposition or lifecycle. ~190 words, 5 visual scenes."),
    ("7. ENDING & REBIRTH", "11:30 - 13:00", "Final fate (recycled, reused, or remembered), emotional callback to my FIRST owner, life lesson for humans, powerful closing quote, and a question for viewers to comment. ~180 words, 5 visual scenes."),
]

def get_candidate_models(client: genai.Client) -> list[str]:
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
        if "generateContent" not in (m.supported_actions or []):
            continue
        name = m.name.replace("models/", "")
        if any(s in name for s in ["image", "deep-research", "antigravity"]) or name == "gemini-2.5-flash":
            continue
        available.append(name)
    ordered = [m for m in preferred if m in available]
    for m in available:
        if m not in ordered:
            ordered.append(m)
    return ordered or preferred

def call_llm_json(client: genai.Client, models: list[str], prompt: str) -> dict:
    last_err = None
    for model_name in models:
        try:
            is_gemma = model_name.startswith("gemma")
            cfg = types.GenerateContentConfig(
                temperature=0.8,
                **({} if is_gemma else {"response_mime_type": "application/json"}),
            )
            res = client.models.generate_content(model=model_name, contents=prompt, config=cfg)
            cleaned = re.sub(r"^```(?:json)?\s*", "", res.text.strip())
            cleaned = re.sub(r"\s*```\$", "", cleaned)
            return json.loads(cleaned)
        except Exception as e:
            last_err = f"{model_name}: {e}"
            print(f"Retrying next model ({last_err})")
    raise RuntimeError(f"All models failed. Last error: {last_err}")

def format_timestamp(seconds: float) -> str:
    mins = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{mins}:{secs:02d}"

async def build_episode():
    os.makedirs("public", exist_ok=True)
    os.makedirs("out", exist_ok=True)

    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is missing.")

    client = genai.Client(api_key=api_key)
    models = get_candidate_models(client)
    chosen_object = os.environ.get("OBJECT_NAME", "").strip() or random.choice(OBJECT_POOL)
    print(f"Building Life of an Object episode for: {chosen_object}")

    # Step 1: Generate Master Metadata, Story Bible & Marketing Pack
    meta_prompt = f"""
You are writing a cinematic, Pixar-style emotional first-person documentary script titled "Life of {chosen_object}" for a 10-12 minute YouTube video (Target audience: age 13-35, India + Global).
Create the story bible and YouTube packaging for "{chosen_object}".
Return ONLY valid JSON:
{{
  "objectName": "{chosen_object}",
  "objectType": "pencil | bottle | note | charger | bag | umbrella | ball | teddy | bench | ticket | light | slipper",
  "primaryColor": "#HEXCOLOR matching the real object",
  "accentColor": "#HEXCOLOR secondary shade",
  "firstOwnerName": "Relatable Indian/global first name (e.g., Aarav, Maya, Rohan)",
  "title": "Emotional curiosity YouTube title under 68 characters",
  "hookVariations": [
    "Title/Hook A/B variation 1",
    "Title/Hook A/B variation 2",
    "Title/Hook A/B variation 3"
  ],
  "seoSummary": "150-word emotional SEO YouTube description without timestamps",
  "pinnedComment": "1 deep emotional question to spark viewer comments",
  "hashtags": ["#LifeOfAnObject", "#Storytelling", "...10 total relevant hashtags"],
  "thumbnailIdea": "Pixar-style 3D close-up description: expressive big emotional eyes on {chosen_object}, dark moody lighting, 3-4 word bold text overlay",
  "voiceoverNotes": "Warm, slow, nostalgic first-person documentary pacing notes"
}}
"""
    meta = call_llm_json(client, models, meta_prompt)

    # Step 2: Generate all 8 Chapters sequentially (1,450 - 1,750 words total, ~42 short visual scenes)
    all_scenes = []
    story_so_far = ""

    for ch_title, approx_time, ch_goal in CHAPTER_SPECS:
        print(f"Generating {ch_title}...")
        ch_prompt = f"""
Continue the first-person emotional documentary "Life of {chosen_object}" (First owner: {meta['firstOwnerName']}).
Story context so far: {story_so_far[-800:] if story_so_far else "Beginning of story."}

Write {ch_title} ({approx_time}).
Goal: {ch_goal}
Rules:
- Simple, cinematic, deeply emotional English in first person ("I", "my").
- Break into multiple short scenes so NO scene exceeds 15-20 seconds of speech (~35-45 words per scene).
- Every scene must include a rich 16:9 Pixar-style 3D AI animation prompt.

Return ONLY valid JSON:
{{
  "scenes": [
    {{
      "chapter": "{ch_title}",
      "narration": "35-45 words of warm first-person narration.",
      "subtitle": "Short punchy 6-10 word on-screen subtitle",
      "emotion": "happy | curious | proud | sad | lonely | hopeful",
      "setting": "factory | store_shelf | home_desk | school_outdoor | rainy_street | dustbin_dark | recycling_light",
      "cameraMove": "zoom_in | zoom_out | pan_left | pan_right",
      "aiVisualPrompt": "3D Pixar-style cinematic shot, 16:9, expressive {chosen_object} with big emotional eyes, [detailed scene description], volumetric lighting, shallow depth of field"
    }}
  ]
}}
"""
        ch_data = call_llm_json(client, models, ch_prompt)
        for s in ch_data.get("scenes", []):
            s["chapter"] = ch_title
            all_scenes.append(s)
            story_so_far += " " + s["narration"]

    # Step 3: Synthesize full warm documentary voiceover via Edge-TTS
    full_narration = " ".join(s["narration"] for s in all_scenes)
    word_count = len(full_narration.split())
    print(f"Total script generated: {word_count} words across {len(all_scenes)} scenes.")

    audio_path = "public/voiceover.mp3"
    communicate = edge_tts.Communicate(
        full_narration,
        voice="en-US-AndrewNeural",
        rate="-6%",
        pitch="-2Hz",
    )
    await communicate.save(audio_path)

    # Step 4: Map exact MP3 duration to 30fps frames & build chapter timestamps
    audio_len = MP3(audio_path).info.length
    total_frames = int((audio_len + 2.0) * 30)
    total_words = max(1, sum(len(s["narration"].split()) for s in all_scenes))

    cursor_frame = 0
    chapter_timestamps = []
    seen_chapters = set()

    for idx, scene in enumerate(all_scenes):
        if scene["chapter"] not in seen_chapters:
            seen_chapters.add(scene["chapter"])
            chapter_timestamps.append((format_timestamp(cursor_frame / 30.0), scene["chapter"]))

        words = max(1, len(scene["narration"].split()))
        dur_frames = max(90, int((words / total_words) * total_frames))
        scene["startFrame"] = cursor_frame
        scene["durationInFrames"] = dur_frames
        scene["sceneIndex"] = idx + 1
        cursor_frame += dur_frames

    # Build full YouTube Description with auto-generated chapters
    chapters_block = "\n".join(f"{ts} - {name}" for ts, name in chapter_timestamps)
    hashtags_str = " ".join(meta.get("hashtags", ["#LifeOfAnObject", "#Storytelling"]))
    full_description = f"{meta['seoSummary']}\n\nCHAPTERS:\n{chapters_block}\n\n{hashtags_str}"

    episode_payload = {
        "objectName": chosen_object,
        "objectType": meta.get("objectType", "bottle"),
        "primaryColor": meta.get("primaryColor", "#38BDF8"),
        "accentColor": meta.get("accentColor", "#0284C7"),
        "title": meta["title"],
        "description": full_description,
        "totalFrames": cursor_frame,
        "scenes": all_scenes,
    }

    with open("public/episode.json", "w", encoding="utf-8") as f:
        json.dump(episode_payload, f, indent=2)

    # Step 5: Export complete Creator Pack (Prompts, Thumbnail, Hooks, Pinned Comment)
    pack_lines = [
        f"# YOUTUBE CREATOR PACK: {meta['title']}\n",
        f"**Object:** {chosen_object} | **Duration:** {format_timestamp(cursor_frame / 30.0)} | **Words:** {word_count}\n",
        "## 1. Thumbnail Idea",
        f"{meta['thumbnailIdea']}\n",
        "## 2. 3 Hook / Title Variations (A/B Test)",
        *[f"- {h}" for h in meta.get("hookVariations", [])],
        "\n## 3. Pinned Comment",
        f"{meta['pinnedComment']}\n",
        "## 4. Voiceover Tone & Pacing Notes",
        f"{meta['voiceoverNotes']}\n",
        "## 5. YouTube Description (Auto-Uploaded)",
        f"{full_description}\n",
        "## 6. Scene-by-Scene 16:9 AI Animation Prompts (Ready to Paste)",
        *[f"**Scene {s['sceneIndex']} [{s['chapter']}] ({format_timestamp(s['startFrame']/30)}):** {s['aiVisualPrompt']}" for s in all_scenes],
    ]
    with open("out/youtube_pack.md", "w", encoding="utf-8") as f:
        f.write("\n".join(pack_lines))

    print(f"Episode ready: '{meta['title']}' ({cursor_frame/30/60:.2f} mins)")

if __name__ == "__main__":
    asyncio.run(build_episode())
