import UsersList from "../components/UsersList";
import PageHeading from "../../shared/components/UIElements/PageHeading";
import { DemoNote } from "../../shared/components/UIElements/Demo";
import { ErrorPanel, StatusLine } from "../../shared/components/UIElements/LoadState";
import { useApiResource } from "../../shared/hooks/resource-hook";
import { useDocumentTitle } from "../../shared/hooks/use-document-title";
import { withFreshness } from "../../shared/util/api";
import { API_URL } from "../../config";
import "../components/UserList.css";

/** /users: every member, by name. */
const Users = () => {
  useDocumentTitle("Members");
  const resource = useApiResource(withFreshness(`${API_URL}/users`));
  const users = resource.data ? resource.data.users : [];

  return (
    <div className="members-page">
      <header className="members-page__header">
        <PageHeading>Members</PageHeading>
        <DemoNote show={users.some((user) => user.isDemo)} />
      </header>
      {resource.status === "loading" && <StatusLine>Loading members…</StatusLine>}
      {resource.status === "error" && (
        <ErrorPanel
          title="We couldn't load the members"
          message={resource.error.message}
          onRetry={resource.retry}
        />
      )}
      {resource.status === "ready" && <UsersList items={users} />}
    </div>
  );
};

export default Users;
