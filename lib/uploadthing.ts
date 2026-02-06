import { genUploader } from "uploadthing/client";
import type { UploadRouter } from "@/app/api/uploadthing/route";

export const { uploadFiles } = genUploader<UploadRouter>();
