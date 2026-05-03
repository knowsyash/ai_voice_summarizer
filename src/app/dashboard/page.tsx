"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type JobStatus = "queued" | "processing" | "completed" | "failed";

type JobRecord = {
    id: string;
    filename: string;
    status: JobStatus;
    createdAt: string;
    updatedAt: string;
    sizeBytes?: number;
    transcript?: string;
    summary?: string;
    error?: string;
    result?: {
        message?: string;
    };
};

type ChatMessage = {
    role: "user" | "assistant";
    content: string;
};

const statusStyles: Record<JobStatus, string> = {
    queued: "bg-amber-400 text-amber-950",
    processing: "bg-sky-400 text-sky-950",
    completed: "bg-emerald-400 text-emerald-950",
    failed: "bg-rose-400 text-rose-950",
};

function formatBytes(size?: number) {
    if (!size) return "-";
    const units = ["B", "KB", "MB", "GB"];
    let value = size;
    let index = 0;
    while (value >= 1024 && index < units.length - 1) {
        value /= 1024;
        index += 1;
    }
    return `${value.toFixed(1)} ${units[index]}`;
}

function clipText(text: string, max = 240) {
    if (text.length <= max) return text;
    return `${text.slice(0, max)}...`;
}

export default function DashboardPage() {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [jobs, setJobs] = useState<JobRecord[]>([]);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
    const [chatInput, setChatInput] = useState("");
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatLoading, setChatLoading] = useState(false);
    const [chatError, setChatError] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const fetchJobs = async () => {
        try {
            const response = await fetch("/api/jobs", { cache: "no-store" });
            if (!response.ok) {
                throw new Error("Failed to load jobs");
            }
            const data = (await response.json()) as { jobs: JobRecord[] };
            setJobs(data.jobs ?? []);
            setLastUpdated(new Date().toLocaleTimeString());
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load jobs");
        }
    };

    const completedJobs = useMemo(
        () => jobs.filter((job) => job.status === "completed"),
        [jobs]
    );

    const selectedJob = useMemo(() => {
        return (
            jobs.find((job) => job.id === selectedJobId) ??
            completedJobs[0] ??
            jobs[0]
        );
    }, [jobs, completedJobs, selectedJobId]);

    useEffect(() => {
        fetchJobs();
        const interval = setInterval(fetchJobs, 2000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!selectedJobId && completedJobs.length > 0) {
            setSelectedJobId(completedJobs[0].id);
        }
    }, [completedJobs, selectedJobId]);

    const handleUpload = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);

        const file = fileInputRef.current?.files?.[0];
        if (!file) {
            setError("Please select a WAV file to upload.");
            return;
        }

        const formData = new FormData();
        formData.append("file", file);

        try {
            setUploading(true);
            const response = await fetch("/api/audio/upload", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                throw new Error(payload.error ?? "Upload failed");
            }

            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
            await fetchJobs();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Upload failed");
        } finally {
            setUploading(false);
        }
    };

    const handleChatSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!chatInput.trim()) {
            return;
        }

        const availableJobs = completedJobs.filter(
            (job) => job.summary || job.transcript
        );

        if (availableJobs.length === 0) {
            setChatError("No completed transcripts available yet.");
            return;
        }

        setChatError(null);
        const question = chatInput.trim();
        setChatInput("");
        setChatMessages((prev) => [...prev, { role: "user", content: question }]);

        try {
            setChatLoading(true);
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    question,
                    jobIds: selectedJob?.id ? [selectedJob.id] : undefined,
                }),
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                throw new Error(payload.error ?? "Chat request failed");
            }

            const data = (await response.json()) as { answer?: string };
            setChatMessages((prev) => [
                ...prev,
                { role: "assistant", content: data.answer ?? "" },
            ]);
        } catch (err) {
            setChatError(err instanceof Error ? err.message : "Chat failed");
        } finally {
            setChatLoading(false);
        }
    };

    const handleDelete = async (jobId: string) => {
        setError(null);
        setDeletingId(jobId);
        try {
            const response = await fetch(
                `/api/jobs?jobId=${encodeURIComponent(jobId)}`,
                { method: "DELETE" }
            );
            if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                throw new Error(payload.error ?? "Delete failed");
            }
            if (selectedJobId === jobId) {
                setSelectedJobId(null);
            }
            await fetchJobs();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Delete failed");
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <main className="min-h-screen bg-[radial-gradient(80%_80%_at_50%_0%,#edf4ff_0%,#ffffff_55%,#f8f5ec_100%)] text-zinc-900">
            <section className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-12">
                <header
                    className="flex flex-col gap-4"
                    style={{ animation: "fade-in-up 0.6s ease-out both" }}
                >
                    <div className="flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-zinc-500">
                        <span className="h-2 w-2 rounded-full bg-emerald-400" />
                        Connected Pipeline
                    </div>
                    <h1 className="text-4xl font-semibold text-zinc-950 sm:text-5xl">
                        Echo Archive Dashboard
                    </h1>
                    <p className="max-w-2xl text-base text-zinc-600">
                        Upload WAV files, watch the queue, and interrogate the
                        transcripts with a free local model.
                    </p>
                </header>

                <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
                    <div
                        className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-[0_24px_60px_-30px_rgba(15,23,42,0.35)] backdrop-blur"
                        style={{ animation: "fade-in-up 0.75s ease-out both" }}
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-zinc-900">
                                    Upload audio
                                </h2>
                                <p className="text-sm text-zinc-500">
                                    Accepted: audio files up to 50MB.
                                </p>
                            </div>
                            <div
                                className="rounded-full bg-zinc-900 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white"
                                style={{ animation: "float-slow 5s ease-in-out infinite" }}
                            >
                                Live
                            </div>
                        </div>

                        <form onSubmit={handleUpload} className="mt-6 space-y-4">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="audio/*"
                                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 file:mr-4 file:rounded-full file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-xs file:font-semibold file:uppercase file:tracking-[0.2em] file:text-white hover:file:bg-zinc-800"
                            />
                            <button
                                type="submit"
                                disabled={uploading}
                                className="flex w-full items-center justify-center rounded-2xl bg-zinc-900 px-5 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {uploading ? "Uploading..." : "Start processing"}
                            </button>
                            {error ? (
                                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                    {error}
                                </div>
                            ) : null}
                        </form>
                    </div>

                    <div
                        className="rounded-3xl border border-zinc-200/80 bg-white p-6"
                        style={{ animation: "fade-in-up 0.9s ease-out both" }}
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-zinc-900">
                                    Processing queue
                                </h2>
                                <p className="text-xs text-zinc-500">
                                    {lastUpdated ? `Last refresh ${lastUpdated}` : "Waiting for updates"}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={fetchJobs}
                                className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-900"
                            >
                                Refresh
                            </button>
                        </div>

                        <div className="mt-6 space-y-3">
                            {jobs.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-zinc-200 px-4 py-6 text-center text-sm text-zinc-500">
                                    No jobs yet. Upload audio to kick off the pipeline.
                                </div>
                            ) : (
                                jobs.map((job) => {
                                    const isSelected = job.id === selectedJob?.id;
                                    return (
                                        <div
                                            key={job.id}
                                            onClick={() => setSelectedJobId(job.id)}
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(event) => {
                                                if (event.key === "Enter" || event.key === " ") {
                                                    event.preventDefault();
                                                    setSelectedJobId(job.id);
                                                }
                                            }}
                                            className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${isSelected
                                                ? "border-zinc-900/30 bg-zinc-100"
                                                : "border-zinc-200/80 bg-zinc-50/80 hover:border-zinc-300"
                                                }`}
                                        >
                                            <div>
                                                <p className="text-sm font-semibold text-zinc-900">
                                                    {job.filename}
                                                </p>
                                                <p className="text-xs text-zinc-500">
                                                    {formatBytes(job.sizeBytes)} · {job.id}
                                                </p>
                                                {job.summary ? (
                                                    <p className="mt-1 text-xs text-zinc-500">
                                                        {clipText(job.summary, 120)}
                                                    </p>
                                                ) : null}
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {job.result?.message ? (
                                                    <span className="text-xs text-zinc-500">
                                                        {job.result.message}
                                                    </span>
                                                ) : null}
                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        void handleDelete(job.id);
                                                    }}
                                                    disabled={deletingId === job.id}
                                                    className="rounded-full border border-zinc-200 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-zinc-500 transition hover:border-rose-200 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                                                >
                                                    {deletingId === job.id ? "Deleting" : "Delete"}
                                                </button>
                                                <span
                                                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${statusStyles[job.status]}`}
                                                >
                                                    {job.status}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                    <div
                        className="rounded-3xl border border-zinc-200/80 bg-white p-6"
                        style={{ animation: "fade-in-up 1.05s ease-out both" }}
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-zinc-900">
                                    Transcript + summary
                                </h2>
                                <p className="text-xs text-zinc-500">
                                    {selectedJob?.filename ?? "Select a job"}
                                </p>
                            </div>
                            <span className="rounded-full border border-zinc-200 px-3 py-1 text-xs uppercase tracking-[0.2em] text-zinc-500">
                                Local LLM
                            </span>
                        </div>

                        <div className="mt-4 space-y-4">
                            <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
                                    Summary
                                </p>
                                <p className="mt-2 text-sm text-zinc-700 whitespace-pre-line">
                                    {selectedJob?.summary ??
                                        "Summaries appear after processing finishes."}
                                </p>
                            </div>
                            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
                                    Transcript
                                </p>
                                <p className="mt-2 max-h-60 overflow-y-auto text-sm text-zinc-700 whitespace-pre-line">
                                    {selectedJob?.transcript ??
                                        "Transcripts appear after processing finishes."}
                                </p>
                            </div>
                            {selectedJob?.error ? (
                                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                    {selectedJob.error}
                                </div>
                            ) : null}
                        </div>
                    </div>

                    <div
                        className="rounded-3xl border border-zinc-200/80 bg-white p-6"
                        style={{ animation: "fade-in-up 1.2s ease-out both" }}
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-zinc-900">
                                    Ask the dataset
                                </h2>
                                <p className="text-xs text-zinc-500">
                                    Chat with the selected transcript.
                                </p>
                            </div>
                            <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white">
                                Free
                            </span>
                        </div>

                        <div className="mt-4 flex min-h-[220px] flex-col gap-3 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/70 p-4 text-sm text-zinc-700">
                            {chatMessages.length === 0 ? (
                                <p className="text-zinc-500">
                                    Ask a question about the processed audio to get a
                                    summary or quick answer.
                                </p>
                            ) : null}
                            {chatMessages.map((message, index) => (
                                <div
                                    key={`${message.role}-${index}`}
                                    className={`rounded-2xl px-4 py-3 ${message.role === "user"
                                        ? "ml-auto bg-zinc-900 text-white"
                                        : "bg-white text-zinc-800"
                                        }`}
                                >
                                    {message.content}
                                </div>
                            ))}
                        </div>

                        <form onSubmit={handleChatSubmit} className="mt-4 space-y-3">
                            <textarea
                                value={chatInput}
                                onChange={(event) => setChatInput(event.target.value)}
                                rows={3}
                                className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                                placeholder="Summarize the speaker intent, or ask a question..."
                            />
                            <button
                                type="submit"
                                disabled={chatLoading}
                                className="flex w-full items-center justify-center rounded-2xl bg-zinc-900 px-5 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {chatLoading ? "Thinking..." : "Ask"}
                            </button>
                            {chatError ? (
                                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                    {chatError}
                                </div>
                            ) : null}
                        </form>
                    </div>
                </div>
            </section>
        </main>
    );
}
