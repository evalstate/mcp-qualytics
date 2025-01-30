import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { promises as fs } from 'fs';
import { parse } from "@typescript-eslint/typescript-estree";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FIXTURES_DIR = join(__dirname, '..', 'test', 'fixtures');
const SNAPSHOTS_DIR = join(__dirname, '..', 'test', 'snapshots');

// Import analyzer from source to get type information
import type { MetricsResult } from '../dist/types/metrics.js';
let functionAnalyzer: { analyzeFunctions(node: any): { name: string, type: string, startLine: number, endLine: number, metrics: MetricsResult }[] };

async function createSnapshot(fixturePath: string): Promise<string> {
    try {
        const code = await fs.readFile(fixturePath, 'utf8');
        console.log(`Parsing file: ${fixturePath}`);
        const ast = parse(code, {
            loc: true,
            range: true,
            tokens: true,
            comment: true,
            useJSXTextNode: true,
            jsx: true,
            errorOnUnknownASTType: true,
        });
        
        const analysis = functionAnalyzer.analyzeFunctions(ast);
        return JSON.stringify(analysis, null, 2);
    } catch (error) {
        console.error(`Error processing file ${fixturePath}:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to process ${fixturePath}: ${errorMessage}`);
    }
}

async function saveSnapshot(fixtureName: string, content: string): Promise<void> {
    const snapshotPath = join(SNAPSHOTS_DIR, `${fixtureName}.snapshot.json`);
    await fs.writeFile(snapshotPath, content);
}

async function compareWithSnapshot(fixtureName: string, content: string): Promise<boolean> {
    const snapshotPath = join(SNAPSHOTS_DIR, `${fixtureName}.snapshot.json`);
    try {
        const snapshot = await fs.readFile(snapshotPath, 'utf8');
        return snapshot === content;
    } catch (error) {
        console.error(`No snapshot found for ${fixtureName}`);
        return false;
    }
}

async function generateSnapshots(): Promise<void> {
    await fs.mkdir(SNAPSHOTS_DIR, { recursive: true });
    
    const files = await fs.readdir(FIXTURES_DIR);
    for (const file of files) {
        if (file.endsWith('.ts')) {
            const fixturePath = join(FIXTURES_DIR, file);
            const snapshot = await createSnapshot(fixturePath);
            await saveSnapshot(file, snapshot);
            console.log(`Created snapshot for ${file}`);
        }
    }
}

async function verifySnapshots(): Promise<boolean> {
    let success = true;
    const files = await fs.readdir(FIXTURES_DIR);
    
    for (const file of files) {
        if (file.endsWith('.ts')) {
            const fixturePath = join(FIXTURES_DIR, file);
            const snapshot = await createSnapshot(fixturePath);
            const matches = await compareWithSnapshot(file, snapshot);
            
            if (!matches) {
                console.error(`❌ Snapshot mismatch for ${file}`);
                success = false;
            } else {
                console.log(`✅ Snapshot matches for ${file}`);
            }
        }
    }
    
    return success;
}

// Command line interface
async function main() {
    // Wait for the module to load
    await import('../dist/metrics/function-analyzer.js').then(module => {
        functionAnalyzer = module.functionAnalyzer;
    });

    const command = process.argv[2];
    if (command === 'generate') {
        await generateSnapshots().catch(error => {
            console.error('Error generating snapshots:', error);
            process.exit(1);
        });
    } else if (command === 'verify') {
        const success = await verifySnapshots().catch(error => {
            console.error('Error verifying snapshots:', error);
            process.exit(1);
            return false;
        });
        process.exit(success ? 0 : 1);
    } else {
        console.error('Please specify either "generate" or "verify" as command');
        process.exit(1);
    }
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});