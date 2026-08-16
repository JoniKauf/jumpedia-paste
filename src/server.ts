import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import ejs from "ejs";

import {
    getPaste,
    initializeStore,
    PasteNotFoundError,
} from "./store.js";
import { startCleanup } from "./cleanup.js";

const HOST = process.env.HOST ?? "127.0.0.1";
const PORT = Number(process.env.PORT ?? 8000);

const WEB_DIRECTORY = join(process.cwd(), "web");

const pasteTemplate = await readFile(
    join(WEB_DIRECTORY, "paste.ejs"),
    "utf8",
);

const pasteCss = await readFile(
    join(WEB_DIRECTORY, "paste.css"),
    "utf8",
);

function parsePastePath(pathname: string): {
    id: string;
    raw: boolean;
} | null {
    const match = pathname.match(/^\/p\/([A-Za-z0-9_-]+)(\/raw)?$/);

    if (match === null) {
        return null;
    }

    return {
        id: match[1],
        raw: match[2] !== undefined,
    };
}

const server = createServer(async (request, response) => {
    if (request.method !== "GET") {
        response.writeHead(405);
        response.end("Method Not Allowed");
        return;
    }

    const url = new URL(
        request.url ?? "/",
        `http://${request.headers.host ?? "localhost"}`,
    );

    if (url.pathname === "/health") {
        response.writeHead(200, {
            "Content-Type": "text/plain; charset=utf-8",
        });

        response.end("ok");
        return;
    }

    if (url.pathname === "/paste.css") {
        response.writeHead(200, {
            "Content-Type": "text/css; charset=utf-8",
        });

        response.end(pasteCss);
        return;
    }

    const paste = parsePastePath(url.pathname);

    if (paste === null) {
        response.writeHead(404);
        response.end("Not Found");
        return;
    }

    try {
        const content = await getPaste(paste.id);

        if (paste.raw) {
            response.writeHead(200, {
                "Content-Type": "text/plain; charset=utf-8",
                "X-Content-Type-Options": "nosniff",
            });

            response.end(content);
            return;
        }

        const html = ejs.render(pasteTemplate, {
            id: paste.id,
            content: content.toString("utf8"),
        });

        response.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8",
            "X-Content-Type-Options": "nosniff",
        });

        response.end(html);
    } catch (error) {
        if (error instanceof PasteNotFoundError) {
            response.writeHead(404);
            response.end("Paste Not Found");
            return;
        }

        console.error(error);

        response.writeHead(500);
        response.end("Internal Server Error");
    }
});

await initializeStore();
startCleanup();

server.listen(PORT, HOST, () => {
    console.log(`Listening on http://${HOST}:${PORT}`);
});