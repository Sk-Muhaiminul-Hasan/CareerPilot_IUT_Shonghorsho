import json
import os

BATCHES = [17, 18, 19]

FILE_SUMMARIES = {
    ".understand-anything/.understandignore": "Specifies pattern rules to ignore files and directories during the codebase structure scanning process.",
    ".understand-anything/tmp/changed-files.txt": "Lists the changed files in the workspace to track modifications for incremental updates.",
    "backend/app/__init__.py": "Initializes the FastAPI backend application package.",
    "backend/app/api/__init__.py": "Initializes the API package containing routing modules for the backend service.",
    "backend/app/api/v1/__init__.py": "Initializes version 1 of the REST API package.",
    "backend/app/api/websocket/__init__.py": "Initializes the WebSocket endpoints package for real-time bi-directional communications.",
    "backend/app/core/__init__.py": "Initializes the core application configuration, security, and utility modules.",
    "backend/app/core/documents/templates/__init__.py": "Initializes the document templates package for resume and cover letter generation.",
    "backend/app/core/documents/templates/styles/__init__.py": "Initializes the CSS style templates package for resume and cover letter formatting.",
    "backend/app/core/job_discovery/__init__.py": "Initializes the job discovery module for searching, parsing, and discovering new job listings.",
    "backend/app/core/llm/__init__.py": "Initializes the Large Language Model interface layer for interacting with AI providers.",
    "backend/app/core/rag/__init__.py": "Initializes the Retrieval-Augmented Generation module for resume matching and document querying.",
    "backend/app/db/migrations/__init__.py": "Initializes the database migrations package.",
    "backend/app/db/migrations/script.py.mako": "Alembic database migration script template.",
    "backend/app/db/migrations/versions/__init__.py": "Initializes the alembic migration versions package.",
    "backend/app/db/migrations/versions/20260603_fa1d9b61a6ce_initial_schema.py": "Alembic database migration script establishing the initial database schema with core tables.",
    "backend/app/db/migrations/versions/20260604_a1b2c3d4e5f6_add_reasoning_to_applications.py": "Alembic database migration script adding AI reasoning fields to job applications.",
    "backend/app/db/migrations/versions/20260606_user_id_multitenancy.py": "Alembic database migration script migrating the database schema to support multi-tenancy via user_id.",
    "backend/app/db/migrations/versions/20260606180000_preferred_model_and_user_api_key.py": "Alembic database migration script adding preferred AI model and user API key fields to settings.",
    "backend/app/db/migrations/versions/20260606200000_replace_general_extraction_ai.py": "Alembic database migration script upgrading AI model and job board scraping tables.",
    "backend/app/db/migrations/versions/20260607_add_job_deadline_and_work_type.py": "Alembic database migration script adding job deadlines and work type classifications.",
    "backend/data/db/autoapply.db": "SQLite database holding job seeker profiles, applications, and scraping configurations.",
    "backend/data/db/careerpilot.db": "SQLite database used for local development tracking and job application analytics.",
    "backend/data/generated/cover_letters/~$d74f418c75.docx": "Temporary Word document lock file generated during cover letter creation.",
    "backend/data/generated/cover_letters/85d74f418c75.docx": "Generated Word document containing a customized professional cover letter for an application.",
    "backend/data/sessions/linkedin/cookies.json": "Saves LinkedIn authentication cookies and session state to bypass login checks during automated scraping.",
    "backend/run.py": "Main backend entry point script that starts the Uvicorn ASGI server to host the FastAPI application.",
    "backend/scripts/enable_pgvector.py": "Enables the pgvector extension in the PostgreSQL database for semantic embedding searches.",
    "backend/test_connection_ipv6.py": "Checks PostgreSQL database connection using IPv6 addresses to verify network compatibility.",
    "backend/test_connection_sync.py": "Tests synchronous connection to the PostgreSQL database using psycopg2.",
    "backend/test_connection.py": "Verifies asynchronous connection to the PostgreSQL database using asyncpg.",
    "backend/tests/__init__.py": "Initializes the backend test suite package.",
    "backend/tests/e2e/__init__.py": "Initializes the end-to-end integration test suite.",
    "backend/tests/integration/__init__.py": "Initializes the integration test suite.",
    "backend/tests/integration/test_analytics_api.py": "Contains integration tests verifying endpoints that serve career dashboard analytics and stage metrics.",
    "backend/tests/integration/test_settings_api.py": "Contains integration tests validating backend APIs for managing user and LLM provider settings.",
    "backend/tests/unit/__init__.py": "Initializes the backend unit tests package.",
    "docker/Dockerfile.backend": "Dockerfile containing instructions to build a container image for the Python FastAPI backend service.",
    "docker/Dockerfile.frontend": "Dockerfile containing instructions to build a container image for the React/TypeScript frontend application.",
    "docker/nginx.conf": "Nginx configuration file routing traffic and serving static assets for the frontend and API services.",
    "docs/important/troubleshootP3.md": "Troubleshooting documentation and flow diagrams for solving job application pipeline issues.",
    "frontend/src/__tests__/mocks/handlers.ts": "Defines Mock Service Worker (MSW) handlers to mock backend REST endpoints for frontend testing.",
    "frontend/src/__tests__/mocks/server.ts": "Configures a Mock Service Worker (MSW) server instance for integration and unit test mocking.",
    "frontend/src/components/settings/AIConfigCard.tsx": "React component presenting UI inputs for updating and saving Large Language Model configurations and API keys.",
    "frontend/src/icons.d.ts": "TypeScript declaration file providing type definitions for SVG icons and assets.",
    "frontend/src/pages/HomePage.tsx": "React component rendering the modern landing page showcasing application features, stats, and workflows.",
    "frontend/src/setupTests.ts": "Configures the frontend testing environment and registers mock servers before test execution.",
    "frontend/src/vite-env.d.ts": "Vite environment types and client-side module definitions for assets and import meta.",
    "frontend/vite.config.ts": "Vite configuration file defining bundler plugins, dev servers, and alias pathways.",
    "templates/cover_letter/creative/style.css": "CSS style definition for the creative cover letter template.",
    "templates/cover_letter/creative/template.html": "HTML markup template for the creative cover letter layout.",
    "templates/cover_letter/standard/style.css": "CSS style definition for the standard cover letter template.",
    "templates/cover_letter/standard/template.html": "HTML markup template for the standard cover letter layout.",
    "templates/cover_letter/technical/style.css": "CSS style definition for the technical cover letter template.",
    "templates/cover_letter/technical/template.html": "HTML markup template for the technical cover letter layout.",
    "templates/resume/classic/style.css": "CSS style definition for the classic resume template.",
    "templates/resume/classic/template.html": "HTML markup template for the classic resume layout.",
    "templates/resume/creative/style.css": "CSS style definition for the creative resume template.",
    "templates/resume/creative/template.html": "HTML markup template for the creative resume layout.",
    "templates/resume/executive/style.css": "CSS style definition for the executive resume template.",
    "templates/resume/executive/template.html": "HTML markup template for the executive resume layout.",
    "templates/resume/minimal/style.css": "CSS style definition for the minimal resume template.",
    "templates/resume/minimal/template.html": "HTML markup template for the minimal resume layout.",
    "templates/resume/modern/style.css": "CSS style definition for the modern resume template.",
    "templates/resume/modern/template.html": "HTML markup template for the modern resume layout.",
    "test_extraction.py": "Script used to test and inspect content extraction from resume and cover letter PDF documents."
}

BUILTINS_TO_IGNORE = {
    "print", "len", "str", "enumerate", "isinstance", "useState", "useEffect",
    "setTimeout", "clearTimeout", "useNavigate", "navigate", "map", "is_string",
    "range", "dict", "list", "set", "int", "float", "bool", "any", "all",
    "sum", "min", "max", "type"
}

def get_node_id_and_type(path):
    lower_path = path.lower()
    if "docker" in lower_path or lower_path.endswith("dockerfile") or "dockerfile" in lower_path:
        return f"service:{path}", "service"
    elif "docker-compose" in lower_path:
        return f"service:{path}", "service"
    elif lower_path.endswith((".json", ".yml", ".yaml", ".toml", ".ini", ".conf", "makefile", ".mako", ".ignore")) or "config" in lower_path or "settings" in lower_path:
        return f"config:{path}", "config"
    elif lower_path.endswith((".md", ".txt", ".pdf", ".docx", ".doc")):
        return f"document:{path}", "document"
    elif "github/workflows" in lower_path or "gitlab-ci" in lower_path:
        return f"pipeline:{path}", "pipeline"
    else:
        return f"file:{path}", "file"

def get_complexity(lines):
    if lines < 50:
        return "simple"
    elif lines <= 200:
        return "moderate"
    else:
        return "complex"

def get_class_or_func_complexity(lines):
    if lines < 15:
        return "simple"
    elif lines <= 40:
        return "moderate"
    else:
        return "complex"

def get_tags(path):
    tags = []
    lower_path = path.lower()
    
    if lower_path.endswith(".py"):
        tags.extend(["python", "backend"])
    elif lower_path.endswith((".ts", ".tsx")):
        tags.extend(["typescript", "frontend"])
    elif lower_path.endswith(".json"):
        tags.append("json")
    elif lower_path.endswith((".css", ".scss")):
        tags.extend(["css", "styles"])
    elif lower_path.endswith(".html"):
        tags.extend(["html", "template"])
    elif lower_path.endswith(".md"):
        tags.extend(["markdown", "docs"])
    elif lower_path.endswith(".db"):
        tags.extend(["database", "sqlite"])
    elif lower_path.endswith(".docx"):
        tags.extend(["document", "word"])
    elif "dockerfile" in lower_path:
        tags.extend(["docker", "container"])
    elif lower_path.endswith(".conf"):
        tags.extend(["nginx", "config"])
        
    if "migration" in lower_path:
        tags.extend(["database", "alembic", "migration"])
    if "api" in lower_path:
        tags.extend(["api", "endpoints"])
    if "test" in lower_path:
        tags.extend(["testing", "pytest" if "backend" in lower_path or lower_path.endswith(".py") else "jest"])
    if "websocket" in lower_path:
        tags.append("websocket")
    if "llm" in lower_path or "ai" in lower_path:
        tags.extend(["llm", "ai"])
    if "resume" in lower_path:
        tags.extend(["resume", "template"])
    if "cover_letter" in lower_path:
        tags.extend(["cover-letter", "template"])
    if "cookies" in lower_path or "session" in lower_path:
        tags.extend(["auth", "session"])
        
    unique_tags = list(set(tags))
    if len(unique_tags) < 3:
        unique_tags.extend(["careerpilot", "system"])
    return unique_tags[:5]

def get_class_or_function_tags(name, filePath):
    tags = []
    lower_name = name.lower()
    lower_path = filePath.lower()
    
    if "test" in lower_name or "test" in lower_path:
        tags.extend(["testing", "verification"])
    if "upgrade" in lower_name:
        tags.extend(["migration", "schema-upgrade"])
    if "downgrade" in lower_name:
        tags.extend(["migration", "schema-downgrade"])
    if "main" in lower_name:
        tags.append("entrypoint")
    if "inspect" in lower_name or "extract" in lower_name:
        tags.extend(["pdf", "extraction"])
        
    if "backend" in lower_path:
        tags.append("backend")
    if "frontend" in lower_path:
        tags.append("frontend")
        
    unique_tags = list(set(tags))
    if len(unique_tags) < 2:
        unique_tags.extend(["core", "logic"])
    return unique_tags[:3]

def get_language_notes(path, language):
    lower_path = path.lower()
    if "migration" in lower_path:
        return "Alembic database migration script using SQLAlchemy schema definitions."
    elif language == "python":
        return "Python 3.x implementation using standard typing conventions and imports."
    elif language in ("typescript", "tsx", "javascript"):
        return "TypeScript/ES6 module utilizing modern import/export patterns and static typings."
    elif language in ("html", "css"):
        return "Standard markup/style template utilized by the document formatting engine."
    elif language == "json":
        return "Structured JSON data file used for configuration and system metadata storage."
    elif language in ("dockerfile", "infra", "service"):
        return "Containerization or infrastructure definition specifying runtime environments."
    else:
        return f"Resource file handled dynamically by the application."

for batch_idx in BATCHES:
    input_path = f".understand-anything/tmp/input-{batch_idx}.json"
    ast_path = f".understand-anything/tmp/ast-{batch_idx}.json"
    output_path = f".understand-anything/intermediate/batch-{batch_idx}.json"
    
    if not os.path.exists(input_path) or not os.path.exists(ast_path):
        print(f"Skipping batch {batch_idx}: files not found.")
        continue
        
    with open(input_path, 'r', encoding='utf-8') as f:
        input_data = json.load(f)
        
    with open(ast_path, 'r', encoding='utf-8') as f:
        ast_data = json.load(f)
        
    nodes = []
    edges = []
    
    # Track nodes we've generated to avoid duplicate ids
    node_ids = set()
    
    def add_node(node):
        if node["id"] not in node_ids:
            nodes.append(node)
            node_ids.add(node["id"])
            
    # Step 1: Create main file-level nodes
    file_map = {}
    for bf in input_data.get("batchFiles", []):
        path = bf["path"]
        file_map[path] = bf
        
    ast_results = {res["path"]: res for res in ast_data.get("results", [])}
    
    for path, bf in file_map.items():
        ast_res = ast_results.get(path, {})
        size_lines = bf.get("sizeLines", ast_res.get("totalLines", 0))
        language = bf.get("language", ast_res.get("language", "unknown"))
        
        node_id, node_type = get_node_id_and_type(path)
        summary = FILE_SUMMARIES.get(path, f"Source file for {os.path.basename(path)}.")
        
        file_node = {
            "id": node_id,
            "type": node_type,
            "name": os.path.basename(path),
            "filePath": path,
            "summary": summary,
            "complexity": get_complexity(size_lines),
            "tags": get_tags(path),
            "languageNotes": get_language_notes(path, language)
        }
        add_node(file_node)
        
        # Parse Classes
        for cls in ast_res.get("classes", []):
            class_name = cls["name"]
            class_id = f"class:{path}:{class_name}"
            class_lines = cls.get("endLine", 0) - cls.get("startLine", 0)
            
            class_node = {
                "id": class_id,
                "type": "class",
                "name": class_name,
                "filePath": path,
                "summary": f"Class {class_name} defined in {os.path.basename(path)}.",
                "complexity": get_class_or_func_complexity(class_lines),
                "tags": get_class_or_function_tags(class_name, path)
            }
            add_node(class_node)
            
            # Containment: file contains class
            edges.append({
                "source": node_id,
                "target": class_id,
                "type": "contains",
                "weight": 1.0,
                "summary": f"Contains {class_name} definition.",
                "direction": "forward"
            })
            
            # Methods within class
            for m_name in cls.get("methods", []):
                method_id = f"function:{path}:{m_name}"
                method_node = {
                    "id": method_id,
                    "type": "function",
                    "name": m_name,
                    "filePath": path,
                    "summary": f"Method {m_name} belonging to class {class_name}.",
                    "complexity": "simple",
                    "tags": get_class_or_function_tags(m_name, path)
                }
                add_node(method_node)
                
                # Containment: class contains method
                edges.append({
                    "source": class_id,
                    "target": method_id,
                    "type": "contains",
                    "weight": 1.0,
                    "summary": f"Contains {m_name} definition.",
                    "direction": "forward"
                })
                
        # Parse Functions
        for func in ast_res.get("functions", []):
            func_name = func["name"]
            func_id = f"function:{path}:{func_name}"
            func_lines = func.get("endLine", 0) - func.get("startLine", 0)
            
            func_node = {
                "id": func_id,
                "type": "function",
                "name": func_name,
                "filePath": path,
                "summary": f"Function {func_name} defined in {os.path.basename(path)}.",
                "complexity": get_class_or_func_complexity(func_lines),
                "tags": get_class_or_function_tags(func_name, path)
            }
            add_node(func_node)
            
            # Containment: file contains function
            edges.append({
                "source": node_id,
                "target": func_id,
                "type": "contains",
                "weight": 1.0,
                "summary": f"Contains {func_name} definition.",
                "direction": "forward"
            })
            
        # Parse callGraph
        for call in ast_res.get("callGraph", []):
            caller_name = call["caller"]
            callee_name = call["callee"]
            
            # Ignore trivial/builtin calls
            if callee_name in BUILTINS_TO_IGNORE:
                continue
                
            caller_id = f"function:{path}:{caller_name}"
            
            # If caller is not in our nodes (e.g. it was a method in a class or a function),
            # check if it exists in any class.
            # We already registered class methods under function:<path>:<methodName>.
            # If the caller is not registered, we can fall back to the file node as caller.
            if caller_id not in node_ids:
                # Fallback to file ID
                caller_id = node_id
                
            # Determine callee ID
            # 1. Is it a function defined locally?
            local_func_id = f"function:{path}:{callee_name}"
            local_class_id = f"class:{path}:{callee_name}"
            
            if local_func_id in node_ids:
                callee_id = local_func_id
            elif local_class_id in node_ids:
                callee_id = local_class_id
            else:
                # It's an external library function
                callee_id = f"external:{callee_name}"
                ext_node = {
                    "id": callee_id,
                    "type": "external",
                    "name": callee_name,
                    "filePath": "",
                    "summary": f"External dependency or library call to {callee_name}.",
                    "complexity": "simple",
                    "tags": ["external", "library"],
                    "languageNotes": "Third-party call imported dynamically or standard library routine."
                }
                add_node(ext_node)
                
            edges.append({
                "source": caller_id,
                "target": callee_id,
                "type": "calls",
                "weight": 0.8,
                "summary": f"Calls {callee_name}.",
                "direction": "forward"
            })

    # Step 2: Create import edges from batchImportData
    batch_import_data = input_data.get("batchImportData", {})
    for src_path, imports in batch_import_data.items():
        src_id, _ = get_node_id_and_type(src_path)
        for imp_path in imports:
            target_id, _ = get_node_id_and_type(imp_path)
            edges.append({
                "source": src_id,
                "target": target_id,
                "type": "imports",
                "weight": 0.7,
                "summary": f"Imports {os.path.basename(imp_path)}.",
                "direction": "forward"
            })
            
    # Step 3: Create special behavioral/semantic edges
    for path in file_map.keys():
        src_id, src_type = get_node_id_and_type(path)
        
        # "tested_by" relations
        if "test_analytics_api.py" in path:
            prod_id, _ = get_node_id_and_type("backend/app/api/v1/analytics.py")
            edges.append({
                "source": prod_id,
                "target": src_id,
                "type": "tested_by",
                "weight": 0.5,
                "summary": "Analytics API endpoints are tested by this suite.",
                "direction": "forward"
            })
        elif "test_settings_api.py" in path:
            prod_id, _ = get_node_id_and_type("backend/app/api/v1/settings.py")
            edges.append({
                "source": prod_id,
                "target": src_id,
                "type": "tested_by",
                "weight": 0.5,
                "summary": "Settings management API is tested by this suite.",
                "direction": "forward"
            })
            
        # "configures" relations
        if "nginx.conf" in path:
            backend_id, _ = get_node_id_and_type("docker/Dockerfile.backend")
            frontend_id, _ = get_node_id_and_type("docker/Dockerfile.frontend")
            edges.append({
                "source": src_id,
                "target": backend_id,
                "type": "configures",
                "weight": 0.6,
                "summary": "Nginx configures reverse proxy routing to the backend service container.",
                "direction": "forward"
            })
            edges.append({
                "source": src_id,
                "target": frontend_id,
                "type": "configures",
                "weight": 0.6,
                "summary": "Nginx configures web serving parameters for the frontend client container.",
                "direction": "forward"
            })
        elif "cookies.json" in path:
            session_id, _ = get_node_id_and_type("backend/app/core/automation/scraper.py")
            edges.append({
                "source": src_id,
                "target": session_id,
                "type": "configures",
                "weight": 0.6,
                "summary": "Injects cookies to configure authenticated scrapers for platform automation.",
                "direction": "forward"
            })
        elif ".understandignore" in path:
            cfg_id, _ = get_node_id_and_type(".understand-anything/intermediate/scan-result.json")
            edges.append({
                "source": src_id,
                "target": cfg_id,
                "type": "configures",
                "weight": 0.6,
                "summary": "Filters out files and folders configured to be ignored by scanner structure scan.",
                "direction": "forward"
            })
        elif "vite.config.ts" in path:
            prod_id, _ = get_node_id_and_type("frontend/src/main.tsx")
            edges.append({
                "source": src_id,
                "target": prod_id,
                "type": "configures",
                "weight": 0.6,
                "summary": "Configures bundling, asset pathways, and development server for Vite client.",
                "direction": "forward"
            })
            
        # "deploys" relations
        if "Dockerfile.backend" in path:
            run_id, _ = get_node_id_and_type("backend/run.py")
            edges.append({
                "source": src_id,
                "target": run_id,
                "type": "deploys",
                "weight": 0.7,
                "summary": "Deploys the backend application via ASGI run command.",
                "direction": "forward"
            })
        elif "Dockerfile.frontend" in path:
            main_id, _ = get_node_id_and_type("frontend/src/main.tsx")
            edges.append({
                "source": src_id,
                "target": main_id,
                "type": "deploys",
                "weight": 0.7,
                "summary": "Deploys the client application web bundle dynamically served by Nginx.",
                "direction": "forward"
            })
            
        # "reads_from" / "writes_to" relations
        if "migrations/versions" in path and path.endswith(".py"):
            db_id, _ = get_node_id_and_type("backend/data/db/careerpilot.db")
            edges.append({
                "source": src_id,
                "target": db_id,
                "type": "writes_to",
                "weight": 0.5,
                "summary": "Alters schema or applies structural modifications to the database.",
                "direction": "forward"
            })
        elif "enable_pgvector.py" in path:
            db_id = "config:backend/scripts/db_postgres"
            pg_node = {
                "id": db_id,
                "type": "config",
                "name": "PostgreSQL Vector Store",
                "filePath": "",
                "summary": "External/Internal PostgreSQL database store holding embeddings.",
                "complexity": "simple",
                "tags": ["database", "postgres", "pgvector"],
                "languageNotes": "External relational DB configured with vector indexing."
            }
            add_node(pg_node)
            edges.append({
                "source": src_id,
                "target": db_id,
                "type": "writes_to",
                "weight": 0.5,
                "summary": "Configures and enables pgvector extension for high-dimensional searches.",
                "direction": "forward"
            })
        elif "test_connection" in path:
            db_id = "config:backend/scripts/db_postgres"
            edges.append({
                "source": src_id,
                "target": db_id,
                "type": "reads_from",
                "weight": 0.5,
                "summary": "Tests connectivity and read access to the PostgreSQL database service.",
                "direction": "forward"
            })
            
    # Write raw output
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    output_data = {
        "nodes": nodes,
        "edges": edges
    }
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2)
    print(f"Successfully generated {output_path}")
