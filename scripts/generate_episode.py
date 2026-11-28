import asyncio
from datetime import datetime
import json
import os
import random
import re
import time
from google import genai
from google.genai import types
import edge_tts
from gtts import gTTS
from mutagen.mp3 import MP3

def log(msg: str):
    now = datetime.now().strftime("%H:%M:%S")
    print(f"[{now}] {msg}", flush=True)

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
    log("Fetching available models from Gemini API...")
    preferred = [
        "gemini-3.6-flash",
        "gemini-3.5-flash-lite",
        "gemini-3.5-flash",
        "gemini-3.1-flash-lite",
        "gemini-2.5-flash-lite",
        "gemma-4-31b-it",
        "gemma-4-26b-a4b-it",
    ]
    available = []
    for m in client.models.list():
        if "generateContent" not in (m.supported_actions or []):
            continue
        name = m.name.replace("models/", "")
        if any(s in name for s in ["image", "deep-research", "antigravity", "3.8", "3.7"]) or name == "gemini-2.5-flash":
            continue
        available.append(name)
    ordered = [m for m in preferred if m in available]
    for m in available:
        if m not in ordered:
            ordered.append(m)
    log(f"Candidate models ready: {ordered[:6]}...")
    return ordered or preferred

def call_llm_json(client: genai.Client, models: list[str], prompt: str, step_label: str) -> dict:
    last_err = None
    for idx, model_name in enumerate(list(models)):
        try:
            log(f"  -> [{step_label}] Calling {model_name}...")
            t0 = time.time()
            is_gemma = model_name.startswith("gemma")
            cfg = types.GenerateContentConfig(
                temperature=0.85,
                **({} if is_gemma else {"response_mime_type": "application/json"}),
            )
            res = client.models.generate_content(model=model_name, contents=prompt, config=cfg)
            cleaned = re.sub(r"^```(?:json)?\s*", "", res.text.strip())
            cleaned = re.sub(r"\s*```$", "", cleaned)
            parsed = json.loads(cleaned)
            log(f"  <- [{step_label}] Success with {model_name} in {time.time() - t0:.1f}s")
            # Pin the working model to the front so subsequent chapters skip exhausted models
            if idx > 0:
                models.remove(model_name)
                models.insert(0, model_name)
            return parsed
        except Exception as e:
            last_err = f"{model_name} ({type(e).__name__}): {str(e)[:160]}"
            log(f"  !! [{step_label}] Failed on {last_err}")
            if "429" in str(e):
                time.sleep(2)
    raise RuntimeError(f"All models failed on {step_label}. Last error: {last_err}")

async def synthesize_chunk(text: str, out_file: str, voice: str, label: str) -> float:
    """Synthesize a single chapter chunk with 30s timeout and 3 retries."""
    clean_text = re.sub(r"\s+", " ", text).strip()
    for attempt in range(1, 4):
        try:
            t0 = time.time()
            communicate = edge_tts.Communicate(
                clean_text,
                voice=voice,
                rate="-4%",
                pitch="-1Hz",
            )
            await asyncio.wait_for(communicate.save(out_file), timeout=35)
            dur = MP3(out_file).info.length
            log(f"  <- [TTS {label}] {dur:.1f}s audio saved in {time.time() - t0:.1f}s")
            return dur
        except Exception as e:
            log(f"  !! [TTS {label}] Attempt {attempt}/3 failed: {type(e).__name__} {e}")
            await asyncio.sleep(2)
    raise RuntimeError(f"Edge-TTS failed after 3 attempts on {label}")

def format_timestamp(seconds: float) -> str:
    mins = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{mins}:{secs:02d}"

async def build_episode():
    log("Starting generate_episode.py...")
    os.makedirs("public", exist_ok=True)
    os.makedirs("out", exist_ok=True)

    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is missing.")

    client = genai.Client(
        api_key=api_key,
        http_options=types.HttpOptions(
            timeout=45_000,
            retry_options=types.HttpRetryOptions(attempts=1),
        ),
    )

    models = get_candidate_models(client)
    chosen_object = os.environ.get("OBJECT_NAME", "").strip() or random.choice(OBJECT_POOL)
    log(f"Selected object: {chosen_object}")

    # Step 1: Story Bible & Metadata
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
    meta = call_llm_json(client, models, meta_prompt, "Story Bible")

    # Step 2: Generate 8 Chapters & Synthesize Chunked Indian English Audio per Chapter
    tts_voice = os.environ.get("TTS_VOICE", "en-IN-PrabhatNeural").strip() or "en-IN-PrabhatNeural"
    all_scenes = []
    story_so_far = ""
    chunk_files = []
    chapter_timestamps = []
    cursor_frame = 0

    for ch_idx, (ch_title, approx_time, ch_goal) in enumerate(CHAPTER_SPECS):
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
        ch_data = call_llm_json(client, models, ch_prompt, ch_title)
        ch_scenes = ch_data.get("scenes", [])
        if not ch_scenes:
            continue

        ch_text = " ".join(s["narration"] for s in ch_scenes)
        story_so_far += " " + ch_text

        # Synthesize this chapter's audio immediately (prevents giant websocket hangs)
        chunk_path = f"out/chunk_{ch_idx}.mp3"
        ch_audio_sec = await synthesize_chunk(ch_text, chunk_path, tts_voice, ch_title)
        chunk_files.append(chunk_path)

        # Record exact chapter start timestamp for YouTube Chapters
        chapter_timestamps.append((format_timestamp(cursor_frame / 30.0), ch_title))

        # Distribute this chapter's exact audio frames proportionally across its scenes
        ch_total_frames = max(90, int(round(ch_audio_sec * 30)))
        ch_words = max(1, sum(len(s["narration"].split()) for s in ch_scenes))
        allocated = 0

        for s_idx, s in enumerate(ch_scenes):
            s["chapter"] = ch_title
            if s_idx == len(ch_scenes) - 1:
                dur_frames = max(60, ch_total_frames - allocated)
            else:
                w = max(1, len(s["narration"].split()))
                dur_frames = max(60, int((w / ch_words) * ch_total_frames))
                allocated += dur_frames

            s["startFrame"] = cursor_frame
            s["durationInFrames"] = dur_frames
            cursor_frame += dur_frames
            s["sceneIndex"] = len(all_scenes) + 1
            all_scenes.append(s)

    # Concatenate all MP3 chunks into public/voiceover.mp3 + add 2s ending buffer
    audio_path = "public/voiceover.mp3"
    with open(audio_path, "wb") as outfile:
        for cf in chunk_files:
            with open(cf, "rb") as infile:
                outfile.write(infile.read())
            os.remove(cf)

    cursor_frame += 60  # 2-second breathing room at the very end
    word_count = sum(len(s["narration"].split()) for s in all_scenes)
    log(f"Combined voiceover ready: {cursor_frame/30:.1f}s ({word_count} words, {len(all_scenes)} scenes)")

    # Build full YouTube Description with exact chapter timestamps
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

    # Step 5: Export Creator Pack
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

    log(f"DONE! Episode ready: '{meta['title']}' ({cursor_frame/30/60:.2f} mins)")

if __name__ == "__main__":
    asyncio.run(build_episode())
