import { useState, useEffect, useRef, useCallback } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const MONACO_CDN = "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs";

const DEFAULT_FILES = {
  "index.html": {
    content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>My App</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <div class="container">
    <h1>Hello, World! 👋</h1>
    <p>Edit this file to get started.</p>
    <button onclick="greet()">Click me</button>
  </div>
  <script src="app.js"></script>
</body>
</html>`,
    language: "html",
  },
  "style.css": {
    content: `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.container {
  background: white;
  padding: 2rem 3rem;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  text-align: center;
}

h1 {
  font-size: 2.5rem;
  color: #333;
  margin-bottom: 0.5rem;
}

p {
  color: #666;
  margin-bottom: 1.5rem;
}

button {
  background: #667eea;
  color: white;
  border: none;
  padding: 0.75rem 2rem;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

button:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(102,126,234,0.5);
}`,
    language: "css",
  },
  "app.js": {
    content: `function greet() {
  const names = ['Developer', 'Coder', 'Creator', 'Builder'];
  const name = names[Math.floor(Math.random() * names.length)];
  alert(\`Hello, \${name}! 🚀\`);
}

console.log('App loaded successfully!');`,
    language: "javascript",
  },
  "notes.py": {
    content: `# Python Example
def fibonacci(n):
    """Generate Fibonacci sequence up to n terms."""
    a, b = 0, 1
    result = []
    for _ in range(n):
        result.append(a)
        a, b = b, a + b
    return result

def main():
    n = 10
    fib = fibonacci(n)
    print(f"First {n} Fibonacci numbers:")
    print(fib)
    
    # Find even numbers
    evens = [x for x in fib if x % 2 == 0]
    print(f"Even numbers: {evens}")

if __name__ == "__main__":
    main()`,
    language: "python",
  },
};

const LANG_MAP = {
  html: "html", css: "css", js: "javascript", jsx: "javascript",
  ts: "typescript", tsx: "typescript", py: "python", c: "c",
  cpp: "cpp", json: "json", md: "markdown", txt: "plaintext",
};

const LANG_ICONS = {
  html: { icon: "◈", color: "#e34c26" },
  css: { icon: "◉", color: "#264de4" },
  javascript: { icon: "⬡", color: "#f7df1e" },
  typescript: { icon: "⬡", color: "#3178c6" },
  python: { icon: "◆", color: "#3776ab" },
  c: { icon: "◇", color: "#a8b9cc" },
  cpp: { icon: "◇", color: "#00599c" },
  json: { icon: "❴❵", color: "#fbc02d" },
  markdown: { icon: "M↓", color: "#083fa1" },
  plaintext: { icon: "∷", color: "#9e9e9e" },
};

const getLanguage = (filename) => {
  const ext = filename.split(".").pop()?.toLowerCase() || "txt";
  return LANG_MAP[ext] || "plaintext";
};

const getLangMeta = (lang) => LANG_ICONS[lang] || LANG_ICONS.plaintext;

const getFileIcon = (filename) => {
  const lang = getLanguage(filename);
  const meta = getLangMeta(lang);
  return { icon: meta.icon, color: meta.color };
};

// ─── Terminal Simulator ───────────────────────────────────────────────────────
const TerminalSimulator = ({ files, onFileChange, theme }) => {
  const [history, setHistory] = useState([
    { type: "system", text: "WebIDE Terminal v1.0.0 — Type 'help' for commands" },
    { type: "system", text: "─".repeat(52) },
  ]);
  const [input, setInput] = useState("");
  const [cmdHistory, setCmdHistory] = useState([]);
  const [cmdIdx, setCmdIdx] = useState(-1);
  const [cwd, setCwd] = useState("/workspace");
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [history]);

  const addLine = (text, type = "output") =>
    setHistory(h => [...h, { type, text }]);

  const COMMANDS = {
    help: () => {
      addLine("Available commands:", "info");
      [
        "  ls              — list files",
        "  cat <file>      — show file content",
        "  touch <file>    — create new file",
        "  echo <text>     — print text",
        "  clear           — clear terminal",
        "  pwd             — print working directory",
        "  node <file.js>  — simulate JS execution",
        "  python <file>   — simulate Python info",
        "  date            — show current date/time",
        "  whoami          — show current user",
      ].forEach(l => addLine(l));
    },
    ls: () => {
      const fileList = Object.keys(files);
      if (fileList.length === 0) { addLine("(empty directory)"); return; }
      fileList.forEach(f => {
        const lang = getLanguage(f);
        const meta = getLangMeta(lang);
        addLine(`  ${meta.icon}  ${f}`, "file");
      });
    },
    pwd: () => addLine(cwd),
    date: () => addLine(new Date().toString()),
    whoami: () => addLine("developer@webide"),
    clear: () => setHistory([{ type: "system", text: "Terminal cleared. Type 'help' for commands." }]),
    echo: (args) => addLine(args.join(" ")),
    cat: (args) => {
      if (!args[0]) { addLine("Usage: cat <filename>", "error"); return; }
      const file = files[args[0]];
      if (!file) { addLine(`cat: ${args[0]}: No such file`, "error"); return; }
      addLine(`--- ${args[0]} ---`, "info");
      file.content.split("\n").slice(0, 30).forEach(l => addLine(l));
      if (file.content.split("\n").length > 30) addLine("... (truncated)", "info");
    },
    touch: (args) => {
      if (!args[0]) { addLine("Usage: touch <filename>", "error"); return; }
      if (files[args[0]]) { addLine(`touch: ${args[0]} already exists`, "error"); return; }
      onFileChange(args[0], { content: "", language: getLanguage(args[0]) });
      addLine(`Created: ${args[0]}`, "success");
    },
    node: (args) => {
      if (!args[0]) { addLine("Usage: node <file.js>", "error"); return; }
      const file = files[args[0]];
      if (!file) { addLine(`node: Cannot find '${args[0]}'`, "error"); return; }
      addLine(`> node ${args[0]}`, "info");
      try {
        const logs = [];
        const mockConsole = { log: (...a) => logs.push(a.join(" ")), error: (...a) => logs.push("Error: " + a.join(" ")) };
        const fn = new Function("console", file.content);
        fn(mockConsole);
        logs.forEach(l => addLine(l, "success"));
        if (logs.length === 0) addLine("(no output)", "info");
      } catch (e) {
        addLine(`Error: ${e.message}`, "error");
      }
    },
    python: (args) => {
      if (!args[0]) { addLine("Usage: python <file.py>", "error"); return; }
      addLine(`ℹ Python execution requires a backend server.`, "info");
      addLine(`  File '${args[0]}' queued for execution.`, "info");
      addLine(`  Connect a Python backend to run .py files.`, "info");
    },
  };

  const runCommand = (raw) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    addLine(`${cwd} $ ${trimmed}`, "prompt");
    setCmdHistory(h => [trimmed, ...h]);
    setCmdIdx(-1);
    const [cmd, ...args] = trimmed.split(/\s+/);
    if (COMMANDS[cmd]) COMMANDS[cmd](args);
    else addLine(`command not found: ${cmd}. Try 'help'.`, "error");
  };

  const handleKey = (e) => {
    if (e.key === "Enter") { runCommand(input); setInput(""); }
    else if (e.key === "ArrowUp") {
      const idx = Math.min(cmdIdx + 1, cmdHistory.length - 1);
      setCmdIdx(idx);
      setInput(cmdHistory[idx] || "");
    } else if (e.key === "ArrowDown") {
      const idx = Math.max(cmdIdx - 1, -1);
      setCmdIdx(idx);
      setInput(idx === -1 ? "" : cmdHistory[idx]);
    }
  };

  const bg = theme === "dark" ? "#0d1117" : "#1e1e1e";
  const colors = { system: "#6a9955", info: "#569cd6", error: "#f44747", success: "#4ec9b0", prompt: "#dcdcaa", file: "#9cdcfe", output: "#d4d4d4" };

  return (
    <div style={{ background: bg, height: "100%", display: "flex", flexDirection: "column", fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: "13px" }}>
      <div style={{ padding: "6px 12px", background: theme === "dark" ? "#161b22" : "#252526", borderBottom: "1px solid #333", color: "#8b949e", fontSize: "11px", display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ color: "#4ec9b0" }}>▶</span> TERMINAL
        <span style={{ marginLeft: "auto", color: "#444" }}>bash — /workspace</span>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "12px 16px" }} onClick={() => inputRef.current?.focus()}>
        {history.map((line, i) => (
          <div key={i} style={{ color: colors[line.type] || colors.output, lineHeight: "1.7", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            {line.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: "flex", alignItems: "center", padding: "8px 16px", borderTop: "1px solid #333", gap: "8px" }}>
        <span style={{ color: "#4ec9b0", fontSize: "12px" }}>{cwd} $</span>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#d4d4d4", fontFamily: "inherit", fontSize: "13px" }}
          autoFocus
          spellCheck={false}
          placeholder="type a command..."
        />
      </div>
    </div>
  );
};

// ─── Live Preview ─────────────────────────────────────────────────────────────
const LivePreview = ({ files }) => {
  const iframeRef = useRef(null);

  useEffect(() => {
    const html = files["index.html"]?.content || "";
    const css = files["style.css"]?.content || "";
    const js = files["app.js"]?.content || "";

    const combined = html
      .replace("</head>", `<style>${css}</style></head>`)
      .replace("</body>", `<script>${js}</script></body>`);

    const doc = iframeRef.current?.contentDocument;
    if (doc) { doc.open(); doc.write(combined); doc.close(); }
  }, [files]);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#fff" }}>
      <div style={{ padding: "6px 12px", background: "#252526", borderBottom: "1px solid #333", color: "#8b949e", fontSize: "11px", display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ color: "#569cd6" }}>◈</span> LIVE PREVIEW
        <div style={{ marginLeft: "auto", display: "flex", gap: "6px" }}>
          {["🔴", "🟡", "🟢"].map((c, i) => <span key={i} style={{ fontSize: "10px" }}>{c}</span>)}
        </div>
      </div>
      <iframe ref={iframeRef} style={{ flex: 1, border: "none", width: "100%" }} title="preview" sandbox="allow-scripts allow-same-origin" />
    </div>
  );
};

// ─── Monaco Loader Hook ───────────────────────────────────────────────────────
const useMonaco = () => {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (window.monaco) { setReady(true); return; }
    const script = document.createElement("script");
    script.src = `${MONACO_CDN}/loader.js`;
    script.onload = () => {
      window.require.config({ paths: { vs: MONACO_CDN } });
      window.require(["vs/editor/editor.main"], () => setReady(true));
    };
    document.head.appendChild(script);
  }, []);
  return ready;
};

// ─── Monaco Editor Component ──────────────────────────────────────────────────
const MonacoEditorPane = ({ content, language, theme, onChange, readOnly = false }) => {
  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const modelRef = useRef(null);
  const monacoReady = useMonaco();

  useEffect(() => {
    if (!monacoReady || !containerRef.current) return;
    const monaco = window.monaco;

    monaco.editor.defineTheme("webide-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6a9955", fontStyle: "italic" },
        { token: "keyword", foreground: "c586c0" },
        { token: "string", foreground: "ce9178" },
        { token: "number", foreground: "b5cea8" },
        { token: "type", foreground: "4ec9b0" },
      ],
      colors: {
        "editor.background": "#0d1117",
        "editor.foreground": "#c9d1d9",
        "editorLineNumber.foreground": "#30363d",
        "editorLineNumber.activeForeground": "#8b949e",
        "editor.selectionBackground": "#264f78",
        "editor.lineHighlightBackground": "#161b22",
        "editorCursor.foreground": "#58a6ff",
        "editor.findMatchBackground": "#f6cc5740",
        "editorWidget.background": "#161b22",
        "editorSuggestWidget.background": "#161b22",
        "editorSuggestWidget.border": "#30363d",
        "editorSuggestWidget.selectedBackground": "#264f78",
      },
    });

    monaco.editor.defineTheme("webide-light", {
      base: "vs",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#ffffff",
        "editor.lineHighlightBackground": "#f6f8fa",
        "editorLineNumber.foreground": "#bbb",
        "editorLineNumber.activeForeground": "#555",
      },
    });

    modelRef.current = monaco.editor.createModel(content, language);
    editorRef.current = monaco.editor.create(containerRef.current, {
      model: modelRef.current,
      theme: theme === "dark" ? "webide-dark" : "webide-light",
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      fontLigatures: true,
      lineNumbers: "on",
      minimap: { enabled: true, scale: 1 },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 2,
      insertSpaces: true,
      wordWrap: "on",
      renderWhitespace: "selection",
      bracketPairColorization: { enabled: true },
      guides: { bracketPairs: true, indentation: true },
      smoothScrolling: true,
      cursorBlinking: "phase",
      cursorSmoothCaretAnimation: "on",
      suggest: { showKeywords: true, showSnippets: true },
      quickSuggestions: { other: true, comments: false, strings: false },
      readOnly,
      padding: { top: 16, bottom: 16 },
    });

    editorRef.current.onDidChangeModelContent(() => {
      onChange?.(editorRef.current.getValue());
    });

    return () => { editorRef.current?.dispose(); modelRef.current?.dispose(); };
  }, [monacoReady]);

  // Update content when file changes
  useEffect(() => {
    if (!editorRef.current || !window.monaco) return;
    const current = editorRef.current.getValue();
    if (current !== content) {
      const pos = editorRef.current.getPosition();
      editorRef.current.setValue(content);
      if (pos) editorRef.current.setPosition(pos);
    }
  }, [content]);

  // Update language
  useEffect(() => {
    if (!modelRef.current || !window.monaco) return;
    window.monaco.editor.setModelLanguage(modelRef.current, language);
  }, [language]);

  // Update theme
  useEffect(() => {
    if (!window.monaco) return;
    window.monaco.editor.setTheme(theme === "dark" ? "webide-dark" : "webide-light");
  }, [theme]);

  if (!monacoReady) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: "12px", background: theme === "dark" ? "#0d1117" : "#fff", color: "#8b949e" }}>
        <div style={{ width: "32px", height: "32px", border: "2px solid #58a6ff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <span style={{ fontSize: "13px" }}>Loading Monaco Editor…</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
};

// ─── JS Output Runner ─────────────────────────────────────────────────────────
const JSRunner = ({ content, theme }) => {
  const [output, setOutput] = useState([]);
  const [ran, setRan] = useState(false);

  const run = () => {
    const logs = [];
    const mockConsole = {
      log: (...a) => logs.push({ type: "log", text: a.map(x => typeof x === "object" ? JSON.stringify(x, null, 2) : String(x)).join(" ") }),
      error: (...a) => logs.push({ type: "error", text: "Error: " + a.join(" ") }),
      warn: (...a) => logs.push({ type: "warn", text: "⚠ " + a.join(" ") }),
      info: (...a) => logs.push({ type: "info", text: "ℹ " + a.join(" ") }),
    };
    try {
      const fn = new Function("console", content);
      fn(mockConsole);
      if (logs.length === 0) logs.push({ type: "info", text: "(script ran with no output)" });
    } catch (e) {
      logs.push({ type: "error", text: e.toString() });
    }
    setOutput(logs);
    setRan(true);
  };

  const colors = { log: "#d4d4d4", error: "#f44747", warn: "#dcdcaa", info: "#569cd6" };
  const bg = theme === "dark" ? "#0d1117" : "#1e1e1e";

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: bg }}>
      <div style={{ padding: "8px 16px", background: theme === "dark" ? "#161b22" : "#252526", borderBottom: "1px solid #333", display: "flex", alignItems: "center", gap: "8px" }}>
        <button onClick={run} style={{ background: "#238636", border: "none", color: "white", padding: "4px 14px", borderRadius: "4px", cursor: "pointer", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px", fontFamily: "inherit" }}>
          ▶ Run
        </button>
        {ran && <button onClick={() => { setOutput([]); setRan(false); }} style={{ background: "transparent", border: "1px solid #30363d", color: "#8b949e", padding: "4px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>Clear</button>}
        <span style={{ color: "#8b949e", fontSize: "11px", marginLeft: "auto" }}>JavaScript Console</span>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: "12px 16px", fontFamily: "'JetBrains Mono', monospace", fontSize: "13px" }}>
        {!ran && <div style={{ color: "#444", fontStyle: "italic" }}>Click ▶ Run to execute your JavaScript…</div>}
        {output.map((line, i) => (
          <div key={i} style={{ color: colors[line.type], lineHeight: "1.8", whiteSpace: "pre-wrap", borderBottom: "1px solid #1a1a1a", paddingBottom: "2px" }}>
            {line.text}
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Main IDE Component ───────────────────────────────────────────────────────
export default function WebIDE() {
  const [files, setFiles] = useState(DEFAULT_FILES);
  const [openTabs, setOpenTabs] = useState(["index.html", "style.css", "app.js"]);
  const [activeTab, setActiveTab] = useState("index.html");
  const [theme, setTheme] = useState("dark");
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [bottomHeight, setBottomHeight] = useState(220);
  const [bottomPanel, setBottomPanel] = useState("terminal"); // terminal | preview | output
  const [showBottomPanel, setShowBottomPanel] = useState(true);
  const [renaming, setRenaming] = useState(null);
  const [newFileName, setNewFileName] = useState("");
  const [creatingFile, setCreatingFile] = useState(false);
  const [newFileInput, setNewFileInput] = useState("");
  const [explorerExpanded, setExplorerExpanded] = useState(true);
  const [saveIndicator, setSaveIndicator] = useState({});
  const [contextMenu, setContextMenu] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const autoSaveTimers = useRef({});

  const isDark = theme === "dark";
  const colors = {
    bg: isDark ? "#0d1117" : "#f6f8fa",
    sidebar: isDark ? "#010409" : "#f0f0f0",
    sidebarBorder: isDark ? "#21262d" : "#d0d7de",
    tabBar: isDark ? "#0d1117" : "#f3f3f3",
    tabActive: isDark ? "#161b22" : "#ffffff",
    tabBorder: isDark ? "#21262d" : "#e1e4e8",
    text: isDark ? "#c9d1d9" : "#24292f",
    textMuted: isDark ? "#8b949e" : "#57606a",
    accent: "#58a6ff",
    hover: isDark ? "#161b22" : "#e8f0fe",
    activeLine: isDark ? "#161b22" : "#f0f6ff",
    statusBar: isDark ? "#238636" : "#0969da",
    input: isDark ? "#161b22" : "#ffffff",
    inputBorder: isDark ? "#30363d" : "#d0d7de",
    headerBg: isDark ? "#010409" : "#24292f",
  };

  // Auto-save
  const handleContentChange = useCallback((filename, newContent) => {
    clearTimeout(autoSaveTimers.current[filename]);
    setFiles(prev => ({ ...prev, [filename]: { ...prev[filename], content: newContent } }));
    setSaveIndicator(prev => ({ ...prev, [filename]: "saving" }));
    autoSaveTimers.current[filename] = setTimeout(() => {
      setSaveIndicator(prev => ({ ...prev, [filename]: "saved" }));
      setTimeout(() => setSaveIndicator(prev => { const n = { ...prev }; delete n[filename]; return n; }), 1500);
    }, 800);
  }, []);

  // File Operations
  const openFile = (name) => {
    if (!openTabs.includes(name)) setOpenTabs(t => [...t, name]);
    setActiveTab(name);
  };

  const closeTab = (name, e) => {
    e?.stopPropagation();
    const idx = openTabs.indexOf(name);
    const newTabs = openTabs.filter(t => t !== name);
    setOpenTabs(newTabs);
    if (activeTab === name) setActiveTab(newTabs[Math.max(0, idx - 1)] || newTabs[0] || "");
  };

  const createFile = () => {
    if (!newFileInput.trim()) { setCreatingFile(false); return; }
    const name = newFileInput.trim();
    if (files[name]) { alert(`File '${name}' already exists.`); return; }
    const lang = getLanguage(name);
    setFiles(prev => ({ ...prev, [name]: { content: "", language: lang } }));
    setCreatingFile(false);
    setNewFileInput("");
    openFile(name);
  };

  const deleteFile = (name) => {
    if (!confirm(`Delete '${name}'?`)) return;
    setFiles(prev => { const n = { ...prev }; delete n[name]; return n; });
    setOpenTabs(t => t.filter(x => x !== name));
    if (activeTab === name) setActiveTab(openTabs.filter(x => x !== name)[0] || "");
  };

  const renameFile = (oldName, newName) => {
    if (!newName || newName === oldName) { setRenaming(null); return; }
    if (files[newName]) { alert("File already exists."); return; }
    setFiles(prev => {
      const n = { ...prev };
      n[newName] = { ...n[oldName], language: getLanguage(newName) };
      delete n[oldName];
      return n;
    });
    setOpenTabs(t => t.map(x => x === oldName ? newName : x));
    if (activeTab === oldName) setActiveTab(newName);
    setRenaming(null);
  };

  const downloadZip = async () => {
    // Simple download — create a text dump since JSZip isn't available
    const content = Object.entries(files)
      .map(([name, f]) => `// === ${name} ===\n${f.content}`)
      .join("\n\n");
    const blob = new Blob([content], { type: "text/plain" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "project-files.txt"; a.click();
  };

  const activeFile = files[activeTab];
  const activeLang = activeFile?.language || "plaintext";

  const filteredFiles = searchQuery
    ? Object.keys(files).filter(f => f.toLowerCase().includes(searchQuery.toLowerCase()))
    : Object.keys(files);

  // Determine which bottom panel makes sense
  const isHTML = activeTab === "index.html" || activeLang === "html";
  const isJS = activeLang === "javascript";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: colors.bg, color: colors.text, fontFamily: "'Segoe UI', system-ui, sans-serif", overflow: "hidden" }}>

      {/* ── Title Bar ── */}
      <div style={{ background: colors.headerBg, display: "flex", alignItems: "center", padding: "0 16px", height: "38px", borderBottom: `1px solid ${colors.sidebarBorder}`, gap: "12px", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: "6px" }}>
          {["#ff5f57", "#febc2e", "#28c840"].map((c, i) => (
            <div key={i} style={{ width: "12px", height: "12px", borderRadius: "50%", background: c, cursor: "pointer" }} />
          ))}
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "#8b949e", fontSize: "12px", letterSpacing: "0.05em" }}>
            ⬡ WebIDE — {activeTab || "No file open"}
          </span>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}
            style={{ background: "transparent", border: "1px solid #30363d", color: "#8b949e", padding: "3px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "11px" }}>
            {isDark ? "☀ Light" : "🌙 Dark"}
          </button>
          <button onClick={downloadZip}
            style={{ background: "#238636", border: "none", color: "white", padding: "3px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "11px" }}>
            ↓ Export
          </button>
        </div>
      </div>

      {/* ── Main Layout ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ── Activity Bar ── */}
        <div style={{ width: "44px", background: colors.headerBg, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "8px", gap: "4px", borderRight: `1px solid ${colors.sidebarBorder}`, flexShrink: 0 }}>
          {[
            { icon: "⊞", title: "Explorer", action: () => setExplorerExpanded(e => !e) },
            { icon: "⊘", title: "Search", action: () => setShowSearch(s => !s) },
            { icon: "⊙", title: "Terminal", action: () => { setShowBottomPanel(true); setBottomPanel("terminal"); } },
            { icon: "⊛", title: "Preview", action: () => { setShowBottomPanel(true); setBottomPanel("preview"); } },
          ].map(({ icon, title, action }) => (
            <button key={title} title={title} onClick={action}
              style={{ width: "36px", height: "36px", background: "transparent", border: "none", color: "#8b949e", cursor: "pointer", borderRadius: "6px", fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
              onMouseEnter={e => { e.target.style.background = "#21262d"; e.target.style.color = "#c9d1d9"; }}
              onMouseLeave={e => { e.target.style.background = "transparent"; e.target.style.color = "#8b949e"; }}>
              {icon}
            </button>
          ))}
        </div>

        {/* ── Sidebar ── */}
        <div style={{ width: explorerExpanded ? `${sidebarWidth}px` : "0", background: colors.sidebar, borderRight: `1px solid ${colors.sidebarBorder}`, display: "flex", flexDirection: "column", overflow: "hidden", transition: "width 0.2s", flexShrink: 0 }}>
          <div style={{ padding: "8px 12px 4px", fontSize: "10px", color: colors.textMuted, fontWeight: "700", letterSpacing: "0.1em", textTransform: "uppercase", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            EXPLORER
            <button onClick={() => setCreatingFile(true)}
              style={{ background: "transparent", border: "none", color: colors.textMuted, cursor: "pointer", fontSize: "16px", padding: "0 2px", lineHeight: 1 }}
              title="New File">+</button>
          </div>

          {showSearch && (
            <div style={{ padding: "0 8px 8px" }}>
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search files…"
                style={{ width: "100%", background: colors.input, border: `1px solid ${colors.inputBorder}`, color: colors.text, padding: "4px 8px", borderRadius: "4px", fontSize: "12px", outline: "none", boxSizing: "border-box" }} />
            </div>
          )}

          <div style={{ flex: 1, overflow: "auto" }}>
            <div style={{ padding: "4px 8px 2px", fontSize: "11px", color: colors.textMuted, fontWeight: 600 }}>📁 /workspace</div>
            {filteredFiles.map(name => {
              const { icon, color } = getFileIcon(name);
              const isActive = activeTab === name;
              const isOpen = openTabs.includes(name);
              return (
                <div key={name}
                  onContextMenu={e => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, file: name }); }}
                  onClick={() => openFile(name)}
                  style={{ display: "flex", alignItems: "center", padding: "4px 8px 4px 20px", cursor: "pointer", background: isActive ? colors.activeLine : "transparent", borderLeft: isActive ? `2px solid ${colors.accent}` : "2px solid transparent", gap: "6px", transition: "background 0.1s" }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = colors.hover; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
                  {renaming === name ? (
                    <input autoFocus defaultValue={name}
                      onBlur={e => renameFile(name, e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") renameFile(name, e.target.value); if (e.key === "Escape") setRenaming(null); }}
                      onClick={e => e.stopPropagation()}
                      style={{ background: colors.input, border: `1px solid ${colors.accent}`, color: colors.text, padding: "2px 4px", borderRadius: "3px", fontSize: "12px", outline: "none", width: "100%" }} />
                  ) : (
                    <>
                      <span style={{ color, fontSize: "12px", fontFamily: "monospace" }}>{icon}</span>
                      <span style={{ fontSize: "13px", flex: 1, color: isOpen ? colors.text : colors.textMuted, fontWeight: isActive ? 500 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                      {saveIndicator[name] && (
                        <span style={{ fontSize: "9px", color: saveIndicator[name] === "saved" ? "#3fb950" : "#f7cc45" }}>
                          {saveIndicator[name] === "saved" ? "✓" : "●"}
                        </span>
                      )}
                    </>
                  )}
                </div>
              );
            })}

            {creatingFile && (
              <div style={{ padding: "4px 8px 4px 20px" }}>
                <input autoFocus value={newFileInput}
                  onChange={e => setNewFileInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") createFile(); if (e.key === "Escape") { setCreatingFile(false); setNewFileInput(""); } }}
                  onBlur={createFile}
                  placeholder="filename.js"
                  style={{ background: colors.input, border: `1px solid ${colors.accent}`, color: colors.text, padding: "3px 6px", borderRadius: "4px", fontSize: "12px", outline: "none", width: "100%", boxSizing: "border-box" }} />
              </div>
            )}
          </div>

          <div style={{ padding: "8px", borderTop: `1px solid ${colors.sidebarBorder}`, fontSize: "11px", color: colors.textMuted }}>
            {Object.keys(files).length} files
          </div>
        </div>

        {/* ── Editor + Bottom Panel ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Tab Bar */}
          <div style={{ background: colors.tabBar, borderBottom: `1px solid ${colors.tabBorder}`, display: "flex", alignItems: "center", overflowX: "auto", flexShrink: 0, scrollbarWidth: "none" }}>
            {openTabs.map(tab => {
              const { icon, color } = getFileIcon(tab);
              const isActive = tab === activeTab;
              return (
                <div key={tab} onClick={() => setActiveTab(tab)}
                  style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", cursor: "pointer", borderRight: `1px solid ${colors.tabBorder}`, background: isActive ? colors.tabActive : "transparent", borderBottom: isActive ? `2px solid ${colors.accent}` : "2px solid transparent", minWidth: "100px", maxWidth: "180px", flexShrink: 0, transition: "background 0.1s" }}>
                  <span style={{ color, fontSize: "11px" }}>{icon}</span>
                  <span style={{ fontSize: "12px", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: isActive ? colors.text : colors.textMuted }}>
                    {saveIndicator[tab] === "saving" ? <span style={{ color: "#f7cc45" }}>●</span> : null} {tab}
                  </span>
                  <span onClick={e => closeTab(tab, e)}
                    style={{ color: colors.textMuted, fontSize: "14px", lineHeight: 1, padding: "0 2px", borderRadius: "3px", opacity: 0.6 }}
                    onMouseEnter={e => { e.target.style.opacity = 1; e.target.style.color = "#f44747"; }}
                    onMouseLeave={e => { e.target.style.opacity = 0.6; e.target.style.color = colors.textMuted; }}>
                    ×
                  </span>
                </div>
              );
            })}
            {openTabs.length === 0 && (
              <div style={{ padding: "8px 16px", fontSize: "12px", color: colors.textMuted, fontStyle: "italic" }}>
                No files open — click a file to open it
              </div>
            )}
          </div>

          {/* Editor Area */}
          <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
            {activeFile ? (
              <MonacoEditorPane
                key={activeTab}
                content={activeFile.content}
                language={activeFile.language}
                theme={theme}
                onChange={v => handleContentChange(activeTab, v)}
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: colors.textMuted, gap: "12px" }}>
                <div style={{ fontSize: "48px", opacity: 0.3 }}>⬡</div>
                <div style={{ fontSize: "18px", fontWeight: 600, color: colors.text }}>WebIDE</div>
                <div style={{ fontSize: "13px" }}>Open a file from the explorer to start editing</div>
                <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                  {Object.keys(files).slice(0, 3).map(f => (
                    <button key={f} onClick={() => openFile(f)}
                      style={{ background: colors.hover, border: `1px solid ${colors.inputBorder}`, color: colors.text, padding: "6px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Bottom Panel */}
          {showBottomPanel && (
            <div style={{ height: `${bottomHeight}px`, borderTop: `1px solid ${colors.tabBorder}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
              {/* Panel Tab Bar */}
              <div style={{ background: colors.tabBar, display: "flex", alignItems: "center", borderBottom: `1px solid ${colors.tabBorder}`, flexShrink: 0, padding: "0 8px", gap: "2px" }}>
                {[
                  { id: "terminal", label: "⊙ TERMINAL" },
                  { id: "preview", label: "◈ PREVIEW" },
                  { id: "output", label: "▶ OUTPUT" },
                ].map(({ id, label }) => (
                  <button key={id} onClick={() => setBottomPanel(id)}
                    style={{ background: "transparent", border: "none", borderBottom: bottomPanel === id ? `2px solid ${colors.accent}` : "2px solid transparent", color: bottomPanel === id ? colors.text : colors.textMuted, padding: "6px 12px", cursor: "pointer", fontSize: "11px", fontFamily: "inherit", fontWeight: bottomPanel === id ? 600 : 400, transition: "all 0.15s" }}>
                    {label}
                  </button>
                ))}
                <div style={{ marginLeft: "auto", display: "flex", gap: "4px" }}>
                  <button onClick={() => setBottomHeight(h => Math.max(120, h - 60))}
                    style={{ background: "transparent", border: "none", color: colors.textMuted, cursor: "pointer", fontSize: "16px", padding: "0 4px" }} title="Shrink">−</button>
                  <button onClick={() => setBottomHeight(h => Math.min(500, h + 60))}
                    style={{ background: "transparent", border: "none", color: colors.textMuted, cursor: "pointer", fontSize: "16px", padding: "0 4px" }} title="Grow">+</button>
                  <button onClick={() => setShowBottomPanel(false)}
                    style={{ background: "transparent", border: "none", color: colors.textMuted, cursor: "pointer", fontSize: "16px", padding: "0 4px" }} title="Close">×</button>
                </div>
              </div>

              {/* Panel Content */}
              <div style={{ flex: 1, overflow: "hidden" }}>
                {bottomPanel === "terminal" && (
                  <TerminalSimulator
                    files={files}
                    onFileChange={(name, data) => setFiles(prev => ({ ...prev, [name]: data }))}
                    theme={theme}
                  />
                )}
                {bottomPanel === "preview" && <LivePreview files={files} />}
                {bottomPanel === "output" && (
                  <JSRunner content={activeFile?.content || ""} theme={theme} />
                )}
              </div>
            </div>
          )}

          {!showBottomPanel && (
            <div style={{ borderTop: `1px solid ${colors.tabBorder}`, padding: "4px 12px", display: "flex", gap: "8px" }}>
              {[["⊙", "terminal"], ["◈", "preview"], ["▶", "output"]].map(([icon, id]) => (
                <button key={id} onClick={() => { setShowBottomPanel(true); setBottomPanel(id); }}
                  style={{ background: "transparent", border: "none", color: colors.textMuted, cursor: "pointer", fontSize: "13px", padding: "2px 6px", borderRadius: "3px" }}>
                  {icon}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Status Bar ── */}
      <div style={{ background: colors.statusBar, display: "flex", alignItems: "center", padding: "0 16px", height: "22px", gap: "16px", fontSize: "11px", color: "rgba(255,255,255,0.85)", flexShrink: 0 }}>
        <span>⬡ WebIDE</span>
        <span>|</span>
        <span>{activeLang.toUpperCase()}</span>
        {activeFile && <span>| {activeFile.content.split("\n").length} lines</span>}
        {saveIndicator[activeTab] && (
          <span style={{ color: saveIndicator[activeTab] === "saved" ? "#7ee787" : "#f7cc45" }}>
            {saveIndicator[activeTab] === "saved" ? "✓ Saved" : "● Saving…"}
          </span>
        )}
        <span style={{ marginLeft: "auto" }}>UTF-8  |  {theme === "dark" ? "🌙 Dark" : "☀ Light"}  |  Tab Size: 2</span>
      </div>

      {/* ── Context Menu ── */}
      {contextMenu && (
        <>
          <div onClick={() => setContextMenu(null)} style={{ position: "fixed", inset: 0, zIndex: 998 }} />
          <div style={{ position: "fixed", left: contextMenu.x, top: contextMenu.y, background: isDark ? "#161b22" : "#ffffff", border: `1px solid ${colors.inputBorder}`, borderRadius: "6px", zIndex: 999, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", overflow: "hidden", minWidth: "160px" }}>
            {[
              { label: "Open File", action: () => { openFile(contextMenu.file); setContextMenu(null); } },
              { label: "Rename", action: () => { setRenaming(contextMenu.file); setContextMenu(null); } },
              { label: "Delete", action: () => { deleteFile(contextMenu.file); setContextMenu(null); }, danger: true },
            ].map(({ label, action, danger }) => (
              <div key={label} onClick={action}
                style={{ padding: "8px 14px", cursor: "pointer", fontSize: "13px", color: danger ? "#f44747" : colors.text, transition: "background 0.1s" }}
                onMouseEnter={e => { e.currentTarget.style.background = colors.hover; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                {label}
              </div>
            ))}
          </div>
        </>
      )}

      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #30363d; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #58a6ff; }
      `}</style>
    </div>
  );
}
