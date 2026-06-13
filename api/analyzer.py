import json
import logging
import google.generativeai as genai
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

class CodeAnalyzer:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key
        if api_key:
            genai.configure(api_key=api_key)

    def calculate_cyclomatic_complexity(self, code: str, filepath: str) -> Optional[int]:
        """
        Calculates cyclomatic complexity. For Python files, uses the radon library (if available)
        or fallback regex counting. For other files, returns None (will let Gemini estimate).
        """
        if not filepath.endswith(".py"):
            return self._fallback_complexity(code, filepath)
            
        try:
            from radon.complexity import cc_visit
            results = cc_visit(code)
            if not results:
                return 1
            # Return max complexity of any block in the file
            return max(block.complexity for block in results)
        except ImportError:
            # Fallback to manual AST/regex parsing if radon is not installed
            return self._fallback_complexity(code, filepath)
        except Exception as e:
            logger.error(f"Error calculating radon complexity: {e}")
            return self._fallback_complexity(code, filepath)

    def _fallback_complexity(self, code: str, filepath: str) -> int:
        """
        Simple heuristic for cyclomatic complexity: count control flow structures.
        Base complexity is 1. We add 1 for each:
        if, elif, for, while, except, catch, &&, ||, and, or, ? (ternary).
        """
        complexity = 1
        # Quick token-like counting
        tokens = [
            r"\bif\b", r"\belif\b", r"\bfor\b", r"\bwhile\b", r"\bexcept\b",
            r"\bcatch\b", r"&&", r"\|\|", r"\band\b", r"\bor\b", r"\?"
        ]
        
        # We search case insensitively
        import re
        for token in tokens:
            matches = re.findall(token, code, re.IGNORECASE)
            complexity += len(matches)
            
        return min(complexity, 50) # Cap it at 50 for safety

    async def analyze_file(self, filepath: str, code: str, language: str) -> Dict:
        """
        Calls Gemini to perform a code review analysis of the provided file content.
        Uses structured JSON response format.
        """
        # Truncate very long files to avoid token limits
        max_chars = 40000  # roughly 10k tokens
        if len(code) > max_chars:
            code = code[:max_chars] + "\n\n... [File content truncated due to size limit] ..."

        # Calculate local complexity if possible
        local_complexity = self.calculate_cyclomatic_complexity(code, filepath)

        prompt = f"""
Analyze the following code file and perform a thorough code review.
File Path: {filepath}
Language: {language}

You must review this code in detail for:
1. **Bugs & Logical Errors**: Edge cases, null pointer dereferences, incorrect conditional logic, resource leaks.
2. **Security Vulnerabilities**: Hardcoded API keys/secrets, SQL injection, Cross-Site Scripting (XSS), command injections, insecure dependencies, bad cryptography.
3. **Performance Issues**: Inefficient loops, duplicate operations, excessive memory allocation, missing indices, synchronous blockages.
4. **Style & Architecture**: Code readability, SOLID principles, design pattern issues, bad naming conventions.
5. **Refactoring Suggestions**: Suggest cleaner, more performant, and more modern code patterns.

For every issue found, specify the line number, severity (high, medium, low), type (bug, security, performance, style), description, suggestion, and provide the original vs suggested code snippet.

Your output must be a single valid JSON object. Do not wrap it in markdown code blocks like ```json ... ```. Just return raw JSON matching the following JSON schema:
{{
  "file_path": "{filepath}",
  "score": 90, // A score out of 100, where 100 is perfect and < 60 is poor
  "summary": "Brief 2-3 sentence summary of findings.",
  "complexity_score": {local_complexity or "null"} // If null, estimate the cyclomatic complexity here as an integer.
  "issues": [
    {{
      "type": "bug" | "security" | "performance" | "style",
      "severity": "high" | "medium" | "low",
      "line": 15, // 1-indexed starting line number of the issue
      "line_end": 18, // 1-indexed ending line number of the issue
      "title": "Short title describing the issue",
      "description": "Explanation of the issue and why it is problematic.",
      "suggestion": "Explanation of how to resolve the issue.",
      "original_code": "exact lines of code causing the issue",
      "suggested_code": "corrected drop-in code snippet to fix the issue"
    }}
  ],
  "architecture_notes": "General feedback on the file's overall design, cohesion, and architecture."
}}

Here is the code to analyze:
---
{code}
---
"""

        try:
            # Check model name and initialize
            # Use gemini-1.5-flash for speed and reliability, supports JSON outputs
            model = genai.GenerativeModel("gemini-2.5-flash")
            
            response = await model.generate_content_async(
                prompt,
                generation_config={
                    "response_mime_type": "application/json"
                }
            )
            
            # Parse the response text
            result = json.loads(response.text)
            
            # Validate essential fields
            if "score" not in result:
                result["score"] = 100 if not result.get("issues") else 80
            if "issues" not in result:
                result["issues"] = []
            if "complexity_score" not in result or result["complexity_score"] is None:
                result["complexity_score"] = local_complexity or 1
                
            return result
            
        except Exception as e:
            logger.error(f"Error during Gemini analysis of {filepath}: {e}")
            # Fallback response in case of error
            return {
                "file_path": filepath,
                "score": 0,
                "summary": f"Could not complete AI review for this file due to error: {str(e)}",
                "complexity_score": local_complexity or 1,
                "issues": [
                    {
                        "type": "security",
                        "severity": "high",
                        "line": 1,
                        "title": "AI Review Failed",
                        "description": f"The Gemini API call failed for this file: {str(e)}",
                        "suggestion": "Please check your Gemini API key, network connection, or API quota. Ensure you provided a valid key in the setup form or server environment variable.",
                        "original_code": "",
                        "suggested_code": ""
                    }
                ],
                "architecture_notes": "Analysis failed."
            }

    async def chat_about_file(self, filepath: str, code: str, question: str, previous_reviews: Optional[List[Dict]] = None) -> str:
        """
        Allows the user to chat with Gemini about a specific file or request custom refactoring.
        """
        context_prompt = f"""
You are an expert code reviewer assistant. You are helping a developer review and refactor their code.
File: {filepath}

Code:
---
{code}
---

"""
        if previous_reviews:
            context_prompt += f"Here is the code review summary we generated earlier: \n{json.dumps(previous_reviews, indent=2)}\n\n"

        context_prompt += f"Developer Question:\n{question}\n\nProvide a clear, expert explanation and any code suggestions needed."

        try:
            model = genai.GenerativeModel("gemini-2.5-flash")
            response = await model.generate_content_async(context_prompt)
            return response.text
        except Exception as e:
            logger.error(f"Error in chat assistant for {filepath}: {e}")
            return f"Error connecting to AI Assistant: {str(e)}"
