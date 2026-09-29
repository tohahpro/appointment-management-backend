/* eslint-disable @typescript-eslint/no-explicit-any */
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import stream from 'stream';
import config from '.';
import ApiError from '../app/errors/ApiError';



cloudinary.config({
    cloud_name: config.cloudinary.cloud_name,
    api_key: config.cloudinary.api_key,
    api_secret: config.cloudinary.api_secret
})


export const uploadBufferCloudinary = async (buffer: Buffer, fileName: string): Promise<UploadApiResponse | undefined> => {
    try {
        // step-1 
        return new Promise((resolve, reject) => {
            const public_id = `${fileName}-${Date.now()}`

            // step-2
            // for buffer steam ready stream er maddhome chank e chank e amra pathabo cloudinary te
            const bufferStream = new stream.PassThrough()
            bufferStream.end(buffer)

            // step-3
            cloudinary.uploader.upload_stream(
                {
                    resource_type: 'auto',
                    public_id: public_id,
                    folder: 'projects',
                }, (error, result) => {
                    if (error) {
                        return reject(error)
                    }
                    resolve(result)
                }
            ).end(buffer)
        })

    } catch (error: any) {
        console.log(error);
        throw new ApiError(401, `Cloudinary upload failed ${error.message}`)
    }
}



export const deleteImageFromCloudinary = async (url: string) => {
    try {
        const regex = /\/v\d+\/(.*?)\.(jpg|jpeg|png|gif|webp)$/i;

        const match = url.match(regex)

        if (match && match[1]) {
            const public_id = match[1];
            await cloudinary.uploader.destroy(public_id)
            // console.log(`File ${public_id} is deleted from cloudinary.`);
        }
    } catch (error: any) {
        throw new ApiError(401, "Cloudinary image deletion failed", error.message)
    }
}

export const cloudinaryUpload = cloudinary