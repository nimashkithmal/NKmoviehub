import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './ImageCropper.css';

/**
 * Crop an image to a fixed aspect ratio before it is uploaded.
 *
 * The crop frame never moves; the image is dragged and zoomed underneath it,
 * the way avatar croppers work. That keeps the result always exactly the right
 * shape without asking the admin to size a selection by hand.
 *
 * Done hands back a data URI at outputWidth x outputHeight.
 */
const ImageCropper = ({
  src,
  outputWidth = 1920,
  outputHeight = 800,
  title = 'Adjust the image',
  onDone,
  onCancel
}) => {
  const frameRef = useRef(null);
  const imageRef = useRef(null);
  const pointersRef = useRef(new Map());
  // Panning reads and writes these every pointermove, too often for state
  const dragRef = useRef(null);
  const pinchRef = useRef(null);

  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const [natural, setNatural] = useState(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [loadFailed, setLoadFailed] = useState(false);
  const [exportError, setExportError] = useState('');

  // Remote images have to be fetched with CORS or the canvas export is blocked
  const isRemote = /^https?:\/\//i.test(src || '');

  // Track the frame's real size so the crop stays correct at any width
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;

    const measure = () => {
      const rect = frame.getBoundingClientRect();
      setFrameSize({ width: rect.width, height: rect.height });
    };

    measure();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  // The scale at which the image just covers the frame; zoom multiplies this
  const baseScale = natural && frameSize.width
    ? Math.max(frameSize.width / natural.width, frameSize.height / natural.height)
    : 0;

  const clampOffset = useCallback((next, atScale) => {
    if (!natural || !frameSize.width) return next;

    const total = baseScale * atScale;
    const displayWidth = natural.width * total;
    const displayHeight = natural.height * total;

    // Keep every edge of the frame covered by the image
    const minX = Math.min(0, frameSize.width - displayWidth);
    const minY = Math.min(0, frameSize.height - displayHeight);

    return {
      x: Math.min(0, Math.max(minX, next.x)),
      y: Math.min(0, Math.max(minY, next.y))
    };
  }, [natural, frameSize, baseScale]);

  const centre = useCallback((atScale) => {
    if (!natural || !frameSize.width) return { x: 0, y: 0 };

    const total = baseScale * atScale;
    return {
      x: (frameSize.width - natural.width * total) / 2,
      y: (frameSize.height - natural.height * total) / 2
    };
  }, [natural, frameSize, baseScale]);

  // Start centred once the image and the frame are both measured
  useEffect(() => {
    if (!natural || !frameSize.width) return;
    setScale(1);
    setOffset(centre(1));
  }, [natural, frameSize.width, frameSize.height, centre]);

  const handleImageLoad = (e) => {
    setNatural({ width: e.target.naturalWidth, height: e.target.naturalHeight });
    setLoadFailed(false);
  };

  /**
   * Zoom around a point in the frame so whatever is under the cursor or the
   * pinch centre stays put.
   */
  const zoomTo = useCallback((nextScale, focus) => {
    const clamped = Math.min(6, Math.max(1, nextScale));
    if (clamped === scale) return;

    const point = focus || { x: frameSize.width / 2, y: frameSize.height / 2 };
    const ratio = clamped / scale;

    // Computed from the current render's values rather than inside a state
    // updater, which React is free to run more than once
    setOffset(clampOffset({
      x: point.x - (point.x - offset.x) * ratio,
      y: point.y - (point.y - offset.y) * ratio
    }, clamped));
    setScale(clamped);
  }, [scale, offset, clampOffset, frameSize]);

  const framePoint = (event) => {
    const rect = frameRef.current.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const handlePointerDown = (event) => {
    if (!natural) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, framePoint(event));

    if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()];
      pinchRef.current = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        scale,
        centre: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      };
      dragRef.current = null;
    } else {
      const point = framePoint(event);
      dragRef.current = { startX: point.x, startY: point.y, origin: offset };
    }
  };

  const handlePointerMove = (event) => {
    if (!pointersRef.current.has(event.pointerId)) return;

    pointersRef.current.set(event.pointerId, framePoint(event));

    if (pointersRef.current.size >= 2 && pinchRef.current) {
      const [a, b] = [...pointersRef.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);

      if (pinchRef.current.distance > 0) {
        zoomTo(
          pinchRef.current.scale * (distance / pinchRef.current.distance),
          pinchRef.current.centre
        );
      }
      return;
    }

    if (!dragRef.current) return;

    const point = framePoint(event);
    setOffset(clampOffset({
      x: dragRef.current.origin.x + (point.x - dragRef.current.startX),
      y: dragRef.current.origin.y + (point.y - dragRef.current.startY)
    }, scale));
  };

  const handlePointerUp = (event) => {
    pointersRef.current.delete(event.pointerId);

    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 0) dragRef.current = null;
  };

  const handleWheel = (event) => {
    if (!natural) return;
    event.preventDefault();
    zoomTo(scale * (event.deltaY < 0 ? 1.12 : 1 / 1.12), framePoint(event));
  };

  const handleZoomSlider = (event) => {
    zoomTo(Number(event.target.value));
  };

  const handleReset = () => {
    setScale(1);
    setOffset(centre(1));
  };

  const handleDone = () => {
    const image = imageRef.current;
    if (!image || !natural) return;

    const canvas = document.createElement('canvas');
    canvas.width = outputWidth;
    canvas.height = outputHeight;

    const context = canvas.getContext('2d');
    const total = baseScale * scale;

    // Frame coordinates map back to the source image by dividing by the
    // total scale; the frame's top-left sits at -offset in image space
    context.drawImage(
      image,
      -offset.x / total,
      -offset.y / total,
      frameSize.width / total,
      frameSize.height / total,
      0,
      0,
      outputWidth,
      outputHeight
    );

    try {
      onDone(canvas.toDataURL('image/jpeg', 0.92));
    } catch (err) {
      // A remote image served without CORS headers taints the canvas
      console.error('Crop export failed:', err);
      setExportError(
        'This image cannot be cropped in the browser because the site hosting ' +
        'it does not allow it. Download the image and upload it as a file instead.'
      );
    }
  };

  const ready = Boolean(natural) && frameSize.width > 0;

  // Escape cancels, and the page behind must not scroll while this is open
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onCancel();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onCancel]);

  /*
   * Rendered into document.body on purpose. An ancestor with a transform - the
   * dashboard's .card picks one up on hover - becomes the containing block for
   * position:fixed, which made the panel jump around as the hover toggled.
   */
  return createPortal(
    <div className="cropper-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="cropper-panel">
        <div className="cropper-header">
          <h3>{title}</h3>
          <button
            type="button"
            className="cropper-close"
            onClick={onCancel}
            aria-label="Cancel cropping"
          >
            ×
          </button>
        </div>

        <p className="cropper-hint">
          Drag the image to move it, and zoom in or out until the part you want
          fills the box. The saved banner is {outputWidth}×{outputHeight}.
        </p>

        {exportError && <div className="alert alert-error">{exportError}</div>}

        <div
          className="cropper-frame"
          ref={frameRef}
          style={{ aspectRatio: `${outputWidth} / ${outputHeight}` }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
        >
          {loadFailed ? (
            <div className="cropper-message">That image could not be loaded.</div>
          ) : (
            <img
              ref={imageRef}
              src={src}
              alt=""
              draggable={false}
              {...(isRemote ? { crossOrigin: 'anonymous' } : {})}
              onLoad={handleImageLoad}
              onError={() => setLoadFailed(true)}
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${baseScale * scale})`,
                transformOrigin: 'top left',
                visibility: ready ? 'visible' : 'hidden'
              }}
            />
          )}

          {ready && <div className="cropper-grid" aria-hidden="true" />}
        </div>

        <div className="cropper-controls">
          <label htmlFor="cropper-zoom">Zoom</label>
          <input
            id="cropper-zoom"
            type="range"
            min="1"
            max="6"
            step="0.01"
            value={scale}
            onChange={handleZoomSlider}
            disabled={!ready}
          />
          <button
            type="button"
            className="btn btn-secondary cropper-reset"
            onClick={handleReset}
            disabled={!ready}
          >
            Reset
          </button>
        </div>

        <div className="cropper-actions">
          <button type="button" className="btn btn-primary" onClick={handleDone} disabled={!ready}>
            Done
          </button>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ImageCropper;
