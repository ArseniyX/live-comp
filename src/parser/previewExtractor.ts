import * as fs from 'fs';
import * as path from 'path';
import { Project, Node } from 'ts-morph';

export interface PreviewState {
	name: string;
	props: string; // Raw props text - we don't parse, just pass through for override
}

export interface PreviewConfig {
	states: PreviewState[];
	componentPath: string;
	componentName: string;
	isDefaultExport: boolean;
}

const project = new Project({
	useInMemoryFileSystem: true,
	compilerOptions: {
		allowJs: true,
		jsx: 2 // React
	}
});

/**
 * Extract preview configuration from a component file or its colocated .preview.ts file
 */
export async function extractPreviewConfig(filePath: string): Promise<PreviewConfig | null> {
	const content = await fs.promises.readFile(filePath, 'utf-8');

	const sourceFile = project.createSourceFile('temp.tsx', content, { overwrite: true });

	// Detect export type using AST
	const { componentName, isDefaultExport } = extractComponentInfo(sourceFile, filePath);

	// First, try to find inline preview export
	const inlinePreview = parsePreviewExport(sourceFile);
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
		const previewSourceFile = project.createSourceFile('preview.tsx', previewContent, {
			overwrite: true
		});
		const previewStates = parsePreviewExport(previewSourceFile);
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
 * Extract component name and export type from AST
 */
function extractComponentInfo(
	sourceFile: ReturnType<typeof project.createSourceFile>,
	filePath: string
): { componentName: string; isDefaultExport: boolean } {
	// Check for default export
	const defaultExport = sourceFile.getDefaultExportSymbol();
	if (defaultExport) {
		const declarations = defaultExport.getDeclarations();
		for (const decl of declarations) {
			// export default function ComponentName
			if (Node.isFunctionDeclaration(decl)) {
				const name = decl.getName();
				if (name) {
					return { componentName: name, isDefaultExport: true };
				}
			}
			// export default ComponentName (identifier)
			if (Node.isExportAssignment(decl)) {
				const expr = decl.getExpression();
				if (Node.isIdentifier(expr)) {
					return { componentName: expr.getText(), isDefaultExport: true };
				}
			}
		}
		// Fallback for default export
		return {
			componentName: path.basename(filePath, path.extname(filePath)),
			isDefaultExport: true
		};
	}

	// Check for named exports - find PascalCase function/const (likely React component)
	const exportedDeclarations = sourceFile.getExportedDeclarations();
	for (const [name] of exportedDeclarations) {
		if (
			/^[A-Z][a-zA-Z0-9]*$/.test(name) &&
			name !== 'Preview' &&
			!name.toLowerCase().includes('preview')
		) {
			return { componentName: name, isDefaultExport: false };
		}
	}

	// Fallback to filename
	return { componentName: path.basename(filePath, path.extname(filePath)), isDefaultExport: false };
}

/**
 * Parse the preview export from AST
 * Looks for: export const preview = { ... }
 */
function parsePreviewExport(
	sourceFile: ReturnType<typeof project.createSourceFile>
): PreviewState[] | null {
	const exportedDeclarations = sourceFile.getExportedDeclarations();
	const previewDecl = exportedDeclarations.get('preview');

	if (!previewDecl || previewDecl.length === 0) {
		return null;
	}

	const decl = previewDecl[0];

	// Find the variable declaration
	if (!Node.isVariableDeclaration(decl)) {
		return null;
	}

	const initializer = decl.getInitializer();
	if (!initializer || !Node.isObjectLiteralExpression(initializer)) {
		return null;
	}

	const states: PreviewState[] = [];

	for (const prop of initializer.getProperties()) {
		if (Node.isPropertyAssignment(prop)) {
			const name = prop.getName();
			const value = prop.getInitializer();

			if (value) {
				states.push({
					name,
					props: value.getText()
				});
			}
		} else if (Node.isShorthandPropertyAssignment(prop)) {
			// Handle { loading } shorthand syntax
			const name = prop.getName();
			states.push({
				name,
				props: name
			});
		}
	}

	return states.length > 0 ? states : null;
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
