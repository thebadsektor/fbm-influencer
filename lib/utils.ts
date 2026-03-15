import { clsx, type ClassValue } from "clsx"
import { customAlphabet } from "nanoid";
import { twMerge } from "tailwind-merge"
import Resizer from "react-image-file-resizer";


const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
export const generateShortId = customAlphabet(alphabet, 8);

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const resizeImage = async (file: File, size: number) => {
  return new Promise((resolve) => {
    Resizer.imageFileResizer(
      file,
      size,
      size,
      "png",
      100,
      0,
      (uri: unknown) => {
        resolve(uri);
      },
      "file"
    );
  });
};