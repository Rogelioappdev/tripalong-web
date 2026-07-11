// Normalize any user-picked image to a web-safe JPEG before upload.
//
// Fixes the intermittent "black photo / black screen" bug: previously the raw
// file was uploaded as-is, so an iPhone HEIC (which renders on iOS but NOT in
// Android browsers/WebViews), an odd/missing file extension (wrong stored
// content-type), or an oversized photo (slow upload that leaves the spinner
// stuck) all produced an unviewable image or a hung screen.
//
// Decoding into an <img> then re-encoding through a <canvas> gives us a
// consistent downscaled image/jpeg that renders on every platform, with
// correct content-type and orientation. If the browser genuinely can't decode
// the file, we reject with a friendly message so callers show an error instead
// of silently storing a black image.

export async function normalizeImageToJpeg(
  file: File,
  maxDim = 1440,
  quality = 0.9,
): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    const { width, height } = fitWithin(img.naturalWidth || img.width, img.naturalHeight || img.height, maxDim)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Your browser could not process this image.')
    ctx.drawImage(img, 0, 0, width, height)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    )
    if (!blob) throw new Error('Could not process that photo. Try a different one.')
    return blob
  } finally {
    URL.revokeObjectURL(url)
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const timeout = setTimeout(
      () => reject(new Error('That photo took too long to load. Try a smaller one.')),
      15000,
    )
    img.onload = () => { clearTimeout(timeout); resolve(img) }
    img.onerror = () => {
      clearTimeout(timeout)
      reject(new Error("That photo format isn't supported. Try a different photo or a screenshot."))
    }
    img.src = url
  })
}

function fitWithin(w: number, h: number, max: number): { width: number; height: number } {
  if (!w || !h) return { width: max, height: max }
  if (w <= max && h <= max) return { width: w, height: h }
  const scale = Math.min(max / w, max / h)
  return { width: Math.round(w * scale), height: Math.round(h * scale) }
}
