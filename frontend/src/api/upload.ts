// src/api/uploads.ts
export type UploadPosterResponse = {
    imageUrl: string;     // public URL to display on the frontend (served from MinIO or your CDN)
    // You can extend this later if backend returns more info, e.g. resourceId
    // resourceId?: number;
};

export async function uploadTournamentPoster(file: File): Promise<UploadPosterResponse> {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/uploads/tournament-poster", {
        method: "POST",
        body: formData,
        // include credentials if your API needs cookies:
        // credentials: "include",
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "Upload failed");
    }

    return res.json();
}