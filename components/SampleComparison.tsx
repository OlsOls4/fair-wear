"use client";

import { useId, useRef, useState, type PointerEvent } from "react";

const ROOMS = [
  { id: "bedroom", label: "Bedroom", note: "The model can get it wrong. You stay in control.", detail: "This carpet was planted as fair wear, but the model called it damage. The error is published in the review.", type: "Known model error", number: "01" },
  { id: "living-room", label: "Living room", note: "A visible change is a starting point, not a verdict.", detail: "The model flagged carpet damage. Inspect the evidence, then decide how to respond.", type: "Change detected", number: "02" },
  { id: "kitchen", label: "Kitchen", note: "Different changes need different questions.", detail: "The model suggested worktop damage and oven cleaning. Neither suggestion establishes a reasonable charge.", type: "Two types of change", number: "03" },
  { id: "bathroom", label: "Bathroom", note: "What the model misses matters, too.", detail: "The sealant was not segmented, so it has no finding card. A missing finding is not evidence of no change.", type: "Known missed item", number: "04" },
] as const;

export default function SampleComparison() {
  const [roomIndex, setRoomIndex] = useState(0);
  const [position, setPosition] = useState(50);
  const id = useId();
  const dragPointer = useRef<number | null>(null);
  function moveDivider(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width > 0) setPosition(Math.max(0, Math.min(100, Math.round((event.clientX - bounds.left) / bounds.width * 100))));
  }
  const room = ROOMS[roomIndex];
  return (
    <section className="sample-comparison" aria-labelledby={`${id}-title`}>
      <div className="comparison-topline">
        <span className="eyebrow" id={`${id}-title`}>The sample flat</span>
        <span className="sample-stamp">Generated imagery</span>
      </div>
      <div className="room-switcher" role="group" aria-label="Choose a sample room">
        {ROOMS.map((item, index) => <button type="button" key={item.id} aria-pressed={roomIndex === index} onClick={() => { setRoomIndex(index); setPosition(50); }}>{item.label}</button>)}
      </div>
      <div className="comparison-scene"
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0) return;
          dragPointer.current = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId);
          moveDivider(event);
        }}
        onPointerMove={(event) => { if (dragPointer.current === event.pointerId) moveDivider(event); }}
        onPointerUp={(event) => { if (dragPointer.current === event.pointerId) { dragPointer.current = null; event.currentTarget.releasePointerCapture(event.pointerId); } }}
        onPointerCancel={() => { dragPointer.current = null; }}
        onLostPointerCapture={() => { dragPointer.current = null; }}
      >
        <img src={`/demo/flat/${room.id}-move-in.jpg`} width="1280" height="720" alt={`Generated ${room.label.toLowerCase()} scene at move-in`} draggable={false} fetchPriority={roomIndex === 0 ? "high" : undefined} />
        <img className="comparison-after" src={`/demo/flat/${room.id}-move-out.jpg`} width="1280" height="720" alt={`Generated ${room.label.toLowerCase()} scene at move-out`} draggable={false} style={{ clipPath: `inset(0 0 0 ${position}%)` }} />
        <span className="scene-tag scene-tag-before" hidden={position === 0}>Move-in</span>
        <span className="scene-tag scene-tag-after" hidden={position === 100}>Move-out</span>
        <div className="comparison-divider" style={{ left: `${position}%` }} aria-hidden="true"><span>↔</span></div>
      </div>
      <div className="comparison-controls">
        <label htmlFor={`${id}-slider`}>Drag the divider or adjust the slider</label>
        <input id={`${id}-slider`} type="range" min="0" max="100" value={position} aria-label="Reveal move-in or move-out scene" aria-valuetext={`${position}% move-in, ${100 - position}% move-out`} aria-describedby={`${id}-caveat`} onChange={(event) => setPosition(Number(event.target.value))} />
        <div className="comparison-presets" role="group" aria-label="Comparison view">
          <button type="button" aria-pressed={position === 100} onClick={() => setPosition(100)}>Move-in</button>
          <button type="button" aria-pressed={position === 50} onClick={() => setPosition(50)}>Compare</button>
          <button type="button" aria-pressed={position === 0} onClick={() => setPosition(0)}>Move-out</button>
        </div>
      </div>
      <div className="comparison-finding" aria-live="polite" aria-atomic="true">
        <span className="finding-index" aria-hidden="true">{room.number}</span>
        <div><span className="eyebrow">{room.type}</span><h3>{room.note}</h3><p>{room.detail}</p></div>
      </div>
      <p className="comparison-caveat" id={`${id}-caveat`}>Muse Image-generated test scenes. Views can differ in framing and lighting; the slider is a visual aid, not an aligned measurement.</p>
    </section>
  );
}
