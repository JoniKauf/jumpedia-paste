import {
    mkdir,
    readFile,
    readdir,
    stat,
    unlink,
    utimes,
    writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { TimeSpan } from "node:time"
const DATA_DIRECTORY =
    process.env.PASTE_DATA_DIRECTORY ??
    join(process.cwd(), "data", "pastes");

const MAX_PASTE_SIZE = 10 * 1024 * 1024;

const ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export class PasteNotFoundError extends Error {}

export class PasteTooLargeError extends Error {}

export async function initializeStore(): Promise<void> {
    await mkdir(DATA_DIRECTORY, { recursive: true });
}

function getPath(id: string): string {
    if (!ID_PATTERN.test(id)) {
        throw new PasteNotFoundError();
    }

    return join(DATA_DIRECTORY, id);
}

export async function createPaste(
    content: Buffer,
    expiresAt: Date,
): Promise<string> {
    if (content.length > MAX_PASTE_SIZE) {
        throw new PasteTooLargeError();
    }

    while (true) {
        const id = randomBytes(9).toString("base64url");
        const path = getPath(id);

        try {
            await writeFile(path, content, { flag: "wx" });
            await utimes(path, expiresAt, expiresAt);
            return id;
        } catch (error) {
            if (
                error instanceof Error &&
                "code" in error &&
                error.code === "EEXIST"
            ) {
                continue;
            }

            throw error;
        }
    }
}

export async function getPaste(id: string): Promise<Buffer> {
    const path = getPath(id);

    let information;

    try {
        information = await stat(path);
    } catch {
        throw new PasteNotFoundError();
    }

    if (information.mtime <= new Date()) {
        await deletePaste(id);
        throw new PasteNotFoundError();
    }

    return readFile(path);
}

export async function deletePaste(id: string): Promise<void> {
    try {
        await unlink(getPath(id));
    } catch (error) {
        if (
            !(error instanceof Error) ||
            !("code" in error) ||
            error.code !== "ENOENT"
        ) {
            throw error;
        }
    }
}

export async function deleteExpiredPastes(): Promise<void> {
    const now = new Date();
    const expiration = new Date(now.getTime() - 10 * 60 * 1000);

    for (const name of await readdir(DATA_DIRECTORY)) {
        if (!ID_PATTERN.test(name)) {
            continue;
        }

        const path = join(DATA_DIRECTORY, name);

        try {
            const information = await stat(path);

            if (information.mtime <= expiration) {
                await unlink(path);
            }
        } catch {
            // The file may have disappeared between operations.
        }
    }
}