import * as fs from 'fs';
import * as path from 'path';

export interface PreviewState {
	name: string;
	props: Record<string, unknown>;
}

export interface PreviewConfig {
	states: PreviewState[];
	componentPath: string;
	componentName: string;
	isDefaultExport: boolean;
}

/**
 * Extract preview configuration from a component file or its colocated .preview.ts file
 */
export async function extractPreviewConfig(filePath: string): Promise<PreviewConfig | null> {
	const content = await fs.promises.readFile(filePath, 'utf-8');

	// Detect export type
	const defaultExportName = extractDefaultExportName(content);
	const namedExportName = extractNamedExportName(content);
	const isDefaultExport = defaultExportName !== null;
	const componentName =
		defaultExportName || namedExportName || path.basename(filePath, path.extname(filePath));

	// First, try to find inline preview export
	const inlinePreview = parsePreviewExport(content);
	if (inlinePreview) {
		return {
			states: inlinePreview,
			componentPath: filePath,
			componentName,
			isDefaultExport
		};
	}

	// Check for colocated .preview.ts file
	const previewFilePath = findColocatedPreviewFile(filePath);
	if (previewFilePath) {
		const previewContent = await fs.promises.readFile(previewFilePath, 'utf-8');
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

/**
 * Parse the preview export from file content
 * Looks for: export const preview = { ... }
 */
function parsePreviewExport(content: string): PreviewState[] | null {
	// Match export const preview = { ... } or export const preview: PreviewConfig = { ... }
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

/**
 * Parse the preview object string into PreviewState array
 * Handles object syntax like: { loading: { isLoading: true }, error: { error: new Error('...') } }
 */
function parsePreviewObject(objectStr: string): PreviewState[] {
	const states: PreviewState[] = [];

	// Remove outer braces and split by top-level properties
	const inner = objectStr.slice(1, -1).trim();

	// Use a simple state machine to extract key-value pairs at the top level
	let depth = 0;
	let currentKey = '';
	let currentValue = '';
	let inKey = true;
	let inString = false;
	let stringChar = '';

	for (let i = 0; i < inner.length; i++) {
		const char = inner[i];
		const prevChar = i > 0 ? inner[i - 1] : '';

		// Handle string boundaries
		if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
			if (!inString) {
				inString = true;
				stringChar = char;
			} else if (char === stringChar) {
				inString = false;
			}
		}

		if (!inString) {
			if (char === '{' || char === '[' || char === '(') {
				depth++;
			} else if (char === '}' || char === ']' || char === ')') {
				depth--;
			}

			// At top level, look for key: value separators
			if (depth === 0 && char === ':' && inKey) {
				inKey = false;
				continue;
			}

			// At top level, comma separates entries
			if (depth === 0 && char === ',') {
				if (currentKey.trim() && currentValue.trim()) {
					states.push({
						name: currentKey.trim(),
						props: safeParseProps(currentValue.trim())
					});
				}
				currentKey = '';
				currentValue = '';
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

	// Don't forget the last entry
	if (currentKey.trim() && currentValue.trim()) {
		states.push({
			name: currentKey.trim(),
			props: safeParseProps(currentValue.trim())
		});
	}

	return states;
}

/**
 * Safely parse props string into an object
 * For complex expressions, we store the raw string
 */
function safeParseProps(propsStr: string): Record<string, unknown> {
	// If it's a simple object literal, try to parse key-value pairs
	if (propsStr.startsWith('{') && propsStr.endsWith('}')) {
		const inner = propsStr.slice(1, -1).trim();
		const props: Record<string, unknown> = {};

		// Simple regex for basic key: value pairs
		const propRegex = /(\w+)\s*:\s*([^,]+?)(?:,|$)/g;
		let propMatch;

		while ((propMatch = propRegex.exec(inner)) !== null) {
			const key = propMatch[1];
			const value = propMatch[2].trim();
			props[key] = parseValue(value);
		}

		return props;
	}

	// Return raw string representation for complex cases
	return { __raw: propsStr };
}

/**
 * Parse a value string into its JavaScript representation
 */
function parseValue(valueStr: string): unknown {
	const trimmed = valueStr.trim();

	if (trimmed === 'true') {
		return true;
	}
	if (trimmed === 'false') {
		return false;
	}
	if (trimmed === 'null') {
		return null;
	}
	if (trimmed === 'undefined') {
		return undefined;
	}

	// Number
	if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
		return parseFloat(trimmed);
	}

	// String literal
	if (
		(trimmed.startsWith('"') && trimmed.endsWith('"')) ||
		(trimmed.startsWith("'") && trimmed.endsWith("'"))
	) {
		return trimmed.slice(1, -1);
	}

	// Array
	if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
		return trimmed; // Keep as string for now
	}

	// Object or complex expression - keep as raw
	return trimmed;
}

/**
 * Extract the default export component name
 */
function extractDefaultExportName(content: string): string | null {
	// Match: export default function ComponentName
	const funcMatch = content.match(/export\s+default\s+function\s+(\w+)/);
	if (funcMatch) {
		return funcMatch[1];
	}

	// Match: export default ComponentName
	const directMatch = content.match(/export\s+default\s+(\w+)/);
	if (directMatch) {
		return directMatch[1];
	}

	// Match: const ComponentName = ...; export default ComponentName
	const constExportMatch = content.match(/const\s+(\w+)\s*=[\s\S]*?export\s+default\s+\1/);
	if (constExportMatch) {
		return constExportMatch[1];
	}

	return null;
}

/**
 * Extract a named export component name (for components without default export)
 * Looks for: export function ComponentName, export const ComponentName, or export { ComponentName }
 */
function extractNamedExportName(content: string): string | null {
	// Match: export function ComponentName (PascalCase, likely a React component)
	const funcMatch = content.match(/export\s+function\s+([A-Z]\w*)/);
	if (funcMatch) {
		return funcMatch[1];
	}

	// Match: export const ComponentName = (PascalCase)
	const constMatch = content.match(/export\s+const\s+([A-Z]\w*)\s*[=:]/);
	if (constMatch && constMatch[1] !== 'Preview') {
		return constMatch[1];
	}

	// Match: export { ComponentName } or export { ComponentName, ... }
	// Look for PascalCase names that are likely React components
	const exportListMatch = content.match(/export\s*\{([^}]+)\}/g);
	if (exportListMatch) {
		for (const exportList of exportListMatch) {
			const names = exportList.match(/\{([^}]+)\}/)?.[1];
			if (names) {
				// Split by comma and find PascalCase names
				const exportedNames = names.split(',').map((n) =>
					n
						.trim()
						.split(/\s+as\s+/)[0]
						.trim()
				);
				for (const name of exportedNames) {
					// PascalCase and not 'Preview' or variant-related names
					if (
						/^[A-Z][a-zA-Z0-9]*$/.test(name) &&
						name !== 'Preview' &&
						!name.toLowerCase().includes('variant')
					) {
						return name;
					}
				}
			}
		}
	}

	// Match: function ComponentName or const ComponentName defined in file (not exported inline)
	// This catches components that are exported via export { Name } at the end
	const funcDefMatch = content.match(/function\s+([A-Z][a-zA-Z0-9]*)\s*\(/);
	if (funcDefMatch && funcDefMatch[1] !== 'Preview') {
		// Verify it's actually exported
		const name = funcDefMatch[1];
		if (new RegExp(`export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}`).test(content)) {
			return name;
		}
	}

	return null;
}

/**
 * Find a colocated .preview.ts or .preview.tsx file
 */
function findColocatedPreviewFile(componentPath: string): string | null {
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
