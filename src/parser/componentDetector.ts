import * as fs from 'fs';
import * as path from 'path';

export interface ComponentInfo {
	componentPath: string;
	previewPath: string | null;
	hasInlinePreview: boolean;
}

/**
 * Detect if a file is a React component with preview configuration
 */
export async function detectComponent(filePath: string): Promise<ComponentInfo | null> {
	const ext = path.extname(filePath);

	// Only process React files
	if (!['.tsx', '.jsx', '.ts', '.js'].includes(ext)) {
		return null;
	}

	// Skip preview files themselves
	if (filePath.includes('.preview.')) {
		return null;
	}

	// Check if file exists
	if (!fs.existsSync(filePath)) {
		return null;
	}

	const content = await fs.promises.readFile(filePath, 'utf-8');

	// Check if it looks like a React component
	if (!isReactComponent(content)) {
		return null;
	}

	// Check for inline preview export
	const hasInlinePreview = hasPreviewExport(content);

	// Check for colocated preview file
	const previewPath = findPreviewFile(filePath);

	// Only return if there's some preview configuration
	if (!hasInlinePreview && !previewPath) {
		return null;
	}

	return {
		componentPath: filePath,
		previewPath,
		hasInlinePreview
	};
}

/**
 * Check if file content looks like a React component
 */
function isReactComponent(content: string): boolean {
	// Check for React import
	const hasReactImport = /import\s+(?:React|\{[^}]*\})\s+from\s+['"]react['"]/.test(content);

	// Check for JSX-like syntax
	const hasJSX = /<\w+[\s>]/.test(content);

	// Check for React.createElement
	const hasCreateElement = /React\.createElement/.test(content);

	// Check for component-like exports
	const hasComponentExport = /export\s+(?:default\s+)?(?:function|const|class)\s+\w+/.test(content);

	return (hasReactImport || hasJSX || hasCreateElement) && hasComponentExport;
}

/**
 * Check if file has a preview export
 */
function hasPreviewExport(content: string): boolean {
	return /export\s+const\s+preview\s*(?::\s*[^=]+)?\s*=/.test(content);
}

/**
 * Find colocated preview file for a component
 */
function findPreviewFile(componentPath: string): string | null {
	const dir = path.dirname(componentPath);
	const ext = path.extname(componentPath);
	const baseName = path.basename(componentPath, ext);

	// Try various preview file extensions
	const extensions = ['.ts', '.tsx', '.js', '.jsx'];

	for (const previewExt of extensions) {
		const previewPath = path.join(dir, `${baseName}.preview${previewExt}`);
		if (fs.existsSync(previewPath)) {
			return previewPath;
		}
	}

	return null;
}

/**
 * Find all React components with preview configurations in a directory
 */
export async function findPreviewableComponents(dirPath: string): Promise<ComponentInfo[]> {
	const components: ComponentInfo[] = [];

	async function walkDir(dir: string): Promise<void> {
		const entries = await fs.promises.readdir(dir, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);

			if (entry.isDirectory()) {
				// Skip node_modules and hidden directories
				if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
					await walkDir(fullPath);
				}
			} else if (entry.isFile()) {
				const componentInfo = await detectComponent(fullPath);
				if (componentInfo) {
					components.push(componentInfo);
				}
			}
		}
	}

	await walkDir(dirPath);
	return components;
}
