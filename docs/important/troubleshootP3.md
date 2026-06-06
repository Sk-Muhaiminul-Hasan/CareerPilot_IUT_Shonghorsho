# Pillar 3 Troubleshooting Notes

## Scope

Pillar 3 is the Personal AI Assistant. Keep this work isolated from job search,
resume scoring, and automation branches unless a shared contract is needed.

## Expected Behavior

- Readiness: compare the user's CV with a job description and return a verdict
  with grounded reasoning.
- Skill gaps: compare the user's CV with role/company benchmarks and list gaps.
- Roadmap: build a 3-month weekly plan from the user's current CV context.
- Cover letter: draft a personalized letter that references real CV experience.

## Data Flow

1. Uploaded resumes are parsed into `Resume.content_text`.
2. The assistant resolves the active resume ID. If none is selected, it falls
   back to the newest base resume with parsed text.
3. CV text is chunked and indexed in `data/vector_indices`.
4. Assistant prompts receive retrieved CV chunks and optional job context.
5. Responses return `answer`, `sources`, `intent`, and optional metadata.
6. Generated roadmaps, cover letters, readiness reports, and gap analyses are
   saved to the frontend Artifacts page via local storage.

## Manual P3 Flow

1. Open `Resumes`.
2. Upload a PDF/DOCX CV. The page should open the parsed text editor after the
   upload succeeds.
3. Make a small text edit and save it.
4. Click `Use in Copilot`.
5. Open Copilot and ask a personal question.
6. Click source chips or attached CV chips to jump back to the CV context.
7. Open `Artifacts` to reuse generated outputs.

The `Open demo CV` action is only a placeholder for testing before Pillar 2 is
complete. It is visible and clickable so users can inspect what the assistant is
using.

## Common Issues

- `Please upload your CV first...`: no resume with non-empty `content_text`
  exists in the database.
- Empty or weak grounding: check that the resume upload parser extracted text.
- FAISS errors: delete the relevant `cv_<resume_id>*` files under
  `data/vector_indices` and retry. The index is rebuilt on demand.
- Frontend chat does not stream: the compatibility endpoint returns one SSE
  answer chunk. That is expected for now; the core service returns JSON.
- OpenAI shows not configured: make sure `LLM__OPENAI_API_KEY` or
  `OPENAI_API_KEY` is set in either `backend/.env` or the repo root `.env`, then
  restart the backend.

## Run Checks

```bash
cd backend
pytest tests/unit/test_rag_service.py tests/unit/test_chat_service.py -v
```

Use `/api/v1/assistant/chat` for the existing drawer and `/api/v1/chat` for a
plain JSON response.
