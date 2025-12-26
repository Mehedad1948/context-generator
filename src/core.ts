// src/core.ts
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import fg from 'fast-glob';
import { ContextResult, FileNode, GeneratorConfig } from './types';

// Helper to build tree from paths
function buildTree(paths: string[], rootPath: string): FileNode[] {
    const root: FileNode[] = [];
    
    paths.forEach(filePath => {
        const parts = filePath.split('/'); 
        let currentLevel = root;
        let currentPath = '';

        parts.forEach((part, index) => {
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            const isFile = index === parts.length - 1;
            
            let existingNode = currentLevel.find(n => n.name === part);

            if (!existingNode) {
                const newNode: FileNode = {
                    name: part,
                    path: currentPath,
                    type: isFile ? 'file' : 'folder',
                    children: isFile ? undefined : []
                };
                currentLevel.push(newNode);
                existingNode = newNode;
            }

            if (!isFile && existingNode.children) {
                currentLevel = existingNode.children;
            }
        });
    });

    const sortNodes = (nodes: FileNode[]) => {
        nodes.sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'folder' ? -1 : 1;
        });
        nodes.forEach(n => {
            if (n.children) sortNodes(n.children);
        });
    };
    
    sortNodes(root);
    return root;
}

export async function scanDirectory(rootPath: string) {
    const entries = await fg(['**/*'], {
        cwd: rootPath,
        ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**', '**/.vscode/**', '**/*.lock'],
        onlyFiles: true,
        markDirectories: false,
        dot: true
    });

    return buildTree(entries, rootPath);
}

export async function generateContext(rootPath: string, config: GeneratorConfig): Promise<ContextResult> {
    let output = '';
    const selections = config.selections;

    // --- 1. User Prompt ---
    if (config.userPrompt && config.userPrompt.trim()) {
        output += `# User Instructions\n${config.userPrompt}\n\n`;
    }

    // --- 2. Root README (Optional) ---
    if (config.includeReadme) {
        try {
            // Try common readme names
            const readmeCandidates = ['README.md', 'readme.md', 'Readme.md'];
            let readmeContent = '';
            for (const name of readmeCandidates) {
                const p = path.join(rootPath, name);
                if (fs.existsSync(p)) {
                    readmeContent = fs.readFileSync(p, 'utf-8');
                    break;
                }
            }
            if (readmeContent) {
                output += `# Project README\n\`\`\`markdown\n${readmeContent}\n\`\`\`\n\n`;
            }
        } catch (e) { /* ignore if read fails */ }
    }
    
    // --- 3. Project Tree ---
    output += '# Project Tree\n```\n';

const printTree = (dir: string, currentRelativePath: string, prefix: string = '') => {
let items: fs.Dirent[] = [];
try {
items = fs.readdirSync(dir, { withFileTypes: true });
} catch (e) { return; }

const filteredItems = items.filter(item => {
const relPath = currentRelativePath ? `${currentRelativePath}/${item.name}` : item.name;
if (item.name.startsWith('.') || item.name === 'node_modules' || item.name === 'dist' || item.name === 'build') return false;

const itemConfig = selections[relPath];
// If it's not in the selection map (e.g. a new file), default to included? Or excluded?
// Based on UI defaults, it should be in the map. If missing, assume excluded or included based on logic.
// Safe bet: if itemConfig exists and tree is false, exclude.
if (itemConfig && !itemConfig.tree) return false; 
return true;
});

filteredItems.forEach((item, index) => {
const isLast = index === filteredItems.length - 1;
const pointer = isLast ? '└── ' : '├── ';
const relPath = currentRelativePath ? `${currentRelativePath}/${item.name}` : item.name;

output += `${prefix}${pointer}${item.name}\n`;

if (item.isDirectory()) {
printTree(path.join(dir, item.name), relPath, prefix + (isLast ? '    ' : '│   '));
}
});
};

try {
printTree(rootPath, '');
} catch (e) {
output += `Error generating tree: ${e}\n`;
}
output += '```\n\n';

    // --- 4. File Contents ---
    output += '# File Contents\n\n';

    const entries = await fg(['**/*'], {
        cwd: rootPath,
        ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**', '**/.vscode/**'],
        onlyFiles: true,
        absolute: false 
    });

    for (const relativePath of entries) {
        const normalizedPath = relativePath.split(path.sep).join('/');
        const fileConfig = selections[normalizedPath];

        if (fileConfig && fileConfig.content) {
            try {
                const fullPath = path.join(rootPath, relativePath);
                const content = fs.readFileSync(fullPath, 'utf-8');
                const ext = path.extname(relativePath);
                
                if (content.indexOf('\0') === -1) {
                    output += `## File: ${relativePath}\n\`\`\`${ext.replace('.', '')}\n${content}\n\`\`\`\n\n`;
                }
            } catch (err) { }
        }
    }

    const tokenCount = Math.ceil(output.length / 4);

    return {
        output: output,
        tokens: tokenCount
    };
}
