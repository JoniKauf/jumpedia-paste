export interface TableData {
    headers: string[];
    rows: string[][][];
}

const PAGE_SIZE =
    500;

export function renderTable(
    container: HTMLElement,
    data: TableData,
): void {
    const names =
        data.headers;

    const rows =
        data.rows;

    container.replaceChildren();

    if (
        names.length === 0
    ) {
        return;
    }

    const scroll =
        document.createElement(
            "div",
        );

    scroll.className =
        "table-scroll";

    const tableElement =
        document.createElement(
            "table",
        );

    tableElement.className =
        "data-table";

    const thead =
        document.createElement(
            "thead",
        );

    const headerRow =
        document.createElement(
            "tr",
        );

    const filters:
        HTMLInputElement[] =
        new Array(
            names.length,
        );

    for (
        let i = 0;
        i < names.length;
        i++
    ) {
        const th =
            document.createElement(
                "th",
            );

        const filter =
            document.createElement(
                "input",
            );

        filter.type =
            "text";

        filter.className =
            "column-filter";

        filter.placeholder =
            "Filter...";

        filter.autocomplete =
            "off";

        filter.spellcheck =
            false;

        const columnTitle =
            document.createElement(
                "div",
            );

        columnTitle.className =
            "column-title";

        columnTitle.textContent =
            names[i] ?? "";

        th.append(
            columnTitle,
            filter,
        );

        headerRow.appendChild(
            th,
        );

        filters[i] =
            filter;
    }

    thead.appendChild(
        headerRow,
    );

    const tbody =
        document.createElement(
            "tbody",
        );

    tableElement.append(
        thead,
        tbody,
    );

    scroll.appendChild(
        tableElement,
    );

    const pagination =
        document.createElement(
            "div",
        );

    pagination.className =
        "pagination";

    const previous =
        document.createElement(
            "button",
        );

    previous.type =
        "button";

    previous.className =
        "page-button";

    previous.textContent =
        "‹ Previous";

    const pageInfo =
        document.createElement(
            "span",
        );

    pageInfo.className =
        "page-info";

    const next =
        document.createElement(
            "button",
        );

    next.type =
        "button";

    next.className =
        "page-button";

    next.textContent =
        "Next ›";

    pagination.append(
        previous,
        pageInfo,
        next,
    );

    container.append(
        scroll,
        pagination,
    );

    let matchingRows =
        new Array<number>(
            rows.length,
        );

    for (
        let i = 0;
        i < rows.length;
        i++
    ) {
        matchingRows[i] =
            i;
    }

    let currentPage =
        0;

    function renderPage(): void {
        const pageCount =
            Math.max(
                1,
                Math.ceil(
                    matchingRows.length /
                    PAGE_SIZE,
                ),
            );

        if (
            currentPage >=
            pageCount
        ) {
            currentPage =
                pageCount - 1;
        }

        if (
            currentPage < 0
        ) {
            currentPage =
                0;
        }

        const start =
            currentPage *
            PAGE_SIZE;

        const end =
            Math.min(
                start +
                    PAGE_SIZE,
                matchingRows.length,
            );

        const fragment =
            document.createDocumentFragment();

        for (
            let position =
                start;
            position < end;
            position++
        ) {
            const rowIndex =
                matchingRows[
                    position
                ];

            if (
                rowIndex ===
                undefined
            ) {
                continue;
            }

            const row =
                rows[rowIndex];

            if (
                row === undefined
            ) {
                continue;
            }

            const tr =
                document.createElement(
                    "tr",
                );

            for (
                let columnIndex =
                    0;
                columnIndex <
                    names.length;
                columnIndex++
            ) {
                const cell =
                    row[
                        columnIndex
                    ];

                const td =
                    document.createElement(
                        "td",
                    );

                if (
                    cell ===
                        undefined ||
                    cell.length ===
                        0
                ) {
                    td.textContent =
                        "";
                } else {
                    td.textContent =
                        cell.join(
                            "\n",
                        );
                }

                tr.appendChild(
                    td,
                );
            }

            fragment.appendChild(
                tr,
            );
        }

        tbody.replaceChildren(
            fragment,
        );

        pageInfo.textContent =
            matchingRows.length ===
            0
                ? "No results"
                : `Page ${
                    currentPage + 1
                } of ${
                    pageCount
                } · ${
                    matchingRows.length
                        .toLocaleString()
                } results`;

        previous.disabled =
            currentPage === 0;

        next.disabled =
            currentPage >=
            pageCount - 1;

        scroll.scrollTop =
            0;
    }

    function applyFilters(): void {
        const activeFilters:
            [number, string][] =
            [];

        for (
            let i = 0;
            i < filters.length;
            i++
        ) {
            const filter =
                filters[i];

            if (
                filter ===
                undefined
            ) {
                continue;
            }

            const value =
                filter.value
                    .trim()
                    .toLowerCase();

            if (
                value !== ""
            ) {
                activeFilters.push(
                    [
                        i,
                        value,
                    ],
                );
            }
        }

        if (
            activeFilters.length ===
            0
        ) {
            matchingRows =
                new Array<number>(
                    rows.length,
                );

            for (
                let i = 0;
                i < rows.length;
                i++
            ) {
                matchingRows[i] =
                    i;
            }
        } else {
            matchingRows =
                [];

            for (
                let rowIndex =
                    0;
                rowIndex <
                    rows.length;
                rowIndex++
            ) {
                const row =
                    rows[rowIndex];

                if (
                    row ===
                    undefined
                ) {
                    continue;
                }

                let matches =
                    true;

                for (
                    const [
                        columnIndex,
                        filter,
                    ]
                    of activeFilters
                ) {
                    const cell =
                        row[
                            columnIndex
                        ];

                    if (
                        cell ===
                        undefined
                    ) {
                        matches =
                            false;

                        break;
                    }

                    let columnMatches =
                        false;

                    for (
                        const value
                        of cell
                    ) {
                        if (
                            value
                                .toLowerCase()
                                .includes(
                                    filter,
                                )
                        ) {
                            columnMatches =
                                true;

                            break;
                        }
                    }

                    if (
                        !columnMatches
                    ) {
                        matches =
                            false;

                        break;
                    }
                }

                if (
                    matches
                ) {
                    matchingRows.push(
                        rowIndex,
                    );
                }
            }
        }

        currentPage =
            0;

        renderPage();
    }

    previous.addEventListener(
        "click",
        () => {
            if (
                currentPage > 0
            ) {
                currentPage--;

                renderPage();
            }
        },
    );

    next.addEventListener(
        "click",
        () => {
            const pageCount =
                Math.ceil(
                    matchingRows.length /
                        PAGE_SIZE,
                );

            if (
                currentPage <
                pageCount - 1
            ) {
                currentPage++;

                renderPage();
            }
        },
    );

    for (
        const filter of filters
    ) {
        filter.addEventListener(
            "input",
            applyFilters,
        );
    }

    renderPage();
}