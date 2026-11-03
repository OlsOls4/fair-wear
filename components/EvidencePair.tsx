"use client";

import { useEffect, useId, useRef, useState } from "react";

type Props = { before?: string; after?: string; label: string; simulated?: boolean };
type Stage = "before" | "after";

export default function EvidencePair({ before, after, label, simulated = false }: Props) {
  const [selected, setSelected] = useState<Stage | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const opener = useRef<HTMLButtonElement | null>(null);
  const images = [
    { stage: "before" as const, src: before, title: "Move-in" },
    { stage: "after" as const, src: after, title: "Move-out" },
  ].filter((image) => Boolean(image.src));
  const current = images.find((image) => image.stage === selected);

  useEffect(() => {
    if (selected && dialog.current && !dialog.current.open) {
      dialog.current.showModal();
    }
  }, [selected]);

  if (!images.length) return null;

  return (
    <>
      <div className="pair">
        {images.map(({ stage, src, title }) => (
          <figure key={stage} style={{ margin: 0, minWidth: 0 }}>
            <button
              className="evidence-thumbnail"
              type="button"
              aria-label={`Enlarge ${title.toLowerCase()} evidence for ${label}`}
              aria-haspopup="dialog"
              onClick={(event) => { opener.current = event.currentTarget; setSelected(stage); }}
            >
              <img src={src} alt={`${label}: ${title.toLowerCase()} evidence`} />
            </button>
            <figcaption>{title} · Enlarge evidence</figcaption>
          </figure>
        ))}
      </div>
      <dialog
        ref={dialog}
        className="evidence-dialog"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClose={() => { setSelected(null); opener.current?.focus(); }}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        <div className="evidence-content">
          <div className="evidence-toolbar">
            <h2 id={titleId}>{label} · {current?.title ?? "Evidence"}</h2>
            <button type="button" className="chip" autoFocus onClick={() => dialog.current?.close()}>
              Close
            </button>
          </div>
          <p id={descriptionId} className="meta evidence-description">
            {simulated ? "Simulated input imagery: these generated scenes are not photographs of an actual tenancy. " : ""}
            Item crops are shown without trimming. Compare both stages; framing and scale can differ.
          </p>
          {images.length > 1 && (
            <div className="evidence-toolbar" role="group" aria-label="Select evidence image">
              {images.map(({ stage, title }) => (
                <button
                  key={stage}
                  type="button"
                  className={`chip ${selected === stage ? "on" : ""}`}
                  aria-pressed={selected === stage}
                  onClick={() => setSelected(stage)}
                >
                  {title}
                </button>
              ))}
            </div>
          )}
          {current && <>
            <img className="evidence-full" src={current.src} alt={`${label}: ${current.title.toLowerCase()} evidence, enlarged`} />
            {current.src?.startsWith("/") && !current.src.startsWith("//") && (
              <a className="chip evidence-original" href={current.src} target="_blank" rel="noopener noreferrer">
                Open original {current.title.toLowerCase()} image (new tab)
              </a>
            )}
          </>}
        </div>
      </dialog>
      <style jsx>{`
        .evidence-thumbnail { display: block; width: 100%; height: 150px; min-height: 44px; padding: 4px; background: #f5f3ee; border: 0; border-radius: 8px; cursor: zoom-in; }
        .evidence-thumbnail img { width: 100%; height: 100%; object-fit: contain; border: 0; border-radius: 4px; }
        .evidence-thumbnail:focus-visible { outline: 3px solid #315fce; outline-offset: 3px; }
        .evidence-dialog { width: min(1200px, calc(100vw - 24px)); max-width: calc(100vw - 24px); max-height: calc(100vh - 24px); max-height: calc(100dvh - 24px); padding: 0; border: 1px solid var(--line, #ddd); border-radius: 14px; color: inherit; background: var(--bg, #fff); }
        .evidence-dialog::backdrop { background: rgba(10, 15, 25, 0.8); }
        .evidence-content { padding: 16px; }
        .evidence-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
        .evidence-toolbar h2 { flex: 1; min-width: 150px; font-size: 18px; margin: 0; overflow-wrap: anywhere; }
        .evidence-description { margin: 0 0 12px; }
        .evidence-original { margin-top: 12px; }
        .evidence-full { display: block; width: 100%; height: auto; max-height: calc(100dvh - 190px); object-fit: contain; }
      `}</style>
    </>
  );
}
