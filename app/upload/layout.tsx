import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How it works",
  description: "Follow the Fair Wear evidence workflow, from generated room inputs and recorded model suggestions to a response you control. No live model calls or personal videos.",
};

export default function WorkflowLayout({ children }: { children: React.ReactNode }) {
  return children;
}
