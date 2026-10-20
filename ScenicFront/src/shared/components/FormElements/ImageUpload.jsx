import { useEffect, useRef, useState } from "react";

import Button from "./Button";
import { ImagePrepError, UNREADABLE, prepareImage } from "../../util/prepare-image";
import "./ImageUpload.css";

const HINT = "JPEG, PNG or WebP. Large photos are resized for you.";

/**
 * Choose a photo. It is checked and prepared in the browser (see
 * prepareImage) before the form gets it, so an unsupported file shows a
 * message straight away and never reaches the server.
 *
 * Reports through onInput(id, file, isValid): invalid while a photo is
 * being prepared; when `optional`, valid with no photo at all.
 */
const ImageUpload = ({ id, onInput, text, uploadText, optional = false, round = false }) => {
  const [preview, setPreview] = useState(null);
  const [preparing, setPreparing] = useState(false);
  const [message, setMessage] = useState("");
  const chosen = useRef(null);
  const picker = useRef(null);

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const picked = async (event) => {
    const file = event.target.files && event.target.files[0];
    event.target.value = ""; // choosing the same file again still fires
    if (!file) return;

    setMessage("");
    setPreparing(true);
    onInput(id, null, false);
    try {
      const prepared = await prepareImage(file);
      chosen.current = prepared;
      setPreview(URL.createObjectURL(prepared));
      onInput(id, prepared, true);
    } catch (err) {
      setMessage(err instanceof ImagePrepError ? err.message : UNREADABLE);
      // Keep the photo chosen before, if there was one.
      onInput(id, chosen.current, Boolean(chosen.current) || optional);
    } finally {
      setPreparing(false);
    }
  };

  return (
    <div className="form-control image-upload">
      <input
        id={id}
        ref={picker}
        className="image-upload__input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={picked}
      />
      {preview && (
        <div className={`image-upload__preview${round ? " image-upload__preview--round" : ""}`}>
          <img src={preview} alt="Preview of your upload" />
        </div>
      )}
      <Button inverse onClick={() => picker.current.click()} disabled={preparing}>
        {preview ? uploadText : text}
      </Button>
      <p className="image-upload__hint">{HINT}</p>
      {preparing && (
        <p className="image-upload__status" role="status">
          Preparing your photo…
        </p>
      )}
      {message && (
        <p className="image-upload__error" role="alert">
          {message}
        </p>
      )}
    </div>
  );
};

export default ImageUpload;
