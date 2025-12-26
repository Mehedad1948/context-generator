// src/core.ts
import * as fs from 'fs';
import * as path from 'path';

export interface TreeItem {
    name: string;
    path: string;
    type: 'file' | 'folder';
    children?: TreeItem[];
}

export interface GeneratorConfig {
    selections: { 
        [path: string]: { tree: boolean; content: boolean } 
    };
    userPrompt?: string;
    includeReadme?: boolean;
}

export async function scanDirectory(rootPath: string): Promise<TreeItem[]> {
    const items: TreeItem[] = [];
    // Added common lock files and system folders to ignore list
    const ignoreList = ['.git', 'node_modules', 'dist', 'out', 'build', '.DS_Store', '.vscode', 'package-lock.json', 'yarn.lock'];

    async function walk(dir: string, list: TreeItem[]) {
        try {
            const files = await fs.promises.readdir(dir, { withFileTypes: true });

            // Sort: Folders first, then files (Case insensitive sort looks better)
            files.sort((a, b) => {
                if (a.isDirectory() === b.isDirectory()) {
                    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
                }
                return a.isDirectory() ? -1 : 1;
            });

            for (const file of files) {
                if (ignoreList.includes(file.name)) continue;

                const fullPath = path.join(dir, file.name);
                const isDir = file.isDirectory();

                const item: TreeItem = {
                    name: file.name,
                    path: fullPath,
                    type: isDir ? 'folder' : 'file'
                };

                if (isDir) {
                    item.children = [];
                    await walk(fullPath, item.children);
                }

                list.push(item);
            }
        } catch (error) {
            console.error(`Failed to read directory ${dir}:`, error);
        }
    }

    await walk(rootPath, items);
    return items;
}

export async function generateContext(rootPath: string, config: GeneratorConfig): Promise<{ output: string; tokens: number }> {
    let output = '';

    // 1. ADD USER PROMPT
    if (config.userPrompt && config.userPrompt.trim()) {
        output += `USER INSTRUCTIONS:\n`;
        output += `${config.userPrompt}\n`;
        output += `================================================================\n\n`;
    }

    // 2. ADD README (Special Handling)
    if (config.includeReadme) {
        const readmeVariants = ['README.md', 'Readme.md', 'readme.md', 'README.txt'];
        
        for (const variant of readmeVariants) {
            const readmePath = path.join(rootPath, variant);
            if (fs.existsSync(readmePath)) {
                try {
                    const content = fs.readFileSync(readmePath, 'utf-8');
                    output += `PROJECT README (${variant}):\n\n`;
                    output += content;
                    output += `\n\n================================================================\n\n`;
                    break; // Stop after finding the first match
                } catch (e) {
                    console.error("Error reading README:", e);
                }
            }
        }
    }

    // 3. PROJECT STRUCTURE (Tree)
    // We filter the keys of selections where tree=true
    const validPaths = Object.keys(config.selections).filter(p => config.selections[p].tree);
    
    if (validPaths.length > 0) {
        output += `PROJECT STRUCTURE:\n`;
        // Sort paths alphabetically for cleaner tree output
        validPaths.sort().forEach(filePath => {
            // Convert to relative path for cleaner output
            const relativePath = path.relative(rootPath, filePath);
            // Normalized relative path (replace backslashes for consistency in output)
            output += `- ${relativePath.split(path.sep).join('/')}\n`;
        });
        output += `\n================================================================\n\n`;
    }

    // 4. FILE CONTENTS
    output += `FILE CONTENTS:\n\n`;
    const contentPaths = Object.keys(config.selections).filter(p => config.selections[p].content).sort();

    for (const filePath of contentPaths) {
        // Skip if file no longer exists
        if (!fs.existsSync(filePath)) continue;

        // Skip folders (folders can be checked in UI, but have no text content)
        try {
            const stat = fs.statSync(filePath);
            if (!stat.isFile()) continue;

            const relativePath = path.relative(rootPath, filePath);
            const normalizedPath = relativePath.split(path.sep).join('/');
            
            const fileContent = fs.readFileSync(filePath, 'utf-8');

            output += `--- START FILE: ${normalizedPath} ---\n`;
            output += fileContent + '\n';
            output += `--- END FILE: ${normalizedPath} ---\n\n`;
        } catch (error) {
            console.error(`Error processing file ${filePath}:`, error);
            output += `[Error reading file: ${filePath}]\n\n`;
        }
    }

    // Rough token estimation (4 characters ~= 1 token)
    const tokens = Math.ceil(output.length / 4);

    return { output, tokens };
}
