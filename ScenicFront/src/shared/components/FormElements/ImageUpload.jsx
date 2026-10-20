import { useEffect, useState } from "react";

import { ImagePrepError, UNREADABLE, prepareImage } from "../../util/prepare-image";
import "./Button.css";
import "./ImageUpload.css";

const HINT = "JPEG, PNG or WebP. Large photos are resized for you.";

/**
 * Choose a photo. The visible control is the file input's <label>, styled
 * as a button; the input itself is visually hidden but still in the tab
 * order, so keyboard and screen reader users reach it with its label and
 * hint. The photo is checked and prepared in the browser (prepareImage)
 * before the form gets it, so an unsupported file shows a message straight
 * away and never reaches the server.
 *
 * Reports through onInput(id, file, isValid): invalid while a photo is
 * being prepared; when `optional`, valid with no photo at all. With
 * `showErrors` (after a submit), a missing photo shows `errorText`.
 */
const ImageUpload = ({
  id,
  onInput,
  text,
  uploadText,
  optional = false,
  round = false,
  showErrors = false,
  errorText = "Choose a photo",
}) => {
  const [preview, setPreview] = useState(null);
  const [preparing, setPreparing] = useState(false);
  const [message, setMessage] = useState("");
  const [chosen, setChosen] = useState(null);

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
      setChosen(prepared);
      setPreview(URL.createObjectURL(prepared));
      onInput(id, prepared, true);
    } catch (err) {
      setMessage(err instanceof ImagePrepError ? err.message : UNREADABLE);
      // Keep the photo chosen before, if there was one.
      onInput(id, chosen, Boolean(chosen) || optional);
    } finally {
      setPreparing(false);
    }
  };

  const missing = showErrors && !optional && !chosen && !preparing;
  const errorId = `${id}-error`;
  const describedBy = [`${id}-hint`, message || missing ? errorId : null].filter(Boolean).join(" ");

  return (
    <div className={`image-upload${missing ? " image-upload--invalid" : ""}`}>
      {preview && (
        <div className={`image-upload__preview${round ? " image-upload__preview--round" : ""}`}>
          <img src={preview} alt="Preview of your upload" />
        </div>
      )}
      <input
        id={id}
        className="image-upload__input visually-hidden"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={picked}
        disabled={preparing}
        required={!optional || undefined}
        aria-invalid={missing || Boolean(message) || undefined}
        aria-describedby={describedBy}
      />
      <label htmlFor={id} className="button button--inverse image-upload__choose">
        {preview ? uploadText : text}
      </label>
      <p className="image-upload__hint" id={`${id}-hint`}>
        {HINT}
      </p>
      {preparing && (
        <p className="image-upload__status" role="status">
          Preparing your photo…
        </p>
      )}
      {message ? (
        <p className="image-upload__error" id={errorId} role="alert">
          {message}
        </p>
      ) : (
        missing && (
          <p className="image-upload__error" id={errorId}>
            {errorText}
          </p>
        )
      )}
    </div>
  );
};

export default ImageUpload;
