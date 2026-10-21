import { useEffect, useRef, useState } from 'react'
import { normalizeBarcode } from '../food/openFoodFacts.js'

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e']

function cameraError(err) {
  if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
    return 'Camera access is blocked. Allow the camera for this site in your browser settings, or type the barcode instead.'
  }
  if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') return 'No camera found. Type the barcode instead.'
  return 'The camera could not start. Type the barcode instead.'
}

/**
 * Live camera barcode scanner. Uses the browser's built-in BarcodeDetector
 * where it exists (Chrome on Android) and the bundled ZXing decoder elsewhere
 * (iPhone Safari), loaded only when the scanner opens. Calls onDetected once
 * with the barcode digits.
 */
export default function BarcodeScanner({ onDetected, onClose }) {
  const video = useRef(null)
  const done = useRef(false)
  const [error, setError] = useState(null)
  const [starting, setStarting] = useState(true)

  useEffect(() => {
    let cancelled = false
    let stream = null
    let timer = null
    let controls = null

    const found = (raw) => {
      const code = normalizeBarcode(raw)
      if (!code || done.current || cancelled) return
      done.current = true
      onDetected(code)
    }

    async function startNative() {
      const supported = await window.BarcodeDetector.getSupportedFormats()
      const formats = FORMATS.filter((f) => supported.includes(f))
      if (!formats.length) return false
      const detector = new window.BarcodeDetector({ formats })
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      if (cancelled) return true
      video.current.srcObject = stream
      await video.current.play()
      setStarting(false)
      const tick = async () => {
        if (cancelled || done.current) return
        try {
          const codes = await detector.detect(video.current)
          if (codes[0]) found(codes[0].rawValue)
        } catch {
          // A frame that cannot be read yet; try the next one.
        }
        timer = setTimeout(tick, 200)
      }
      tick()
      return true
    }

    async function startZxing() {
      const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import('@zxing/browser'), import('@zxing/library')])
      if (cancelled) return
      const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]]])
      const reader = new BrowserMultiFormatReader(hints)
      controls = await reader.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } }, audio: false }, video.current, (result) => {
        if (result) found(result.getText())
      })
      if (cancelled) controls.stop()
      else setStarting(false)
    }

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('This browser cannot use the camera. Type the barcode instead.')
        return
      }
      try {
        const native = 'BarcodeDetector' in window && (await startNative())
        if (!native) await startZxing()
      } catch (err) {
        if (!cancelled) setError(cameraError(err))
      }
    }

    start()
    return () => {
      cancelled = true
      clearTimeout(timer)
      controls?.stop()
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [onDetected])

  return (
    <div className="scanner">
      {!error && (
        <div className="scanner-view">
          <video ref={video} muted playsInline aria-label="Camera view for scanning a barcode" />
          <span className="scanner-guide" aria-hidden />
        </div>
      )}
      <p className={error ? 'error' : 'hint'}>{error ?? (starting ? 'Starting the camera…' : 'Point the camera at the barcode on the packet and hold steady.')}</p>
      <button type="button" className="btn small" onClick={onClose}>
        Close camera
      </button>
    </div>
  )
}
