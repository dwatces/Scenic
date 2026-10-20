import { NotFoundState } from "../components/UIElements/LoadState";
import { useDocumentTitle } from "../hooks/use-document-title";

/** Any URL the app doesn't know, signed in or not. */
const NotFound = () => {
  useDocumentTitle("Page not found");
  return (
    <NotFoundState
      title="Page not found"
      links={[
        { to: "/", label: "Home" },
        { to: "/explore", label: "Explore scenes" },
      ]}
    >
      There&apos;s nothing at this address. The link may be old or mistyped.
    </NotFoundState>
  );
};

export default NotFound;
