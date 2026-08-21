import {
    createHash,
} from "node:crypto";

import {
    mkdir,
    readFile,
    readdir,
    stat,
    unlink,
    writeFile,
} from "node:fs/promises";

import {
    join,
} from "node:path";

import * as fzstd from "fzstd";

const DATA_DIRECTORY =
    process.env.PASTE_DATA_DIRECTORY ??
    join(
        process.cwd(),
        "data",
    );

const PASTE_DIRECTORY =
    join(
        DATA_DIRECTORY,
        "pastes",
    );

const PASTE_LIFETIME =
    10 * 60 * 1000;

export class PasteNotFoundError
    extends Error
{
    constructor() {
        super("Paste not found.");
        this.name =
            "PasteNotFoundError";
    }
}

export async function initializeStore(): Promise<void> {
    await mkdir(
        PASTE_DIRECTORY,
        {
            recursive: true,
        },
    );
}

function getPastePath(
    id: string,
): string {
    return join(
        PASTE_DIRECTORY,
        `${id}.zst`,
    );
}

export async function savePaste(
    content: Buffer,
): Promise<string> {
    await initializeStore();

    const id =
        createHash("sha256")
            .update(content)
            .digest("hex");

    /*
     * writeFile always updates mtime, even when overwriting a file
     * with identical bytes. So re-submitting the same content
     * naturally "renews" it for another PASTE_LIFETIME window,
     * since deleteExpiredPastes below keys off mtime.
     */
    await writeFile(
        getPastePath(id),
        content,
    );

    return id;
}

export async function getPaste(
    id: string,
): Promise<Buffer> {
    try {
        const compressed =
            await readFile(
                getPastePath(id),
            );

        return Buffer.from(
            fzstd.decompress(
                compressed,
            ),
        );
    } catch (error: unknown) {
        if (
            error instanceof Error &&
            "code" in error &&
            error.code === "ENOENT"
        ) {
            throw new PasteNotFoundError();
        }

        throw error;
    }
}

export async function deleteExpiredPastes(): Promise<void> {
    await initializeStore();

    const now =
        Date.now();

    const entries =
        await readdir(
            PASTE_DIRECTORY,
            {
                withFileTypes: true,
            },
        );

    for (
        const entry of entries
    ) {
        if (
            !entry.isFile() ||
            !entry.name.endsWith(".zst")
        ) {
            continue;
        }

        const path =
            join(
                PASTE_DIRECTORY,
                entry.name,
            );

        /*
         * Each entry is handled independently so that one bad
         * stat/unlink (e.g. a concurrent savePaste rewriting the
         * same file, or something else deleting it between the
         * readdir above and here) can't abort the rest of the
         * sweep or crash the whole cleanup tick.
         */
        try {
            const information =
                await stat(path);

            if (
                now -
                information.mtimeMs >=
                PASTE_LIFETIME
            ) {
                await unlink(path);

                console.log(
                    `Deleted expired paste: ${entry.name}`,
                );
            }
        } catch (error: unknown) {
            if (
                error instanceof Error &&
                "code" in error &&
                error.code === "ENOENT"
            ) {
                // Already gone (e.g. race with a rewrite/delete) - fine.
                continue;
            }

            console.error(
                `Failed to check/delete paste ${entry.name}:`,
                error,
            );
        }
    }
}