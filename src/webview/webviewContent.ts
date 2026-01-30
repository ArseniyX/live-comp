export interface WebviewContentOptions {
  bundledCode: string;
  componentName: string;
  stateNames: string[];
  cspSource: string;
  nonce: string;
}

/**
 * Generate the HTML content for the preview webview
 */
export function generateWebviewContent(options: WebviewContentOptions): string {
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
      <div class="state-count">${stateNames.length} state${stateNames.length !== 1 ? 's' : ''}: ${stateNames.map(escapeHtml).join(', ')}</div>
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

/**
 * Generate error HTML when bundling fails
 */
export function generateErrorContent(
  componentName: string,
  errors: string[],
  cspSource: string,
  nonce: string
): string {
  const errorList = errors.map(escapeHtml).join('\n');

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

/**
 * Generate a cryptographic nonce for CSP
 */
export function generateNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let i = 0; i < 32; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
