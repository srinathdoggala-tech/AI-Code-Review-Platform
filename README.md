# ReviewGPT: AI Code Review Platform

ReviewGPT is a premium AI-powered Code Review Platform built using **FastAPI**, **React (Vite)**, the **GitHub API**, and the **Gemini API**. It helps developers, students, and code reviewers scan their repositories, calculate code complexity locally using Radon AST analysis, detect security vulnerabilities, find bugs, optimize performance, and get step-by-step refactoring suggestions with visual code diff comparisons. It also features an interactive AI Refactor Assistant chat for on-the-fly inquiries about the codebase.

---

## Key Features

1. **GitHub Repository Scanner**: Scan public repositories out of the box or scan private repositories using a GitHub Personal Access Token (PAT).
2. **Comprehensive Code Analysis**:
   - **Bugs & Logical Flaws**: Detects off-by-one errors, resource leaks, edge cases, and typing problems.
   - **Security Vulnerabilities**: Scans for hardcoded keys/secrets, SQL injections, XSS, and insecure patterns.
   - **Performance Insights**: Recommends loop optimization, memory footprint reduction, and async improvements.
   - **Style & Architecture**: Notes on SOLID principles, DRY guidelines, readability, and design pattern improvements.
3. **Cyclomatic Complexity Calculation**: Performs local Radon-based complexity visits for Python files and heuristics-based checks for other languages.
4. **Interactive Dashboard**:
   - **Overall Health Score**: An automated grade (A-F) based on issue density and scores.
   - **Recursive Directory Explorer**: Interactive side sidebar showing folders and files, marked with warning/error badges.
   - **Code Viewer & Diffs**: Visually reviews files showing line numbers, highlighted issues, and side-by-side original vs. refactored code blocks.
5. **AI Refactor Assistant**: Chatbox to ask questions about specific file implementations and request custom refactoring suggestions.

---

## Tech Stack

- **Backend**: FastAPI, Uvicorn, Python AST, Radon, Pydantic, HTTPX, Google Generative AI (Gemini 1.5 Flash).
- **Frontend**: React (Vite), Lucide Icons, Custom Premium CSS (Modern Dark Mode with glassmorphism).

---

## System Requirements

- **Python**: 3.10+ (Recommended Python 3.12)
- **Node.js**: 18+ (Recommended Node.js 20+)

---

## Getting Started

### 1. Setup Backend

Navigate to the `backend/` directory:
```bash
cd backend
```

Create a virtual environment and activate it:
*Windows (PowerShell):*
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```
*macOS / Linux:*
```bash
python3 -m venv venv
source venv/bin/activate
```

Install python dependencies:
```bash
pip install -r requirements.txt
```

*(Optional)* Create a `.env` file inside `backend/` to configure your default Gemini API key:
```env
GEMINI_API_KEY=AIzaSy...
```
*(If you do not specify it in the backend, you can enter it directly in the frontend interface during scanning.)*

Start the FastAPI application:
```bash
uvicorn main:app --reload
```
The API will run on `http://localhost:8000`.

### 2. Setup Frontend

Navigate to the `frontend/` directory:
```bash
cd frontend
```

Install package dependencies:
```bash
npm install
```

Start the Vite development server:
```bash
npm run dev
```
The React interface will run on `http://localhost:5173`. Open this URL in your browser to begin scanning!

---

## Usage Instructions

1. **Enter Repository URL**: Provide the full URL of the GitHub repository (e.g., `https://github.com/owner/repository`).
2. **Select Options**:
   - Specify a target branch (optional, defaults to the default branch).
   - Paste a GitHub Personal Access Token (PAT) if scanning a private repository.
   - Paste your Gemini API Key if not configured on the backend server.
3. **Execute Scan**: Click the **Run Static & AI Scan** button. An interactive radar loader will stream the progress log.
4. **Explore Code**: Browse the repository file tree. Scanned files will display error/warning badge counts. Click a file to open its source code view, reviews, and refactoring diffs.
5. **AI Chat Assistant**: Select a scanned file and type any question (e.g., "Explain how to fix the security issue on line 12" or "Rewrite this function to be cleaner") in the chat sidebar.
