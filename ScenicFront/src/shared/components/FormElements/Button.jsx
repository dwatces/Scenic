import { Link } from "react-router";

import "./Button.css";

const Button = (props) => {
  const classes = [
    "button",
    `button--${props.size || "default"}`,
    props.inverse && "button--inverse",
    props.danger && "button--danger",
    props.center && "center__button",
    props.className,
  ]
    .filter(Boolean)
    .join(" ");

  if (props.href) {
    return (
      <a className={classes} href={props.href}>
        {props.children}
      </a>
    );
  }
  if (props.to) {
    return (
      <Link to={props.to} className={classes}>
        {props.children}
      </Link>
    );
  }
  // While busy (saving, deleting, logging in) the button keeps focus, so
  // whatever happens next (an error dialog, say) can hand focus back to it.
  // It is marked aria-disabled and ignores clicks (and so a second submit)
  // instead of becoming disabled, which would drop focus to the page.
  const busy = Boolean(props.busy);
  return (
    // type defaults to "button": a typeless button inside a form submits it.
    <button
      className={classes}
      type={props.type || "button"}
      onClick={busy ? (event) => event.preventDefault() : props.onClick}
      disabled={busy ? false : props.disabled}
      aria-disabled={busy || undefined}
      aria-busy={busy || undefined}
    >
      {props.children}
    </button>
  );
};

export default Button;
