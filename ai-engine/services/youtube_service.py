import json
import logging
import os
import re
from html import unescape
from typing import TypedDict
from urllib.parse import quote

import httpx
from youtube_transcript_api import YouTubeTranscriptApi

logger = logging.getLogger(__name__)


class YouTubeVideo(TypedDict):
    video_id: str
    title: str


FALLBACK_VIDEO: YouTubeVideo = {
    "video_id": "aircAruvnKk",
    "title": "But what is a neural network? | 3Blue1Brown",
}


async def _search_youtube_html(query: str) -> YouTubeVideo | None:
    url = f"https://www.youtube.com/results?search_query={quote(query)}"
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(url)
        response.raise_for_status()
        page = response.text

    video_match = re.search(r'"videoId":"([a-zA-Z0-9_-]{11})"', page)
    if not video_match:
        return None

    video_id = video_match.group(1)
    result = page[video_match.end() : video_match.end() + 2000]
    title_match = re.search(
        r'"title":\{"runs":\[\{"text":"((?:\\.|[^"\\])*)"',
        result,
    )
    title = unescape(title_match.group(1)) if title_match else query
    if title_match:
        try:
            title = json.loads(f'"{title}"')
        except json.JSONDecodeError:
            logger.warning("Could not decode YouTube result title")
    return {"video_id": video_id, "title": title}


async def search_youtube_video(query: str) -> YouTubeVideo:
    api_key = os.getenv("YOUTUBE_API_KEY")
    if api_key:
        params = {
            "part": "snippet",
            "q": query,
            "type": "video",
            "maxResults": 1,
            "key": api_key,
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    "https://www.googleapis.com/youtube/v3/search",
                    params=params,
                )
                response.raise_for_status()
                payload = response.json()

            items = payload.get("items", [])
            if items:
                video = items[0]
                video_id = video.get("id", {}).get("videoId")
                title = video.get("snippet", {}).get("title")
                if (
                    isinstance(video_id, str)
                    and re.fullmatch(r"[a-zA-Z0-9_-]{11}", video_id)
                    and isinstance(title, str)
                ):
                    return {"video_id": video_id, "title": title}
        except Exception as error:
            logger.warning(
                "YouTube Data API search failed; trying HTML search (%s)",
                type(error).__name__,
            )

    try:
        video = await _search_youtube_html(query)
        if video:
            return video
    except Exception:
        logger.exception("YouTube HTML search failed; using fallback video")

    return FALLBACK_VIDEO


def get_video_transcript(video_id: str) -> str:
    try:
        transcript_api = YouTubeTranscriptApi()
        fetch = getattr(transcript_api, "fetch", None)
        if callable(fetch):
            fragments = fetch(video_id)
        else:
            get_transcript = getattr(YouTubeTranscriptApi, "get_transcript", None)
            if not callable(get_transcript):
                logger.warning("No compatible transcript API for video %s", video_id)
                return ""
            fragments = get_transcript(video_id)

        texts = []
        for fragment in fragments:
            text = (
                fragment.get("text")
                if isinstance(fragment, dict)
                else getattr(fragment, "text", None)
            )
            if isinstance(text, str):
                texts.append(text)
        return " ".join(texts)
    except Exception:
        logger.exception("Could not retrieve transcript for video %s", video_id)
        get_transcript = getattr(YouTubeTranscriptApi, "get_transcript", None)
        if callable(get_transcript):
            try:
                return " ".join(
                    fragment["text"]
                    for fragment in get_transcript(video_id)
                    if isinstance(fragment.get("text"), str)
                )
            except Exception:
                logger.exception(
                    "Legacy transcript API also failed for video %s",
                    video_id,
                )
        return ""
