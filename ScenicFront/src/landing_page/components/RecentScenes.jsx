import { Link } from "react-router";

import SceneGrid from "../../scenes/components/SceneGrid";
import { DemoNote } from "../../shared/components/UIElements/Demo";
import { ErrorPanel, StatusLine } from "../../shared/components/UIElements/LoadState";
import { useSceneFeed } from "../../scenes/hooks/feed-hook";
import "./RecentScenes.css";

/** The landing page's proof of life: the six newest scenes, and a way to see the rest. */
const RecentScenes = () => {
  const feed = useSceneFeed({ limit: 6 });

  return (
    <section className="recent-scenes" aria-labelledby="recent-scenes-heading">
      <header className="recent-scenes__header">
        <h2 id="recent-scenes-heading">Recent scenes</h2>
        <DemoNote show={feed.scenes.some((scene) => scene.isDemo)} />
      </header>
      {feed.status === "loading" && <StatusLine>Loading scenes…</StatusLine>}
      {feed.status === "error" && (
        <ErrorPanel
          title="We couldn't load the latest scenes"
          message={feed.error.message}
          onRetry={feed.retry}
        />
      )}
      {feed.status === "ready" && feed.scenes.length === 0 && (
        <p className="recent-scenes__empty">No one has posted a scene yet.</p>
      )}
      {feed.scenes.length > 0 && <SceneGrid scenes={feed.scenes} headingLevel={3} />}
      <p className="recent-scenes__more">
        <Link to="/explore">See all scenes</Link>
      </p>
    </section>
  );
};

export default RecentScenes;
