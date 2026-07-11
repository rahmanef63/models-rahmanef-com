"use client";
import { Component, type ReactNode } from "react";

// One section crashing (e.g. a Convex query that isn't deployed yet, or a render bug) must NOT
// white-screen the whole dashboard. Wrap the section content so a thrown render degrades to a
// recoverable inline card. Resets automatically when you navigate to a different section.
export class SectionErrorBoundary extends Component<{ children: ReactNode; section: string }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidUpdate(prev: { section: string }) {
    if (prev.section !== this.props.section && this.state.error) this.setState({ error: null });
  }
  render() {
    if (this.state.error) {
      return (
        <section className="card">
          <h2>Couldn’t load this section</h2>
          <p className="sub">It hit an error and couldn’t render — the rest of the app is fine. Try another section, or reload.</p>
          <p className="mono danger" style={{ fontSize: ".78rem", wordBreak: "break-word" }}>{String(this.state.error?.message ?? this.state.error).slice(0, 300)}</p>
        </section>
      );
    }
    return this.props.children;
  }
}
