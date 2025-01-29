import { promises as fs } from 'fs';
import path from 'path';
import { functionAnalyzer } from '../src/metrics/function-analyzer.js';
import { parse } from "@typescript-eslint/typescript-estree";

const FIXTURES_DIR = path.join(process.cwd(), 'test/fixtures');
const SNAPSHOTS_DIR = path.join(process.cwd(), 'test/snapshots');

async function createSnapshot(fixturePath: string): Promise<string> {
    const code = await fs.readFile(fixturePath, 'utf8');
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
}

async function saveSnapshot(fixtureName: string, content: string): Promise<void> {
    const snapshotPath = path.join(SNAPSHOTS_DIR, `${fixtureName}.snapshot.json`);
    await fs.writeFile(snapshotPath, content);
}

async function compareWithSnapshot(fixtureName: string, content: string): Promise<boolean> {
    const snapshotPath = path.join(SNAPSHOTS_DIR, `${fixtureName}.snapshot.json`);
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
            const fixturePath = path.join(FIXTURES_DIR, file);
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
            const fixturePath = path.join(FIXTURES_DIR, file);
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
const command = process.argv[2];
if (command === 'generate') {
    generateSnapshots().catch(console.error);
} else if (command === 'verify') {
    verifySnapshots().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error(error);
        process.exit(1);
    });
} else {
    console.error('Please specify either "generate" or "verify" as command');
    process.exit(1);
}