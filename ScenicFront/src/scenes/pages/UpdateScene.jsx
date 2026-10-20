import React, { useContext } from "react";
import { Navigate, useNavigate, useParams } from "react-router";

import Input from "../../shared/components/FormElements/Input";
import Button from "../../shared/components/FormElements/Button";
import ErrorSummary from "../../shared/components/FormElements/ErrorSummary";
import ErrorModal from "../../shared/components/UIElements/ErrorModal";
import PageHeading from "../../shared/components/UIElements/PageHeading";
import {
  ErrorPanel,
  NotFoundState,
  StatusLine,
} from "../../shared/components/UIElements/LoadState";
import { VALIDATOR_REQUIRE, VALIDATOR_MINLENGTH } from "../../shared/Util/validators";
import { useForm, useValidatedSubmit } from "../../shared/hooks/form";
import { useHttpClient } from "../../shared/hooks/http-hook";
import { useApiResource } from "../../shared/hooks/resource-hook";
import { useDocumentTitle } from "../../shared/hooks/use-document-title";
import { AuthContext } from "../../shared/context/auth-context";
import { markWrite } from "../../shared/util/api";
import { API_URL, apiAsset } from "../../config";
import { imageAlt } from "./ScenePage";
import "./SceneForm.css";

const FIELDS = [
  { id: "title", message: "Enter a title" },
  { id: "description", message: "Descriptions need at least 5 characters" },
];

/** The edit form, shown once the scene has loaded. */
const EditSceneForm = ({ scene }) => {
  const auth = useContext(AuthContext);
  const navigate = useNavigate();
  const { isLoading, error, sendRequest, clearError } = useHttpClient();
  const [formState, inputHandler] = useForm(
    {
      title: { value: scene.title, isValid: true },
      description: { value: scene.description, isValid: true },
    },
    true,
  );

  const save = async () => {
    let data;
    try {
      data = await sendRequest(
        `${API_URL}/scenes/${scene.id}`,
        "PATCH",
        JSON.stringify({
          title: formState.inputs.title.value,
          description: formState.inputs.description.value,
        }),
        { "Content-Type": "application/json", Authorization: `Bearer ${auth.token}` },
      );
    } catch {
      return; // shown in the error modal, or the session-ended redirect
    }
    markWrite();
    navigate(`/scenes/${scene.id}`, { state: { scene: data.scene } });
  };
  const { attempted, errors, handleSubmit } = useValidatedSubmit(formState, FIELDS, save);

  return (
    <React.Fragment>
      <ErrorModal error={error} onClear={clearError} />
      <form className="scene-form" onSubmit={handleSubmit} noValidate>
        <PageHeading className="scene-form__heading">Edit scene</PageHeading>
        <ErrorSummary errors={errors} />
        <div className="scene-form__preview">
          <img src={apiAsset(scene.imageUrl)} alt={imageAlt(scene)} width="600" height="400" />
        </div>
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
          initialValue={scene.title}
          initialValid={true}
        />
        <Input
          id="description"
          element="textarea"
          label="Description"
          hint="At least 5 characters."
          required
          validators={[VALIDATOR_MINLENGTH(5)]}
          errorText={FIELDS[1].message}
          onInput={inputHandler}
          showErrors={attempted}
          initialValue={scene.description}
          initialValid={true}
        />
        <div className="update__button">
          <Button inverse to={`/scenes/${scene.id}`}>
            Cancel
          </Button>
          <Button type="submit" busy={isLoading}>
            {isLoading ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </React.Fragment>
  );
};

/**
 * /scenes/:sceneId/edit, for the scene's owner. Anyone else is sent to the
 * scene's public page.
 */
const UpdateScene = () => {
  const { sceneId } = useParams();
  const auth = useContext(AuthContext);
  const resource = useApiResource(`${API_URL}/scenes/${sceneId}`, { fresh: true });
  const scene = resource.data && resource.data.scene;
  useDocumentTitle(scene ? `Edit ${scene.title}` : "Edit scene");

  if (resource.status === "error" && resource.error.status === 404) {
    return (
      <NotFoundState
        title="We couldn't find that scene"
        links={[
          { to: "/", label: "Your scenes" },
          { to: "/explore", label: "Explore scenes" },
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
  if (!scene) return <StatusLine>Loading scene…</StatusLine>;
  if (scene.creator.id !== auth.userId) return <Navigate to={`/scenes/${scene.id}`} replace />;
  return <EditSceneForm scene={scene} />;
};

export default UpdateScene;
