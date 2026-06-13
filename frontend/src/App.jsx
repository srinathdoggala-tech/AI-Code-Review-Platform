import React, { useState, useEffect, useRef } from 'react';
import { 
  Folder, File, Bug, ShieldAlert, Zap, Award, 
  HelpCircle, Search, RefreshCw, Send, ArrowLeft, 
  Download, ChevronRight, ChevronDown, CheckCircle2, 
  FileCode, Terminal, AlertTriangle, Code, LayoutDashboard, Sparkles
} from 'lucide-react';

const API_BASE = 'http://localhost:8000/api';

export default function App() {
  // Navigation / Views: 'landing' | 'scanning' | 'dashboard'
  const [view, setView] = useState('landing');
  
  // Forms & keys
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  
  // Scanning state
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [logs, setLogs] = useState([]);
  
  // Review metrics and tree payload
  const [scanResult, setScanResult] = useState(null);
  
  // Dashboard navigation
  const [activeFile, setActiveFile] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'issues' | 'code' | 'suggestions'
  
  // Interactive Chat State
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  
  // On-demand scanning
  const [onDemandScanning, setOnDemandScanning] = useState({});
  const [expandedFolders, setExpandedFolders] = useState({});
  
  // Refs
  const logsEndRef = useRef(null);
  const chatEndRef = useRef(null);

  // Auto-scroll logs & chats
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  // Handle repository submit
  const handleStartScan = async (e) => {
    e.preventDefault();
    if (!repoUrl) return;

    setView('scanning');
    setLoadingProgress(10);
    setLogs([
      { text: 'Starting repository analyzer...', status: 'active' }
    ]);

    // Simulated progress ticks during api call
    const logTimeline = [
      { text: 'Parsing GitHub repository URL...', progress: 20 },
      { text: 'Authenticating with GitHub...', progress: 30 },
      { text: 'Downloading repository branch metadata...', progress: 45 },
      { text: 'Building repository file tree...', progress: 60 },
      { text: 'Filtering codebase for support source files...', progress: 75 },
      { text: 'Sending files to Gemini API for analysis...', progress: 85 }
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < logTimeline.length) {
        const step = logTimeline[currentStep];
        setLogs(prev => {
          const updated = [...prev];
          updated[updated.length - 1].status = 'completed';
          updated.push({ text: step.text, status: 'active' });
          return updated;
        });
        setLoadingProgress(step.progress);
        currentStep++;
      } else {
        clearInterval(interval);
      }
    }, 800);

    try {
      const response = await fetch(`${API_BASE}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_url: repoUrl,
          branch: branch || null,
          github_token: githubToken || null,
          gemini_key: geminiKey || null
        })
      });

      clearInterval(interval);

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to complete scanning.');
      }

      const result = await response.json();
      setLoadingProgress(100);
      setLogs(prev => {
        const updated = [...prev];
        updated[updated.length - 1].status = 'completed';
        updated.push({ text: 'Scan completed successfully! Loading dashboard...', status: 'completed' });
        return updated;
      });

      // Quick delay to display complete state
      setTimeout(() => {
        setScanResult(result);
        setView('dashboard');
        setActiveFile(null);
        setActiveTab('overview');
      }, 1000);

    } catch (err) {
      clearInterval(interval);
      alert(`Error scanning repository: ${err.message}`);
      setView('landing');
    }
  };

  // On-demand single file scan
  const handleScanSingleFile = async (path) => {
    if (!scanResult) return;
    setOnDemandScanning(prev => ({ ...prev, [path]: true }));

    try {
      const response = await fetch(`${API_BASE}/scan-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_url: repoUrl,
          path: path,
          branch: scanResult.repo_info.branch,
          github_token: githubToken || null,
          gemini_key: geminiKey || null
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to scan file');
      }

      const fileAnalysis = await response.json();
      
      // Update scanResult with new file analysis
      setScanResult(prev => {
        const updatedAnalyses = { ...prev.file_analyses, [path]: fileAnalysis };
        const updatedScanned = [...prev.scanned_files];
        if (!updatedScanned.includes(path)) {
          updatedScanned.push(path);
        }

        // Re-aggregate metrics
        let totalIssues = 0;
        let bugCount = 0;
        let securityCount = 0;
        let performanceCount = 0;
        let styleCount = 0;
        let scoreSum = 0;
        let complexitySum = 0;
        
        Object.keys(updatedAnalyses).forEach(fpath => {
          const analysis = updatedAnalyses[fpath];
          scoreSum += analysis.score || 100;
          complexitySum += analysis.complexity_score || 1;
          (analysis.issues || []).forEach(issue => {
            totalIssues++;
            const itype = (issue.type || '').toLowerCase();
            if (itype.includes('bug')) bugCount++;
            else if (itype.includes('sec')) securityCount++;
            else if (itype.includes('perf')) performanceCount++;
            else styleCount++;
          });
        });

        const scannedCount = Object.keys(updatedAnalyses).length;
        const avgScore = scannedCount > 0 ? scoreSum / scannedCount : 100;
        const avgComplexity = scannedCount > 0 ? complexitySum / scannedCount : 1;
        
        const calculateRepoGrade = (score) => {
          if (score >= 90) return 'A';
          if (score >= 80) return 'B';
          if (score >= 70) return 'C';
          if (score >= 60) return 'D';
          return 'F';
        };

        return {
          ...prev,
          scanned_files: updatedScanned,
          file_analyses: updatedAnalyses,
          metrics: {
            grade: calculateRepoGrade(avgScore),
            score: Math.round(avgScore * 10) / 10,
            complexity: Math.round(avgComplexity * 10) / 10,
            total_issues: totalIssues,
            bugs: bugCount,
            security: securityCount,
            performance: performanceCount,
            style: styleCount
          }
        };
      });

      // Automatically select file and focus code view
      setActiveFile(path);
      setActiveTab('code');
      // Reset chat
      setChatMessages([
        { sender: 'assistant', text: `Hello! I have reviewed ${path.split('/').pop()}. Ask me anything about refactoring, optimization, or security in this file!` }
      ]);
    } catch (err) {
      alert(`Error scanning file ${path}: ${err.message}`);
    } finally {
      setOnDemandScanning(prev => ({ ...prev, [path]: false }));
    }
  };

  // Chat request
  const handleSendChatMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeFile || chatLoading) return;

    const fileReview = scanResult.file_analyses[activeFile];
    if (!fileReview) return;

    const userMessage = chatInput;
    setChatMessages(prev => [...prev, { sender: 'user', text: userMessage }]);
    setChatInput('');
    setChatLoading(true);

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_url: repoUrl,
          path: activeFile,
          branch: scanResult.repo_info.branch,
          code: fileReview.content || '',
          question: userMessage,
          github_token: githubToken || null,
          gemini_key: geminiKey || null
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get answer from AI Assistant');
      }

      const data = await response.json();
      setChatMessages(prev => [...prev, { sender: 'assistant', text: data.response }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { sender: 'assistant', text: `Sorry, I couldn't respond: ${err.message}` }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Expand/collapse folders
  const toggleFolder = (folderName) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderName]: !prev[folderName]
    }));
  };

  // Convert flat paths to recursive tree structure
  const getFileTree = () => {
    if (!scanResult) return [];
    
    const root = { name: "Root", children: {}, type: "tree" };
    scanResult.full_tree.forEach(file => {
      const parts = file.path.split("/");
      let current = root;
      parts.forEach((part, index) => {
        const isLast = index === parts.length - 1;
        if (!current.children[part]) {
          current.children[part] = isLast && file.type === "blob"
            ? { name: part, path: file.path, type: "blob", size: file.size }
            : { name: part, children: {}, type: "tree" };
        }
        current = current.children[part];
      });
    });

    // Sort folders first, then files
    const sortTree = (node) => {
      const keys = Object.keys(node.children);
      keys.sort((a, b) => {
        const nodeA = node.children[a];
        const nodeB = node.children[b];
        if (nodeA.type !== nodeB.type) {
          return nodeA.type === "tree" ? -1 : 1;
        }
        return a.localeCompare(b);
      });
      
      return keys.map(key => {
        const child = node.children[key];
        if (child.type === "tree") {
          return {
            name: key,
            type: "tree",
            children: sortTree(child)
          };
        }
        return child;
      });
    };

    return sortTree(root);
  };

  // Render tree node recursive component
  const renderTreeNodes = (nodes, depth = 0) => {
    return nodes.map((node, i) => {
      const isFolder = node.type === 'tree';
      const pathKey = isFolder ? node.name : node.path;
      const isExpanded = !!expandedFolders[pathKey];
      
      const fileClient = scanResult.file_analyses[node.path];
      const isScanned = !!fileClient;
      
      const bugCount = isScanned ? (fileClient.issues || []).filter(x => (x.type || '').toLowerCase().includes('bug')).length : 0;
      const warnCount = isScanned ? (fileClient.issues || []).filter(x => !(x.type || '').toLowerCase().includes('bug')).length : 0;
      
      if (isFolder) {
        return (
          <div key={i}>
            <div 
              className="tree-node folder" 
              style={{ paddingLeft: `${depth * 0.75 + 0.5}rem` }}
              onClick={() => toggleFolder(pathKey)}
            >
              {isExpanded ? <ChevronDown size={14} className="tree-icon" /> : <ChevronRight size={14} className="tree-icon" />}
              <Folder size={14} className="tree-icon folder" />
              <span className="tree-node-name">{node.name}</span>
            </div>
            {isExpanded && renderTreeNodes(node.children, depth + 1)}
          </div>
        );
      } else {
        const isActive = activeFile === node.path;
        return (
          <div 
            key={i} 
            className={`tree-node file ${isActive ? 'active' : ''}`}
            style={{ paddingLeft: `${depth * 0.75 + 0.5}rem` }}
            onClick={() => {
              if (isScanned) {
                setActiveFile(node.path);
                setActiveTab('code');
                setChatMessages([
                  { sender: 'assistant', text: `Hello! I have reviewed ${node.name}. Ask me anything about refactoring, optimization, or security in this file!` }
                ]);
              }
            }}
          >
            <File size={14} className={`tree-icon file ${isScanned ? 'scanned' : ''}`} />
            <span className="tree-node-name">{node.name}</span>
            
            {isScanned ? (
              <div style={{ display: 'flex', gap: '2px' }}>
                {bugCount > 0 && <span className="tree-badge bug">{bugCount}</span>}
                {warnCount > 0 && <span className="tree-badge warn">{warnCount}</span>}
                {bugCount === 0 && warnCount === 0 && <span className="tree-badge" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}>✓</span>}
              </div>
            ) : (
              <button 
                className="submit-btn" 
                style={{ margin: 0, padding: '0.1rem 0.35rem', fontSize: '0.7rem', width: 'auto', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#a5b4fc', boxShadow: 'none' }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleScanSingleFile(node.path);
                }}
                disabled={onDemandScanning[node.path]}
              >
                {onDemandScanning[node.path] ? <RefreshCw size={10} className="spin" /> : 'Scan'}
              </button>
            )}
          </div>
        );
      }
    });
  };

  // Format code display with issue line annotations
  const renderAnnotatedCode = (code, issues) => {
    if (!code) return <div className="code-display">No code content available.</div>;
    const lines = code.split('\n');
    const issueMap = {};
    
    (issues || []).forEach(issue => {
      const lineStart = issue.line;
      const lineEnd = issue.line_end || lineStart;
      for (let l = lineStart; l <= lineEnd; l++) {
        if (!issueMap[l]) issueMap[l] = [];
        issueMap[l].push(issue);
      }
    });

    return (
      <div className="code-display">
        {lines.map((line, idx) => {
          const lineNum = idx + 1;
          const lineIssues = issueMap[lineNum];
          const hasIssue = !!lineIssues;
          
          return (
            <div key={idx} className={`code-line ${hasIssue ? 'has-issue' : ''}`} title={hasIssue ? lineIssues.map(x => `[${x.type.toUpperCase()}] ${x.title}`).join('\n') : ''}>
              <span className="line-number">{lineNum}</span>
              <span className="line-text">{line}</span>
            </div>
          );
        })}
      </div>
    );
  };

  // Helper for rendering suggestions (diff view)
  const renderSuggestions = (issues) => {
    const suggestions = (issues || []).filter(x => x.suggested_code);
    if (suggestions.length === 0) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <CheckCircle2 size={32} style={{ color: 'var(--color-style)', marginBottom: '0.5rem' }} />
          <p>No major structural code changes suggested for this file.</p>
        </div>
      );
    }

    return (
      <div className="analysis-report-panel">
        <h3 style={{ color: 'white' }}>Refactoring Suggestions</h3>
        {suggestions.map((issue, idx) => (
          <div key={idx} className="issue-card">
            <div className="issue-header">
              <div className="issue-tag-group">
                <span className={`issue-badge ${issue.type.toLowerCase()}`}>{issue.type}</span>
                <span className="issue-line-tag">Lines {issue.line} - {issue.line_end || issue.line}</span>
              </div>
            </div>
            <div className="issue-body">
              <h4 className="issue-title">{issue.title}</h4>
              <p className="issue-desc">{issue.suggestion || issue.description}</p>
              
              <div className="diff-viewer">
                <div className="diff-title">Original (Before)</div>
                <div className="diff-line removed">
                  {issue.original_code}
                </div>
                
                <div className="diff-title" style={{ borderTop: '1px solid var(--border-color)' }}>Suggested Refactoring (After)</div>
                <div className="diff-line added">
                  {issue.suggested_code}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="app-container">
      {/* App Header */}
      <header className="app-header">
        <div className="logo-container" onClick={() => setView('landing')} style={{ cursor: 'pointer' }}>
          <Terminal className="logo-icon" size={24} />
          <span className="logo-text">ReviewGPT</span>
          <span className="logo-badge">Beta</span>
        </div>
        
        {view !== 'landing' && (
          <button className="github-link-btn" onClick={() => setView('landing')}>
            <ArrowLeft size={14} /> Back to Setup
          </button>
        )}
      </header>

      {/* 1. Landing View */}
      {view === 'landing' && (
        <main className="landing-view">
          <section className="hero-section">
            <h1 className="hero-title">
              Instant <span>AI-Powered</span> Code Reviews
            </h1>
            <p className="hero-subtitle">
              Upload your GitHub repository and let AI analyze bugs, security flaws, performance, architecture, and complexity. Receive real-time refactoring suggestions and chat directly with code review experts.
            </p>
          </section>

          <div className="setup-form-card glass">
            <h2 className="form-title">Scan Repository</h2>
            <form onSubmit={handleStartScan}>
              <div className="form-group">
                <label>GitHub Repository URL *</label>
                <div className="input-wrapper">
                  <Search className="input-icon" size={16} />
                  <input 
                    type="url" 
                    placeholder="https://github.com/owner/repo"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    required
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Branch (Optional)</label>
                  <div className="input-wrapper">
                    <FileCode className="input-icon" size={16} />
                    <input 
                      type="text" 
                      placeholder="e.g. main"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>GitHub Token (Optional)</label>
                  <div className="input-wrapper">
                    <ShieldAlert className="input-icon" size={16} />
                    <input 
                      type="password" 
                      placeholder="For private repos"
                      value={githubToken}
                      onChange={(e) => setGithubToken(e.target.value)}
                      className="form-input"
                    />
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>Gemini API Key (Optional)</label>
                <div className="input-wrapper">
                  <Sparkles className="input-icon" size={16} style={{ color: 'var(--accent-cyan)' }} />
                  <input 
                    type="password" 
                    placeholder="Provide custom API key or use server default"
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <button type="submit" className="submit-btn">
                <RefreshCw size={18} /> Run Static & AI Scan
              </button>
            </form>
          </div>

          <div className="feature-grid">
            <div className="feature-card glass">
              <div className="feature-icon-wrapper">
                <Bug size={20} />
              </div>
              <h3>Bug Spotting</h3>
              <p>Finds logic errors, boundary exceptions, and race conditions before production.</p>
            </div>
            <div className="feature-card glass">
              <div className="feature-icon-wrapper" style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--color-security)' }}>
                <ShieldAlert size={20} />
              </div>
              <h3>Security Audits</h3>
              <p>Detects hardcoded keys, SQL injections, XSS, and dangerous API calls.</p>
            </div>
            <div className="feature-card glass">
              <div className="feature-icon-wrapper" style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-perf)' }}>
                <Zap size={20} />
              </div>
              <h3>Radon Complexity</h3>
              <p>Measures cyclomatic complexity values using Radon AST parsing metrics.</p>
            </div>
            <div className="feature-card glass">
              <div className="feature-icon-wrapper" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-style)' }}>
                <Award size={20} />
              </div>
              <h3>AI Refactor Diffs</h3>
              <p>View side-by-side modifications to make your logic cleaner and SOLID compliant.</p>
            </div>
          </div>
        </main>
      )}

      {/* 2. Scanning / Loading View */}
      {view === 'scanning' && (
        <main className="scanner-view">
          <div className="scanner-box glass">
            <div className="radar-spinner">
              <div className="radar-circle"></div>
              <div className="radar-glow"></div>
            </div>
            <h2 className="scan-status-title">Reviewing Repository</h2>
            
            <div className="progress-bar-container">
              <div className="progress-bar-fill" style={{ width: `${loadingProgress}%` }}></div>
            </div>
            
            <div className="progress-logs">
              {logs.map((log, index) => (
                <div key={index} className={`log-item ${log.status}`}>
                  {log.status === 'completed' && <span style={{ color: 'var(--color-style)' }}>✓</span>}
                  {log.status === 'active' && <RefreshCw size={12} className="spin" style={{ color: 'var(--accent-cyan)' }} />}
                  <span>{log.text}</span>
                </div>
              ))}
              <div ref={logsEndRef}></div>
            </div>
          </div>
        </main>
      )}

      {/* 3. Dashboard View */}
      {view === 'dashboard' && scanResult && (
        <main className="dashboard-view">
          {/* Subheader */}
          <div className="summary-bar">
            <div className="repo-meta">
              <span className="repo-badge">{scanResult.repo_info.owner} / {scanResult.repo_info.repo}</span>
              <span className="repo-branch">
                <FileCode size={14} /> {scanResult.repo_info.branch}
              </span>
            </div>
            <div className="repo-stats-summary">
              <span className="stat-summary-pill" style={{ color: 'var(--color-bug)' }}>
                <Bug size={14} /> {scanResult.metrics.bugs} Bugs
              </span>
              <span className="stat-summary-pill" style={{ color: 'var(--color-security)' }}>
                <ShieldAlert size={14} /> {scanResult.metrics.security} Security
              </span>
              <span className="stat-summary-pill" style={{ color: 'var(--color-perf)' }}>
                <Zap size={14} /> {scanResult.metrics.performance} Perf
              </span>
              <span className="stat-summary-pill" style={{ color: 'var(--color-style)' }}>
                <Award size={14} /> {scanResult.metrics.style} Style
              </span>
            </div>
          </div>

          {/* Grid Content */}
          <div className="dashboard-grid">
            {/* Left Tree Explorer */}
            <aside className="file-tree-sidebar">
              <h3 className="sidebar-title">
                Files 
                <span style={{ fontSize: '0.75rem', textTransform: 'none', fontWeight: 'normal' }}>
                  ({scanResult.scanned_files.length} / {scanResult.repo_info.code_files_count} analyzed)
                </span>
              </h3>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {renderTreeNodes(getFileTree())}
              </div>
            </aside>

            {/* Central Workspace */}
            <section className="workspace-container">
              {/* Tab Navigation */}
              <div className="workspace-tabs">
                <button 
                  className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveFile(null);
                    setActiveTab('overview');
                  }}
                >
                  <LayoutDashboard size={14} /> Repository Overview
                </button>
                {activeFile && (
                  <>
                    <button 
                      className={`tab-btn ${activeTab === 'code' ? 'active' : ''}`}
                      onClick={() => setActiveTab('code')}
                    >
                      <Code size={14} /> Source Code
                    </button>
                    <button 
                      className={`tab-btn ${activeTab === 'issues' ? 'active' : ''}`}
                      onClick={() => setActiveTab('issues')}
                    >
                      <AlertTriangle size={14} /> Issues ({ (scanResult.file_analyses[activeFile]?.issues || []).length })
                    </button>
                    <button 
                      className={`tab-btn ${activeTab === 'suggestions' ? 'active' : ''}`}
                      onClick={() => setActiveTab('suggestions')}
                    >
                      <Sparkles size={14} /> Code Suggestions
                    </button>
                  </>
                )}
              </div>

              {/* Tab Content Display */}
              <div style={{ flex: 1, overflow: 'hidden' }}>
                {/* A. Overview Dashboard */}
                {activeTab === 'overview' && (
                  <div className="overview-panel">
                    <div className="overview-header">
                      <h2 className="overview-title">Code Health Summary</h2>
                      <p style={{ color: 'var(--text-muted)' }}>Aggregated findings from all scanned repository code files.</p>
                    </div>

                    <div className="metrics-section">
                      <div className="grade-card glass">
                        <div className="grade-letter">{scanResult.metrics.grade}</div>
                        <div className="grade-label">Health Score: {scanResult.metrics.score}/100</div>
                      </div>
                      
                      <div className="metrics-grid">
                        <div className="metric-card glass bugs">
                          <div className="metric-header">
                            <span>Detected Bugs</span>
                            <Bug size={16} />
                          </div>
                          <div className="metric-value">{scanResult.metrics.bugs}</div>
                        </div>
                        <div className="metric-card glass security">
                          <div className="metric-header">
                            <span>Security Issues</span>
                            <ShieldAlert size={16} />
                          </div>
                          <div className="metric-value">{scanResult.metrics.security}</div>
                        </div>
                        <div className="metric-card glass performance">
                          <div className="metric-header">
                            <span>Performance Issues</span>
                            <Zap size={16} />
                          </div>
                          <div className="metric-value">{scanResult.metrics.performance}</div>
                        </div>
                        <div className="metric-card glass style">
                          <div className="metric-header">
                            <span>Code Quality & Style</span>
                            <Award size={16} />
                          </div>
                          <div className="metric-value">{scanResult.metrics.style}</div>
                        </div>
                      </div>
                    </div>

                    <h3 style={{ color: 'white', marginBottom: '1rem' }}>Scanned Code Files Overview</h3>
                    <div className="glass" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', fontWeight: 600 }}>
                        <span>File Path</span>
                        <div style={{ display: 'flex', gap: '2rem' }}>
                          <span>Complexity</span>
                          <span>File Score</span>
                        </div>
                      </div>
                      
                      {scanResult.scanned_files.map((fpath, idx) => {
                        const file = scanResult.file_analyses[fpath];
                        return (
                          <div 
                            key={idx} 
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem', cursor: 'pointer' }}
                            onClick={() => {
                              setActiveFile(fpath);
                              setActiveTab('code');
                            }}
                          >
                            <span style={{ color: 'var(--primary)', textDecoration: 'underline' }}>{fpath}</span>
                            <div style={{ display: 'flex', gap: '3rem', alignItems: 'center' }}>
                              <span style={{ fontFamily: 'var(--font-mono)' }}>{file.complexity_score}</span>
                              <span 
                                className={`tree-badge`} 
                                style={{ 
                                  background: file.score >= 80 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                                  color: file.score >= 80 ? '#10b981' : '#f43f5e'
                                }}
                              >
                                {file.score}/100
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* B. Specific File Details */}
                {activeFile && scanResult.file_analyses[activeFile] && (
                  <div style={{ height: '100%', overflow: 'hidden' }}>
                    
                    {/* B.1. Code View */}
                    {activeTab === 'code' && (
                      <div className="file-view-container">
                        <div className="code-viewer-panel">
                          <div className="panel-header">
                            <span>{activeFile.split('/').pop()}</span>
                            <span className="score-badge-large">Health: {scanResult.file_analyses[activeFile].score}/100</span>
                          </div>
                          {renderAnnotatedCode(scanResult.file_analyses[activeFile].content, scanResult.file_analyses[activeFile].issues)}
                        </div>

                        {/* File summary on the right side of Code View */}
                        <div className="analysis-report-panel">
                          <h3 style={{ color: 'white' }}>File Review Summary</h3>
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                            {scanResult.file_analyses[activeFile].summary}
                          </p>

                          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                            <div className="glass" style={{ padding: '0.75rem 1.25rem', display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.85rem' }}>
                              <Zap size={14} style={{ color: 'var(--color-perf)' }} />
                              <span>Complexity: <strong>{scanResult.file_analyses[activeFile].complexity_score}</strong></span>
                            </div>
                          </div>

                          <h4 style={{ color: 'white', marginTop: '1rem' }}>Code architecture</h4>
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.45 }}>
                            {scanResult.file_analyses[activeFile].architecture_notes}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* B.2. Issues List */}
                    {activeTab === 'issues' && (
                      <div className="analysis-report-panel">
                        <div className="analysis-file-header">
                          <h2 style={{ color: 'white' }}>Issues in {activeFile.split('/').pop()}</h2>
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Lines highlighted red in the Code view represent code segments mapped here.</p>
                        </div>
                        
                        {(scanResult.file_analyses[activeFile].issues || []).length === 0 ? (
                          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <CheckCircle2 size={40} style={{ color: 'var(--color-style)', marginBottom: '1rem' }} />
                            <h3>No Issues Detected!</h3>
                            <p style={{ marginTop: '0.5rem' }}>This file follows good development practices and design patterns.</p>
                          </div>
                        ) : (
                          (scanResult.file_analyses[activeFile].issues || []).map((issue, idx) => (
                            <div key={idx} className="issue-card">
                              <div className="issue-header">
                                <div className="issue-tag-group">
                                  <span className={`issue-badge ${issue.type.toLowerCase()}`}>{issue.type}</span>
                                  <span className={`issue-badge ${issue.severity.toLowerCase()}`}>{issue.severity}</span>
                                </div>
                                <span className="issue-line-tag">Line {issue.line}</span>
                              </div>
                              <div className="issue-body">
                                <h4 className="issue-title">{issue.title}</h4>
                                <p className="issue-desc">{issue.description}</p>
                                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                                  <span style={{ color: 'white', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Recommendation:</span>
                                  <span style={{ color: 'var(--text-muted)' }}>{issue.suggestion}</span>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {/* B.3. Code Refactoring / Suggestions */}
                    {activeTab === 'suggestions' && renderSuggestions(scanResult.file_analyses[activeFile].issues)}
                  </div>
                )}
              </div>
            </section>

            {/* Right Assistant Panel */}
            <aside className="ai-chat-sidebar">
              <div className="chat-header">
                <Sparkles size={16} style={{ color: 'var(--accent-cyan)' }} />
                <span>AI Refactor Assistant</span>
              </div>

              {activeFile ? (
                <>
                  <div className="chat-messages">
                    {chatMessages.map((msg, index) => (
                      <div key={index} className={`chat-msg ${msg.sender}`}>
                        {msg.text}
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="chat-msg assistant" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <RefreshCw size={12} className="spin" /> Thinking...
                      </div>
                    )}
                    <div ref={chatEndRef}></div>
                  </div>
                  <form className="chat-input-area" onSubmit={handleSendChatMessage}>
                    <input 
                      type="text" 
                      placeholder="Ask about this code..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      disabled={chatLoading}
                      className="chat-input"
                    />
                    <button type="submit" className="chat-send-btn" disabled={chatLoading || !chatInput.trim()}>
                      <Send size={14} />
                    </button>
                  </form>
                </>
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <HelpCircle size={32} style={{ marginBottom: '1rem' }} />
                  <h4>No File Selected</h4>
                  <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>Select a file from the sidebar to activate the AI Refactor Assistant chat.</p>
                </div>
              )}
            </aside>
          </div>
        </main>
      )}
    </div>
  );
}
