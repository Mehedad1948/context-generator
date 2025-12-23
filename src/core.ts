// src/core.ts
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import fg from 'fast-glob';

// 1. Define the interface so we know what to expect
export interface ContextResult {
    output: string;
    tokens: number;
}

export async function scanDirectory(rootPath: string) {
    // Using fast-glob to scan efficiently
    const entries = await fg(['**/*'], {
        cwd: rootPath,
        ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**', '**/.vscode/**'],
        onlyFiles: true,
        markDirectories: false,
        dot: true
    });

    const folders = new Set<string>();
    const extensions = new Set<string>();

    entries.forEach((entry: string) => {
        const dir = path.dirname(entry);
        const ext = path.extname(entry);

        if (dir !== '.') {
            // Get the top-level folder name
            folders.add(dir.split(path.sep)[0]);
        }
        if (ext) {
            extensions.add(ext);
        }
    });

    return {
        folders: Array.from(folders).sort(),
        extensions: Array.from(extensions).sort()
    };
}

export async function generateContext(rootPath: string, config: any): Promise<ContextResult> {
    let output = '';
    
    // --- 1. Generate Tree ---
    output += '# Project Tree\n```\n';

const printTree = (dir: string, prefix: string = '') => {
const items = fs.readdirSync(dir, { withFileTypes: true });

const filteredItems = items.filter(item => {
if (item.name.startsWith('.') || item.name === 'node_modules') return false;
return true;
});

filteredItems.forEach((item, index) => {
const isLast = index === filteredItems.length - 1;
const pointer = isLast ? '└── ' : '├── ';

let shouldInclude = true;

// Check config against UI selections
if (item.isDirectory()) {
const folderConfig = config.folders[item.name];
if (folderConfig && !folderConfig.tree) shouldInclude = false;
} else {
const ext = path.extname(item.name);
const extConfig = config.extensions[ext];
if (extConfig && !extConfig.tree) shouldInclude = false;
}

if (shouldInclude) {
output += `${prefix}${pointer}${item.name}\n`;
if (item.isDirectory()) {
printTree(path.join(dir, item.name), prefix + (isLast ? '    ' : '│   '));
}
}
});
};

try {
printTree(rootPath);
} catch (e) {
output += `Error generating tree: ${e}\n`;
}
output += '```\n\n';

    // --- 2. Generate Content ---
    output += '# File Contents\n\n';

    const entries = await fg(['**/*'], {
        cwd: rootPath,
        ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**', '**/.vscode/**'],
        onlyFiles: true,
        absolute: true
    });

    for (const filePath of entries) {
        const relativePath = path.relative(rootPath, filePath);
        const ext = path.extname(filePath);
        const parts = relativePath.split(path.sep);
        const topFolder = parts.length > 1 ? parts[0] : null;

        // Determine if file should be included based on extension
        let includeFile = true;
        const extConfig = config.extensions[ext];
        if (extConfig && !extConfig.content) {
            includeFile = false;
        }

        // Determine if file should be included based on parent folder
        if (topFolder) {
            const folderConfig = config.folders[topFolder];
            if (folderConfig && !folderConfig.content) {
                includeFile = false;
            }
        }

        if (includeFile) {
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                // Simple binary check (skip if null characters found)
                if (content.indexOf('\0') === -1) {
                    output += `## File: ${relativePath}\n\`\`\`${ext.replace('.', '')}\n${content}\n\`\`\`\n\n`;
                }
            } catch (err) {
                // Skip unreadable files
            }
        }
    }

    // --- 3. Token Count ---
    // Using your preferred approximation (chars / 4)
    const tokenCount = Math.ceil(output.length / 4);

    // CRITICAL FIX: Return an OBJECT, not just the string
    return {
        output: output,
        tokens: tokenCount
    };
}
