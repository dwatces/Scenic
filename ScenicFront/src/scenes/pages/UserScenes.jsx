import { useContext } from "react";
import { Link, useParams } from "react-router";

import Avatar from "../../shared/components/UIElements/Avatar";
import Button from "../../shared/components/FormElements/Button";
import PageHeading from "../../shared/components/UIElements/PageHeading";
import { DemoBadge } from "../../shared/components/UIElements/Demo";
import {
  ErrorPanel,
  NotFoundState,
  StatusLine,
} from "../../shared/components/UIElements/LoadState";
import SceneGrid from "../components/SceneGrid";
import LoadMore from "../components/LoadMore";
import { useSceneFeed } from "../hooks/feed-hook";
import { AuthContext } from "../../shared/context/auth-context";
import { useApiResource } from "../../shared/hooks/resource-hook";
import { useDocumentTitle } from "../../shared/hooks/use-document-title";
import { API_URL, apiAsset } from "../../config";
import "./UserScenes.css";

const isId = (value) => /^[0-9a-f]{24}$/i.test(value || "");
const countLabel = (count) => `${count} ${count === 1 ? "scene" : "scenes"}`;

/**
 * A member's page (/:userId/scenes), and "Your scenes" for the signed-in
 * member (also at /). The profile and the first page of scenes load side
 * by side.
 */
const UserScenes = ({ own = false }) => {
  const params = useParams();
  const auth = useContext(AuthContext);
  const userId = own ? auth.userId : params.userId;
  const isMe = auth.isLoggedIn && auth.userId === userId;

  const validId = isId(userId);
  const profile = useApiResource(validId ? `${API_URL}/users/${userId}` : null, { fresh: true });
  const feed = useSceneFeed({ creator: userId, enabled: validId });
  const user = profile.data && profile.data.user;
  const notFound = !validId || (profile.status === "error" && profile.error.status === 404);

  useDocumentTitle(
    isMe ? "Your scenes" : user ? `Scenes by ${user.name}` : notFound ? "Member not found" : null,
  );

  if (notFound) {
    return (
      <NotFoundState
        title="We couldn't find that member"
        links={[
          { to: "/users", label: "See all members" },
          { to: "/explore", label: "Explore scenes" },
        ]}
      >
        The link may be wrong, or the account may no longer exist.
      </NotFoundState>
    );
  }
  if (profile.status === "error") {
    return (
      <ErrorPanel
        title="We couldn't load this member"
        message={profile.error.message}
        onRetry={profile.retry}
      />
    );
  }
  if (!user) return <StatusLine>Loading scenes…</StatusLine>;

  const onDeleted = (id) => {
    feed.remove(id);
    profile.update((data) => ({
      user: { ...data.user, sceneCount: Math.max(0, data.user.sceneCount - 1) },
    }));
  };

  return (
    <div className="member-page">
      <header className="member-page__header">
        <Avatar src={apiAsset(user.avatarUrl)} name={user.name} size={72} />
        <div className="member-page__intro">
          <PageHeading>{isMe ? "Your scenes" : `Scenes by ${user.name}`}</PageHeading>
          <p className="member-page__meta">
            {countLabel(user.sceneCount)}
            {user.isDemo && <DemoBadge kind="account" />}
          </p>
        </div>
        <div className="member-page__links">
          {isMe ? (
            <Button to="/scenes/new">Add a scene</Button>
          ) : (
            <Link className="member-page__back" to="/users">
              Back to members
            </Link>
          )}
        </div>
      </header>

      {feed.status === "loading" && <StatusLine>Loading scenes…</StatusLine>}
      {feed.status === "error" && (
        <ErrorPanel
          title="We couldn't load these scenes"
          message={feed.error.message}
          onRetry={feed.retry}
        />
      )}
      {feed.status === "ready" && feed.scenes.length === 0 && (
        <div className="member-page__empty">
          <p>
            {isMe
              ? "You haven't posted any scenes yet."
              : `${user.name} hasn't posted any scenes yet.`}
          </p>
          {isMe && <Button to="/scenes/new">Add your first scene</Button>}
        </div>
      )}
      {feed.scenes.length > 0 && (
        <SceneGrid
          scenes={feed.scenes}
          showCreator={false}
          ownerId={isMe ? auth.userId : null}
          onDeleted={onDeleted}
        />
      )}
      {feed.status === "ready" && <LoadMore feed={feed} />}
    </div>
  );
};

export default UserScenes;
