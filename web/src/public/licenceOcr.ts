// Reads text from a photo in the browser with Tesseract.js. Used when the server has no OCR
// (OCR_PROVIDER=none): licence and Aadhaar text goes to the user-service parsers, and car photos are
// read here only (the photo is never uploaded).
import type { Worker, WorkerParams } from 'tesseract.js'

let workerPromise: Promise<Worker> | null = null
let ready = false

/** True until the OCR engine and language data have been downloaded once (about 10 MB, then cached). */
export const needsFirstDownload = () => !ready

function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = import('tesseract.js').then(({ createWorker }) => createWorker('eng'))
    workerPromise.catch(() => {
      workerPromise = null // allow a retry, e.g. after the connection comes back
    })
  }
  return workerPromise
}

/** Grey, contrast-stretched copy at a size Tesseract reads well. Helps with number plates and phone photos. */
async function enhance(file: File): Promise<Blob | File> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(2.5, 1800 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const px = img.data
    let lo = 255
    let hi = 0
    const grey = new Uint8ClampedArray(px.length / 4)
    for (let i = 0; i < grey.length; i++) {
      const g = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]
      grey[i] = g
      if (g < lo) lo = g
      if (g > hi) hi = g
    }
    const range = Math.max(1, hi - lo)
    for (let i = 0; i < grey.length; i++) {
      const v = ((grey[i] - lo) * 255) / range
      px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = v
    }
    ctx.putImageData(img, 0, 0)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    return blob ?? file
  } catch {
    return file
  }
}

/**
 * @param sparse true for photos with scattered text, like a number plate on a car (Tesseract "sparse text" mode)
 */
export async function readImageText(file: File, { sparse = false }: { sparse?: boolean } = {}): Promise<string> {
  if (!file.type.startsWith('image/')) return '' // PDFs can only be read by server OCR
  const worker = await getWorker()
  ready = true
  await worker.setParameters({ tessedit_pageseg_mode: (sparse ? '11' : '3') as WorkerParams['tessedit_pageseg_mode'] })
  const { data } = await worker.recognize(sparse ? await enhance(file) : file)
  return data.text ?? ''
}
