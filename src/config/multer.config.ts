import { CloudinaryStorage } from "multer-storage-cloudinary";
import { cloudinaryUpload } from "./cloudinary.config";
import multer from "multer";


const storage = new CloudinaryStorage({
    cloudinary: cloudinaryUpload,
    params: {
        public_id: (req, file) => {
            const fileName = file.originalname
                .toLowerCase()
                .replace(/\s+/g, "-") // empty space remove replace with dash
                .replace(/\./g, "-") // dot remove replace with dash
                .replace(/[^a-zA-Z0-9]/g, "")  // non alpha numeric - !@#

            const uniqueFileName = Date.now() + "-" + fileName
            return uniqueFileName
        }
    }
})

export const multerUpload = multer({ storage: storage })
// export const multerUpload = multer({ storage: multer.memoryStorage() })