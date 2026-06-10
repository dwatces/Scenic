import React from "react";
import { Link } from "react-router-dom";

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
      <Link to={props.to} exact={props.exact} className={classes}>
        {props.children}
      </Link>
    );
  }
  return (
    <button
      className={classes}
      type={props.type}
      onClick={props.onClick}
      disabled={props.disabled}
    >
      {props.children}
    </button>
  );
};

export default Button;
