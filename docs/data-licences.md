# Demo data licence check (15 Oct 2026)

| Source | Licence | OK for hackathon demo? | Notes |
|---|---|---|---|
| SceneDiff (huggingface.co/datasets/yuqun/SceneDiff) | MIT (dataset card) | Yes, SD-V subset | SD-K kitchen subset comes from HD-EPIC, whose own pages disagree (data.bris says CC BY 4.0, readme/site say CC BY-NC 4.0). Use SD-V only, or treat SD-K as non-commercial and credit it. Cite arXiv 2512.16908. |
| RealEstate10K camera poses (google.github.io/realestate10k) | CC BY 4.0 (poses only) | Poses yes; videos no by default | Videos belong to YouTube uploaders. The HF mirror Kunho/RealEstate10K-videos is gated: non-commercial research only, no redistribution. Don't show those frames in a public demo video. Instead pick walkthroughs YouTube marks Creative Commons (CC BY) and credit the uploader, or generate rooms. |
| miProgram UK property inspection sample | Evaluation/research only | Internal eval only | Don't show images in the public demo; commercial use needs a licence. |
| JamaisVu | check card before use | Eval only for now | Not checked in detail. |

Decision: demo footage = CC-BY YouTube walkthrough clips (credited) or fully generated rooms, with damage added by Muse Image and labelled "simulated". Benchmarks = SceneDiff SD-V.
