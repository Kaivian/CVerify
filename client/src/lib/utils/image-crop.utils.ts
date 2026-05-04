/**
 * Image Cropping and Dimension Validation Utilities
 */

export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Validates that an image file meets the minimum width and height requirements.
 * Returns the dimensions on success, or rejects with an error message.
 */
export function validateImageDimensions(
  file: File,
  minWidth: number,
  minHeight: number
): Promise<ImageDimensions> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    
    img.onload = () => {
      const { naturalWidth: width, naturalHeight: height } = img;
      URL.revokeObjectURL(objectUrl);
      
      if (width < minWidth || height < minHeight) {
        reject(
          `Image dimensions (${width}x${height}px) do not meet requirements. Minimum required is ${minWidth}x${minHeight}px.`
        );
      } else {
        resolve({ width, height });
      }
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject("Failed to parse the selected image file.");
    };
    
    img.src = objectUrl;
  });
}

/**
 * Crops a given image element using canvas rendering and returns a JPEG blob.
 * Uses bounding rect coordinates for projection mapping.
 */
export async function cropImage(
  img: HTMLImageElement,
  cropRect: { left: number; top: number; width: number; height: number },
  targetWidth: number,
  targetHeight: number
): Promise<Blob | null> {
  const imgRect = img.getBoundingClientRect();
  const relX = imgRect.left - cropRect.left;
  const relY = imgRect.top - cropRect.top;

  const factorX = targetWidth / cropRect.width;
  const factorY = targetHeight / cropRect.height;

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return null;
  }

  ctx.clearRect(0, 0, targetWidth, targetHeight);

  // Perform physical canvas image projection based on coordinate mapping
  ctx.drawImage(
    img,
    relX * factorX,
    relY * factorY,
    imgRect.width * factorX,
    imgRect.height * factorY
  );

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        resolve(blob);
      },
      "image/jpeg",
      0.90 // High-quality JPEG compression
    );
  });
}
