// Crop an image down to a pixel-exact region using an offscreen <canvas> —
// the standard recipe from react-easy-crop's own docs (draw the source image
// onto a canvas sized to the crop, offset by the crop's x/y, then export via
// canvas.toBlob). Used by PhotoCropModal to turn the user's drag/zoom
// selection (react-easy-crop's onCropComplete `croppedAreaPixels`) into an
// actual File before handing off to the existing upload pipeline.

export type PixelCrop = { x: number; y: number; width: number; height: number }

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load that photo. Try a different one.'))
    img.src = url
  })
}

export async function getCroppedImage(imageSrc: string, pixelCrop: PixelCrop): Promise<Blob> {
  const img = await loadImage(imageSrc)

  const canvas = document.createElement('canvas')
  // Canvas is sized to exactly match the crop region, so the output image IS
  // the crop — no extra scaling math needed after the draw.
  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Your browser could not process this image.')

  // 9-arg drawImage: read the (x, y, width, height) region out of the source
  // image (in source-image pixel space, exactly as react-easy-crop reports
  // it) and paint it at (0, 0) on the destination canvas at the same size.
  ctx.drawImage(
    img,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  )

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.92),
  )
  if (!blob) throw new Error('Could not process that photo. Try a different one.')
  return blob
}
