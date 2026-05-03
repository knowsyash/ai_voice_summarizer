import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { createJob, updateJob } from "@/lib/jobStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PublicAudioRequest = {
    filename?: string;
};

export async function POST(request: Request) {
    const body = (await request.json().catch(() => ({}))) as PublicAudioRequest;
    const filename = body.filename?.trim();

    if (!filename) {
        return NextResponse.json(
            { error: "Missing filename." },
            { status: 400 }
        );
    }

    const publicDir = path.join(process.cwd(), "public");
    const resolvedPath = path.resolve(publicDir, filename);

    if (!resolvedPath.startsWith(publicDir + path.sep)) {
        return NextResponse.json(
            { error: "Invalid public file path." },
            { status: 400 }
        );
    }

    try {
        await fs.access(resolvedPath);
    } catch {
        return NextResponse.json(
            { error: "Public file not found." },
            { status: 404 }
        );
    }

    const stats = await fs.stat(resolvedPath);
    const job = await createJob(path.basename(filename));
    await updateJob(job.id, {
        sizeBytes: stats.size,
        filePath: resolvedPath,
    });

    return NextResponse.json({
        jobId: job.id,
        status: "queued",
        filename: path.basename(filename),
    });
}
