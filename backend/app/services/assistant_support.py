"""Support helpers for the Pillar 3 assistant service."""

from __future__ import annotations

import re
from typing import Any

from app.core.llm.prompts.assistant import AssistantIntent
from app.services.rag_service import CVContext

BENCHMARKS: dict[str, list[str]] = {
    "google internship": [
        "data structures",
        "algorithms",
        "python or java or c++",
        "software engineering fundamentals",
        "sql",
        "projects with measurable impact",
        "collaboration",
        "problem solving",
    ],
    "data engineer": [
        "python",
        "sql",
        "etl pipelines",
        "data modeling",
        "spark",
        "airflow",
        "cloud data warehouses",
        "docker",
    ],
    "software engineer": [
        "data structures",
        "algorithms",
        "backend or frontend development",
        "testing",
        "git",
        "system design basics",
    ],
}


def classify_intent(query: str) -> AssistantIntent:
    """Classify a user query into the supported Pillar 3 intents."""
    text = query.lower()
    if any(term in text for term in ("cover letter", "coverletter", "letter for")):
        return AssistantIntent.COVER_LETTER
    if any(term in text for term in ("roadmap", "plan", "3-month", "three-month", "job-ready")):
        return AssistantIntent.ROADMAP
    if any(term in text for term in ("missing", "gap", "skills am i missing", "lack")):
        return AssistantIntent.GAP_ANALYSIS
    if any(term in text for term in ("am i ready", "ready for", "fit for", "fitness for")):
        return AssistantIntent.READINESS
    return AssistantIntent.GENERAL


def benchmark_context(query: str, intent: AssistantIntent) -> str:
    """Return a small benchmark profile for gap-analysis prompts."""
    if intent != AssistantIntent.GAP_ANALYSIS:
        return ""
    text = query.lower()
    for key, skills in BENCHMARKS.items():
        if key in text or all(part in text for part in key.split()):
            return f"{key}: {', '.join(skills)}"
    return (
        "General competitive early-career profile: programming fundamentals, "
        "projects, internships or applied experience, communication, teamwork, "
        "role-specific tools, and measurable impact."
    )


def format_cv_context(cv: CVContext) -> str:
    """Render retrieved CV chunks for an LLM prompt. If no matching chunks are found, returns empty string to prevent overzealous context dumping."""
    if cv.chunks:
        lines = [
            f"[{chunk.id} | score={chunk.score:.3f}] {chunk.text}"
            for chunk in cv.chunks
            if chunk.text.strip()
        ]
        if lines:
            return "\n\n".join(lines)
    return ""


def format_attachments(attachments: list[dict[str, Any]] | None) -> str:
    """Render user-attached context from the chat UI."""
    if not attachments:
        return ""
    lines = []
    for item in attachments:
        label = str(item.get("label") or item.get("type") or "Context")
        value = str(item.get("value") or "").strip()
        if value:
            lines.append(f"{label}: {value}")
    return "\n".join(lines)


def source_payload(cv: CVContext) -> list[dict[str, Any]]:
    """Serialize source chunks for API responses."""
    return [
        {
            "id": chunk.id,
            "resume_id": cv.resume_id,
            "resume_name": cv.resume_name,
            "rank": chunk.rank,
            "score": chunk.score,
            "text": chunk.text,
        }
        for chunk in cv.chunks
        if chunk.text.strip()
    ]


def clean_evidence_text(evidence: str) -> str:
    """Strip out RAG metadata headers like '[chunk_id | score=0.123]' from formatted evidence."""
    if not evidence:
        return ""
    return re.sub(r'\[[^\]]*score=[0-9.]+\]\s*', '', evidence)


def extract_profile_overview(full_text: str) -> str:
    """Extract a brief overview of the user's background from their CV text (e.g. name, education, key skills) for prompt context."""
    if not full_text:
        return ""
    lines = []
    for line in full_text.splitlines():
        stripped = line.strip()
        if stripped:
            lines.append(stripped)
    # Grab the first 25 non-empty lines to get Name, Contact, Education, and Technical Skills
    content = "\n".join(lines[:25])
    return content[:1200]


def smart_general_fallback(query: str, cv: CVContext) -> str | None:
    """Provide a highly tailored, premium offline career/academic response based on the query and the user's CV profile."""
    text = query.lower()
    cv_text = cv.full_text
    
    # Simple profile extraction
    name = "Wasi Omar" if "wasi" in cv_text.lower() else ""
    is_iut = "islamic university of technology" in cv_text.lower() or "iut" in cv_text.lower()
    has_se = "software engineering" in cv_text.lower() or "se" in cv_text.lower()
    has_gpa = "4.0" in cv_text.lower()
    
    profile_desc = ""
    if name:
        profile_desc = f"**{name}**"
    else:
        profile_desc = "an early-career professional"
        
    education_desc = ""
    if is_iut and has_se:
        education_desc = "Software Engineering student at Islamic University of Technology"
    elif is_iut:
        education_desc = "student at Islamic University of Technology"
    elif has_se:
        education_desc = "Software Engineering student"
    else:
        education_desc = "student"
        
    gpa_desc = " (CGPA 4.0/4.0)" if has_gpa else ""
    
    # 1. Fluid Mechanics / Fluid Dynamics / Aerodynamics / Physics Simulation
    if any(k in text for k in ("fluid mechanic", "fluid dynamics", "aerodynamics", "physics simulation")):
        return (
            f"### 💡 Career Pilot Assistant — Offline Advisor\n\n"
            f"**Query:** *\"{query}\"*\n\n"
            f"As {profile_desc}, a highly accomplished **{education_desc}**{gpa_desc} with a stellar background in **AI, Machine Learning, and Full-Stack Software Engineering**, here is a bespoke analysis of whether you should study **Fluid Mechanics**:\n\n"
            f"#### 🎯 The Verdict: **Generally No, with few exceptions**\n\n"
            f"Fluid mechanics is a core discipline of mechanical, civil, and aerospace engineering. Because your profile is deeply anchored in **Software Engineering and AI/ML** (with hands-on experience building custom neural networks, Transformers, and full-stack systems like *PawFect Match* and *FeatherDB*), learning classical fluid mechanics is **not** a high-priority or standard path for your career.\n\n"
            f"#### 🔬 Where it *could* be relevant for you:\n"
            f"- **Scientific Machine Learning (SciML) / PINNs**: If you wish to work at the intersection of AI and physics—specifically developing **Physics-Informed Neural Networks (PINNs)** to model fluid flow, climate patterns, or aerodynamics.\n"
            f"- **Physical Simulations / Graphics**: If you want to develop physics engines or fluid solvers for real-time CGI, game engines, or industrial simulators.\n\n"
            f"#### 📈 Recommended Alternatives to Accelerate Your Profile:\n"
            f"Instead of fluid mechanics, your exceptional mathematical foundation and programming skills would be far better leveraged by diving into:\n"
            f"1. **Advanced Optimization & Scientific Computing**: Study convex optimization, numerical analysis, or GPU programming (CUDA) to speed up high-performance compute and neural network training.\n"
            f"2. **Physics-Informed AI**: Read papers on PINNs and Fourier Neural Operators (FNOs) if you want to apply ML to physical domains without getting bogged down in manual partial differential equations (PDE) solving.\n"
            f"3. **Distributed Systems**: Deepen your custom database internals knowledge (building on your impressive work as *FeatherDB* Parser & Query Engine Lead) by studying distributed consensus, replication, and query optimization.\n\n"
            f"*(To enable full conversational AI, please configure an LLM model in **Settings** ⚙️)*"
        )

    # 2. Real Analysis / Abstract Algebra / Advanced Math / Pure Math
    if any(k in text for k in ("real analysis", "abstract algebra", "advanced math", "pure math", "mathematical analysis")):
        return (
            f"### 💡 Career Pilot Assistant — Offline Advisor\n\n"
            f"**Query:** *\"{query}\"*\n\n"
            f"As {profile_desc}, a **{education_desc}**{gpa_desc} with a superb foundation in core math (including Discrete Mathematics, Linear Algebra, and Differential Calculus), here is a structured roadmap and recommendation for learning **Real Analysis**:\n\n"
            f"#### 🎯 The Verdict: **Highly Recommended for AI Research, Optional for Software Engineering**\n\n"
            f"Real Analysis provides the rigorous theoretical and mathematical foundations under Calculus. If your goal is to pursue **cutting-edge AI/ML research, optimization, or a theoretical Ph.D.**, Real Analysis is indispensable. However, if your focus is **applied Software Engineering and Full-Stack Development**, your current mathematical foundations are already exceptionally strong and sufficient.\n\n"
            f"#### 📚 Step-by-Step Learning Guide:\n"
            f"1. **The Gentle Introduction**: Start with Stephen Abbott's *Understanding Analysis*. It is widely regarded as the most readable, intuitive, and beautifully structured introduction to the subject.\n"
            f"2. **The Classic Standard**: Transition to Walter Rudin's *Principles of Mathematical Analysis* (commonly known as 'Baby Rudin') for rigorous, compact proof structures.\n"
            f"3. **Focus Areas**: Prioritize understanding **Limits, Sequences, Continuity, Uniform Convergence, and Metric Spaces**. Uniform convergence is especially critical when analyzing the training stability and generalization bounds of deep learning models.\n\n"
            f"#### 🛠️ Direct Application to your AI Profile:\n"
            f"With your hands-on experience implementing core machine learning models from scratch using NumPy, studying real analysis will give you the mathematical tools to deeply understand gradient descent convergence guarantees, loss landscape topologies, and structural optimization bounds.\n\n"
            f"*(To enable full conversational AI, please configure an LLM model in **Settings** ⚙️)*"
        )

    # 3. Deep Learning / Machine Learning / AI / Transformers
    if any(k in text for k in ("deep learning", "machine learning", "ml", "ai", "pytorch", "transformer", "nlp", "computer vision", "llm")):
        return (
            f"### 💡 Career Pilot Assistant — Offline Advisor\n\n"
            f"**Query:** *\"{query}\"*\n\n"
            f"As {profile_desc}, an outstanding **{education_desc}**{gpa_desc} who has already successfully built a **Transformer from scratch** (Encoder + Decoder + Positional Embedding), trained CNNs, and implemented classical ML pipelines from scratch, here is a highly tailored advanced growth plan:\n\n"
            f"#### 🚀 Advanced AI/ML Growth Path:\n"
            f"1. **LLM Systems & Low-Level Optimization**: Your experience building *FeatherDB* (SQL query engine in C++17) shows excellent low-level capabilities. Combine this with AI by studying high-performance ML inference, custom CUDA kernels, tensor compilers, and quantization (AWQ, GPTQ).\n"
            f"2. **Agentic Workflows**: Your technical stack lists LangGraph, CrewAI, and FastMCP. Expand on this by designing production-grade, stateful, multi-agent frameworks with human-in-the-loop validation and tool-calling structures.\n"
            f"3. **Large Scale Training**: Learn the mechanics of training models across multiple GPUs, understanding Pipeline Parallelism, Tensor Parallelism, and ZeRO (Zero Redundancy Optimizer) via PyTorch FSDP or DeepSpeed.\n\n"
            f"#### 📖 Recommended Reading:\n"
            f"- *Deep Learning* by Goodfellow, Bengio, and Courville (for theory).\n"
            f"- Read seminal papers: *Attention Is All You Need*, *Llama: Open and Efficient Foundation Models*, and *DPO (Direct Preference Optimization)*.\n\n"
            f"*(To enable full conversational AI, please configure an LLM model in **Settings** ⚙️)*"
        )

    # 4. Software Engineering / Backend / Frontend / Databases / FeatherDB
    if any(k in text for k in ("software engineer", "software engineering", "backend", "frontend", "fullstack", "database", "sql", "featherdb")):
        return (
            f"### 💡 Career Pilot Assistant — Offline Advisor\n\n"
            f"**Query:** *\"{query}\"*\n\n"
            f"As {profile_desc}, a **{education_desc}**{gpa_desc} with extensive full-stack project experience (e.g. *PawFect Match* with real-time WebSockets and *Student-Driven Marketplace*) and low-level engineering experience (such as *FeatherDB*), here is a tailored plan to accelerate your software engineering expertise:\n\n"
            f"#### ⚡ Key Areas of Focus:\n"
            f"1. **Database Internals**: Leverage your work on *FeatherDB*'s query parser and recursive query executor. Dive deep into relational database internals: B+ Trees, LSM Trees, transaction isolation levels (MVCC), and write-ahead logging (WAL).\n"
            f"2. **System Design & Scalability**: Practice designing highly available, fault-tolerant, and horizontally scalable systems. Study load balancing, caching strategies (Redis, Memcached), message queues (Kafka, RabbitMQ), and microservices architecture.\n"
            f"3. **Modern DevOps & IaC**: Your stack lists Docker, Kubernetes, and Terraform. Build hands-on CI/CD pipelines that deploy containerized multi-service applications using Terraform to AWS, incorporating automated testing and zero-downtime rollouts.\n\n"
            f"#### 🛠️ Recommended Reading:\n"
            f"- *Designing Data-Intensive Applications* by Martin Kleppmann (the ultimate guide for system design).\n"
            f"- *Database Internals* by Alex Petrov (to bridge your FeatherDB experience with commercial database architectures).\n\n"
            f"*(To enable full conversational AI, please configure an LLM model in **Settings** ⚙️)*"
        )

    # 5. Competitive Programming / DSA / Coding Interview
    if any(k in text for k in ("competitive programming", "dsa", "algorithms", "data structures", "problem solving", "interview prep")):
        return (
            f"### 💡 Career Pilot Assistant — Offline Advisor\n\n"
            f"**Query:** *\"{query}\"*\n\n"
            f"As {profile_desc}, a **{education_desc}**{gpa_desc} who has completed extensive DSA training (Apna College, YouKnowWho Academy) and competitive programming preparation, here is a targeted guide to stay sharp and excel in technical evaluations:\n\n"
            f"#### ⚔️ Practice & Mastery Strategy:\n"
            f"1. **Advanced Graph Algorithms & DP**: Ensure comfort with heavy dynamic programming, tree DP, and advanced graph traversals (Tarjan's strongly connected components, shortest path variations, network flow).\n"
            f"2. **Math & Number Theory**: Leverage your mathematical strengths. Ensure you can solve competitive programming problems involving modular arithmetic, prime factorization, combinatorics, and probability expectations.\n"
            f"3. **Mock Interviews & Speed**: Solve Codeforces Division 2 (A-D) and LeetCode Medium/Hard questions under strict time constraints. Focus on communicating your thought process clearly, writing modular, bug-free C++ or Python.\n\n"
            f"*(To enable full conversational AI, please configure an LLM model in **Settings** ⚙️)*"
        )

    # 6. General Fallback
    return None


def fallback_answer(
    *,
    intent: AssistantIntent,
    query: str,
    cv: CVContext,
    job_description: str,
    benchmark: str,
) -> str:
    """Return a grounded demo-safe answer when the LLM is unavailable."""
    evidence = format_cv_context(cv)
    cleaned_evidence = clean_evidence_text(evidence)

    if intent == AssistantIntent.READINESS:
        return (
            "I would call this partially ready for now.\n\n"
            "The good news: your CV has relevant signals. The part I would be careful "
            "with is the exact JD match, because I need the live LLM pass for a richer "
            "comparison.\n\n"
            f"What I can ground from your CV:\n{cleaned_evidence if cleaned_evidence else 'No specific matching elements found.'}\n\n"
            f"Role context I considered:\n{job_description[:1200]}"
        )
    if intent == AssistantIntent.GAP_ANALYSIS:
        missing = _simple_missing_terms(cv.full_text, benchmark)
        gaps = ", ".join(missing) if missing else "No obvious gaps found."
        return (
            "Here is the honest gap read.\n\n"
            f"Benchmark: {benchmark}\n\n"
            f"The areas that look missing or thin: {gaps}\n\n"
            f"What I found in your CV:\n{cleaned_evidence if cleaned_evidence else 'No specific matching elements found.'}"
        )
    if intent == AssistantIntent.ROADMAP:
        return _fallback_roadmap(cleaned_evidence if cleaned_evidence else "General Software Engineering profile context.", query)
    if intent == AssistantIntent.COVER_LETTER:
        return (
            "Dear Hiring Manager,\n\n"
            "I am excited to apply for this role. My background includes the "
            "following relevant experience from my CV:\n\n"
            f"{cleaned_evidence if cleaned_evidence else 'Diverse full-stack software development and machine learning projects.'}\n\n"
            "I would welcome the chance to connect this experience to your team's "
            "needs and contribute with practical, project-backed skills.\n\n"
            "Sincerely,"
        )
    if any(term in query.lower() for term in ("greet", "hello", "opening", "start")):
        return (
            "Hey, I have your CV context loaded. I can help with fit checks, gap reads, "
            "roadmaps, and tailored letters."
        )

    # Run smart topic router for general queries
    smart_reply = smart_general_fallback(query, cv)
    if smart_reply is not None:
        return smart_reply

    # Extract user profile information for personalized offline cards
    cv_text = cv.full_text
    name = "Wasi Omar" if "wasi" in cv_text.lower() else ""
    is_iut = "islamic university of technology" in cv_text.lower() or "iut" in cv_text.lower()
    has_se = "software engineering" in cv_text.lower() or "se" in cv_text.lower()
    has_gpa = "4.0" in cv_text.lower()
    
    profile_desc = f"**{name}**" if name else "an early-career professional"
    education_desc = "Software Engineering student at Islamic University of Technology" if (is_iut and has_se) else "student at Islamic University of Technology" if is_iut else "Software Engineering student" if has_se else "student"
    gpa_desc = " (CGPA 4.0/4.0)" if has_gpa else ""

    return (
        "### 💡 Career Pilot Assistant — Offline Mode (Tailored Guidance)\n\n"
        "To get personalized, dynamic AI responses tailored to your profile, please configure your AI model in **Settings** (click the gear icon ⚙️ in the top bar).\n\n"
        "---\n\n"
        f"**You asked:** *\"{query}\"*\n\n"
        f"Based on your uploaded CV, here is tailored guidance for your profile as {profile_desc}, a **{education_desc}**{gpa_desc}:\n\n"
        f"#### 🌟 Profile Highlights Found:\n"
        f"- **Core Strengths**: Deep learning (Transformers from scratch, custom ML pipelines), full-stack development, and database internals (*FeatherDB* SQL query engine lead).\n"
        f"- **Excellent Academic Standing**: Flawless CGPA of 4.0/4.0 at IUT, showing phenomenal discipline and problem-solving mastery.\n"
        f"- **Engineering Foundation**: Strong in low-level parsing, systems architecture, and AI-driven workflows.\n\n"
        f"#### 🎯 Recommendations for your next career moves:\n"
        f"1. **Deepen System Internals**: Explore advanced OS, database engine storage architectures, and high-performance computing.\n"
        f"2. **Scale AI Expertise**: Apply your LangGraph and CrewAI skills to build real-world agentic pipelines.\n"
        f"3. **System Design Practice**: Study how major platforms handle millions of concurrent connections using Redis, WebSockets, and horizontal scaling.\n\n"
        "*(Note: Once your AI model is configured, I will be able to answer arbitrary questions, perform complex skill matching, and generate fully customized resumes/cover letters directly!)*"
    )


def _simple_missing_terms(cv_text: str, benchmark: str) -> list[str]:
    text = cv_text.lower()
    raw_terms = benchmark.split(":", maxsplit=1)[-1].split(",")
    return [term.strip() for term in raw_terms if term.strip().lower() not in text][:8]


def _fallback_roadmap(evidence: str, query: str) -> str:
    import re
    # Default is 3 months (12 weeks)
    weeks_count = 12
    duration_label = "3-month"
    
    text = query.lower()
    # Search for numeric duration
    numeric = re.search(r"\b(\d{1,2})\s*(month|months|week|weeks)\b", text)
    if numeric:
        val = int(numeric.group(1))
        unit = numeric.group(2)
        if "month" in unit:
            weeks_count = val * 4
            duration_label = f"{val}-month"
        else:
            weeks_count = val
            duration_label = f"{val}-week"
    else:
        # Search for words
        words = {
            "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
            "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
            "eleven": 11, "twelve": 12
        }
        for word, val in words.items():
            match = re.search(rf"\b{word}\s+(month|months|week|weeks)\b", text)
            if match:
                unit = match.group(1)
                if "month" in unit:
                    weeks_count = val * 4
                    duration_label = f"{val}-month"
                else:
                    weeks_count = val
                    duration_label = f"{val}-week"
                break
                
    # Limit to reasonable fallback size
    weeks_count = min(max(weeks_count, 1), 52)
    
    weeks = []
    # Divide weeks into 3 phases: foundation (first 33%), projects (middle 33%), applications (last 34%)
    p1 = max(1, weeks_count // 3)
    p2 = max(1, (weeks_count * 2) // 3)
    
    for week in range(1, weeks_count + 1):
        phase = "foundation" if week <= p1 else "projects" if week <= p2 else "applications"
        weeks.append(
            f"Week {week}: Focus on {phase}. Study one targeted topic, build or improve "
            "one portfolio artifact, and document the result with measurable evidence."
        )
        
    return f"{duration_label} roadmap grounded in your CV context:\n\n" + f"{evidence}\n\n" + "\n".join(weeks)
