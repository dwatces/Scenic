import React, { useContext, useState } from "react";

import Button from "../../shared/components/FormElements/Button";
import Modal from "../../shared/components/UIElements/Modal";
import ErrorModal from "../../shared/components/UIElements/ErrorModal";
import { AuthContext } from "../../shared/context/auth-context";
import { useHttpClient } from "../../shared/hooks/http-hook";
import { markWrite } from "../../shared/util/api";
import { API_URL } from "../../config";

/**
 * Delete, with a confirmation that names the scene. Calls onDeleted(id)
 * once the API has deleted it.
 */
const DeleteSceneButton = ({ scene, onDeleted, size = "small" }) => {
  const auth = useContext(AuthContext);
  const { isLoading, error, sendRequest, clearError } = useHttpClient();
  const [confirming, setConfirming] = useState(false);

  const confirmDelete = async () => {
    setConfirming(false);
    try {
      await sendRequest(`${API_URL}/scenes/${scene.id}`, "DELETE", null, {
        Authorization: `Bearer ${auth.token}`,
      });
    } catch {
      return; // the error modal (or the session-ended redirect) tells the visitor
    }
    markWrite();
    onDeleted(scene.id);
  };

  return (
    <React.Fragment>
      <ErrorModal error={error} onClear={clearError} />
      <Modal
        show={confirming}
        onCancel={() => setConfirming(false)}
        header={`Delete “${scene.title}”?`}
        footerClass="scene-card__modal-actions"
        footer={
          <React.Fragment>
            <Button inverse onClick={() => setConfirming(false)}>
              Keep it
            </Button>
            <Button danger onClick={confirmDelete}>
              Delete scene
            </Button>
          </React.Fragment>
        }
      >
        <p>This can&apos;t be undone.</p>
      </Modal>
      <Button
        danger
        size={size}
        onClick={() => setConfirming(true)}
        disabled={isLoading}
        busy={isLoading}
      >
        {isLoading ? "Deleting…" : "Delete"}
      </Button>
    </React.Fragment>
  );
};

export default DeleteSceneButton;
