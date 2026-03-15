import { useState, useCallback } from 'react';
import axios from 'axios';

interface UsePresignedUploadResult {
    uploadFile: (file: File) => Promise<string | undefined>;
    uploadProgress: number;
    isUploading: boolean;
    error: string | null;
    reset: () => void;
}

interface UploadCallbacks {
    onSuccess?: (key: string) => void;
    onError?: (error: unknown) => void;
}

export const useMinioUpload = (): UsePresignedUploadResult => {
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const reset = useCallback(() => {
        setUploadProgress(0);
        setIsUploading(false);
        setError(null);
    }, []);

    const uploadFile = useCallback(async (file: File, callbacks?: UploadCallbacks) => {
        setIsUploading(true);
        setUploadProgress(0);
        setError(null);

        try {
            // 1. Get the presigned URL from your Next.js API
            const presignedResponse = await axios.post("/api/upload", {
                filename: file.name,
                contentType: file.type,
            });

            const { url, key, publicUrl } = presignedResponse.data;

            // 2. Upload file directly to S3 using the presigned URL
            await axios.put(url, file, {
                headers: { "Content-Type": file.type },
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round(
                        (progressEvent.loaded * 100) / (progressEvent.total ?? 1)
                    );
                    setUploadProgress(percentCompleted);
                },
            });

            // Upload complete
            if (callbacks?.onSuccess) {
                callbacks.onSuccess(key);
            }

            return publicUrl as string;

        } catch (err: unknown) { // 1. Change 'any' to 'unknown'
            let errorMessage = "Upload failed";

            // 2. Type Narrowing: Check if it's an Axios error specifically
            if (axios.isAxiosError(err)) {
                // Now TS knows 'err' has .response, .data, etc.
                errorMessage = err.response?.data?.message || err.message;
            }
            // 3. Check if it is a standard JS Error
            else if (err instanceof Error) {
                errorMessage = err.message;
            }

            setError(errorMessage);

            if (callbacks?.onError) {
                callbacks.onError(err);
            }
            throw err;
        } finally {
            setIsUploading(false);
        }
    }, []);

    return {
        uploadFile,
        uploadProgress,
        isUploading,
        error,
        reset
    };
};



// Usage


// const { uploadFile, uploadProgress, isUploading } = useMinioUpload();
// await uploadFile(file, {
//         onSuccess: (key) => {
//           // Update the loading toast to success
//           toast.success("File uploaded successfully!", { id: toastId });
//           console.log("File Key:", key);
//         },
//         onError: (err) => {
//           // Update the loading toast to error
//           toast.error("Upload failed", { id: toastId });
//         }
//       });
