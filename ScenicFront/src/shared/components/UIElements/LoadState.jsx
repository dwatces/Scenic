import { Link } from "react-router";

import Button from "../FormElements/Button";
import PageHeading from "./PageHeading";
import "./LoadState.css";

/** A one-line, announced loading message in the page (never a full-screen overlay). */
export const StatusLine = ({ children, compact = false }) => (
  <p className={`load-status${compact ? " load-status--compact" : ""}`} role="status">
    {children}
  </p>
);

/**
 * Grey placeholders the shape of what is loading, so the page doesn't jump
 * when it arrives. Hidden from screen readers: the StatusLine beside it
 * says what is happening.
 * @param {{ count?: number, kind?: "scene" | "member" }} props
 */
export const SkeletonGrid = ({ count = 3, kind = "scene" }) => (
  <ul
    className={kind === "member" ? "users-list skeleton-list" : "scene-grid skeleton-list"}
    aria-hidden="true"
  >
    {Array.from({ length: count }, (_, index) =>
      kind === "member" ? (
        <li key={index} className="skeleton-member">
          <span className="skeleton skeleton--circle" />
          <span className="skeleton-member__lines">
            <span className="skeleton skeleton--line" />
            <span className="skeleton skeleton--line skeleton--short" />
          </span>
        </li>
      ) : (
        <li key={index} className="skeleton-card">
          <span className="skeleton skeleton--image" />
          <span className="skeleton-card__body">
            <span className="skeleton skeleton--line" />
            <span className="skeleton skeleton--line skeleton--short" />
          </span>
        </li>
      ),
    )}
  </ul>
);

/** A load that failed: the plain message and a way to try again. */
export const ErrorPanel = ({ title = "We couldn't load this", message, onRetry }) => (
  <div className="load-panel" role="alert">
    <p className="load-panel__title">{title}</p>
    <p>{message}</p>
    {onRetry && (
      <Button inverse onClick={onRetry}>
        Try again
      </Button>
    )}
  </div>
);

/**
 * Something that doesn't exist: the page's heading says so, with links
 * somewhere useful.
 * @param {{ title: string, links: { to: string, label: string }[], children?: React.ReactNode }} props
 */
export const NotFoundState = ({ title, children, links }) => (
  <div className="not-found">
    <PageHeading>{title}</PageHeading>
    {children && <p className="not-found__text">{children}</p>}
    <ul className="not-found__links">
      {links.map((link) => (
        <li key={link.to}>
          <Link to={link.to}>{link.label}</Link>
        </li>
      ))}
    </ul>
  </div>
);
