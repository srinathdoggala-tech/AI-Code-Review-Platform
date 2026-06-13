import re
import httpx
from typing import Dict, List, Optional, Tuple

class GitHubClient:
    def __init__(self, token: Optional[str] = None):
        self.headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "AI-Code-Review-Platform"
        }
        if token:
            self.headers["Authorization"] = f"token {token}"
            
    @staticmethod
    def parse_repo_url(url: str) -> Tuple[str, str]:
        """
        Parses owner and repo name from a GitHub URL.
        Accepts formats like:
        - https://github.com/owner/repo
        - https://github.com/owner/repo.git
        - git@github.com:owner/repo.git
        """
        url = url.strip()
        # Remove trailing .git
        if url.endswith(".git"):
            url = url[:-4]
            
        # Regex to match owner and repo
        match = re.search(r"github\.com[:/]([^/]+)/([^/]+)", url)
        if match:
            return match.group(1), match.group(2)
        
        # Fallback for simple owner/repo string
        parts = [p for p in url.split("/") if p]
        if len(parts) >= 2:
            return parts[-2], parts[-1]
            
        raise ValueError("Invalid GitHub URL format")

    async def get_default_branch(self, owner: str, repo: str) -> str:
        """Fetches the default branch name of the repository."""
        url = f"https://api.github.com/repos/{owner}/{repo}"
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=self.headers)
            if response.status_code != 200:
                raise Exception(f"Failed to fetch repo details: {response.text}")
            data = response.json()
            return data.get("default_branch", "main")

    async def get_repo_tree(self, owner: str, repo: str, branch: str) -> List[Dict]:
        """
        Fetches the recursive tree of files in the repository.
        Returns a list of file dictionaries with path, sha, type, size, etc.
        """
        # Get the tree recursively using the branch name or commit sha
        url = f"https://api.github.com/repos/{owner}/{repo}/git/trees/{branch}?recursive=1"
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, headers=self.headers)
            if response.status_code != 200:
                raise Exception(f"Failed to fetch repository tree: {response.text}")
            data = response.json()
            
            # Check if truncated
            if data.get("truncated", False):
                # Just a warning log (we'll return what we have)
                pass
                
            return data.get("tree", [])

    async def get_file_content(self, owner: str, repo: str, path: str, branch: str) -> str:
        """
        Fetches file content. We'll use the raw content URL when possible
        as it handles large files and doesn't exhaust Github API limits as easily.
        """
        # If we have a token, fetching via Contents API ensures auth is sent.
        # Otherwise, raw.githubusercontent.com is faster.
        if "Authorization" in self.headers:
            # Use GitHub API contents endpoint
            url = f"https://api.github.com/repos/{owner}/{repo}/contents/{path}?ref={branch}"
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, headers=self.headers)
                if response.status_code != 200:
                    raise Exception(f"Failed to fetch file content for {path}: {response.text}")
                
                data = response.json()
                # If file is too large or encoded, content API returns base64
                if data.get("encoding") == "base64":
                    import base64
                    content = base64.b64decode(data["content"]).decode("utf-8", errors="replace")
                    return content
                else:
                    raise Exception(f"Unexpected file encoding or format for {path}")
        else:
            # Use raw content API
            url = f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}"
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url)
                if response.status_code != 200:
                    raise Exception(f"Failed to fetch raw file for {path}: {response.text}")
                return response.text

    def is_code_file(self, path: str) -> bool:
        """Determines if a file path is a code file that should be scanned."""
        # Common code extensions
        code_extensions = {
            ".py", ".js", ".jsx", ".ts", ".tsx", ".mjs", 
            ".html", ".css", ".go", ".java", ".kt", 
            ".c", ".cpp", ".h", ".hpp", ".rs", ".rb", 
            ".php", ".cs", ".swift", ".sh", ".sql",
            ".yaml", ".yml", ".json", ".ini", ".conf"
        }
        
        # Directories to ignore
        ignore_dirs = {
            "node_modules", "bower_components", ".git", ".github", 
            "dist", "build", "out", ".next", ".nuxt", 
            "venv", ".venv", "env", "__pycache__",
            "target", "bin", "obj", "vendor"
        }
        
        # Files to ignore (e.g. lockfiles, config outputs)
        ignore_files = {
            "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
            "cargo.lock", "gemfile.lock", "poetry.lock", "composer.lock"
        }
        
        # Check folders
        parts = path.lower().split("/")
        if any(ignored in parts for ignored in ignore_dirs):
            return False
            
        # Check exact file names
        filename = parts[-1]
        if filename in ignore_files:
            return False
            
        # Check extensions
        import os
        ext = os.path.splitext(filename)[1]
        return ext.lower() in code_extensions
