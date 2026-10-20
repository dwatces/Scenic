import { useContext } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";

import Avatar from "../../shared/components/UIElements/Avatar";
import Button from "../../shared/components/FormElements/Button";
import Map from "../../shared/components/UIElements/Map";
import PageHeading from "../../shared/components/UIElements/PageHeading";
import {
  ErrorPanel,
  NotFoundState,
  StatusLine,
} from "../../shared/components/UIElements/LoadState";
import DeleteSceneButton from "../components/DeleteSceneButton";
import { AuthContext } from "../../shared/context/auth-context";
import { useApiResource } from "../../shared/hooks/resource-hook";
import { useDocumentTitle } from "../../shared/hooks/use-document-title";
import { withFreshness } from "../../shared/util/api";
import { API_URL, apiAsset } from "../../config";
import "./ScenePage.css";

const postedOn = (iso) =>
  new Date(iso).toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" });

const openStreetMapLink = ({ lat, lng }) =>
  `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`;

/** What the photo is, for people who can't see it. */
export const imageAlt = (scene) =>
  scene.isDemo
    ? `Placeholder image for ${scene.title} (demo content)`
    : `${scene.title}, ${scene.address}`;

/**
 * One scene: the photo, where it is, who posted it, and a map. Public, so
 * the link can be shared. Right after posting or editing, the page shows
 * the scene the API returned instead of fetching it again.
 */
const ScenePage = () => {
  const { sceneId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useContext(AuthContext);

  const passed = location.state && location.state.scene;
  const handedOver = passed && passed.id === sceneId ? passed : null;
  const resource = useApiResource(
    handedOver ? null : withFreshness(`${API_URL}/scenes/${sceneId}`),
  );
  const scene = handedOver || (resource.data && resource.data.scene);

  useDocumentTitle(
    scene
      ? scene.title
      : resource.error && resource.error.status === 404
        ? "Scene not found"
        : null,
  );

  if (!scene) {
    if (resource.status === "error" && resource.error.status === 404) {
      return (
        <NotFoundState
          title="We couldn't find that scene"
          links={[
            { to: "/explore", label: "Explore scenes" },
            { to: "/", label: "Home" },
          ]}
        >
          It may have been deleted, or the link may be wrong.
        </NotFoundState>
      );
    }
    if (resource.status === "error") {
      return (
        <ErrorPanel
          title="We couldn't load this scene"
          message={resource.error.message}
          onRetry={resource.retry}
        />
      );
    }
    return <StatusLine>Loading scene…</StatusLine>;
  }

  const { creator } = scene;
  const isOwner = auth.isLoggedIn && auth.userId === creator.id;

  return (
    <article className="scene-page">
      <figure className="scene-page__figure">
        <img
          src={apiAsset(scene.imageUrl)}
          alt={imageAlt(scene)}
          width="1200"
          height="800"
          fetchPriority="high"
          decoding="async"
        />
        {scene.credit && (
          <figcaption className="scene-page__credit">
            Photo:{" "}
            {scene.credit.url ? (
              <a href={scene.credit.url} rel="noopener noreferrer">
                {scene.credit.text}
              </a>
            ) : (
              scene.credit.text
            )}
          </figcaption>
        )}
      </figure>

      <div className="scene-page__body">
        <PageHeading className="scene-page__title">{scene.title}</PageHeading>
        <p className="scene-page__place">{scene.address}</p>
        <p className="scene-page__description">{scene.description}</p>
        <p className="scene-page__byline">
          <Avatar src={apiAsset(creator.avatarUrl)} name={creator.name} size={36} />
          <span>
            Posted by <Link to={`/${creator.id}/scenes`}>{creator.name}</Link> on{" "}
            <time dateTime={scene.createdAt}>{postedOn(scene.createdAt)}</time>
          </span>
        </p>
        {isOwner && (
          <div className="scene-page__actions">
            <Button inverse to={`/scenes/${scene.id}/edit`}>
              Edit
            </Button>
            <DeleteSceneButton
              scene={scene}
              size="default"
              onDeleted={() => navigate("/", { replace: true })}
            />
          </div>
        )}
      </div>

      <section className="scene-page__map" aria-labelledby="scene-map-heading">
        <h2 id="scene-map-heading">Where it is</h2>
        <div className="scene-page__map-frame">
          <Map center={scene.location} zoom={14} title={`Map of ${scene.address}`} />
        </div>
        <a
          className="scene-page__map-link"
          href={openStreetMapLink(scene.location)}
          rel="noopener noreferrer"
        >
          Open in OpenStreetMap
        </a>
      </section>
    </article>
  );
};

export default ScenePage;
