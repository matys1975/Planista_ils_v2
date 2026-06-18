import fs from 'fs';
import { spawn } from 'child_process';
import type { CommandSpec } from './commandBuilder';

export interface CommandResult {
    stdout: Buffer;
    stderr: string;
    stdoutBytes: number;
}

interface RunOptions {
    stdinFile?: string;
    stdoutFile?: string;
    collectStdout?: boolean;
    maxBuffer?: number;
}

export function runCommand(spec: CommandSpec, options: RunOptions = {}): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
        const child = spawn(spec.command, spec.args, {
            cwd: spec.cwd,
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: false,
            windowsHide: true,
        });

        const chunks: Buffer[] = [];
        let stdoutBytes = 0;
        let stderr = '';
        let settled = false;
        const collectStdout = options.collectStdout !== false;
        const stdoutFile = options.stdoutFile ? fs.createWriteStream(options.stdoutFile) : undefined;

        const fail = (error: Error) => {
            if (settled) return;
            settled = true;
            child.kill();
            stdoutFile?.destroy();
            reject(error);
        };

        if (options.stdinFile) {
            const input = fs.createReadStream(options.stdinFile);
            input.on('error', fail);
            input.pipe(child.stdin);
        } else {
            child.stdin.end();
        }

        child.stdout.on('data', (chunk: Buffer) => {
            stdoutBytes += chunk.length;
            if (options.maxBuffer && stdoutBytes > options.maxBuffer) {
                fail(new Error(`Command stdout exceeded ${options.maxBuffer} bytes`));
                return;
            }
            if (collectStdout) chunks.push(chunk);
            if (stdoutFile && !stdoutFile.write(chunk)) {
                child.stdout.pause();
            }
        });

        stdoutFile?.on('drain', () => child.stdout.resume());
        stdoutFile?.on('error', fail);

        child.stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
            if (options.maxBuffer && Buffer.byteLength(stderr) > options.maxBuffer) {
                fail(new Error(`Command stderr exceeded ${options.maxBuffer} bytes`));
            }
        });

        child.on('error', fail);
        child.on('close', (code) => {
            const finish = () => {
                if (settled) return;
                settled = true;
                if (code !== 0) {
                    reject(new Error(`${spec.command} exited with code ${code}: ${stderr}`));
                    return;
                }
                resolve({
                    stdout: collectStdout ? Buffer.concat(chunks) : Buffer.alloc(0),
                    stderr,
                    stdoutBytes,
                });
            };

            if (stdoutFile) {
                stdoutFile.end(finish);
            } else {
                finish();
            }
        });
    });
}
