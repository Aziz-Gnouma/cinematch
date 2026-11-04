import { Injectable } from '@angular/core';
import { Camera, CameraDirection } from '@capacitor/camera';

/**
 * Takes a selfie with the phone camera and returns a small square JPEG data URL.
 * The image is stored directly in the Firestore profile (no Storage bucket /
 * paid plan needed), so we keep it around 256px.
 */
@Injectable({ providedIn: 'root' })
export class CameraService {
  async takeSelfie(size = 256): Promise<string> {
    const result = await Camera.takePhoto({
      quality: 80,
      targetWidth: 720,
      targetHeight: 720,
      correctOrientation: true,
      cameraDirection: CameraDirection.Front,
    });
    const src =
      result.webPath ??
      (result.thumbnail?.startsWith('data:') ? result.thumbnail : `data:image/jpeg;base64,${result.thumbnail}`);
    return squareJpeg(src, size);
  }
}

function squareJpeg(src: string, size: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
      resolve(canvas.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = reject;
    img.src = src;
  });
}
