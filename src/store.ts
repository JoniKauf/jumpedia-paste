import {
    mkdir,
    readFile,
    readdir,
    stat,
    unlink,
    writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

const DATA_DIRECTORY =
    process.env.PASTE_DATA_DIRECTORY ??
    join(process.cwd(), "data", "pastes");

const MAX_PASTE_SIZE = 10 * 1024 * 1024;
const PASTE_LIFETIME = 10 * 60 * 1000;

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

export async function createPaste(content: Buffer): Promise<string> {
    if (content.length > MAX_PASTE_SIZE) {
        throw new PasteTooLargeError();
    }

    while (true) {
        const id = randomBytes(12).toString("base64url");
        const path = getPath(id);

        try {
            await writeFile(path, content, { flag: "wx" });
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

    try {
        return await readFile(path);
    } catch {
        throw new PasteNotFoundError();
    }
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
    const expiration = Date.now() - PASTE_LIFETIME;

    for (const name of await readdir(DATA_DIRECTORY)) {
        if (!ID_PATTERN.test(name)) {
            continue;
        }

        const path = join(DATA_DIRECTORY, name);

        try {
            const information = await stat(path);

            if (information.mtime.getTime() <= expiration) {
                await unlink(path);
            }
        } catch {
            // The file may have disappeared between operations.
        }
    }
}