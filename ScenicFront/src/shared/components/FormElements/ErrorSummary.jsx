import "./ErrorSummary.css";

/**
 * What needs fixing, at the top of a form after a submit that didn't go
 * through. Each item links to its field.
 * @param {{ errors: { id: string, message: string }[] }} props
 */
const ErrorSummary = ({ errors }) => {
  if (errors.length === 0) return null;
  return (
    <div className="error-summary" role="alert">
      <h2 className="error-summary__title">
        {errors.length === 1 ? "Check this and try again" : "Check these and try again"}
      </h2>
      <ul>
        {errors.map((error) => (
          <li key={error.id}>
            <a
              href={`#${error.id}`}
              onClick={(event) => {
                const field = document.getElementById(error.id);
                if (!field) return;
                event.preventDefault();
                field.focus();
              }}
            >
              {error.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ErrorSummary;
