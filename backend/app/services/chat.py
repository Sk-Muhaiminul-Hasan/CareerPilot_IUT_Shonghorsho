import structlog
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

# Context Layer Imports
from app.core.llm.client import LLMClient
from app.core.matching.vector_store import VectorStore
# Adjust these import paths below if AutoApply uses different model filenames
from app.models.job import Job  
from app.models.resume import Resume 

logger = structlog.get_logger(__name__)

async def generate_assistant_stream(
    db: AsyncSession,
    message: str,
    job_id: str | None = None,
    profile_id: str | None = None,
) -> AsyncGenerator[str, None]:
    
    context_str = ""
    
    # 1. Gather Context - Job Description (If provided)
    if job_id:
        try:
            result = await db.execute(select(Job).where(Job.id == job_id))
            job = result.scalar_one_or_none()
            if job and hasattr(job, 'description'):
                context_str += f"\n=== TARGET JOB DESCRIPTION ===\nRole: {job.title}\nCompany: {job.company}\nDescription:\n{job.description}\n"
        except Exception as e:
            logger.error("failed_to_fetch_job_context", job_id=job_id, error=str(e))

    # 2. Gather Context - RAG Embeddings from Resume (If provided)
    if profile_id:
        try:
            # We look up relevant CV context segments from the local vector index
            # This matches standard AutoApply index query layouts
            vector_store = VectorStore()
            # Querying the index using the user prompt message to match relevant sections
            search_results = await vector_store.asearch(
                user_id=profile_id, 
                query=message, 
                limit=5
            )
            
            if search_results:
                context_str += "\n=== RELEVANT USER CV DETAILS (RAG CHUNKS) ===\n"
                for res in search_results:
                    context_str += f"- {res.text}\n"
        except Exception as e:
            logger.error("failed_to_fetch_vector_cv_context", profile_id=profile_id, error=str(e))

    # 3. Construct System Prompt mapping back to your 4 Criteria Points
    system_prompt = f"""You are an elite, contextual Career Copilot built directly into AutoApply-AI. 
Your target goal is to answer job search, skill tracking, and application preparation questions with total precision.

Guidelines:
1. Ground your evaluations directly inside the [USER CV DETAILS] if they are available. Never hallucinate skills.
2. If [TARGET JOB DESCRIPTION] is available, benchmark the user's details against that description directly.
3. Handle requests clearly based on these styles:
   - For fit/readiness analysis: Provide a definitive verdict with clear reasoning.
   - For skill gap analysis: List the gaps cleanly against benchmark goals.
   - For roadmaps: Create structured weekly steps containing target resources.
   - For materials (like Cover Letters): References real projects or facts from the CV details to personalize the copy perfectly.

CONTEXT RECONSTRUCTED:
{context_str}
"""

    # 4. Stream response through LiteLLM Wrapper client
    try:
        import litellm
        llm = LLMClient()
        
        model_chain = llm._get_model_chain(None)
        response_stream = None
        last_error = None
        
        for attempt_model in model_chain:
            try:
                logger.info("attempting_stream_completion", model=attempt_model)
                response_stream = await litellm.acompletion(
                    model=attempt_model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": message}
                    ],
                    temperature=llm._llm.temperature,
                    max_tokens=llm._llm.max_tokens,
                    stream=True
                )
                break  # Success! Got the stream
            except Exception as e:
                logger.warning("stream_completion_attempt_failed", model=attempt_model, error=str(e))
                last_error = e
                continue
        
        if response_stream is None:
            raise last_error or Exception("No models available for streaming")
            
        async for chunk in response_stream:
            if hasattr(chunk, 'choices') and chunk.choices:
                delta = chunk.choices[0].delta
                content = getattr(delta, 'content', None)
                if content:
                    yield content
                
    except Exception as e:
        logger.error("assistant_stream_generation_failed", error=str(e))
        yield "I encountered an error trying to process that request. Please try again."