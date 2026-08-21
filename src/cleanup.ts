import {
    deleteExpiredPastes,
} from "./store.js";

const CLEANUP_INTERVAL =
    60 * 1000;

export function startCleanup(): void {
    const cleanup =
        async (): Promise<void> => {
            try {
                await deleteExpiredPastes();
            } catch (error) {
                console.error(
                    "Paste cleanup failed:",
                    error,
                );
            }
        };

    void cleanup();

    setInterval(
        () => {
            void cleanup();
        },
        CLEANUP_INTERVAL,
    );
}