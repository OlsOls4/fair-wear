"use client";

import { useId, useRef, useState, type PointerEvent } from "react";

type Props = { before: string; after: string; label: string; descriptionId: string };

/** A reveal between independently fitted crops, never an image registration or measurement. */
export default function EvidenceComparison({ before, after, label, descriptionId }: Props) {
  const [position, setPosition] = useState(50);
  const sliderId = useId();
  const pointer = useRef<number | null>(null);

  function moveDivider(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width > 0) {
      setPosition(Math.max(0, Math.min(100, Math.round((event.clientX - bounds.left) / bounds.width * 100))));
    }
  }

  return (
    <div className="evidence-comparison">
      <div
        className="evidence-comparison-scene"
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0) return;
          pointer.current = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId);
          moveDivider(event);
        }}
        onPointerMove={(event) => { if (pointer.current === event.pointerId) moveDivider(event); }}
        onPointerUp={(event) => {
          if (pointer.current !== event.pointerId) return;
          pointer.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => { pointer.current = null; }}
        onLostPointerCapture={() => { pointer.current = null; }}
      >
        <div className="evidence-comparison-layer" aria-hidden={position === 0}>
          <img src={before} alt={`${label}: move-in evidence, enlarged`} draggable={false} />
        </div>
        <div className="evidence-comparison-layer evidence-comparison-after" style={{ clipPath: `inset(0 0 0 ${position}%)` }} aria-hidden={position === 100}>
          <img src={after} alt={`${label}: move-out evidence, enlarged`} draggable={false} />
        </div>
        <span className="evidence-comparison-tag evidence-comparison-before-tag" hidden={position === 0}>Move-in</span>
        <span className="evidence-comparison-tag evidence-comparison-after-tag" hidden={position === 100}>Move-out</span>
        <div className="evidence-comparison-divider" style={{ left: `${position}%` }} aria-hidden="true">
          <span><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m8 7-5 5 5 5m8-10 5 5-5 5M3 12h18" /></svg></span>
        </div>
      </div>
      <div className="evidence-comparison-controls">
        <label htmlFor={sliderId}>Drag the divider or adjust the slider</label>
        <input
          id={sliderId}
          type="range"
          min="0"
          max="100"
          step="1"
          value={position}
          aria-label={`Reveal move-in or move-out evidence for ${label}`}
          aria-valuetext={`${position}% move-in, ${100 - position}% move-out`}
          aria-describedby={descriptionId}
          onChange={(event) => setPosition(Number(event.target.value))}
        />
        <div className="evidence-comparison-scale" aria-hidden="true"><span>Move-out</span><span>Move-in</span></div>
      </div>
      <style jsx>{`
        .evidence-comparison-scene { position: relative; height: clamp(180px, 53dvh, 560px); overflow: hidden; border: 1px solid var(--line, #ddd); border-radius: 8px; cursor: ew-resize; touch-action: pan-y; user-select: none; }
        .evidence-comparison-layer { position: absolute; inset: 0; background: #e8e9e2; }
        .evidence-comparison-layer img { display: block; width: 100%; height: 100%; object-fit: contain; }
        .evidence-comparison-tag { position: absolute; top: 12px; padding: 4px 8px; border-radius: 3px; background: #fffefbf2; color: var(--ink, #203a35); font-size: 12px; font-weight: 650; pointer-events: none; }
        .evidence-comparison-before-tag { left: 12px; }
        .evidence-comparison-after-tag { right: 12px; }
        .evidence-comparison-divider { position: absolute; top: 0; bottom: 0; width: 2px; transform: translateX(-1px); background: #fffefb; box-shadow: 0 0 0 1px #203a3540; pointer-events: none; }
        .evidence-comparison-divider > span { display: grid; place-items: center; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 44px; height: 44px; border: 1px solid #ccd4c7; border-radius: 50%; color: var(--ink, #203a35); background: #fffefb; box-shadow: 0 2px 8px #0002; }
        .evidence-comparison-controls { padding: 10px 4px 0; }
        .evidence-comparison-controls label, .evidence-comparison-scale { font-size: 12px; color: var(--mute, #596660); }
        .evidence-comparison-controls input { display: block; width: 100%; height: 44px; margin: 0; accent-color: var(--info, #1d6253); cursor: ew-resize; }
        .evidence-comparison-scale { display: flex; justify-content: space-between; margin-top: -4px; }
      `}</style>
    </div>
  );
}
