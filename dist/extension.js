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
var path5 = __toESM(require("path"));

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
var fs4 = __toESM(require("fs"));
var path4 = __toESM(require("path"));
var import_crypto = require("crypto");

// src/bundler/esbuildBundler.ts
var esbuild = __toESM(require("esbuild"));
var path3 = __toESM(require("path"));
var fs3 = __toESM(require("fs"));
async function bundleComponent(componentPath, componentName, states, workspaceRoot, isDefaultExport = true) {
  const errors = [];
  const entryCode = generateEntryPoint(
    componentPath,
    componentName,
    states,
    isDefaultExport
  );
  const tempDir = path3.join(workspaceRoot, ".live-comp-temp");
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
      plugins: [cssPlugin()]
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
  pendingPreview = null;
  constructor(panel, extensionUri) {
    this.panel = panel;
    this._extensionUri = extensionUri;
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(
      (message) => this.handleWebviewMessage(message),
      null,
      this.disposables
    );
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
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, "dist", "webview")
        ]
      }
    );
    _PreviewPanel.currentPanel = new _PreviewPanel(panel, extensionUri);
    _PreviewPanel.currentPanel.panel.webview.html = _PreviewPanel.currentPanel.getWebviewHtml();
    return _PreviewPanel.currentPanel;
  }
  /**
   * Handle messages from the webview
   */
  async handleWebviewMessage(message) {
    console.log("[extension] Received message from webview:", message.type);
    switch (message.type) {
      case "ready":
        console.log("[extension] Webview ready, pendingPreview:", !!this.pendingPreview);
        if (this.pendingPreview) {
          await this.sendPreviewToWebview(
            this.pendingPreview.config,
            this.pendingPreview.workspaceRoot
          );
          this.pendingPreview = null;
        }
        break;
      case "refresh":
        if (this.pendingPreview) {
          await this.sendPreviewToWebview(
            this.pendingPreview.config,
            this.pendingPreview.workspaceRoot
          );
        }
        break;
    }
  }
  /**
   * Update the panel with new preview content
   */
  async updatePreview(previewConfig, workspaceRoot) {
    const { componentName } = previewConfig;
    this.panel.title = `Preview: ${componentName}`;
    this.pendingPreview = { config: previewConfig, workspaceRoot };
    await this.sendPreviewToWebview(previewConfig, workspaceRoot);
  }
  /**
   * Send preview data to the webview
   */
  async sendPreviewToWebview(previewConfig, workspaceRoot) {
    const { componentPath, componentName, states, isDefaultExport } = previewConfig;
    console.log("[extension] sendPreviewToWebview:", componentName);
    try {
      const bundleResult = await bundleComponent(
        componentPath,
        componentName,
        states,
        workspaceRoot,
        isDefaultExport
      );
      console.log("[extension] Bundle result - errors:", bundleResult.errors.length, "code length:", bundleResult.code.length);
      if (bundleResult.errors.length > 0) {
        this.panel.webview.postMessage({
          type: "error",
          componentName,
          errors: bundleResult.errors
        });
        return;
      }
      console.log("[extension] Posting update message to webview");
      this.panel.webview.postMessage({
        type: "update",
        componentName,
        stateNames: states.map((s) => s.name),
        bundledCode: bundleResult.code
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.panel.webview.postMessage({
        type: "error",
        componentName,
        errors: [message]
      });
    }
  }
  /**
   * Get the webview HTML content by loading built webview-ui assets
   */
  getWebviewHtml() {
    const webview = this.panel.webview;
    const webviewPath = vscode.Uri.joinPath(this._extensionUri, "dist", "webview");
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(webviewPath, "assets", "index.js"));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(webviewPath, "assets", "index.css"));
    const cssPath = path4.join(this._extensionUri.fsPath, "dist", "webview", "assets", "index.css");
    const hasCss = fs4.existsSync(cssPath);
    const nonce = generateNonce();
    const csp = [
      "default-src 'none'",
      `style-src ${webview.cspSource} 'unsafe-inline' https://cdn.tailwindcss.com`,
      `script-src 'nonce-${nonce}' 'unsafe-inline' 'unsafe-eval' ${webview.cspSource} https://cdn.tailwindcss.com`,
      `img-src ${webview.cspSource} data: https:`
    ].join("; ");
    const safelist = `
      bg-primary bg-secondary bg-destructive bg-muted bg-accent bg-background
      text-primary text-secondary text-destructive text-muted text-accent text-foreground
      text-primary-foreground text-secondary-foreground text-destructive-foreground text-muted-foreground text-accent-foreground
      border-primary border-secondary border-destructive border-muted border-accent border-input border-border
      hover:bg-primary/90 hover:bg-secondary/80 hover:bg-destructive/90 hover:bg-accent hover:bg-muted
      ring-ring focus:ring-ring focus-visible:ring-ring
      rounded-sm rounded-md rounded-lg rounded-full
      px-2 px-3 px-4 py-1 py-2 py-3 px-2.5 py-0.5
      text-xs text-sm text-base text-lg font-medium font-semibold
      inline-flex items-center justify-center gap-2
      h-8 h-9 h-10 h-11 w-full
      disabled:opacity-50 disabled:pointer-events-none
      transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
    `.trim();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <title>React Preview</title>
  <script src="https://cdn.tailwindcss.com" nonce="${nonce}"></script>
  <script nonce="${nonce}">
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            border: 'hsl(var(--border))',
            input: 'hsl(var(--input))',
            ring: 'hsl(var(--ring))',
            background: 'hsl(var(--background))',
            foreground: 'hsl(var(--foreground))',
            primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
            secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
            destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
            muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
            accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
            card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
            popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
          },
          borderRadius: { lg: 'var(--radius)', md: 'calc(var(--radius) - 2px)', sm: 'calc(var(--radius) - 4px)' },
        },
      },
    }
  </script>
  ${hasCss ? `<link rel="stylesheet" href="${styleUri}">` : ""}
</head>
<body>
  <!-- Safelist for Tailwind CDN to pre-generate common classes -->
  <div style="display:none!important" class="${safelist}"></div>
  <div id="root"></div>
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
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
function generateNonce() {
  return (0, import_crypto.randomBytes)(16).toString("base64");
}

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
  const ext = path5.extname(filePath);
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
    "live-comp.previewComponent",
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
