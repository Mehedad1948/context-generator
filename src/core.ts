// src/core.ts
import * as fs from 'fs-extra';
import * as path from 'path';
import * as glob from 'glob';
import ignore from 'ignore';
import { encode } from 'gpt-3-encoder';

export interface ContextOutput {
    project_name: string;
    root: string;
    structure: any;
    files: Record<string, string>;
    token_count: number;
}

// Helper to count tokens
function countTokens(text: string): number {
    return encode(text).length;
}

// 1. Build Directory Tree
export async function buildTree(dir: string, ig: any, rootPath: string): Promise<any> {
    const name = path.basename(dir);
    const stats = await fs.stat(dir);
    
    // Check ignore rules relative to root
    const relativePath = path.relative(rootPath, dir);
    if (relativePath && ig.ignores(relativePath)) return null;

    if (!stats.isDirectory()) {
        return { type: 'file', name };
    }

    const children: any[] = [];
    const entries = await fs.readdir(dir);

    for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const childNode = await buildTree(fullPath, ig, rootPath);
        if (childNode) children.push(childNode);
    }

    // Sort: directories first, then files
    children.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'dir' ? -1 : 1;
    });

    return { type: 'dir', name, children };
}

// 2. Main Generation Function
export async function generateContext(folderPath: string): Promise<ContextOutput> {
    const rootName = path.basename(folderPath);
    
    // Setup Ignore (Standard .gitignore + common junk)
    const ig = ignore().add(['.git', 'node_modules', 'dist', 'out', '.vscode', '*.log', '.DS_Store']);
    const gitIgnorePath = path.join(folderPath, '.gitignore');
    if (await fs.pathExists(gitIgnorePath)) {
        ig.add((await fs.readFile(gitIgnorePath)).toString());
    }

    // Generate Structure
    const structure = await buildTree(folderPath, ig, folderPath);

    // Read Files (Simple logic: read small text files)
    const filesData: Record<string, string> = {};
    const allFiles = glob.sync('**/*', { 
        cwd: folderPath, 
        nodir: true, 
        dot: true,
        ignore: ['**/.git/**', '**/node_modules/**', '**/*.png', '**/*.jpg', '**/*.exe', '**/package-lock.json'] 
    });

    for (const f of allFiles) {
        if (ig.ignores(f)) continue;
        
        try {
            const fullPath = path.join(folderPath, f);
            const content = await fs.readFile(fullPath, 'utf-8');
            // Only include reasonable size text files
            if (content.length < 50000) { 
                filesData[f] = content;
            }
        } catch (e) {
            // Skip binary or unreadable files
        }
    }

    const fullJson = {
        project_name: rootName,
        root: path.basename(folderPath),
        structure: structure,
        files: filesData
    };
    
    // Calculate total tokens
    const jsonString = JSON.stringify(fullJson);
    const totalTokens = countTokens(jsonString);

    return {
        ...fullJson,
        token_count: totalTokens
    };
}
