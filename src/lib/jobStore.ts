import { promises as fs } from "fs";
import path from "path";

export type JobStatus = "queued" | "processing" | "completed" | "failed";

export type JobRecord = {
    id: string;
    filename: string;
    status: JobStatus;
    createdAt: string;
    updatedAt: string;
    sizeBytes?: number;
    filePath?: string;
    transcript?: string;
    summary?: string;
    error?: string;
    result?: {
        message?: string;
    };
};

const dataDir = path.join(process.cwd(), ".data");
const dataFile = path.join(dataDir, "jobs.json");
const uploadsDir = path.join(dataDir, "uploads");

function nowIso() {
    return new Date().toISOString();
}

async function ensureStore(): Promise<JobRecord[]> {
    try {
        const data = await fs.readFile(dataFile, "utf8");
        return JSON.parse(data) as JobRecord[];
    } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err.code !== "ENOENT") {
            throw err;
        }
        await fs.mkdir(dataDir, { recursive: true });
        await fs.writeFile(dataFile, "[]", "utf8");
        return [];
    }
}

async function saveStore(jobs: JobRecord[]) {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(dataFile, JSON.stringify(jobs, null, 2), "utf8");
}

export async function createJob(
    filename: string,
    status: JobStatus = "queued"
): Promise<JobRecord> {
    const jobs = await ensureStore();
    const job: JobRecord = {
        id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        filename,
        status,
        createdAt: nowIso(),
        updatedAt: nowIso(),
    };
    jobs.unshift(job);
    await saveStore(jobs);
    return job;
}

export async function updateJob(
    jobId: string,
    updates: Partial<JobRecord>
): Promise<JobRecord | null> {
    const jobs = await ensureStore();
    const index = jobs.findIndex((job) => job.id === jobId);
    if (index === -1) {
        return null;
    }
    const updated: JobRecord = {
        ...jobs[index],
        ...updates,
        updatedAt: nowIso(),
    };
    jobs[index] = updated;
    await saveStore(jobs);
    return updated;
}

export async function getJobs(): Promise<JobRecord[]> {
    return ensureStore();
}

export async function getJob(jobId: string): Promise<JobRecord | null> {
    const jobs = await ensureStore();
    return jobs.find((job) => job.id === jobId) ?? null;
}

export async function getJobsByStatus(status: JobStatus): Promise<JobRecord[]> {
    const jobs = await ensureStore();
    return jobs.filter((job) => job.status === status);
}

export async function deleteJob(jobId: string): Promise<JobRecord | null> {
    const jobs = await ensureStore();
    const index = jobs.findIndex((job) => job.id === jobId);
    if (index === -1) {
        return null;
    }

    const [removed] = jobs.splice(index, 1);
    await saveStore(jobs);

    if (removed?.filePath) {
        try {
            await fs.unlink(removed.filePath);
        } catch (error) {
            const err = error as NodeJS.ErrnoException;
            if (err.code !== "ENOENT") {
                throw err;
            }
        }
    }

    return removed ?? null;
}

export async function saveUploadBuffer(
    jobId: string,
    filename: string,
    buffer: Buffer
): Promise<string> {
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_") || "audio";
    const outputName = `${jobId}-${safeName}`;
    const outputPath = path.join(uploadsDir, outputName);
    await fs.mkdir(uploadsDir, { recursive: true });
    await fs.writeFile(outputPath, buffer);
    return outputPath;
}
