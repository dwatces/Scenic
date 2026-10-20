import Button from "../../shared/components/FormElements/Button";
import "./LoadMore.css";

/**
 * "Load more scenes" for a feed from useSceneFeed. Each load is announced
 * ("12 more scenes loaded.") through a polite live region, and at the end
 * the button says so and is disabled.
 */
const LoadMore = ({ feed }) => {
  const reachedEnd = !feed.hasMore && feed.announcement !== "";
  return (
    <div className="load-more">
      {feed.hasMore && (
        <Button inverse onClick={feed.loadMore} disabled={feed.loadingMore} busy={feed.loadingMore}>
          {feed.loadingMore ? "Loading scenes…" : "Load more scenes"}
        </Button>
      )}
      {reachedEnd && (
        <Button inverse disabled>
          You&apos;ve seen every scene.
        </Button>
      )}
      {feed.moreError && (
        <p className="load-more__error" role="alert">
          {feed.moreError.message}
        </p>
      )}
      <p className="visually-hidden" aria-live="polite">
        {feed.announcement}
      </p>
    </div>
  );
};

export default LoadMore;
