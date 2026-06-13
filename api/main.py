import os
import asyncio
import logging
from typing import Dict, List, Optional
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl

try:
    from .github_client import GitHubClient
    from .analyzer import CodeAnalyzer
except ImportError:
    from github_client import GitHubClient
    from analyzer import CodeAnalyzer

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="AI Code Review Platform API")

# Enable CORS for frontend local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins in development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models for request validation
class ScanRequest(BaseModel):
    repo_url: str
    branch: Optional[str] = None
    github_token: Optional[str] = None
    gemini_key: Optional[str] = None

class FileScanRequest(BaseModel):
    repo_url: str
    path: str
    branch: str
    github_token: Optional[str] = None
    gemini_key: Optional[str] = None

class ChatRequest(BaseModel):
    repo_url: str
    path: str
    branch: str
    code: str
    question: str
    github_token: Optional[str] = None
    gemini_key: Optional[str] = None

# Helpers
def get_gemini_api_key(request_key: Optional[str]) -> str:
    """Helper to resolve the Gemini API key from request or env."""
    key = request_key or os.environ.get("GEMINI_API_KEY")
    if not key:
        raise HTTPException(
            status_code=400,
            detail="Gemini API Key is missing. Please provide it in the request or configure GEMINI_API_KEY on the server."
        )
    return key

def calculate_repo_grade(avg_score: float) -> str:
    if avg_score >= 90: return "A"
    elif avg_score >= 80: return "B"
    elif avg_score >= 70: return "C"
    elif avg_score >= 60: return "D"
    else: return "F"

@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": "AI Code Review Platform Backend"}

@app.post("/api/scan")
async def scan_repository(payload: ScanRequest):
    try:
        owner, repo = GitHubClient.parse_repo_url(payload.repo_url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Initialize GitHub client
    github = GitHubClient(token=payload.github_token)

    try:
        # Determine branch
        branch = payload.branch
        if not branch:
            branch = await github.get_default_branch(owner, repo)

        logger.info(f"Fetching tree for {owner}/{repo} branch {branch}")
        tree = await github.get_repo_tree(owner, repo, branch)
    except Exception as e:
        logger.error(f"GitHub fetch error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch GitHub repository data: {str(e)}")

    # Filter code files
    code_files = [item for item in tree if item.get("type") == "blob" and github.is_code_file(item.get("path", ""))]
    
    # Sort files by path to have deterministic ordering, prioritizing certain files
    # E.g. main/src files first, test files later, and cap initial reviews to 8 files to save rate limits
    code_files.sort(key=lambda x: (
        "test" in x["path"].lower(),
        x["path"].count("/"),
        x["path"]
    ))

    # Select initial files for analysis (limit to 8 files for quick initial load)
    initial_scan_limit = 8
    files_to_scan = code_files[:initial_scan_limit]
    
    # Resolve Gemini key
    gemini_key = get_gemini_api_key(payload.gemini_key)
    analyzer = CodeAnalyzer(api_key=gemini_key)

    # Scans files concurrently using a semaphore to limit parallel Gemini calls
    semaphore = asyncio.Semaphore(3)
    
    async def scan_single_file_with_sem(file_item):
        async with semaphore:
            path = file_item["path"]
            try:
                content = await github.get_file_content(owner, repo, path, branch)
                # Simple language extraction based on extension
                import os
                _, ext = os.path.splitext(path)
                language = ext[1:] if ext else "plaintext"
                
                analysis = await analyzer.analyze_file(path, content, language)
                # Keep content in response for code viewing
                analysis["content"] = content
                return path, analysis
            except Exception as e:
                logger.error(f"Error scanning {path}: {e}")
                return path, {
                    "file_path": path,
                    "score": 100,
                    "summary": f"Could not analyze file: {str(e)}",
                    "issues": [],
                    "complexity_score": 1,
                    "architecture_notes": "Skipped due to error."
                }

    logger.info(f"Scanning initial {len(files_to_scan)} files out of {len(code_files)} code files...")
    tasks = [scan_single_file_with_sem(f) for f in files_to_scan]
    results = await asyncio.gather(*tasks)
    
    # Build dictionary of analyzed files
    analyzed_files = {}
    for path, analysis in results:
        analyzed_files[path] = analysis

    # Aggregate statistics
    total_issues = 0
    bug_count = 0
    security_count = 0
    performance_count = 0
    style_count = 0
    score_sum = 0
    complexity_sum = 0
    scanned_count = len(analyzed_files)

    for path, analysis in analyzed_files.items():
        score_sum += analysis.get("score", 100)
        complexity_sum += analysis.get("complexity_score", 1)
        for issue in analysis.get("issues", []):
            total_issues += 1
            itype = issue.get("type", "").lower()
            if "bug" in itype: bug_count += 1
            elif "sec" in itype: security_count += 1
            elif "perf" in itype: performance_count += 1
            else: style_count += 1

    avg_score = score_sum / scanned_count if scanned_count > 0 else 100
    avg_complexity = complexity_sum / scanned_count if scanned_count > 0 else 1
    grade = calculate_repo_grade(avg_score)

    return {
        "repo_info": {
            "owner": owner,
            "repo": repo,
            "branch": branch,
            "total_files": len(tree),
            "code_files_count": len(code_files),
        },
        "full_tree": tree, # Send full tree so frontend can build folder explorer
        "scanned_files": list(analyzed_files.keys()), # List of files scanned in this batch
        "file_analyses": analyzed_files,
        "metrics": {
            "grade": grade,
            "score": round(avg_score, 1),
            "complexity": round(avg_complexity, 1),
            "total_issues": total_issues,
            "bugs": bug_count,
            "security": security_count,
            "performance": performance_count,
            "style": style_count,
        }
    }

@app.post("/api/scan-file")
async def scan_file(payload: FileScanRequest):
    """Scan an individual file on demand."""
    try:
        owner, repo = GitHubClient.parse_repo_url(payload.repo_url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    github = GitHubClient(token=payload.github_token)
    gemini_key = get_gemini_api_key(payload.gemini_key)
    analyzer = CodeAnalyzer(api_key=gemini_key)

    try:
        content = await github.get_file_content(owner, repo, payload.path, payload.branch)
        import os
        _, ext = os.path.splitext(payload.path)
        language = ext[1:] if ext else "plaintext"

        analysis = await analyzer.analyze_file(payload.path, content, language)
        analysis["content"] = content
        return analysis
    except Exception as e:
        logger.error(f"Error scanning single file {payload.path}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to scan file: {str(e)}")

@app.post("/api/chat")
async def chat_about_file(payload: ChatRequest):
    """Ask questions about a specific file."""
    gemini_key = get_gemini_api_key(payload.gemini_key)
    analyzer = CodeAnalyzer(api_key=gemini_key)

    try:
        response_text = await analyzer.chat_about_file(
            filepath=payload.path,
            code=payload.code,
            question=payload.question
        )
        return {"response": response_text}
    except Exception as e:
        logger.error(f"Error in chat endpoint for {payload.path}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
