import React, { useContext } from "react";
import Button from "../../shared/components/FormElements/Button";
import Card from "../../shared/components/UIElements/Card";
import SceneItem from "./SceneItem";
import { AuthContext } from "../../shared/context/auth-context";
import "./SceneList.css";

const SceneList = (props) => {
  const auth = useContext(AuthContext);

  if (auth.userId === props.auth && props.items.length === 0)
    return (
      <div className="scene-error center fallback__scene">
        <Card>
          <h2 className="upload__header">
            You haven't uploaded any scenes yet!
          </h2>
          <Button to="/scenes/new">Add Scene</Button>
        </Card>
      </div>
    );
  if (auth.userId !== props.auth && props.items.length === 0)
    return (
      <div className="scene-error center fallback__scene">
        <Card>
          <h2 className="upload__header">No scenes found for this user</h2>
          <Button to="/users">Return</Button>
        </Card>
      </div>
    );

  return (
    <React.Fragment>
      <h1 className="center scene__header">
        <span className="scene__header__underline">Scenes</span>
      </h1>
      <ul className="scene-list">
        {props.items.map((scene) => (
          <SceneItem
            key={scene.id}
            id={scene.id}
            image={scene.image.data}
            content={scene.contentType}
            title={scene.title}
            description={scene.description}
            address={scene.address}
            creatorId={scene.creator}
            coordinates={scene.location}
            onDelete={props.onDeleteScene}
          />
        ))}
      </ul>
      {auth.userId === props.auth && (
        <span className="center scenes__bottom">
          <Button to="/scenes/new">Add Another Scene</Button>
        </span>
      )}
    </React.Fragment>
  );
};

export default SceneList;
