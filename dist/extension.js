"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);

// src/commands/previewComponent.ts
var vscode2 = __toESM(require("vscode"));
var path4 = __toESM(require("path"));

// src/parser/previewExtractor.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
async function extractPreviewConfig(filePath) {
  const content = await fs.promises.readFile(filePath, "utf-8");
  const defaultExportName = extractDefaultExportName(content);
  const namedExportName = extractNamedExportName(content);
  const isDefaultExport = defaultExportName !== null;
  const componentName = defaultExportName || namedExportName || path.basename(filePath, path.extname(filePath));
  const inlinePreview = parsePreviewExport(content);
  if (inlinePreview) {
    return {
      states: inlinePreview,
      componentPath: filePath,
      componentName,
      isDefaultExport
    };
  }
  const previewFilePath = findColocatedPreviewFile(filePath);
  if (previewFilePath) {
    const previewContent = await fs.promises.readFile(previewFilePath, "utf-8");
    const previewStates = parsePreviewExport(previewContent);
    if (previewStates) {
      return {
        states: previewStates,
        componentPath: filePath,
        componentName,
        isDefaultExport
      };
    }
  }
  return null;
}
function parsePreviewExport(content) {
  const previewRegex = /export\s+const\s+preview\s*(?::\s*[^=]+)?\s*=\s*(\{[\s\S]*?\n\});?/;
  const match = content.match(previewRegex);
  if (!match) {
    return null;
  }
  try {
    const previewObjectStr = match[1];
    return parsePreviewObject(previewObjectStr);
  } catch {
    return null;
  }
}
function parsePreviewObject(objectStr) {
  const states = [];
  const inner = objectStr.slice(1, -1).trim();
  let depth = 0;
  let currentKey = "";
  let currentValue = "";
  let inKey = true;
  let inString = false;
  let stringChar = "";
  for (let i = 0; i < inner.length; i++) {
    const char = inner[i];
    const prevChar = i > 0 ? inner[i - 1] : "";
    if ((char === '"' || char === "'" || char === "`") && prevChar !== "\\") {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
    }
    if (!inString) {
      if (char === "{" || char === "[" || char === "(") {
        depth++;
      } else if (char === "}" || char === "]" || char === ")") {
        depth--;
      }
      if (depth === 0 && char === ":" && inKey) {
        inKey = false;
        continue;
      }
      if (depth === 0 && char === ",") {
        if (currentKey.trim() && currentValue.trim()) {
          states.push({
            name: currentKey.trim(),
            props: safeParseProps(currentValue.trim())
          });
        }
        currentKey = "";
        currentValue = "";
        inKey = true;
        continue;
      }
    }
    if (inKey) {
      currentKey += char;
    } else {
      currentValue += char;
    }
  }
  if (currentKey.trim() && currentValue.trim()) {
    states.push({
      name: currentKey.trim(),
      props: safeParseProps(currentValue.trim())
    });
  }
  return states;
}
function safeParseProps(propsStr) {
  if (propsStr.startsWith("{") && propsStr.endsWith("}")) {
    const inner = propsStr.slice(1, -1).trim();
    const props = {};
    const propRegex = /(\w+)\s*:\s*([^,]+?)(?:,|$)/g;
    let propMatch;
    while ((propMatch = propRegex.exec(inner)) !== null) {
      const key = propMatch[1];
      const value = propMatch[2].trim();
      props[key] = parseValue(value);
    }
    return props;
  }
  return { __raw: propsStr };
}
function parseValue(valueStr) {
  const trimmed = valueStr.trim();
  if (trimmed === "true") {
    return true;
  }
  if (trimmed === "false") {
    return false;
  }
  if (trimmed === "null") {
    return null;
  }
  if (trimmed === "undefined") {
    return void 0;
  }
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return parseFloat(trimmed);
  }
  if (trimmed.startsWith('"') && trimmed.endsWith('"') || trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1);
  }
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed;
  }
  return trimmed;
}
function extractDefaultExportName(content) {
  const funcMatch = content.match(/export\s+default\s+function\s+(\w+)/);
  if (funcMatch) {
    return funcMatch[1];
  }
  const directMatch = content.match(/export\s+default\s+(\w+)/);
  if (directMatch) {
    return directMatch[1];
  }
  const constExportMatch = content.match(/const\s+(\w+)\s*=[\s\S]*?export\s+default\s+\1/);
  if (constExportMatch) {
    return constExportMatch[1];
  }
  return null;
}
function extractNamedExportName(content) {
  const funcMatch = content.match(/export\s+function\s+([A-Z]\w*)/);
  if (funcMatch) {
    return funcMatch[1];
  }
  const constMatch = content.match(/export\s+const\s+([A-Z]\w*)\s*[=:]/);
  if (constMatch && constMatch[1] !== "Preview") {
    return constMatch[1];
  }
  const exportListMatch = content.match(/export\s*\{([^}]+)\}/g);
  if (exportListMatch) {
    for (const exportList of exportListMatch) {
      const names = exportList.match(/\{([^}]+)\}/)?.[1];
      if (names) {
        const exportedNames = names.split(",").map((n) => n.trim().split(/\s+as\s+/)[0].trim());
        for (const name of exportedNames) {
          if (/^[A-Z][a-zA-Z0-9]*$/.test(name) && name !== "Preview" && !name.toLowerCase().includes("variant")) {
            return name;
          }
        }
      }
    }
  }
  const funcDefMatch = content.match(/function\s+([A-Z][a-zA-Z0-9]*)\s*\(/);
  if (funcDefMatch && funcDefMatch[1] !== "Preview") {
    const name = funcDefMatch[1];
    if (new RegExp(`export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}`).test(content)) {
      return name;
    }
  }
  return null;
}
function findColocatedPreviewFile(componentPath) {
  const dir = path.dirname(componentPath);
  const baseName = path.basename(componentPath, path.extname(componentPath));
  const possiblePaths = [
    path.join(dir, `${baseName}.preview.ts`),
    path.join(dir, `${baseName}.preview.tsx`),
    path.join(dir, `${baseName}.preview.js`),
    path.join(dir, `${baseName}.preview.jsx`)
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

// src/parser/componentDetector.ts
var fs2 = __toESM(require("fs"));
var path2 = __toESM(require("path"));
async function detectComponent(filePath) {
  const ext = path2.extname(filePath);
  if (![".tsx", ".jsx", ".ts", ".js"].includes(ext)) {
    return null;
  }
  if (filePath.includes(".preview.")) {
    return null;
  }
  if (!fs2.existsSync(filePath)) {
    return null;
  }
  const content = await fs2.promises.readFile(filePath, "utf-8");
  if (!isReactComponent(content)) {
    return null;
  }
  const hasInlinePreview = hasPreviewExport(content);
  const previewPath = findPreviewFile(filePath);
  if (!hasInlinePreview && !previewPath) {
    return null;
  }
  return {
    componentPath: filePath,
    previewPath,
    hasInlinePreview
  };
}
function isReactComponent(content) {
  const hasReactImport = /import\s+(?:React|\{[^}]*\})\s+from\s+['"]react['"]/.test(content);
  const hasJSX = /<\w+[\s>]/.test(content);
  const hasCreateElement = /React\.createElement/.test(content);
  const hasComponentExport = /export\s+(?:default\s+)?(?:function|const|class)\s+\w+/.test(content);
  return (hasReactImport || hasJSX || hasCreateElement) && hasComponentExport;
}
function hasPreviewExport(content) {
  return /export\s+const\s+preview\s*(?::\s*[^=]+)?\s*=/.test(content);
}
function findPreviewFile(componentPath) {
  const dir = path2.dirname(componentPath);
  const ext = path2.extname(componentPath);
  const baseName = path2.basename(componentPath, ext);
  const extensions = [".ts", ".tsx", ".js", ".jsx"];
  for (const previewExt of extensions) {
    const previewPath = path2.join(dir, `${baseName}.preview${previewExt}`);
    if (fs2.existsSync(previewPath)) {
      return previewPath;
    }
  }
  return null;
}

// src/webview/PreviewPanel.ts
var vscode = __toESM(require("vscode"));

// src/webview/webviewContent.ts
function generateWebviewContent(options) {
  const { bundledCode, componentName, stateNames, cspSource, nonce } = options;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline' https://cdn.tailwindcss.com; script-src 'nonce-${nonce}' https://cdn.tailwindcss.com; img-src ${cspSource} data: https:;">
  <title>Preview: ${escapeHtml(componentName)}</title>
  <script src="https://cdn.tailwindcss.com" nonce="${nonce}"></script>
  <script nonce="${nonce}">
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            border: 'hsl(var(--border, 220 13% 91%))',
            input: 'hsl(var(--input, 220 13% 91%))',
            ring: 'hsl(var(--ring, 224 71% 45%))',
            background: 'hsl(var(--background, 0 0% 100%))',
            foreground: 'hsl(var(--foreground, 224 71% 4%))',
            primary: {
              DEFAULT: 'hsl(var(--primary, 224 71% 45%))',
              foreground: 'hsl(var(--primary-foreground, 0 0% 100%))',
            },
            secondary: {
              DEFAULT: 'hsl(var(--secondary, 220 14% 96%))',
              foreground: 'hsl(var(--secondary-foreground, 224 71% 4%))',
            },
            destructive: {
              DEFAULT: 'hsl(var(--destructive, 0 84% 60%))',
              foreground: 'hsl(var(--destructive-foreground, 0 0% 100%))',
            },
            muted: {
              DEFAULT: 'hsl(var(--muted, 220 14% 96%))',
              foreground: 'hsl(var(--muted-foreground, 220 9% 46%))',
            },
            accent: {
              DEFAULT: 'hsl(var(--accent, 220 14% 96%))',
              foreground: 'hsl(var(--accent-foreground, 224 71% 4%))',
            },
          },
          borderRadius: {
            lg: 'var(--radius, 0.5rem)',
            md: 'calc(var(--radius, 0.5rem) - 2px)',
            sm: 'calc(var(--radius, 0.5rem) - 4px)',
          },
        },
      },
    }
  </script>
  <style nonce="${nonce}">
    :root {
      --vscode-font-family: var(--vscode-editor-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
      --vscode-font-size: var(--vscode-editor-font-size, 14px);
    }

    * {
      box-sizing: border-box;
    }

    /* shadcn/ui CSS variables */
    :root {
      --background: 0 0% 100%;
      --foreground: 224 71% 4%;
      --card: 0 0% 100%;
      --card-foreground: 224 71% 4%;
      --popover: 0 0% 100%;
      --popover-foreground: 224 71% 4%;
      --primary: 224 71% 45%;
      --primary-foreground: 0 0% 100%;
      --secondary: 220 14% 96%;
      --secondary-foreground: 224 71% 4%;
      --muted: 220 14% 96%;
      --muted-foreground: 220 9% 46%;
      --accent: 220 14% 96%;
      --accent-foreground: 224 71% 4%;
      --destructive: 0 84% 60%;
      --destructive-foreground: 0 0% 100%;
      --border: 220 13% 91%;
      --input: 220 13% 91%;
      --ring: 224 71% 45%;
      --radius: 0.5rem;
    }

    .dark {
      --background: 224 71% 4%;
      --foreground: 0 0% 100%;
      --card: 224 71% 4%;
      --card-foreground: 0 0% 100%;
      --popover: 224 71% 4%;
      --popover-foreground: 0 0% 100%;
      --primary: 224 71% 45%;
      --primary-foreground: 0 0% 100%;
      --secondary: 215 28% 17%;
      --secondary-foreground: 0 0% 100%;
      --muted: 215 28% 17%;
      --muted-foreground: 220 9% 70%;
      --accent: 215 28% 17%;
      --accent-foreground: 0 0% 100%;
      --destructive: 0 62% 50%;
      --destructive-foreground: 0 0% 100%;
      --border: 215 28% 17%;
      --input: 215 28% 17%;
      --ring: 224 71% 55%;
    }

    body {
      margin: 0;
      padding: 16px;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
    }

    .preview-header {
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }

    .preview-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .preview-header h1 {
      margin: 0;
      font-size: 1.4em;
      font-weight: 500;
      color: var(--vscode-foreground);
    }

    .preview-header .state-count {
      margin-top: 4px;
      font-size: 0.85em;
      color: var(--vscode-descriptionForeground);
    }

    .theme-toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      background: transparent;
      color: var(--vscode-foreground);
      font-size: 12px;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .theme-toggle:hover {
      background-color: var(--vscode-list-hoverBackground);
    }

    .theme-toggle svg {
      width: 16px;
      height: 16px;
    }

    .theme-toggle .icon-sun,
    .theme-toggle .icon-moon {
      display: none;
    }

    .dark .theme-toggle .icon-sun {
      display: block;
    }

    :not(.dark) .theme-toggle .icon-moon {
      display: block;
    }

    .preview-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 16px;
    }

    .preview-item {
      border: 1px solid hsl(var(--border));
      border-radius: 6px;
      overflow: hidden;
      background-color: hsl(var(--background));
    }

    .preview-title {
      margin: 0;
      padding: 10px 12px;
      font-size: 0.9em;
      font-weight: 600;
      background-color: hsl(var(--muted));
      border-bottom: 1px solid hsl(var(--border));
      color: hsl(var(--foreground));
    }

    .preview-content {
      padding: 16px;
      min-height: 100px;
      background-color: hsl(var(--background));
      color: hsl(var(--foreground));
      border-radius: 0 0 5px 5px;
    }

    .preview-error {
      padding: 12px;
      background-color: var(--vscode-inputValidation-errorBackground);
      border: 1px solid var(--vscode-inputValidation-errorBorder);
      border-radius: 4px;
      color: var(--vscode-errorForeground);
    }

    .preview-error strong {
      display: block;
      margin-bottom: 8px;
    }

    .preview-error pre {
      margin: 0;
      font-family: var(--vscode-editor-font-family);
      font-size: 0.85em;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 200px;
      color: var(--vscode-descriptionForeground);
    }

    .loading::after {
      content: '';
      width: 24px;
      height: 24px;
      margin-left: 12px;
      border: 2px solid var(--vscode-progressBar-background);
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .bundle-error {
      padding: 20px;
      background-color: var(--vscode-inputValidation-errorBackground);
      border: 1px solid var(--vscode-inputValidation-errorBorder);
      border-radius: 6px;
      margin-top: 16px;
    }

    .bundle-error h2 {
      margin: 0 0 12px 0;
      color: var(--vscode-errorForeground);
    }

    .bundle-error pre {
      margin: 0;
      padding: 12px;
      background-color: var(--vscode-editor-background);
      border-radius: 4px;
      overflow-x: auto;
      font-family: var(--vscode-editor-font-family);
      font-size: 0.85em;
    }
  </style>
</head>
<body>
  <div class="preview-header">
    <div>
      <h1>${escapeHtml(componentName)}</h1>
      <div class="state-count">${stateNames.length} state${stateNames.length !== 1 ? "s" : ""}: ${stateNames.map(escapeHtml).join(", ")}</div>
    </div>
    <button class="theme-toggle" id="theme-toggle" title="Toggle dark/light mode">
      <svg class="icon-sun" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
      <svg class="icon-moon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
      </svg>
      <span class="theme-label"></span>
    </button>
  </div>
  <div id="preview-root">
    <div class="loading">Loading preview</div>
  </div>
  <script nonce="${nonce}">
    (function() {
      // Detect dark mode from VS Code theme (default)
      const isDark = document.body.classList.contains('vscode-dark') ||
                     document.body.getAttribute('data-vscode-theme-kind') === 'vscode-dark';
      if (isDark) {
        document.documentElement.classList.add('dark');
      }

      function updateThemeLabel() {
        const label = document.querySelector('.theme-label');
        if (label) {
          label.textContent = document.documentElement.classList.contains('dark') ? 'Dark' : 'Light';
        }
      }

      function toggleTheme() {
        document.documentElement.classList.toggle('dark');
        updateThemeLabel();
      }

      // Attach click handler
      const toggleBtn = document.getElementById('theme-toggle');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', toggleTheme);
      }

      updateThemeLabel();
    })();
  </script>
  <script nonce="${nonce}">
    ${bundledCode}
  </script>
</body>
</html>`;
}
function generateErrorContent(componentName, errors, cspSource, nonce) {
  const errorList = errors.map(escapeHtml).join("\n");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline';">
  <title>Preview Error: ${escapeHtml(componentName)}</title>
  <style nonce="${nonce}">
    body {
      margin: 0;
      padding: 20px;
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
    }

    .error-container {
      padding: 20px;
      background-color: var(--vscode-inputValidation-errorBackground);
      border: 1px solid var(--vscode-inputValidation-errorBorder);
      border-radius: 6px;
    }

    h1 {
      margin: 0 0 16px 0;
      color: var(--vscode-errorForeground);
      font-size: 1.2em;
    }

    pre {
      margin: 0;
      padding: 16px;
      background-color: var(--vscode-editor-background);
      border-radius: 4px;
      overflow-x: auto;
      font-family: var(--vscode-editor-font-family);
      font-size: 0.85em;
      white-space: pre-wrap;
      word-break: break-word;
    }
  </style>
</head>
<body>
  <div class="error-container">
    <h1>Failed to bundle ${escapeHtml(componentName)}</h1>
    <pre>${errorList}</pre>
  </div>
</body>
</html>`;
}
function generateNonce() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";
  for (let i = 0; i < 32; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}
function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// src/bundler/esbuildBundler.ts
var esbuild = __toESM(require("esbuild"));
var path3 = __toESM(require("path"));
var fs3 = __toESM(require("fs"));
async function bundleComponent(componentPath, componentName, states, workspaceRoot, isDefaultExport = true) {
  const errors = [];
  const entryCode = generateEntryPoint(componentPath, componentName, states, isDefaultExport);
  const tempDir = path3.join(workspaceRoot, ".react-preview-temp");
  if (!fs3.existsSync(tempDir)) {
    fs3.mkdirSync(tempDir, { recursive: true });
  }
  const entryPath = path3.join(tempDir, "preview-entry.tsx");
  fs3.writeFileSync(entryPath, entryCode);
  try {
    const result = await esbuild.build({
      entryPoints: [entryPath],
      bundle: true,
      write: false,
      format: "iife",
      globalName: "ReactPreview",
      target: "es2020",
      jsx: "automatic",
      jsxImportSource: "react",
      loader: {
        ".tsx": "tsx",
        ".ts": "ts",
        ".jsx": "jsx",
        ".js": "js",
        ".css": "css",
        ".json": "json",
        ".svg": "dataurl",
        ".png": "dataurl",
        ".jpg": "dataurl",
        ".gif": "dataurl"
      },
      define: {
        "process.env.NODE_ENV": '"development"'
      },
      // Resolve from user's workspace node_modules
      nodePaths: [path3.join(workspaceRoot, "node_modules")],
      resolveExtensions: [".tsx", ".ts", ".jsx", ".js", ".json"],
      // External packages that should not be bundled (provided by webview)
      external: [],
      minify: false,
      sourcemap: false,
      // Handle CSS imports
      plugins: [
        cssPlugin()
      ]
    });
    fs3.unlinkSync(entryPath);
    fs3.rmdirSync(tempDir, { recursive: true });
    if (result.errors.length > 0) {
      errors.push(...result.errors.map((e) => e.text));
    }
    const code = result.outputFiles?.[0]?.text || "";
    return { code, errors };
  } catch (error) {
    if (fs3.existsSync(entryPath)) {
      fs3.unlinkSync(entryPath);
    }
    if (fs3.existsSync(tempDir)) {
      fs3.rmdirSync(tempDir, { recursive: true });
    }
    const message = error instanceof Error ? error.message : String(error);
    errors.push(message);
    return { code: "", errors };
  }
}
function generateEntryPoint(componentPath, componentName, _states, isDefaultExport) {
  const relativePath = componentPath.replace(/\\/g, "/");
  const componentImport = isDefaultExport ? `import Component, { preview } from '${relativePath}';` : `import { ${componentName} as Component, preview } from '${relativePath}';`;
  return `
import React from 'react';
import { createRoot } from 'react-dom/client';
${componentImport}

// Error Boundary component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return React.createElement('div', {
        className: 'preview-error'
      }, [
        React.createElement('strong', { key: 'title' }, 'Error in preview:'),
        React.createElement('pre', { key: 'message' }, this.state.error?.message || 'Unknown error')
      ]);
    }
    return this.props.children;
  }
}

// Build preview states from imported preview object
const previewStates = Object.entries(preview).map(([name, props]) => ({
  name,
  render: () => <Component {...(props || {})} />
}));

// Render function exposed to webview
window.__REACT_PREVIEW_STATES__ = previewStates;
window.__REACT_PREVIEW_ERROR_BOUNDARY__ = ErrorBoundary;

// Render all states
function renderPreviews() {
  const container = document.getElementById('preview-root');
  if (!container) return;

  const root = createRoot(container);
  root.render(
    React.createElement('div', { className: 'preview-grid' },
      previewStates.map((state, index) =>
        React.createElement('div', { key: index, className: 'preview-item' }, [
          React.createElement('h3', { key: 'title', className: 'preview-title' }, state.name),
          React.createElement('div', { key: 'content', className: 'preview-content' },
            React.createElement(ErrorBoundary, null, state.render())
          )
        ])
      )
    )
  );
}

// Auto-render when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderPreviews);
} else {
  renderPreviews();
}
`;
}
function cssPlugin() {
  return {
    name: "css-collector",
    setup(build2) {
      build2.onLoad({ filter: /\.css$/ }, async (args) => {
        const css = await fs3.promises.readFile(args.path, "utf8");
        return {
          contents: `
            (function() {
              const style = document.createElement('style');
              style.textContent = ${JSON.stringify(css)};
              document.head.appendChild(style);
            })();
          `,
          loader: "js"
        };
      });
    }
  };
}

// src/webview/PreviewPanel.ts
var PreviewPanel = class _PreviewPanel {
  static currentPanel;
  panel;
  _extensionUri;
  disposables = [];
  constructor(panel, extensionUri) {
    this.panel = panel;
    this._extensionUri = extensionUri;
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }
  /**
   * Create or show the preview panel
   */
  static createOrShow(extensionUri, viewColumn) {
    const column = viewColumn || vscode.ViewColumn.Beside;
    if (_PreviewPanel.currentPanel) {
      _PreviewPanel.currentPanel.panel.reveal(column);
      return _PreviewPanel.currentPanel;
    }
    const panel = vscode.window.createWebviewPanel(
      "reactPreview",
      "React Preview",
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: []
      }
    );
    _PreviewPanel.currentPanel = new _PreviewPanel(panel, extensionUri);
    return _PreviewPanel.currentPanel;
  }
  /**
   * Update the panel with new preview content
   */
  async updatePreview(previewConfig, workspaceRoot) {
    const { componentPath, componentName, states, isDefaultExport } = previewConfig;
    this.panel.title = `Preview: ${componentName}`;
    this.panel.webview.html = this.getLoadingHtml(componentName);
    try {
      const bundleResult = await bundleComponent(
        componentPath,
        componentName,
        states,
        workspaceRoot,
        isDefaultExport
      );
      if (bundleResult.errors.length > 0) {
        const nonce2 = generateNonce();
        this.panel.webview.html = generateErrorContent(
          componentName,
          bundleResult.errors,
          this.panel.webview.cspSource,
          nonce2
        );
        return;
      }
      const nonce = generateNonce();
      this.panel.webview.html = generateWebviewContent({
        bundledCode: bundleResult.code,
        componentName,
        stateNames: states.map((s) => s.name),
        cspSource: this.panel.webview.cspSource,
        nonce
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const nonce = generateNonce();
      this.panel.webview.html = generateErrorContent(
        componentName,
        [message],
        this.panel.webview.cspSource,
        nonce
      );
    }
  }
  /**
   * Get loading HTML
   */
  getLoadingHtml(componentName) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
  <title>Loading: ${componentName}</title>
  <style>
    body {
      margin: 0;
      padding: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
    }

    .loading {
      text-align: center;
    }

    .spinner {
      width: 40px;
      height: 40px;
      margin: 0 auto 16px;
      border: 3px solid var(--vscode-progressBar-background);
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .text {
      color: var(--vscode-descriptionForeground);
    }
  </style>
</head>
<body>
  <div class="loading">
    <div class="spinner"></div>
    <div class="text">Bundling ${componentName}...</div>
  </div>
</body>
</html>`;
  }
  /**
   * Dispose of the panel
   */
  dispose() {
    _PreviewPanel.currentPanel = void 0;
    this.panel.dispose();
    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
};

// src/commands/previewComponent.ts
async function previewComponent(context, uri) {
  let filePath;
  if (uri) {
    filePath = uri.fsPath;
  } else {
    const activeEditor = vscode2.window.activeTextEditor;
    if (activeEditor) {
      filePath = activeEditor.document.uri.fsPath;
    }
  }
  if (!filePath) {
    vscode2.window.showErrorMessage("No file selected. Open a React component file first.");
    return;
  }
  const ext = path4.extname(filePath);
  if (![".tsx", ".jsx", ".ts", ".js"].includes(ext)) {
    vscode2.window.showErrorMessage("Please select a React component file (.tsx, .jsx, .ts, or .js)");
    return;
  }
  const workspaceFolder = vscode2.workspace.getWorkspaceFolder(vscode2.Uri.file(filePath));
  if (!workspaceFolder) {
    vscode2.window.showErrorMessage("Could not determine workspace folder. Please open a workspace.");
    return;
  }
  const workspaceRoot = workspaceFolder.uri.fsPath;
  const componentInfo = await detectComponent(filePath);
  if (!componentInfo) {
    vscode2.window.showWarningMessage(
      "No preview configuration found. Add an `export const preview = { ... }` to your component, or create a colocated .preview.ts file."
    );
    return;
  }
  const previewConfig = await extractPreviewConfig(filePath);
  if (!previewConfig || previewConfig.states.length === 0) {
    vscode2.window.showWarningMessage(
      "Could not parse preview configuration. Check that your preview export is properly formatted."
    );
    return;
  }
  await vscode2.window.withProgress(
    {
      location: vscode2.ProgressLocation.Notification,
      title: `Previewing ${previewConfig.componentName}...`,
      cancellable: false
    },
    async () => {
      const panel = PreviewPanel.createOrShow(context.extensionUri);
      await panel.updatePreview(previewConfig, workspaceRoot);
    }
  );
}
function registerPreviewCommand(context) {
  return vscode2.commands.registerCommand(
    "react-preview.previewComponent",
    (uri) => previewComponent(context, uri)
  );
}

// src/extension.ts
function activate(context) {
  console.log("React Preview extension is now active");
  const previewCommand = registerPreviewCommand(context);
  context.subscriptions.push(previewCommand);
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
