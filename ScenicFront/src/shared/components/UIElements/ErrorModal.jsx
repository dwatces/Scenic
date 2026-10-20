import Modal from "./Modal";
import Button from "../FormElements/Button";

/** An action that failed (saving, deleting, logging in): the plain message and OK. */
const ErrorModal = ({ error, onClear }) => (
  <Modal
    onCancel={onClear}
    header="Something went wrong"
    show={Boolean(error)}
    footer={<Button onClick={onClear}>OK</Button>}
  >
    <p>{error}</p>
  </Modal>
);

export default ErrorModal;
