import { NextResponse } from "next/server";
import { createPresignedUrlToUpload } from "@/lib/minio/minio";
import { generateShortId } from "@/lib/utils";


export async function POST(req: Request) {
    let userId = "public";


    try {
        const { filename, contentType } = await req.json();

        if (!filename || !contentType) {
            return new NextResponse("Missing filename or contentType", { status: 400 });
        }

        // Sanitize filename to prevent path traversal
        const safeFilename = filename.replace(/[^a-zA-Z0-9.\-_]/g, '');
        const key = `uploads/${userId}/${generateShortId()}-${safeFilename}`;

        const url = await createPresignedUrlToUpload({ bucketName: process.env.MINIO_BUCKET_NAME!, fileName: key, expiry: 3600 })

        const publicUrl = `https://${process.env.MINIO_ENDPOINT}/${process.env.MINIO_BUCKET_NAME}/${key}`


        return NextResponse.json({ url, key, publicUrl });
    } catch (error) {
        console.error("[UPLOAD_POST]", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}




// Below is the usage
// 1. Get the presigned URL from your Next.js API
// const presignedResponse = await axios.post("/api/upload", {
//     filename: file.name,
//     contentType: file.type,
// });

// const { url, key, publicUrl } = presignedResponse.data;

// 2. Upload file directly to S3 using the presigned URL
// await axios.put(url, file, {
//     headers: { "Content-Type": file.type },
//     onUploadProgress: (progressEvent) => {
//         const percentCompleted = Math.round(
//             (progressEvent.loaded * 100) / (progressEvent.total ?? 1)
//         );
//         setUploadProgress(percentCompleted);
//     },
// });

// return publicUrl as string;