import * as esbuild from 'esbuild';
import * as path from 'path';
import * as fs from 'fs';
import type { PreviewState } from '../parser/previewExtractor';

export interface BundleResult {
	code: string;
	errors: string[];
}

/**
 * Bundle a React component with its preview states using esbuild
 */
export async function bundleComponent(
	componentPath: string,
	componentName: string,
	states: PreviewState[],
	workspaceRoot: string,
	isDefaultExport: boolean = true
): Promise<BundleResult> {
	const errors: string[] = [];

	// Generate virtual entry point
	const entryCode = generateEntryPoint(componentPath, componentName, states, isDefaultExport);

	// Create a temporary entry file
	const tempDir = path.join(workspaceRoot, '.live-comp-temp');
	if (!fs.existsSync(tempDir)) {
		fs.mkdirSync(tempDir, { recursive: true });
	}

	const entryPath = path.join(tempDir, 'preview-entry.tsx');
	fs.writeFileSync(entryPath, entryCode);

	try {
		const result = await esbuild.build({
			entryPoints: [entryPath],
			bundle: true,
			write: false,
			format: 'iife',
			globalName: 'ReactPreview',
			target: 'es2020',
			jsx: 'automatic',
			jsxImportSource: 'react',
			loader: {
				'.tsx': 'tsx',
				'.ts': 'ts',
				'.jsx': 'jsx',
				'.js': 'js',
				'.css': 'css',
				'.json': 'json',
				'.svg': 'dataurl',
				'.png': 'dataurl',
				'.jpg': 'dataurl',
				'.gif': 'dataurl'
			},
			define: {
				'process.env.NODE_ENV': '"development"'
			},
			// Resolve from user's workspace node_modules
			nodePaths: [path.join(workspaceRoot, 'node_modules')],
			resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
			// External packages that should not be bundled (provided by webview)
			external: [],
			minify: false,
			sourcemap: false,
			// Handle CSS imports
			plugins: [cssPlugin()]
		});

		// Clean up temp file
		fs.unlinkSync(entryPath);
		fs.rmSync(tempDir, { recursive: true });

		if (result.errors.length > 0) {
			errors.push(...result.errors.map((e) => e.text));
		}

		const code = result.outputFiles?.[0]?.text || '';
		return { code, errors };
	} catch (error) {
		// Clean up on error
		if (fs.existsSync(entryPath)) {
			fs.unlinkSync(entryPath);
		}
		if (fs.existsSync(tempDir)) {
			fs.rmSync(tempDir, { recursive: true });
		}

		const message = error instanceof Error ? error.message : String(error);
		errors.push(message);
		return { code: '', errors };
	}
}

/**
 * Generate the entry point code that imports the component and renders preview states
 * Instead of parsing and reconstructing props, we import the preview object directly
 */
function generateEntryPoint(
	componentPath: string,
	componentName: string,
	_states: PreviewState[],
	isDefaultExport: boolean
): string {
	const relativePath = componentPath.replace(/\\/g, '/');

	// Generate the correct import statement based on export type
	// Always import the preview object as well
	const componentImport = isDefaultExport
		? `import Component, { preview } from '${relativePath}';`
		: `import { ${componentName} as Component, preview } from '${relativePath}';`;

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

/**
 * esbuild plugin to handle CSS imports
 */
function cssPlugin(): esbuild.Plugin {
	return {
		name: 'css-collector',
		setup(build) {
			build.onLoad({ filter: /\.css$/ }, async (args) => {
				const css = await fs.promises.readFile(args.path, 'utf8');
				// Inject CSS as a side effect
				return {
					contents: `
            (function() {
              const style = document.createElement('style');
              style.textContent = ${JSON.stringify(css)};
              document.head.appendChild(style);
            })();
          `,
					loader: 'js'
				};
			});
		}
	};
}
