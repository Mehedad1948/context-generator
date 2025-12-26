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
    const ignoreList = ['.git', 'node_modules', 'dist', 'out', 'build', '.DS_Store', '.vscode'];

    async function walk(dir: string, list: TreeItem[]) {
        try {
            const files = await fs.promises.readdir(dir, { withFileTypes: true });

            // Sort: Folders first, then files
            files.sort((a, b) => {
                if (a.isDirectory() === b.isDirectory()) {
                    return a.name.localeCompare(b.name);
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
        let readmeFound = false;
        
        for (const variant of readmeVariants) {
            const readmePath = path.join(rootPath, variant);
            if (fs.existsSync(readmePath)) {
                try {
                    const content = fs.readFileSync(readmePath, 'utf-8');
                    output += `PROJECT README (${variant}):\n\n`;
                    output += content;
                    output += `\n\n================================================================\n\n`;
                    readmeFound = true;
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
        validPaths.sort().forEach(filePath => {
            // Convert to relative path for cleaner output
            const relativePath = path.relative(rootPath, filePath);
            output += `- ${relativePath}\n`;
        });
        output += `\n================================================================\n\n`;
    }

    // 4. FILE CONTENTS
    output += `FILE CONTENTS:\n\n`;
    const contentPaths = Object.keys(config.selections).filter(p => config.selections[p].content).sort();

    for (const filePath of contentPaths) {
        // Skip if file no longer exists
        if (!fs.existsSync(filePath)) continue;

        // Skip folders (sometimes folders get checked for content in UI, but we can't print folder content)
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) continue;

        try {
            const relativePath = path.relative(rootPath, filePath);
            const fileContent = fs.readFileSync(filePath, 'utf-8');

            output += `--- START FILE: ${relativePath} ---\n`;
            output += fileContent + '\n';
            output += `--- END FILE: ${relativePath} ---\n\n`;
        } catch (error) {
            output += `Error reading file: ${filePath}\n\n`;
        }
    }

    // Rough token estimation (4 characters ~= 1 token)
    const tokens = Math.ceil(output.length / 4);

    return { output, tokens };
}
