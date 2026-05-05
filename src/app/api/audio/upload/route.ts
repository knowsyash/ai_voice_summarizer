import { NextResponse } from "next/server";
import { createJob, saveUploadBuffer, updateJob } from "@/lib/jobStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get("file");

        if (!file || !(file instanceof File)) {
            return NextResponse.json(
                { error: "Missing file in form data." },
                { status: 400 }
            );
        }

        const fileType = file.type ?? "";
        const isAudio =
            fileType.startsWith("audio/") ||
            fileType === "" ||
            fileType === "application/octet-stream";

        if (!isAudio) {
            return NextResponse.json(
                { error: "Only audio files are supported." },
                { status: 400 }
            );
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const maxSizeBytes = 50 * 1024 * 1024;
        if (buffer.length > maxSizeBytes) {
            return NextResponse.json(
                { error: "File exceeds 50MB limit." },
                { status: 413 }
            );
        }

        const job = await createJob(file.name || "audio.wav", "processing");
        const filePath = await saveUploadBuffer(job.id, file.name, buffer);

        await updateJob(job.id, {
            status: "queued",
            sizeBytes: buffer.length,
            filePath,
        });

        return NextResponse.json({
            jobId: job.id,
            status: "queued",
            filename: file.name,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Upload failed";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
