import React, { useEffect, useState, useContext } from "react";
import { useParams, useHistory } from "react-router-dom";
import Input from "../../shared/components/FormElements/Input";
import Button from "../../shared/components/FormElements/Button";
import Card from "../../shared/components/UIElements/Card";
import {
  VALIDATOR_REQUIRE,
  VALIDATOR_MINLENGTH,
} from "../../shared/Util/validators";
import LoadingSpinner from "../../shared/components/UIElements/LoadingSpinner";
import ErrorModal from "../../shared/components/UIElements/ErrorModal";
import { useForm } from "../../shared/hooks/form";
import { useHttpClient } from "../../shared/hooks/http-hook";
import { AuthContext } from "../../shared/context/auth-context";
import "./SceneForm.css";

const UpdateScene = () => {
  const auth = useContext(AuthContext);
  const { isLoading, error, sendRequest, clearError } = useHttpClient();
  const [loadedScene, setLoadedScene] = useState();
  const sceneId = useParams().sceneId;
  const history = useHistory();

  const [formState, inputHandler, setFormData] = useForm(
    {
      title: {
        value: "",
        isValid: false,
      },
      description: {
        value: "",
        isValid: false,
      },
      content: {
        value: "",
        isValid: false,
      },
      image: {
        value: "",
        isValid: false,
      },
    },
    false
  );

  useEffect(() => {
    const fetchScene = async () => {
      try {
        const responseData = await sendRequest(
          `${process.env.REACT_APP_BACKEND_URL}/scenes/${sceneId}`
        );
        setLoadedScene(responseData.scene);
        setFormData(
          {
            title: {
              value: responseData.scene.title,
              isValid: true,
            },
            description: {
              value: responseData.scene.description,
              isValid: true,
            },
            content: {
              value: responseData.scene.image.contentType,
              isValid: true,
            },
            image: {
              value: responseData.scene.image.data,
              isValid: true,
            },
          },
          true
        );
      } catch (e) {}
    };
    fetchScene();
  }, [sendRequest, sceneId, setFormData]);

  const sceneUpdateHandler = async (event) => {
    event.preventDefault();
    try {
      await sendRequest(
        `${process.env.REACT_APP_BACKEND_URL}/scenes/${sceneId}`,
        "PATCH",
        JSON.stringify({
          title: formState.inputs.title.value,
          description: formState.inputs.description.value,
        }),
        {
          "Content-Type": "application/json",
          Authorization: "Bearer " + auth.token,
        }
      );
      history.push("/" + auth.userId + "/scenes");
    } catch (err) {}
  };

  if (isLoading) {
    return (
      <div className="center">
        <LoadingSpinner asOverlay />
      </div>
    );
  }

  if (!loadedScene && !error) {
    return (
      <div className="center">
        <Card>
          <h2>Could not find Scene!</h2>
        </Card>
      </div>
    );
  }

  return (
    <React.Fragment>
      <ErrorModal error={error} onClear={clearError} />
      {!isLoading && loadedScene && (
        <form className="scene-form" onSubmit={sceneUpdateHandler}>
          <h2 className="center">
            <span className="scene__header__underline">Update Scene</span>
          </h2>
          <br />
          <div className="center scene-item__image">
            <img
              src={`data:image/${formState.inputs.content.value};base64,${formState.inputs.image.value}`}
              alt={loadedScene.title}
            />
          </div>
          <Input
            id="title"
            element="input"
            type="text"
            label="Title"
            validators={[VALIDATOR_REQUIRE()]}
            errorText="Please Enter A Valid Title"
            onInput={inputHandler}
            initialValue={loadedScene.title}
            initialValid={true}
          />
          <Input
            id="description"
            element="textarea"
            label="Description"
            validators={[VALIDATOR_MINLENGTH(5)]}
            errorText="Please Enter A Valid Description (5 or more characters)"
            onInput={inputHandler}
            initialValue={loadedScene.description}
            initialValid={true}
          />
          <div className="update__button">
            <Button className="auth__button" onClick={() => history.goBack()}>
              Return
            </Button>
            <Button
              className="scene__submit"
              type="submit"
              disabled={!formState.isValid}
            >
              Update Scene
            </Button>
          </div>
        </form>
      )}
    </React.Fragment>
  );
};

export default UpdateScene;
