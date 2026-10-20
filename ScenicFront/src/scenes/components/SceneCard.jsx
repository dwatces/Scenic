import { Link } from "react-router";

import Avatar from "../../shared/components/UIElements/Avatar";
import Button from "../../shared/components/FormElements/Button";
import DeleteSceneButton from "./DeleteSceneButton";
import { DemoBadge } from "../../shared/components/UIElements/Demo";
import { apiAsset } from "../../config";
import "./SceneCard.css";

/**
 * One scene in a grid. The title link covers the whole card, so the card
 * is one link for screen readers and one big target for everyone else;
 * the creator link and the owner's buttons sit above it.
 */
const SceneCard = ({ scene, headingLevel = 2, showCreator = true, canEdit = false, onDeleted }) => {
  const Heading = `h${headingLevel}`;
  const href = `/scenes/${scene.id}`;

  return (
    <li className="scene-card">
      <article className="scene-card__inner">
        <div className="scene-card__image">
          <img
            src={apiAsset(scene.cardImageUrl || scene.imageUrl)}
            alt=""
            width="600"
            height="400"
            loading="lazy"
            decoding="async"
          />
        </div>
        <div className="scene-card__body">
          <Heading className="scene-card__title">
            <Link to={href}>{scene.title}</Link>
          </Heading>
          <p className="scene-card__place">{scene.address}</p>
          {scene.isDemo && (
            <p className="scene-card__badges">
              <DemoBadge kind="scene" />
            </p>
          )}
          {showCreator && (
            <p className="scene-card__creator">
              <Avatar src={apiAsset(scene.creator.avatarUrl)} name={scene.creator.name} size={28} />
              <Link to={`/${scene.creator.id}/scenes`}>{scene.creator.name}</Link>
            </p>
          )}
        </div>
        {canEdit && (
          <div className="scene-card__actions">
            <Button inverse size="small" to={`${href}/edit`}>
              Edit
            </Button>
            <DeleteSceneButton scene={scene} onDeleted={onDeleted} />
          </div>
        )}
      </article>
    </li>
  );
};

export default SceneCard;
