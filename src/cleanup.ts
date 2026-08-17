import { deleteExpiredPastes } from "./store.js";

const CLEANUP_INTERVAL = 60 * 1000;

export function startCleanup(): void {
    const cleanup = () => {
        deleteExpiredPastes().catch(console.error);
    };

    cleanup();
    setInterval(cleanup, CLEANUP_INTERVAL);
}