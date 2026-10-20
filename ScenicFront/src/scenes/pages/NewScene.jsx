import React, { useContext } from "react";
import { useNavigate } from "react-router";
import Input from "../../shared/components/FormElements/Input";
import Button from "../../shared/components/FormElements/Button";
import { VALIDATOR_REQUIRE, VALIDATOR_MINLENGTH } from "../../shared/Util/validators";
import ErrorModal from "../../shared/components/UIElements/ErrorModal";
import LoadingSpinner from "../../shared/components/UIElements/LoadingSpinner";
import ImageUpload from "../../shared/components/FormElements/ImageUpload";
import { useHttpClient } from "../../shared/hooks/http-hook";
import { AuthContext } from "../../shared/context/auth-context";
import { useForm } from "../../shared/hooks/form";
import "./SceneForm.css";
import { API_URL } from "../../config";
import PageHeading from "../../shared/components/UIElements/PageHeading";
import { markWrite } from "../../shared/util/api";
import { useDocumentTitle } from "../../shared/hooks/use-document-title";

const NewScene = () => {
  const auth = useContext(AuthContext);
  const { isLoading, error, sendRequest, clearError } = useHttpClient();
  const [formState, inputHandler] = useForm(
    {
      title: {
        value: "",
        isValid: false,
      },
      description: {
        value: "",
        isValid: false,
      },
      address: {
        value: "",
        isValid: false,
      },
      image: {
        value: null,
        isValid: false,
      },
    },
    false,
  );

  const navigate = useNavigate();
  useDocumentTitle("Add a scene");

  const sceneSubmitHandler = async (event) => {
    event.preventDefault();
    try {
      const formData = new FormData();
      formData.append("title", formState.inputs.title.value);
      formData.append("description", formState.inputs.description.value);
      formData.append("address", formState.inputs.address.value);
      formData.append("image", formState.inputs.image.value);
      const data = await sendRequest(`${API_URL}/scenes`, "POST", formData, {
        Authorization: "Bearer " + auth.token,
      });
      markWrite();
      // Straight to the new scene, shown from the response (no refetch).
      navigate(`/scenes/${data.scene.id}`, { state: { scene: data.scene } });
    } catch {
      // Shown in the error modal, or the session-ended redirect.
    }
  };

  return (
    <React.Fragment>
      <ErrorModal error={error} onClear={clearError} />
      <form className="scene-form" onSubmit={sceneSubmitHandler} encType="multipart/form-data">
        <PageHeading className="scene-form__heading">Add a scene</PageHeading>
        <Input
          id="title"
          element="input"
          type="text"
          label="Title"
          validators={[VALIDATOR_REQUIRE()]}
          errorText="Please enter a valid title"
          onInput={inputHandler}
        />
        <ImageUpload
          id="image"
          name="file"
          onInput={inputHandler}
          errorText="Please provide an image"
          uploadText="Change your Image"
          text="Upload Image"
          center
        />
        <Input
          id="description"
          element="textarea"
          label="Description"
          rows="3"
          validators={[VALIDATOR_MINLENGTH(5)]}
          errorText="Please enter a valid description (5 or more characters)"
          onInput={inputHandler}
        />
        <Input
          id="address"
          element="input"
          label="Location"
          validators={[VALIDATOR_REQUIRE()]}
          errorText="Please enter the location of this scene"
          onInput={inputHandler}
        />
        <Button className="scene__submit" type="submit" disabled={!formState.isValid}>
          Add your Scene
        </Button>
      </form>
      {isLoading && <LoadingSpinner asOverlay />}
    </React.Fragment>
  );
};

export default NewScene;
