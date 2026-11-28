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

STORY_STYLE_RULES = """
CRITICAL STORYTELLING & LANGUAGE RULES:
- Language: Natural, warm Indian English using very simple everyday words (easy for a 13-year-old to understand—no heavy dictionary words or robotic corporate phrasing).
- Style: Tell it like a deeply gripping, emotional bedtime or campfire story in first person ("I", "my"). Make the listener genuinely care about the object's feelings, small joys, fears, and memories.
- Relatable Details: Include vivid, realistic Indian and universal everyday details (like a dusty corner shop, exam stress, monsoon rain, a crowded bus, a study table lamp, or warm hands holding me).
- Pacing & Hooks: Use short, punchy sentences mixed with emotional reflections. Build curiosity so the listener wants to know what happens next.
"""

CHAPTER_SPECS = [
    ("0. HOOK", "0:00 - 0:45", "Start with a gripping mystery hook in first person that makes the viewer stop scrolling. Tease an unforgettable journey of love, heartbreak, and survival without spoiling the ending. ~115 words, 3 visual scenes."),
    ("1. BIRTH", "0:45 - 2:00", "How I was born inside a noisy factory, the raw materials that shaped me, opening my eyes for the first time, and my innocent dream of meeting a kind human. Include 1 surprising real-world manufacturing fact told simply. ~200 words, 5 visual scenes."),
    ("2. FIRST HOME", "2:00 - 4:00", "Start with a curiosity mini-hook. The day I was bought from a local shop, meeting my first owner, my nervous excitement, funny little moments, and our growing bond. ~230 words, 6 visual scenes."),
    ("3. GOLDEN DAYS", "4:00 - 6:00", "Start with a mini-hook. My happiest days—our daily routine, small adventures together, how proud I felt helping my owner through tough days. Make the viewer fall in love with our friendship. ~230 words, 6 visual scenes."),
    ("4. FIRST CRACK", "6:00 - 8:00", "Start with a mini-hook ('But nothing stays the same forever...'). My first scratch, wear and tear, getting pushed to the corner as shiny new things arrive. Quiet jealousy and fear of being forgotten. ~220 words, 6 visual scenes."),
    ("5. THE DARK PHASE", "8:00 - 10:00", "Start with a mini-hook. My lowest, most heartbreaking moment—getting lost, broken, or thrown into a dark drawer, dustbin, or rainy roadside. Describe the silence and loneliness vividly. ~220 words, 6 visual scenes."),
    ("6. JOURNEY AFTER", "10:00 - 11:30", "What happened after I was thrown away? Who picked me up, where did I travel, and what surprising real-world facts explain what happens to objects like me? ~190 words, 5 visual scenes."),
    ("7. ENDING & REBIRTH", "11:30 - 13:00", "My final fate (recycled, given a second life, or still waiting), a touching memory callback to my FIRST owner, a simple life lesson for humans, a memorable final quote, and one question for viewers to answer in the comments. ~180 words, 5 visual scenes."),
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
                temperature=0.85,
                **({} if is_gemma else {"response_mime_type": "application/json"}),
            )
            res = client.models.generate_content(model=model_name, contents=prompt, config=cfg)
            cleaned = re.sub(r"^```(?:json)?\s*", "", res.text.strip())
            cleaned = re.sub(r"\s*```$", "", cleaned)
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
    print(f"Building Indian-English story episode for: {chosen_object}")

    # Step 1: Generate Story Bible & Metadata
    meta_prompt = f"""
You are a master storyteller creating a Pixar-style emotional first-person story titled "Life of {chosen_object}" for a 10-12 minute YouTube video (Audience: age 13-35, India + Global).
{STORY_STYLE_RULES}

Create the story bible and YouTube packaging for "{chosen_object}".
Return ONLY valid JSON:
{{
  "objectName": "{chosen_object}",
  "objectType": "pencil | bottle | note | charger | bag | umbrella | ball | teddy | bench | ticket | light | slipper",
  "primaryColor": "#HEXCOLOR matching the real object",
  "accentColor": "#HEXCOLOR secondary shade",
  "firstOwnerName": "Warm Indian first name (e.g., Aarav, Ananya, Kabir, Diya, Rohan)",
  "title": "Simple, emotional curiosity YouTube title under 68 characters",
  "hookVariations": [
    "Title/Hook A/B variation 1",
    "Title/Hook A/B variation 2",
    "Title/Hook A/B variation 3"
  ],
  "seoSummary": "150-word emotional SEO YouTube description written in simple, warm English",
  "pinnedComment": "1 simple, touching question to make viewers share their own memory in comments",
  "hashtags": ["#LifeOfAnObject", "#IndianStorytelling", "#EmotionalStory", "...10 total relevant hashtags"],
  "thumbnailIdea": "Pixar-style 3D close-up description: expressive big emotional eyes on {chosen_object}, dark moody lighting, 3-4 word bold text overlay",
  "voiceoverNotes": "Warm Indian English narrator (en-IN-PrabhatNeural), slow conversational storytelling tone with gentle pauses on emotional beats"
}}
"""
    meta = call_llm_json(client, models, meta_prompt)

    # Step 2: Generate all 8 Chapters sequentially
    all_scenes = []
    story_so_far = ""

    for ch_title, approx_time, ch_goal in CHAPTER_SPECS:
        print(f"Writing {ch_title}...")
        ch_prompt = f"""
Continue the warm, emotional first-person story "Life of {chosen_object}" (First owner: {meta['firstOwnerName']}).
{STORY_STYLE_RULES}

Story so far: {story_so_far[-900:] if story_so_far else "Opening of the story."}

Write {ch_title} ({approx_time}).
Chapter Goal: {ch_goal}
Formatting Rules:
- Break into multiple short scenes so NO scene stays on screen longer than 15-20 seconds (~35-45 words per scene).
- Keep the spoken narration super natural when read aloud in an Indian English voice—avoid tongue-twisters or complex words.

Return ONLY valid JSON:
{{
  "scenes": [
    {{
      "chapter": "{ch_title}",
      "narration": "35-45 words of simple, heartfelt first-person storytelling.",
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

    # Step 3: Synthesize warm Indian English voiceover via Edge-TTS
    full_narration = " ".join(s["narration"] for s in all_scenes)
    word_count = len(full_narration.split())
    print(f"Total script generated: {word_count} words across {len(all_scenes)} scenes.")

    audio_path = "public/voiceover.mp3"
    # Use en-IN-PrabhatNeural (warm Indian male storyteller) or en-IN-NeerjaNeural (Indian female)
    tts_voice = os.environ.get("TTS_VOICE", "en-IN-PrabhatNeural").strip() or "en-IN-PrabhatNeural"
    communicate = edge_tts.Communicate(
        full_narration,
        voice=tts_voice,
        rate="-4%",
        pitch="-1Hz",
    )
    await communicate.save(audio_path)
    print("Synthesizing Indian English voiceover via Edge-TTS...", flush=True)
    audio_path = "public/voiceover.mp3"
    tts_voice = os.environ.get("TTS_VOICE", "en-IN-PrabhatNeural").strip() or "en-IN-PrabhatNeural"
    communicate = edge_tts.Communicate(
        full_narration,
        voice=tts_voice,
        rate="-4%",
        pitch="-1Hz",
    )
    await asyncio.wait_for(communicate.save(audio_path), timeout=90)
    print("Voiceover saved successfully!", flush=True)

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

    # Step 5: Export complete Creator Pack (Full Script + Prompts + Thumbnail + Hooks)
    script_lines = []
    curr_ch = ""
    for s in all_scenes:
        if s["chapter"] != curr_ch:
            curr_ch = s["chapter"]
            script_lines.append(f"\n### {curr_ch} ({format_timestamp(s['startFrame']/30)})")
        script_lines.append(f"[{format_timestamp(s['startFrame']/30)}] {s['narration']}")

    pack_lines = [
        f"# YOUTUBE CREATOR PACK: {meta['title']}\n",
        f"**Object:** {chosen_object} | **Voice:** {tts_voice} | **Duration:** {format_timestamp(cursor_frame / 30.0)} | **Words:** {word_count}\n",
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
        "## 6. Full Timestamped Narration Script",
        *script_lines,
        "\n## 7. Scene-by-Scene 16:9 AI Animation Prompts (Ready to Paste)",
        *[f"**Scene {s['sceneIndex']} [{s['chapter']}] ({format_timestamp(s['startFrame']/30)}):** {s['aiVisualPrompt']}" for s in all_scenes],
    ]
    with open("out/youtube_pack.md", "w", encoding="utf-8") as f:
        f.write("\n".join(pack_lines))

    print(f"Episode ready: '{meta['title']}' ({cursor_frame/30/60:.2f} mins)")

if __name__ == "__main__":
    asyncio.run(build_episode())
