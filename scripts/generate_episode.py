from datetime import datetime
import json
import os
import random
import re
import time
from google import genai
from google.genai import types

def log(msg: str):
    now = datetime.now().strftime("%H:%M:%S")
    print(f"[{now}] {msg}", flush=True)

OBJECT_POOL = [
    "A Leather Cricket Ball",
    "A School Bag",
    "A Wooden Pencil",
    "A ₹10 Note",
    "A Plastic Water Bottle",
    "A Phone Charger",
    "An Old Umbrella",
    "A Teddy Bear",
    "A School Bench",
    "A Paper Train Ticket",
    "A Street Light",
    "A Worn-Out Slipper",
]

CHAPTER_SPECS = [
    ("0. HOOK", "Gripping 3-scene mystery hook in first person. Tease a dramatic journey of love, heartbreak, and survival without spoiling the ending. ~70 words across 3 scenes."),
    ("1. BIRTH", "Factory birth, raw materials, opening eyes for the first time, 1 surprising real-world fact, and my big dream. ~105 words across 5 scenes."),
    ("2. FIRST HOME", "Mini-hook + bought from a local Indian shop, meeting my first owner, funny moments, and our warm bond. ~110 words across 5 scenes."),
    ("3. GOLDEN DAYS", "Mini-hook + our best adventures together, daily routine, and how proud I felt helping my owner. ~110 words across 5 scenes."),
    ("4. FIRST CRACK", "Mini-hook + first scratch/damage, getting ignored as shiny new things replace me, quiet fear. ~105 words across 5 scenes."),
    ("5. THE DARK PHASE", "Mini-hook + worst heartbreak: lost, broken, or thrown into a dark dustbin or rainy street. Vivid loneliness. ~105 words across 5 scenes."),
    ("6. JOURNEY AFTER", "What happens after being thrown away? Scrapyard/travel/new hands + 1 real-world lifecycle fact. ~95 words across 4 scenes."),
    ("7. ENDING & REBIRTH", "Final fate (recycled or second life), emotional callback to my FIRST owner, life lesson, quote, and comment question. ~90 words across 4 scenes."),
]

TRANSITION_OVERLAP_FRAMES = 15

def infer_object_type(object_name: str, fallback: str = "ball") -> str:
    lower = object_name.lower()
    mapping = [
        ("bag", "bag"), ("backpack", "bag"), ("pencil", "pencil"),
        ("bottle", "bottle"), ("note", "note"), ("rupee", "note"),
        ("charger", "charger"), ("umbrella", "umbrella"), ("ball", "ball"),
        ("cricket", "ball"), ("teddy", "teddy"), ("bear", "teddy"),
        ("bench", "bench"), ("ticket", "ticket"), ("light", "light"),
        ("slipper", "slipper"),
    ]
    for keyword, normalized in mapping:
        if keyword in lower:
            return normalized
    return fallback

def get_candidate_models(client: genai.Client) -> list[str]:
    preferred = [
        "gemini-3.5-flash-lite",
        "gemini-3.6-flash",
        "gemini-3.5-flash",
        "gemini-3.1-flash-lite",
        "gemini-2.5-flash-lite",
        "gemma-4-31b-it",
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
    return ordered or preferred

def call_llm_json(client: genai.Client, models: list[str], prompt: str, label: str) -> dict:
    last_err = None
    for idx, model_name in enumerate(list(models)):
        try:
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
            log(f"  <- [{label}] {model_name} ({time.time() - t0:.1f}s)")
            if idx > 0:
                models.remove(model_name)
                models.insert(0, model_name)
            return parsed
        except Exception as e:
            last_err = f"{model_name}: {str(e)[:140]}"
            log(f"  !! [{label}] {last_err}")
            if "429" in str(e):
                time.sleep(1.5)
    raise RuntimeError(f"All models failed on {label}: {last_err}")

def format_timestamp(seconds: float) -> str:
    return f"{int(seconds // 60)}:{int(seconds % 60):02d}"

def build_episode():
    os.makedirs("public", exist_ok=True)
    os.makedirs("out", exist_ok=True)

    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is missing.")

    client = genai.Client(
        api_key=api_key,
        http_options=types.HttpOptions(timeout=35_000, retry_options=types.HttpRetryOptions(attempts=1)),
    )
    models = get_candidate_models(client)
    chosen_object = os.environ.get("OBJECT_NAME", "").strip() or random.choice(OBJECT_POOL)
    locked_type = infer_object_type(chosen_object)
    log(f"Building Multi-Actor Story Episode for: {chosen_object} (type={locked_type})")

    meta_prompt = f"""
Create a tight, emotional first-person story bible for "Life of {chosen_object}" (Indian + Global audience, simple everyday Indian English).
Return ONLY valid JSON:
{{
  "objectName": "{chosen_object}",
  "objectType": "{locked_type}",
  "primaryColor": "#HEXCOLOR",
  "accentColor": "#HEXCOLOR",
  "firstOwnerName": "Warm Indian first name (e.g., Aarav, Diya, Kabir, Ananya)",
  "title": "Curiosity YouTube title under 65 chars",
  "hookVariations": ["Hook 1", "Hook 2", "Hook 3"],
  "seoSummary": "120-word warm SEO YouTube description",
  "pinnedComment": "1 emotional question for viewers to comment",
  "hashtags": ["#LifeOfAnObject", "#Storytelling", "#IndianStories", "#Animation"],
  "thumbnailIdea": "3D Pixar-style scene of {chosen_object} with expressive eyes alongside its owner, cinematic lighting"
}}
"""
    meta = call_llm_json(client, models, meta_prompt, "Story Bible")

    all_scenes = []
    story_so_far = ""

    for ch_title, ch_goal in CHAPTER_SPECS:
        ch_prompt = f"""
Write {ch_title} of the first-person story "Life of {chosen_object}" (First owner: {meta['firstOwnerName']}).
Story so far: {story_so_far[-650:] if story_so_far else "Opening."}
Goal: {ch_goal}

STRICT SCENE CHOREOGRAPHY RULES:
- Use simple, natural Indian English words. Zero fluff—every sentence must move the action forward!
- Each scene's "narration" MUST be 18 to 25 words (7-10 seconds).
- CRITICAL: Match the visual action ("coActor" + "interaction") to what happens in that exact sentence!
  * If a boy/girl catches, throws, or hits the object -> coActor="boy" or "girl", interaction="throw_catch"
  * If a dog chases or plays with the object -> coActor="dog", interaction="dog_chase"
  * If a kid carries/uses/walks with the object -> coActor="boy" or "girl", interaction="hand_carry"
  * If bought at a shop -> coActor="shopkeeper", interaction="buy_exchange"
  * If dropped, left behind, or thrown away -> coActor="boy" or "worker", interaction="drop_abandon"
  * If it's an emotional close-up monologue -> coActor="none", interaction="solo_hero"

Return ONLY valid JSON:
{{
  "scenes": [
    {{
      "narration": "18-25 words of punchy, visual first-person storytelling.",
      "subtitle": "5-8 word punchy on-screen caption",
      "coActor": "none | boy | girl | dog | shopkeeper | worker",
      "interaction": "solo_hero | throw_catch | dog_chase | hand_carry | buy_exchange | drop_abandon",
      "emotion": "happy | curious | proud | sad | lonely | hopeful | shocked",
      "transition": "slide_left | slide_up | wipe_diagonal | fade_smooth | flip_card",
      "setting": "factory | store_shelf | home_desk | school_outdoor | rainy_street | dustbin_dark | recycling_light",
      "cameraMove": "zoom_in | zoom_out | pan_left | pan_right"
    }}
  ]
}}
"""
        ch_data = call_llm_json(client, models, ch_prompt, ch_title)
        for s in ch_data.get("scenes", []):
            s["chapter"] = ch_title
            all_scenes.append(s)
            story_so_far += " " + s["narration"]

    WORDS_PER_SEC = 2.3
    FPS = 30
    cursor_frame = 0
    chapter_timestamps = []
    seen_chapters = set()

    for idx, scene in enumerate(all_scenes):
        if scene["chapter"] not in seen_chapters:
            seen_chapters.add(scene["chapter"])
            chapter_timestamps.append((format_timestamp(cursor_frame / FPS), scene["chapter"]))

        words = max(8, len(scene["narration"].split()))
        speech_seconds = words / WORDS_PER_SEC
        overlap_pad = TRANSITION_OVERLAP_FRAMES if idx < len(all_scenes) - 1 else 0
        dur_frames = max(120, int(round(speech_seconds * FPS)) + overlap_pad)

        scene["sceneIndex"] = idx + 1
        scene["startFrame"] = cursor_frame
        scene["durationInFrames"] = dur_frames
        cursor_frame += (dur_frames - overlap_pad)

    total_frames = cursor_frame + 45
    word_count = sum(len(s["narration"].split()) for s in all_scenes)
    log(f"Multi-actor episode ready: {total_frames/FPS:.1f}s ({word_count} words, {len(all_scenes)} scenes)")

    chapters_block = "\n".join(f"{ts} - {name}" for ts, name in chapter_timestamps)
    hashtags_str = " ".join(meta.get("hashtags", ["#LifeOfAnObject"]))
    full_description = f"{meta['seoSummary']}\n\nCHAPTERS:\n{chapters_block}\n\n{hashtags_str}"

    episode_payload = {
        "objectName": chosen_object,
        "objectType": locked_type,
        "primaryColor": meta.get("primaryColor", "#38BDF8"),
        "accentColor": meta.get("accentColor", "#0284C7"),
        "title": meta["title"],
        "description": full_description,
        "overlapFrames": TRANSITION_OVERLAP_FRAMES,
        "totalFrames": total_frames,
        "scenes": all_scenes,
    }

    with open("public/episode.json", "w", encoding="utf-8") as f:
        json.dump(episode_payload, f, indent=2)

    clean_voiceover_paragraphs = []
    timestamped_lines = []
    curr_ch = ""

    for s in all_scenes:
        if s["chapter"] != curr_ch:
            curr_ch = s["chapter"]
            clean_voiceover_paragraphs.append(f"\n--- {curr_ch} ---")
            timestamped_lines.append(f"\n### {curr_ch} ({format_timestamp(s['startFrame']/FPS)})")
        clean_voiceover_paragraphs.append(s["narration"])
        timestamped_lines.append(
            f"- **[{format_timestamp(s['startFrame']/FPS)} - {format_timestamp((s['startFrame']+s['durationInFrames'])/FPS)}]** [{s.get('coActor', 'none')} -> {s.get('interaction', 'solo_hero')}]: {s['narration']}"
        )

    pack_lines = [
        f"# VOICEOVER SCRIPT & SCENE SYNC PACK: {meta['title']}\n",
        f"**Object:** {chosen_object} | **Target Video Length:** {format_timestamp(total_frames / FPS)} | **Total Words:** {word_count}\n",
        "## 1. Clean Copy-Paste Voiceover Script (For ElevenLabs / Recording)",
        *clean_voiceover_paragraphs,
        "\n## 2. Scene-by-Scene Visual Sync Guide",
        *timestamped_lines,
        "\n## 3. Thumbnail Idea",
        f"{meta['thumbnailIdea']}\n",
        "## 4. 3 Hook / Title Variations",
        *[f"- {h}" for h in meta.get("hookVariations", [])],
        "\n## 5. Pinned Comment",
        f"{meta['pinnedComment']}\n",
        "## 6. YouTube Description (Auto-Uploaded)",
        f"{full_description}\n",
    ]
    with open("out/youtube_pack.md", "w", encoding="utf-8") as f:
        f.write("\n".join(pack_lines))

if __name__ == "__main__":
    build_episode()
