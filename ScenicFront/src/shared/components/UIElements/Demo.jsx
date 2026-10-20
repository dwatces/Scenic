import "./Demo.css";

export const DEMO_NOTE =
  "Sample accounts and photos show how Scenic works. Anyone can sign up and post their own.";

/** Labels seeded sample content, so it never passes for a real member's. */
export const DemoBadge = ({ kind = "scene" }) => (
  <span className="demo-badge">{kind === "account" ? "Demo account" : "Demo scene"}</span>
);

/** The one-line note above a list, shown when the list holds demo content. */
export const DemoNote = ({ show = true }) =>
  show ? <p className="demo-note">{DEMO_NOTE}</p> : null;
