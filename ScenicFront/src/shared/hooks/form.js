import { useCallback, useReducer, useState } from "react";

const formReducer = (state, action) => {
  switch (action.type) {
    case "INPUT_CHANGE": {
      let formIsValid = true;
      for (const inputId in state.inputs) {
        if (!state.inputs[inputId]) {
          continue;
        }
        if (inputId === action.inputId) {
          formIsValid = formIsValid && action.isValid;
        } else {
          formIsValid = formIsValid && state.inputs[inputId].isValid;
        }
      }
      return {
        ...state,
        inputs: {
          ...state.inputs,
          [action.inputId]: { value: action.value, isValid: action.isValid },
        },
        isValid: formIsValid,
      };
    }
    case "SET_DATA":
      return {
        inputs: action.inputs,
        isValid: action.formIsValid,
      };
    default:
      return state;
  }
};

export const useForm = (initialInputs, initialFormValidity) => {
  const [formState, dispatch] = useReducer(formReducer, {
    inputs: initialInputs,
    isValid: initialFormValidity,
  });

  const inputHandler = useCallback((id, value, isValid) => {
    dispatch({
      type: "INPUT_CHANGE",
      value: value,
      isValid: isValid,
      inputId: id,
    });
  }, []);

  const setFormData = useCallback((formData, formValidity) => {
    dispatch({
      type: "SET_DATA",
      inputs: formData,
      formIsValid: formValidity,
    });
  }, []);

  return [formState, inputHandler, setFormData];
};

/**
 * Submit handling for a form whose submit button always stays enabled.
 * On submit with invalid fields: show every field's error, list them in
 * an ErrorSummary and move focus to the first one; otherwise call
 * onValid().
 * @param {{ inputs: Record<string, { isValid: boolean }> }} formState
 * @param {{ id: string, message: string }[]} fields in the order they appear
 * @param {() => void} onValid
 */
export function useValidatedSubmit(formState, fields, onValid) {
  const [attempted, setAttempted] = useState(false);
  const invalid = fields.filter(
    (field) => !(formState.inputs[field.id] && formState.inputs[field.id].isValid),
  );

  const handleSubmit = (event) => {
    event.preventDefault();
    if (invalid.length > 0) {
      setAttempted(true);
      const first = document.getElementById(invalid[0].id);
      if (first) first.focus();
      return;
    }
    onValid();
  };

  return { attempted, errors: attempted ? invalid : [], handleSubmit };
}
