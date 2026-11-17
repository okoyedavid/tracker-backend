import type { ApiError } from "../../utils/api-error";
export type StoredImage = { url: string; publicId: string };
export const createCloudinaryService = ({ configured, upload, destroy, createApiError }: {
  configured: boolean; upload: (image: Buffer,ownerId: string) => Promise<StoredImage>;
  destroy: (publicId: string) => Promise<unknown>; createApiError: (status: number,message: string) => ApiError;
}) => ({
  uploadImage: async (image: Buffer,ownerId: string) => {
    if (!configured) throw createApiError(503,"Image storage is not configured. Set the Cloudinary environment variables.");
    try { return await upload(image,ownerId); }
    catch { throw createApiError(502,"Image upload failed. Your receipt was not saved; please retry."); }
  },
  deleteImage: destroy,
});
export type CloudinaryService = ReturnType<typeof createCloudinaryService>;
