import { getJobsByStatus, updateJob } from "@/lib/jobStore";

const POLL_INTERVAL_MS = 1500;
const REQUEST_TIMEOUT_MS = 120000;
const ML_SERVICE_URL = process.env.ML_SERVICE_URL ?? "http://localhost:8000";

async function requestWithTimeout(url: string, options: RequestInit) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        return response;
    } finally {
        clearTimeout(timeout);
    }
}

async function analyzeAudio(filePath: string) {
    let response: Response;
    try {
        response = await requestWithTimeout(`${ML_SERVICE_URL}/analyze`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ filePath }),
        });
    } catch (error) {
        const message =
            error instanceof Error && error.name === "AbortError"
                ? "ML service timed out."
                : "ML service unavailable. Start 'npm run dev:ml'.";
        throw new Error(message);
    }

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`ML service error (${response.status}): ${text}`);
    }

    return (await response.json()) as {
        transcript: string;
        summary: string;
    };
}

async function processJob(jobId: string, filePath?: string) {
    if (!filePath) {
        await updateJob(jobId, {
            status: "failed",
            error: "Missing file path for audio job.",
        });
        return;
    }

    const started = await updateJob(jobId, { status: "processing" });
    if (!started) {
        return;
    }

    try {
        const result = await analyzeAudio(filePath);
        await updateJob(jobId, {
            status: "completed",
            transcript: result.transcript,
            summary: result.summary,
            result: { message: "Summarized locally" },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Processing failed";
        await updateJob(jobId, {
            status: "failed",
            error: message,
        });
    }
}

async function tick() {
    const queuedJobs = await getJobsByStatus("queued");
    for (const job of queuedJobs) {
        await processJob(job.id, job.filePath);
    }
}

async function main() {
    console.log("Echo Archive worker online.");
    await tick();
    setInterval(() => {
        void tick();
    }, POLL_INTERVAL_MS);
}

main().catch((error) => {
    console.error("Worker failed:", error);
    process.exitCode = 1;
});
