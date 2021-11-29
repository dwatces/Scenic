import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import SceneList from "../components/SceneList";
import LoadingSpinner from "../../shared/components/UIElements/LoadingSpinner";
import { useHttpClient } from "../../shared/hooks/http-hook";

const UserScenes = (props) => {
  const [loadedScenes, setLoadedScenes] = useState();
  const { isLoading, sendRequest } = useHttpClient();

  const userId = useParams().userId || props.id;

  useEffect(() => {
    const fetchScenes = async () => {
      try {
        const responseData = await sendRequest(
          `${process.env.REACT_APP_BACKEND_URL}/scenes/user/${userId}`
        );
        setLoadedScenes(responseData.scenes);
      } catch (err) {}
    };
    fetchScenes();
  }, [sendRequest, userId]);

  const sceneDeletedHandler = (deletedsceneId) => {
    setLoadedScenes((prevScenes) =>
      prevScenes.filter((scene) => scene.id !== deletedsceneId)
    );
  };

  return (
    <React.Fragment>
      {isLoading && (
        <div className="center">
          <LoadingSpinner asOverlay />
        </div>
      )}
      {!isLoading && loadedScenes && (
        <SceneList
          auth={userId}
          items={loadedScenes}
          onDeleteScene={sceneDeletedHandler}
        />
      )}
    </React.Fragment>
  );
};

export default UserScenes;
