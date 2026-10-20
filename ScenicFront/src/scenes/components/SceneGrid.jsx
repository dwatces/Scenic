import SceneCard from "./SceneCard";
import "./SceneCard.css";

/** A responsive grid of scene cards. */
const SceneGrid = ({ scenes, headingLevel = 2, showCreator = true, ownerId = null, onDeleted }) => (
  <ul className="scene-grid">
    {scenes.map((scene) => (
      <SceneCard
        key={scene.id}
        scene={scene}
        headingLevel={headingLevel}
        showCreator={showCreator}
        canEdit={Boolean(ownerId) && scene.creator.id === ownerId}
        onDeleted={onDeleted}
      />
    ))}
  </ul>
);

export default SceneGrid;
