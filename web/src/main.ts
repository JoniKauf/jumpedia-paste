import {
    renderTable,
} from "./table.js";

interface TableData {
    headers: string[];
    rows: string[][][];
}

declare global {
    interface Window {
        PASTE_ID: string;
        PASTE_DATA: TableData;
    }
}

function requireElement<T extends HTMLElement>(
    id: string,
): T {
    const element =
        document.getElementById(id);

    if (
        element === null
    ) {
        throw new Error(
            `Missing required element: #${id}`,
        );
    }

    return element as T;
}

const container =
    requireElement<HTMLDivElement>(
        "table-container",
    );

const rawButton =
    requireElement<HTMLButtonElement>(
        "raw-button",
    );

const jsonButton =
    requireElement<HTMLButtonElement>(
        "json-button",
    );

const tableData =
    window.PASTE_DATA;

rawButton.addEventListener(
    "click",
    () => {
        window.location.href =
            `/p/${encodeURIComponent(
                window.PASTE_ID,
            )}/raw`;
    },
);

jsonButton.addEventListener(
    "click",
    () => {
        window.location.href =
            `/p/${encodeURIComponent(
                window.PASTE_ID,
            )}/json`;
    },
);

try {
    renderTable(
        container,
        tableData,
    );
} catch (
    error: unknown
) {
    const errorElement =
        document.createElement(
            "div",
        );

    errorElement.className =
        "error";

    errorElement.textContent =
        error instanceof Error
            ? error.message
            : "Failed to render table.";

    container.replaceChildren(
        errorElement,
    );
}