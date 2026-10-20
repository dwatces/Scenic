import { useReducer, useEffect } from "react";

import { validate } from "../../Util/validators";
import "./Input.css";

const inputReducer = (state, action) => {
  switch (action.type) {
    case "CHANGE":
      return {
        ...state,
        value: action.val,
        isValid: validate(action.val, action.validators),
      };
    case "TOUCH":
      return { ...state, isTouched: true };
    default:
      return state;
  }
};

/**
 * A labelled text field (or textarea) that reports (id, value, isValid) to
 * its form.
 *
 * Its error shows once the form has been submitted (`showErrors`), or
 * after the visitor has typed something invalid and left the field; an
 * empty field someone just tabbed past isn't flagged until they submit.
 * The hint and the error are linked with aria-describedby.
 */
const Input = (props) => {
  const [inputState, dispatch] = useReducer(inputReducer, {
    value: props.initialValue || "",
    isTouched: false,
    isValid: props.initialValid || false,
  });

  const { id, onInput } = props;
  const { value, isValid } = inputState;

  useEffect(() => {
    onInput(id, value, isValid);
  }, [id, value, isValid, onInput]);

  const changeHandler = (event) => {
    dispatch({ type: "CHANGE", val: event.target.value, validators: props.validators });
  };
  const touchHandler = () => dispatch({ type: "TOUCH" });

  const showError = !isValid && (props.showErrors || (inputState.isTouched && value.trim() !== ""));
  const hintId = props.hint ? `${id}-hint` : null;
  const errorId = showError ? `${id}-error` : null;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  const shared = {
    id,
    value,
    onChange: changeHandler,
    onBlur: touchHandler,
    required: props.required || undefined,
    "aria-invalid": showError || undefined,
    "aria-describedby": describedBy,
  };
  const element =
    props.element === "input" ? (
      <input
        {...shared}
        type={props.type}
        placeholder={props.placeholder}
        autoComplete={props.autoComplete}
      />
    ) : (
      <textarea {...shared} rows={props.rows || 3} />
    );

  return (
    <div className={`form-control${showError ? " form-control--invalid" : ""}`}>
      <label htmlFor={id}>{props.label}</label>
      {props.hint && (
        <p className="form-control__hint" id={hintId}>
          {props.hint}
        </p>
      )}
      {element}
      {showError && (
        <p className="form-control__error" id={errorId}>
          {props.errorText}
        </p>
      )}
    </div>
  );
};

export default Input;
