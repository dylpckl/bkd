/** Center-crops an image to a square and scales it to `size` px, as a JPEG. */
export async function resizeAvatar(file: File, size = 512): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = Math.min(size, side)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas_unavailable')
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    canvas.width,
    canvas.height,
  )
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('encode_failed'))),
      'image/jpeg',
      0.85,
    ),
  )
}
