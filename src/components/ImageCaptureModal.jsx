import { useEffect, useRef, useState } from 'react';
import { Camera, Check, RefreshCw, X } from 'lucide-react';
import { compressCanvas } from '../utils/storage.js';

export default function ImageCaptureModal({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    async function openCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1600 }, height: { ideal: 1200 } },
          audio: false
        });
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          if (active) setReady(true);
        }
      } catch {
        if (active) setError('Camera access is unavailable. Check your browser permission or use the upload option instead.');
      }
    }
    if (!navigator.mediaDevices?.getUserMedia) setError('This browser does not support camera access. Try the upload option instead.');
    else openCamera();
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function takePhoto() {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) {
      setError('The camera is still warming up. Try again in a moment.');
      return;
    }
    const maxSide = 1200;
    const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext('2d');
    if (!context) {
      setError('Could not prepare the photo. Please try uploading an image instead.');
      return;
    }
    try {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      onCapture(compressCanvas(canvas));
    } catch (captureError) {
      setError(captureError.message || 'Could not prepare the photo. Please try uploading an image instead.');
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="camera-modal" role="dialog" aria-modal="true" aria-labelledby="camera-title">
        <div className="modal-heading">
          <div><span className="eyebrow">PRODUCT PHOTOGRAPHY</span><h2 id="camera-title">Capture a moment</h2></div>
          <button className="icon-button" aria-label="Close camera" onClick={onClose}><X size={19} /></button>
        </div>
        <div className="camera-view">
          <video ref={videoRef} autoPlay playsInline muted aria-label="Live camera preview" />
          {!ready && !error && <div className="camera-message"><RefreshCw className="spin" size={22} /> Connecting to your camera…</div>}
          {error && <div className="camera-message camera-error"><Camera size={24} /><span>{error}</span></div>}
          <span className="camera-corner camera-tl" /><span className="camera-corner camera-tr" />
          <span className="camera-corner camera-bl" /><span className="camera-corner camera-br" />
        </div>
        {error && <p className="camera-permission-note">Camera permissions work on localhost or a secure HTTPS connection.</p>}
        <div className="camera-footer">
          <span className="capture-tip">A natural window light works beautifully.</span>
          <button className="button button-primary" disabled={!ready} onClick={takePhoto}><Check size={16} /> Use this photo</button>
        </div>
      </section>
    </div>
  );
}