"""Fallback CV retrieval helpers for incomplete Pillar 2 environments."""

from app.models.resume import Resume
from app.services.demo_profile import DEMO_CV_TEXT
from app.services.rag_types import CVChunk, CVContext


def section_chunks(text: str) -> list[dict[str, str]]:
    """Chunk CV text by common resume section headings when available."""
    headings = {
        "summary",
        "experience",
        "work experience",
        "education",
        "skills",
        "technical skills",
        "projects",
        "certifications",
    }
    chunks: list[dict[str, str]] = []
    current_heading = ""
    current_lines: list[str] = []

    for line in text.splitlines():
        stripped = line.strip()
        normalized = stripped.lower().rstrip(":")
        if normalized in headings:
            if current_heading and current_lines:
                chunks.append(
                    {"id": current_heading.replace(" ", "_"), "text": " ".join(current_lines)}
                )
            current_heading = normalized
            current_lines = [stripped]
        elif current_heading:
            current_lines.append(stripped)

    if current_heading and current_lines:
        chunks.append({"id": current_heading.replace(" ", "_"), "text": " ".join(current_lines)})
    return [chunk for chunk in chunks if len(chunk["text"].split()) >= 3]


def demo_context(query: str, top_k: int) -> CVContext:
    """Return placeholder CV context until Pillar 2 indexing is available."""
    return CVContext(
        resume_id="demo_profile",
        resume_name="Demo Pillar 2 CV",
        chunks=rank_text_chunks(DEMO_CV_TEXT, query, top_k, id_prefix="demo_"),
        full_text=DEMO_CV_TEXT,
        is_demo=True,
    )


def lexical_context(resume: Resume, query: str, top_k: int) -> CVContext:
    """Return section-ranked chunks when vector retrieval is unavailable."""
    return CVContext(
        resume_id=resume.id,
        resume_name=resume.name,
        chunks=rank_text_chunks(resume.content_text or "", query, top_k),
        full_text=resume.content_text or "",
    )


import re

STOP_WORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "aren't",
    "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "can't",
    "cannot", "could", "couldn't", "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down", "during",
    "each", "few", "for", "from", "further", "had", "hadn't", "has", "hasn't", "have", "haven't", "having", "he",
    "he'd", "he'll", "he's", "her", "here", "here's", "hers", "herself", "him", "himself", "his", "how", "how's",
    "i", "i'd", "i'll", "i'm", "i've", "if", "in", "into", "is", "isn't", "it", "it's", "its", "itself", "let's",
    "me", "more", "most", "mustn't", "my", "myself", "no", "nor", "not", "of", "off", "on", "once", "only", "or",
    "other", "ought", "our", "ours", "ourselves", "out", "over", "own", "same", "shan't", "she", "she'd", "she'll",
    "she's", "should", "shouldn't", "so", "some", "such", "than", "that", "that's", "the", "their", "theirs",
    "them", "themselves", "then", "there", "there's", "these", "they", "they'd", "they'll", "they're", "they've",
    "this", "those", "through", "to", "too", "under", "until", "up", "very", "was", "wasn't", "we", "we'd",
    "we'll", "we're", "we've", "were", "weren't", "what", "what's", "when", "when's", "where", "where's", "which",
    "while", "who", "who's", "whom", "why", "why's", "with", "won't", "would", "wouldn't", "you", "you'd",
    "you'll", "you're", "you've", "your", "yours", "yourself", "yourselves", "hi", "hello", "please", "should"
}


def get_cleaned_query_terms(query: str) -> set[str]:
    """Extract and clean non-stop words from a query."""
    query_terms = set()
    for word in query.lower().split():
        cleaned = re.sub(r'[^\w\-]', '', word).strip()
        if cleaned and cleaned not in STOP_WORDS:
            query_terms.add(cleaned)
    return query_terms


def rank_text_chunks(
    text: str,
    query: str,
    top_k: int,
    id_prefix: str = "",
) -> list[CVChunk]:
    """Rank section chunks by simple query term overlap, ignoring common stop words."""
    query_terms = get_cleaned_query_terms(query)
    if not query_terms:
        return []

    chunks = []
    for rank, chunk in enumerate(_chunk_text(text), start=1):
        words = {re.sub(r'[^\w\-]', '', w).strip() for w in chunk["text"].lower().split()}
        overlap = query_terms & words
        score = len(overlap) / len(query_terms)
        chunks.append(
            CVChunk(
                id=f"{id_prefix}{chunk['id']}",
                text=chunk["text"],
                rank=rank,
                score=score,
            )
        )
    chunks.sort(key=lambda item: item.score, reverse=True)
    chunks = [c for c in chunks if c.score > 0.0]
    return [
        CVChunk(id=chunk.id, text=chunk.text, rank=index + 1, score=chunk.score)
        for index, chunk in enumerate(chunks[:top_k])
    ]


def _chunk_text(text: str, max_words: int = 140, overlap_words: int = 30) -> list[dict[str, str]]:
    sectioned = section_chunks(text)
    if sectioned:
        return sectioned

    words = text.split()
    chunks: list[dict[str, str]] = []
    step = max(1, max_words - overlap_words)
    for index, start in enumerate(range(0, len(words), step), start=1):
        chunk_words = words[start : start + max_words]
        if chunk_words:
            chunks.append({"id": f"chunk_{index}", "text": " ".join(chunk_words)})
        if start + max_words >= len(words):
            break
    return chunks
