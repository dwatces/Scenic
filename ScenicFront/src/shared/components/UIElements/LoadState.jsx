import { Link } from "react-router";

import Button from "../FormElements/Button";
import PageHeading from "./PageHeading";
import "./LoadState.css";

/** A one-line, announced loading message in the page (never a full-screen overlay). */
export const StatusLine = ({ children }) => (
  <p className="load-status" role="status">
    {children}
  </p>
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
