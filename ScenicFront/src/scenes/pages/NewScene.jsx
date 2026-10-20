import React, { useContext } from "react";
import { useNavigate } from "react-router";

import Input from "../../shared/components/FormElements/Input";
import Button from "../../shared/components/FormElements/Button";
import ErrorSummary from "../../shared/components/FormElements/ErrorSummary";
import ImageUpload from "../../shared/components/FormElements/ImageUpload";
import ErrorModal from "../../shared/components/UIElements/ErrorModal";
import PageHeading from "../../shared/components/UIElements/PageHeading";
import { VALIDATOR_REQUIRE, VALIDATOR_MINLENGTH } from "../../shared/Util/validators";
import { useHttpClient } from "../../shared/hooks/http-hook";
import { useForm, useValidatedSubmit } from "../../shared/hooks/form";
import { useDocumentTitle } from "../../shared/hooks/use-document-title";
import { AuthContext } from "../../shared/context/auth-context";
import { markWrite } from "../../shared/util/api";
import { API_URL } from "../../config";
import "./SceneForm.css";

const FIELDS = [
  { id: "title", message: "Enter a title" },
  { id: "image", message: "Choose a photo" },
  { id: "description", message: "Descriptions need at least 5 characters" },
  { id: "address", message: "Enter where you took the photo" },
];

/** /scenes/new: post a photo with a title, a description and where it was taken. */
const NewScene = () => {
  const auth = useContext(AuthContext);
  const navigate = useNavigate();
  useDocumentTitle("Add a scene");
  const { isLoading, error, sendRequest, clearError } = useHttpClient();
  const [formState, inputHandler] = useForm(
    {
      title: { value: "", isValid: false },
      description: { value: "", isValid: false },
      address: { value: "", isValid: false },
      image: { value: null, isValid: false },
    },
    false,
  );

  const post = async () => {
    const formData = new FormData();
    formData.append("title", formState.inputs.title.value);
    formData.append("description", formState.inputs.description.value);
    formData.append("address", formState.inputs.address.value);
    formData.append("image", formState.inputs.image.value);
    let data;
    try {
      data = await sendRequest(`${API_URL}/scenes`, "POST", formData, {
        Authorization: "Bearer " + auth.token,
      });
    } catch {
      return; // shown in the error dialog, or the session-ended redirect
    }
    markWrite();
    // Straight to the new scene, shown from the response (no refetch).
    navigate(`/scenes/${data.scene.id}`, { state: { scene: data.scene } });
  };
  const { attempted, errors, handleSubmit } = useValidatedSubmit(formState, FIELDS, post);

  return (
    <React.Fragment>
      <ErrorModal error={error} onClear={clearError} />
      <form className="scene-form" onSubmit={handleSubmit} noValidate>
        <PageHeading className="scene-form__heading">Add a scene</PageHeading>
        <ErrorSummary errors={errors} />
        <Input
          id="title"
          element="input"
          type="text"
          label="Title"
          required
          validators={[VALIDATOR_REQUIRE()]}
          errorText={FIELDS[0].message}
          onInput={inputHandler}
          showErrors={attempted}
        />
        <ImageUpload
          id="image"
          onInput={inputHandler}
          text="Choose a photo"
          uploadText="Choose a different photo"
          errorText={FIELDS[1].message}
          showErrors={attempted}
        />
        <Input
          id="description"
          element="textarea"
          label="Description"
          hint="At least 5 characters."
          rows="3"
          required
          validators={[VALIDATOR_MINLENGTH(5)]}
          errorText={FIELDS[2].message}
          onInput={inputHandler}
          showErrors={attempted}
        />
        <Input
          id="address"
          element="input"
          label="Location"
          hint="Town or place, and region, e.g. Hahei, Coromandel"
          required
          validators={[VALIDATOR_REQUIRE()]}
          errorText={FIELDS[3].message}
          onInput={inputHandler}
          showErrors={attempted}
        />
        <Button className="scene__submit" type="submit" busy={isLoading}>
          {isLoading ? "Posting…" : "Add scene"}
        </Button>
      </form>
    </React.Fragment>
  );
};

export default NewScene;
