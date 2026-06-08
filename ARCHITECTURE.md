#  Architecture of CareerPilot
### `By IUT_shonghorsho`

Welcome to the architectural design document for **CareerPilot** (built by `IUT_shonghorsho`). This document maps out the system components, engineering patterns, and the exact end-to-end data flows from **CV upload and indexing** to **context-grounded AI agent responses**.

---

## 1. High-Level System Architecture

CareerPilot is structured as a decoupled, asynchronous, high-fidelity AI-assisted career companion. It features a React-based Single Page Application (SPA) on the frontend and an async-first FastAPI service on the backend.

```mermaid
graph TD
    %% Define System Layers
    subgraph Client ["Client Layer (Frontend)"]
        UI["React SPA (TS + MUI)"]
        State["Zustand (UI State)"]
        Query["React Query (Server Sync)"]
    end

    subgraph API ["Gateway & Routing Layer"]
        FastAPI["FastAPI App (ASGI)"]
        Routes["APIRouter (v1)"]
        Auth["Auth & Deps Injection"]
    end

    subgraph Service ["Service & Core Logic Layer"]
        RAG["RAGService"]
        ResumeSvc["ResumeService"]
        NudgeSvc["NudgeService"]
        JobSearch["JobSearchService"]
        ATS["ATS ResumeScorer Engine"]
        LLM["LLMClient"]
    end

    subgraph Data ["Data, Index & Cache Layer"]
        DB[(SQLite / PostgreSQL DB)]
        FAISS["FAISS Index Files"]
        Redis[(Redis Cache & Task Queue)]
    end

    %% Define Layer Connections
    UI -->|HTTPS / WSS| FastAPI
    FastAPI --> Routes
    Routes --> Auth
    Auth --> Service
    
    RAG -->|Vector Search| FAISS
    ResumeSvc -->|Persist Metadata| DB
    NudgeSvc -->|Cache Dashboard| Redis
    JobSearch -->|Scrapers / Exa| Web((External Job Platforms))
    
    LLM -->|API Completions| LLMProviders[[LLM Providers: Gemini, OpenAI, Claude]]
    ATS -->|Tokenization / NLP| SpaCy["spaCy (en_core_web_sm)"]
    
    Service -->|Transaction Context| DB
```

---

## 2. Phase A: Resume Upload & Vector Indexing Flow

When a candidate uploads their primary (or a tailored) CV, the system extracts the raw text and generates a localized vector store index using FAISS. This makes the resume searchable and retrieval-friendly for subsequent RAG workflows.

```mermaid
sequenceDiagram
    autonumber
    actor User as Candidate
    participant FE as React Frontend
    participant BE as FastAPI Backend (Resume API)
    participant DB as SQL Database
    participant RAG as RAGService
    participant VS as VectorStore (FAISS)
    participant Disk as Local File Storage

    User->>FE: Click "Upload CV" & Select PDF/Text File
    FE->>BE: POST /api/v1/resumes/upload (Multipart Form)
    
    Note over BE: Extract raw content text<br/>from PDF/TXT document
    
    BE->>DB: Insert Resume Row (type="base", content_text=extracted_text)
    DB-->>BE: Return saved Resume object (resume_id)
    
    BE->>RAG: Trigger index creation (RAGService._ensure_cv_index(resume))
    Note over RAG: Compute SHA-256 hash of resume content_text
    
    RAG->>Disk: Read existing metadata index file (if exists)
    
    alt Hash Matches (Cache Hit)
        RAG-->>BE: Index is up-to-date (no-op)
    else Hash Mismatch / Index Missing (Cache Miss)
        RAG->>RAG: Chunk text into overlapping word segments (max_words=140, overlap=30)
        RAG->>VS: Create FAISS index & initialize embedding dimension (EMBEDDING_DIMENSION=768)
        RAG->>VS: Encode chunks using SentenceTransformers (SentenceTransformer("all-MiniLM-L6-v2"))
        RAG->>VS: Save FAISS index files on disk (data/vector_indices/cv_{resume_id})
        RAG->>Disk: Write index chunk metadata (json) on disk
    end
    
    BE-->>FE: Return JSON Response with resume_id & upload status
    FE-->>User: Display Resume Preview (Ready for Tailoring / Chat)
```

---

## 3. Phase B: AI Chat & Context-Grounded Retrieval Flow

When a user interacts with the career assistant (e.g., asking "Am I ready for this job?" or "Tailor my CV for this role"), the system dynamically determines their intent, retrieves RAG chunks, constructs a bounded context, queries the LLM, and parses output into high-fidelity markdown artifacts.

```mermaid
graph TD
    %% Nodes representing the processing steps
    UserQuery["1. User Message / Query"] --> APIEndpoint["2. POST /api/v1/chat"]
    APIEndpoint --> IntentClassifier["3. Classify Intent (readiness, cover_letter, resume_tailoring, general)"]
    
    %% Intent check logic
    IntentClassifier --> JobResolution{"4. Resolve Job Context?"}
    JobResolution -->|Yes: job_id or description| FetchJob["5. Fetch Job Details from DB"]
    JobResolution -->|No| RAGSearch{"6. Query Type?"}
    FetchJob --> RAGSearch
    
    %% RAG Retrieval Split
    RAGSearch -->|Tailoring/Cover Letter| FullResume["7a. Load Full CV text from RAGService (holistic context)"]
    RAGSearch -->|General/Readiness Query| VectorRAG["7b. Query FAISS Vector Store for top K matching chunks"]
    
    VectorRAG --> OverlapScoring["8. Re-score and filter chunks using query-aware keyword overlaps"]
    OverlapScoring --> ContextAssembly["9. Assemble bounded prompt (Intent + Query + RAG Chunks + Job Context)"]
    FullResume --> ContextAssembly
    
    %% LLM Execution
    ContextAssembly --> LLMClient["10. Submit to LLMClient (with System Prompt & User Model Config)"]
    LLMClient --> LLMResponse["11. Parse raw LLM response"]
    
    %% Post-processing into Artifacts
    LLMResponse --> OutBuilder["12. prepare_assistant_output() extracts artifacts (Markdown resumes / Cover letters)"]
    OutBuilder --> DBStore["13. Automatically save generated documents back to DB (type='tailored' / 'cover_letter')"]
    DBStore --> FE["14. Return structured JSON (answer, artifacts, source chunks) to React Frontend"]
    FE --> RenderUI["15. Render chat bubbles & high-fidelity interactive Markdown/PDF Artifact viewers"]
```

---

## 4. Phase C: Dashboard Personalized AI Nudge Flow

The Dashboard utilizes the same RAG architecture to personalize metrics, advice, job recommendations, and calendar to-dos dynamically.

```mermaid
sequenceDiagram
    autonumber
    actor User as Dashboard Page
    participant BE as FastAPI Backend (/api/v1/nudge)
    participant Redis as Redis Cache
    participant DB as SQL Database
    participant RAG as RAGService
    participant LLM as LLMClient

    User->>BE: GET /api/v1/nudge (Authenticated request)
    BE->>Redis: Check cached nudge response (nudge:{user_id})
    
    alt Cache Hit
        Redis-->>BE: Return cached NudgeResponse
        BE-->>User: Render personalized dashboard overview instantly
    else Cache Miss
        BE->>DB: Fetch user's latest base CV & recent application stats
        
        alt CV Exists
            BE->>RAG: Get full CV text via get_full_cv_text()
            RAG-->>BE: Return CV content text
        else CV Missing
            BE->>DB: Fallback to Candidate Profile Settings (skills, experience)
            DB-->>BE: Return profile details
        end
        
        BE->>DB: Fetch active unapplied jobs + goals of the user
        DB-->>BE: Return job listings & current targets
        
        BE->>LLM: Complete nudge query (Prompt includes: CV context + unapplied jobs + goals)
        LLM-->>BE: Return structured JSON (headline, bullets, job matches, custom todos)
        
        Note over BE: Parse recommended job matches & update match scores
        
        loop For each suggested todo
            BE->>DB: Check if unfinished custom todo with same title exists (get_or_create_custom_todo)
            alt Todo Exists
                DB-->>BE: Return existing TodoItem (is_completed state preserved)
            else Todo Missing
                BE->>DB: Create and insert new TodoItem into SQL Database
                DB-->>BE: Return newly created TodoItem (Pushed to Calendar)
            end
        end
        
        BE->>Redis: Cache calculated NudgeResponse (TTL = 300 seconds)
        BE-->>User: Return NudgeResponse JSON (headline, bullets, recommended_jobs, suggested_todos)
    end
```

---

## 5. Architectural Design Principles

1. **Async-First Execution**:
   - All I/O operations—database transactions (SQLAlchemy 2.0 with `AsyncSession`), Redis caching, vector indexing, and LLM completions—are fully asynchronous (`async`/`await`), maximizing hardware utilization and concurrent request handling.
   
2. **Deterministic Context Boundaries**:
   - Instead of injecting massive documents into the LLM context (which increases token consumption and latency), the `RAGService` limits the context size using semantic text splitting, keyword boosts, and localized query-aware filtering.

3. **Separation of Concerns**:
   - The **Business Logic Layer** (`services/`) is fully separated from **API presentation routers** (`api/v1/`) and **Core Domain modules** (`core/`). This ensures components like the `LLMClient` or `VectorStore` can be unit tested in isolation without spawning mock web servers.

4. **Robust Fallbacks & Self-Correction**:
   - If Redis is unavailable, the backend falls back seamlessly to direct database computation.
   - If spaCy models or FAISS indices fail to initialize, lexical token searches (`rag_fallbacks.py`) provide instant backup.
   - If the user's CV is completely missing, the platform automatically pivots to onboarding configurations, helping them register their profile without crashing the dashboard.o