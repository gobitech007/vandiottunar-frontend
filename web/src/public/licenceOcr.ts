// Reads text from a licence photo in the browser with Tesseract.js. Used when the server has no OCR
// (OCR_PROVIDER=none). The text is sent to the user-service's /drivers/me/licence/parse so the licence
// number and vehicle classes are worked out by the same parser as server OCR.
import type { Worker } from 'tesseract.js'

let workerPromise: Promise<Worker> | null = null
let ready = false

/** True until the OCR engine and language data have been downloaded once (about 10 MB, then cached). */
export const needsFirstDownload = () => !ready

export async function readImageText(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) return '' // PDFs can only be read by server OCR
  if (!workerPromise) {
    workerPromise = import('tesseract.js').then(({ createWorker }) => createWorker('eng'))
    workerPromise.catch(() => {
      workerPromise = null // allow a retry, e.g. after the connection comes back
    })
  }
  const worker = await workerPromise
  ready = true
  const { data } = await worker.recognize(file)
  return data.text ?? ''
}
