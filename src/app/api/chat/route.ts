import { NextResponse } from "next/server";
import { getJobs } from "@/lib/jobStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatRequest = {
    question?: string;
    jobIds?: string[];
};

function buildContext(jobs: Array<{ id: string; filename: string; transcript?: string; summary?: string }>) {
    const sections = jobs.map((job) => {
        const summary = job.summary?.trim();
        const transcript = job.transcript?.trim();
        const parts: string[] = [`File: ${job.filename}`, `Job: ${job.id}`];
        if (summary) {
            parts.push(`Summary:\n${summary}`);
        }
        if (transcript) {
            const clipped = transcript.length > 4000 ? `${transcript.slice(0, 4000)}...` : transcript;
            parts.push(`Transcript:\n${clipped}`);
        }
        return parts.join("\n");
    });
    return sections.join("\n\n---\n\n");
}

export async function POST(request: Request) {
    const body = (await request.json()) as ChatRequest;
    const question = body.question?.trim();

    if (!question) {
        return NextResponse.json({ error: "Missing question." }, { status: 400 });
    }

    const jobs = await getJobs();
    const completed = jobs.filter(
        (job) => job.status === "completed" && (job.transcript || job.summary)
    );

    const selected = body.jobIds?.length
        ? completed.filter((job) => body.jobIds?.includes(job.id))
        : completed;

    if (selected.length === 0) {
        return NextResponse.json(
            { error: "No completed transcripts available." },
            { status: 400 }
        );
    }

    const context = buildContext(selected);
    const mlServiceUrl = process.env.ML_SERVICE_URL ?? "http://localhost:8000";

    try {
        const response = await fetch(`${mlServiceUrl}/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ question, context }),
        });

        if (!response.ok) {
            const text = await response.text();
            return NextResponse.json(
                { error: `ML service error (${response.status}): ${text}` },
                { status: 502 }
            );
        }

        const data = (await response.json()) as { answer?: string };
        return NextResponse.json({ answer: data.answer ?? "" });
    } catch (error) {
        const message = error instanceof Error ? error.message : "ML service unavailable";
        return NextResponse.json({ error: message }, { status: 503 });
    }
}
