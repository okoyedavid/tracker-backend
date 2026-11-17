import { v2 as cloudinary } from "cloudinary";
import { randomUUID } from "node:crypto";
import { env } from "../../config/env";
import { ApiError } from "../../utils/api-error";
import { createCloudinaryService } from "./cloudinary.service";
const options={cloud_name:env.CLOUDINARY_CLOUD_NAME,api_key:env.CLOUDINARY_API_KEY,api_secret:env.CLOUDINARY_API_SECRET};
export const cloudinaryService=createCloudinaryService({
  configured:!!(options.cloud_name && options.api_key && options.api_secret),
  upload:(image,ownerId)=>new Promise((resolve,reject)=>{
    const stream=cloudinary.uploader.upload_stream({ ...options,resource_type:"image",folder:`receipt-tracker/${ownerId}`,
      public_id:randomUUID(),overwrite:false,timeout:20000,allowed_formats:["jpg","jpeg","png","webp","heic","heif"] },(error,result)=>{
      if(error || !result?.secure_url || !result.public_id) { reject(new Error("Image upload failed")); return; }
      resolve({url:result.secure_url,publicId:result.public_id});
    });
    stream.on("error",reject); stream.end(image);
  }),
  destroy:publicId=>{
    const destroyOptions={...options,resource_type:"image" as const,invalidate:true,timeout:10000};
    return cloudinary.uploader.destroy(publicId,destroyOptions);
  },
  createApiError:(status,message)=>new ApiError(status,message),
});
