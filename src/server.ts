import {
    createServer,
} from "node:http";

import {
    readFile,
} from "node:fs/promises";

import {
    join,
} from "node:path";

import ejs from "ejs";

import {
    getPaste,
    initializeStore,
    PasteNotFoundError,
} from "./store.js";

import {
    startCleanup,
} from "./cleanup.js";

const HOST =
    process.env.HOST ??
    "127.0.0.1";

const PORT =
    Number(
        process.env.PORT ?? 8000,
    );

const WEB_DIRECTORY =
    join(
        process.cwd(),
        "web",
    );

const FRONTEND_DIRECTORY =
    join(
        process.cwd(),
        "dist",
        "web",
        "src",
    );

const indexTemplate =
    await readFile(
        join(
            WEB_DIRECTORY,
            "index.ejs",
        ),
        "utf8",
    );

const jsonTemplate =
    await readFile(
        join(
            WEB_DIRECTORY,
            "json.ejs",
        ),
        "utf8",
    );

const rawTemplate =
    await readFile(
        join(
            WEB_DIRECTORY,
            "raw.ejs",
        ),
        "utf8",
    );

const styleCss =
    await readFile(
        join(
            WEB_DIRECTORY,
            "style.css",
        ),
        "utf8",
    );

const mainJs =
    await readFile(
        join(
            FRONTEND_DIRECTORY,
            "main.js",
        ),
        "utf8",
    );

const tableJs =
    await readFile(
        join(
            FRONTEND_DIRECTORY,
            "table.js",
        ),
        "utf8",
    );

interface TableData {
    headers: string[];
    rows: string[][][];
}

function parseTableData(
    content: Buffer,
): TableData {
    const data =
        JSON.parse(
            content.toString(
                "utf8",
            ),
        ) as unknown;

    if (
        typeof data !== "object" ||
        data === null ||
        !("headers" in data) ||
        !("rows" in data) ||
        !Array.isArray(
            data.headers,
        ) ||
        !Array.isArray(
            data.rows,
        )
    ) {
        throw new Error(
            "Invalid paste format.",
        );
    }

    return data as TableData;
}

/*
 * Renders the table as a fixed-width plain-text grid:
 *
 *   Name | Difficulty
 *   -----+------------
 *   abc  | abc2
 *
 * Each column's width is the max of its header length and every
 * cell's rendered length (multi-value cells are joined with ", "
 * since a plain-text grid can't represent embedded newlines
 * without breaking alignment). The divider row uses "+" at each
 * column intersection and "-" padded to width + 2, matching the
 * single space of padding on either side of the " | " separator.
 */
function formatRawTable(
    data: TableData,
): string {
    const headers =
        data.headers;

    const rows =
        data.rows;

    if (
        headers.length === 0
    ) {
        return "(empty table)";
    }

    const cellText = (
        row: string[][],
        columnIndex: number,
    ): string => {
        const cell =
            row[columnIndex];

        if (
            cell === undefined ||
            cell.length === 0
        ) {
            return "";
        }

        return cell.join(", ");
    };

    const widths =
        headers.map(
            (header, columnIndex) => {
                let width =
                    header.length;

                for (
                    const row of rows
                ) {
                    const text =
                        cellText(
                            row,
                            columnIndex,
                        );

                    if (
                        text.length >
                        width
                    ) {
                        width =
                            text.length;
                    }
                }

                return width;
            },
        );

    const padCell = (
        text: string,
        columnIndex: number,
    ): string => {
        const width =
            widths[columnIndex] ??
            text.length;

        return (
            text +
            " ".repeat(
                Math.max(
                    0,
                    width -
                        text.length,
                ),
            )
        );
    };

    const headerLine =
        headers
            .map(
                (header, columnIndex) =>
                    padCell(
                        header,
                        columnIndex,
                    ),
            )
            .join(" | ");

    const dividerLine =
        widths
            .map(
                (width) =>
                    "-".repeat(
                        width,
                    ),
            )
            .join("-+-");

    const rowLines =
        rows.map(
            (row) =>
                headers
                    .map(
                        (
                            _,
                            columnIndex,
                        ) =>
                            padCell(
                                cellText(
                                    row,
                                    columnIndex,
                                ),
                                columnIndex,
                            ),
                    )
                    .join(" | "),
        );

    return [
        headerLine,
        dividerLine,
        ...rowLines,
    ].join("\n");
}

function parsePastePath(
    pathname: string,
): {
    id: string;
    mode: "table" | "json" | "raw";
} | null {
    const match =
        pathname.match(
            /^\/p\/([a-f0-9]{64})(?:\/(json|raw|))?$/,
        );

    if (
        match === null
    ) {
        return null;
    }

    /*
     * With `noUncheckedIndexedAccess`, capture groups from a regex
     * match are typed as `string | undefined` even though we know
     * group 1 must be present when the overall match succeeds.
     * Guard explicitly instead of asserting the type away, so a
     * malformed match fails safe (404) rather than crashing.
     */
    const id =
        match[1];

    if (
        id === undefined
    ) {
        return null;
    }

    const modeSegment =
        match[2];

    let mode: "table" | "json" | "raw" =
        "table";

    if (
        modeSegment === "json"
    ) {
        mode = "json";
    } else if (
        modeSegment === "raw"
    ) {
        mode = "raw";
    }

    return {
        id,
        mode,
    };
}

function sendText(
    response: import("node:http").ServerResponse,
    status: number,
    content: string,
): void {
    response.writeHead(
        status,
        {
            "Content-Type":
                "text/plain; charset=utf-8",
            "X-Content-Type-Options":
                "nosniff",
        },
    );

    response.end(
        content,
    );
}

const server =
    createServer(
        async (
            request,
            response,
        ) => {
            if (
                request.method !==
                "GET"
            ) {
                sendText(
                    response,
                    405,
                    "Method Not Allowed",
                );

                return;
            }

            const url =
                new URL(
                    request.url ?? "/",
                    `http://${
                        request.headers.host ??
                        "localhost"
                    }`,
                );

            /*
             * Root
             */

            if (
                url.pathname === "/"
            ) {
                response.writeHead(
                    302,
                    {
                        Location:
                            "https://docs.jumpedia.dev",
                    },
                );

                response.end();

                return;
            }

            /*
             * Health
             */

            if (
                url.pathname ===
                "/health"
            ) {
                sendText(
                    response,
                    200,
                    "ok",
                );

                return;
            }

            /*
             * Assets
             */

            if (
                url.pathname ===
                "/p/assets/style.css"
            ) {
                response.writeHead(
                    200,
                    {
                        "Content-Type":
                            "text/css; charset=utf-8",
                        "X-Content-Type-Options":
                            "nosniff",
                    },
                );

                response.end(
                    styleCss,
                );

                return;
            }

            if (
                url.pathname ===
                "/p/assets/main.js"
            ) {
                response.writeHead(
                    200,
                    {
                        "Content-Type":
                            "text/javascript; charset=utf-8",
                        "X-Content-Type-Options":
                            "nosniff",
                    },
                );

                response.end(
                    mainJs,
                );

                return;
            }

            if (
                url.pathname ===
                "/p/assets/table.js"
            ) {
                response.writeHead(
                    200,
                    {
                        "Content-Type":
                            "text/javascript; charset=utf-8",
                        "X-Content-Type-Options":
                            "nosniff",
                    },
                );

                response.end(
                    tableJs,
                );

                return;
            }

            /*
             * Paste
             */

            const paste =
                parsePastePath(
                    url.pathname,
                );

            if (
                paste === null
            ) {
                sendText(
                    response,
                    404,
                    "Not Found",
                );

                return;
            }

            try {
                const content =
                    await getPaste(
                        paste.id,
                    );

                const data =
                    parseTableData(
                        content,
                    );

                /*
                 * JSON page
                 */

                if (
                    paste.mode ===
                    "json"
                ) {
                    const html =
                        ejs.render(
                            jsonTemplate,
                            {
                                id:
                                    paste.id,
                                data,
                            },
                        );

                    response.writeHead(
                        200,
                        {
                            "Content-Type":
                                "text/html; charset=utf-8",
                            "X-Content-Type-Options":
                                "nosniff",
                        },
                    );

                    response.end(
                        html,
                    );

                    return;
                }

                /*
                 * Raw page
                 */

                if (
                    paste.mode ===
                    "raw"
                ) {
                    const raw =
                        formatRawTable(
                            data,
                        );

                    const html =
                        ejs.render(
                            rawTemplate,
                            {
                                id:
                                    paste.id,
                                raw,
                            },
                        );

                    response.writeHead(
                        200,
                        {
                            "Content-Type":
                                "text/html; charset=utf-8",
                            "X-Content-Type-Options":
                                "nosniff",
                        },
                    );

                    response.end(
                        html,
                    );

                    return;
                }

                /*
                 * Table page
                 */

                const html =
                    ejs.render(
                        indexTemplate,
                        {
                            id:
                                paste.id,
                            data,
                        },
                    );

                response.writeHead(
                    200,
                    {
                        "Content-Type":
                            "text/html; charset=utf-8",
                        "X-Content-Type-Options":
                            "nosniff",
                    },
                );

                response.end(
                    html,
                );
            } catch (
                error: unknown
            ) {
                if (
                    error instanceof
                    PasteNotFoundError
                ) {
                    sendText(
                        response,
                        404,
                        "Paste Not Found",
                    );

                    return;
                }

                console.error(
                    error,
                );

                sendText(
                    response,
                    500,
                    "Internal Server Error",
                );
            }
        },
    );

await initializeStore();

startCleanup();

server.listen(
    PORT,
    HOST,
    () => {
        console.log(
            `Listening on http://${HOST}:${PORT}`,
        );
    },
);