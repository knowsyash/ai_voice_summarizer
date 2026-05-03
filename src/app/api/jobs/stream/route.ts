import { getJob } from "@/lib/jobStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");

    const stream = new ReadableStream({
        start(controller) {
            const encoder = new TextEncoder();
            let interval: NodeJS.Timeout | null = null;

            const send = async () => {
                const job = jobId ? await getJob(jobId) : null;
                const payload = { job };
                controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
                );
            };

            const onAbort = () => {
                if (interval) {
                    clearInterval(interval);
                }
                controller.close();
            };

            request.signal.addEventListener("abort", onAbort);

            send();
            interval = setInterval(send, 1500);
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
        },
    });
}
