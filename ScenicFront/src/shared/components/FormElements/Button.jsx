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
  return (
    // type defaults to "button": a typeless button inside a form submits it.
    <button
      className={classes}
      type={props.type || "button"}
      onClick={props.onClick}
      disabled={props.disabled}
      aria-busy={props.busy || undefined}
    >
      {props.children}
    </button>
  );
};

export default Button;
