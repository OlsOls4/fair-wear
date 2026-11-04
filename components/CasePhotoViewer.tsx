"use client";

import { useEffect, useId, useRef, useState } from "react";
import styles from "./CasePhotoViewer.module.css";

/** Display only: no uploads, persistence, changes or reclassification of evidence. */
export default function CasePhotoViewer({ src, label, item, sample }: { src: string; label: string; item: string; sample: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [actualSize, setActualSize] = useState(false);
  // A different claim/photo must not inherit an open viewer or its zoom state.
  useEffect(() => { if (dialog.current?.open) dialog.current.close(); setActualSize(false); }, [src]);
  const name = item.trim() || "this deduction";
  return <>
    <button ref={opener} type="button" className={styles.thumbnail} aria-haspopup="dialog" aria-label={`Enlarge ${label} evidence for ${name}`} onClick={() => { setActualSize(false); setIsOpen(true); dialog.current?.showModal(); closeButton.current?.focus(); }}>
      <img src={src} alt={`${label} evidence for ${name}`} />
      <span>Enlarge photo</span>
    </button>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId} aria-describedby={descriptionId} onClose={() => { setIsOpen(false); setActualSize(false); opener.current?.focus({ preventScroll: true }); }} onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className={styles.content}>
        <div className={styles.toolbar}><h2 id={titleId}>{label} · {name}</h2><button ref={closeButton} type="button" onClick={() => dialog.current?.close()}>Close photo</button></div>
        <p id={descriptionId}>{sample ? "Generated sample scene, not a photograph of an actual tenancy." : "Local display copy. No upload or AI analysis. Keep your original separately."} Labels and order are reviewer-selected; timing is unverified. The complete image is shown without trimming or stretching.</p>
        <div className={styles.toolbar}><button type="button" aria-pressed={actualSize} onClick={() => setActualSize((value) => !value)}>{actualSize ? "Fit to window" : "View actual size"}</button><span>{actualSize ? "Scroll to inspect the display copy. This does not add detail or authenticate evidence." : "Use actual size to inspect detail in small or narrow images."}</span></div>
        <div className={`${styles.viewport} ${actualSize ? styles.actualSize : ""}`} tabIndex={0} role="region" aria-label={`${label} enlarged photo${actualSize ? ", scroll to inspect" : ""}`}>{isOpen && <img src={src} alt={`${label} evidence for ${name}, enlarged`} />}</div>
      </div>
    </dialog>
  </>;
}
