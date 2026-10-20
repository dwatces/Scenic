import "./SkipLink.css";

/**
 * The first thing Tab reaches: jumps past the header to the page. Focus is
 * moved by hand (not by the #main fragment) so the URL stays as it is.
 */
const SkipLink = () => (
  <a
    className="skip-link"
    href="#main"
    onClick={(event) => {
      const main = document.getElementById("main");
      if (!main) return;
      event.preventDefault();
      main.focus();
      main.scrollIntoView();
    }}
  >
    Skip to main content
  </a>
);

export default SkipLink;
