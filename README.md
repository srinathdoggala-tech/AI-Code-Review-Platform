# ReviewGPT: AI Code Review Platform (Vercel-Ready)

ReviewGPT is a premium AI-powered code review dashboard utilizing **FastAPI**, **React (Vite)**, the **GitHub API**, and the **Gemini API**. It helps developers, students, and reviewers scan public/private repos, calculate cyclomatic complexity, audit security vulnerabilities, and get refactoring code diffs.

This repository is pre-configured and structured for **instant deployment to Vercel** using **Vercel Serverless Functions (Python)** and static frontend hosting.

---

## Screenshots

| Landing Page | Scanning Progress |
| :---: | :---: |
| ![Landing Page](screenshots/landing-page.png) | ![Scanning Progress](screenshots/scanning.png) |

| Dashboard Overview | File Analysis & Suggestions |
| :---: | :---: |
| ![Dashboard Overview](screenshots/dashboard.png) | ![File Analysis](screenshots/file-analysis.png) |

| AI Refactor Assistant Chat |
| :---: |
| ![AI Assistant](screenshots/assistant.png) |

---

## Restructured Layout

- `/src` & `/public`: React components, styles, and assets (moved to project root).
- `/api`: FastAPI backend files, including serverless routes (`main.py`), complexity checkers (`analyzer.py`), and the Vercel entrypoint (`index.py`).
- `vercel.json`: Handles rewrites mapping `/api/*` endpoints to the serverless function `/api/index.py`.

---

## Vercel Deployment Guide

Deploying ReviewGPT on Vercel takes just a few clicks:

1. **Import Repository**: Log in to Vercel, click **Add New** > **Project**, and import your `AI-Code-Review-Platform` repository.
2. **Environment Variables**: In the Vercel project configuration, add your default Gemini API key as an environment variable (optional, as users can also input it on the landing page):
   - Key: `GEMINI_API_KEY`
   - Value: `YOUR_GEMINI_API_KEY`
3. **Deploy**: Click **Deploy**. Vercel will automatically:
   - Identify the React application at the root and build it using `npm run build`.
   - Identify the `/api` folder, install Python dependencies from `/api/requirements.txt`, and compile the Python serverless functions.
   - Serve your frontend and route `/api/*` requests seamlessly!

---

## Local Development Setup

You can still run and develop this project locally on your machine:

### 1. Run the FastAPI Backend

Navigate to the `api/` directory:
```bash
cd api
```

Set up a virtual environment and install backend requirements:
*Windows (PowerShell):*
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```
*macOS / Linux:*
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Launch the FastAPI dev server (from inside the `api/` folder):
```bash
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```
*The backend will run on `http://127.0.0.1:8000`.*

---

### 2. Run the React Frontend

Open a new terminal at the **project root** directory:

Install npm packages:
```bash
npm install
```

Start the Vite development server:
```bash
npm run dev
```
*The frontend will run on `http://localhost:5173`. Open this URL in your browser to start scanning!*
