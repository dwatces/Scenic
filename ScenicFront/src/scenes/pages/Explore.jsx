import PageHeading from "../../shared/components/UIElements/PageHeading";
import { DemoNote } from "../../shared/components/UIElements/Demo";
import { ErrorPanel, StatusLine } from "../../shared/components/UIElements/LoadState";
import SceneGrid from "../components/SceneGrid";
import LoadMore from "../components/LoadMore";
import { useSceneFeed } from "../hooks/feed-hook";
import { useDocumentTitle } from "../../shared/hooks/use-document-title";
import "./Explore.css";

/** /explore: every member's scenes, newest first, twelve at a time. */
const Explore = () => {
  useDocumentTitle("Explore");
  const feed = useSceneFeed({ limit: 12 });

  return (
    <div className="explore-page">
      <header className="explore-page__header">
        <PageHeading>Explore scenes</PageHeading>
        <p className="explore-page__intro">The newest places members have shared.</p>
        <DemoNote show={feed.scenes.some((scene) => scene.isDemo)} />
      </header>
      {feed.status === "loading" && <StatusLine>Loading scenes…</StatusLine>}
      {feed.status === "error" && (
        <ErrorPanel
          title="We couldn't load the scenes"
          message={feed.error.message}
          onRetry={feed.retry}
        />
      )}
      {feed.status === "ready" && feed.scenes.length === 0 && (
        <p className="explore-page__empty">No one has posted a scene yet.</p>
      )}
      {feed.scenes.length > 0 && <SceneGrid scenes={feed.scenes} />}
      {feed.status === "ready" && <LoadMore feed={feed} />}
    </div>
  );
};

export default Explore;
