import { NextResponse } from "next/server";
import { deleteJob, getJob, getJobs } from "@/lib/jobStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");

    if (jobId) {
        const job = await getJob(jobId);
        if (!job) {
            return NextResponse.json({ error: "Job not found" }, { status: 404 });
        }
        return NextResponse.json({ job });
    }

    const jobs = await getJobs();
    return NextResponse.json({ jobs });
}

export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
        return NextResponse.json({ error: "Missing jobId." }, { status: 400 });
    }

    const removed = await deleteJob(jobId);
    if (!removed) {
        return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json({ deleted: true, jobId: removed.id });
}
