import React, { useContext } from "react";
import { Link, useSearchParams } from "react-router";

import Card from "../../shared/components/UIElements/Card";
import Input from "../../shared/components/FormElements/Input";
import Button from "../../shared/components/FormElements/Button";
import ErrorSummary from "../../shared/components/FormElements/ErrorSummary";
import ErrorModal from "../../shared/components/UIElements/ErrorModal";
import ImageUpload from "../../shared/components/FormElements/ImageUpload";
import PageHeading from "../../shared/components/UIElements/PageHeading";
import {
  VALIDATOR_EMAIL,
  VALIDATOR_MINLENGTH,
  VALIDATOR_REQUIRE,
} from "../../shared/Util/validators";
import { useForm, useValidatedSubmit } from "../../shared/hooks/form";
import { useHttpClient } from "../../shared/hooks/http-hook";
import { useDocumentTitle } from "../../shared/hooks/use-document-title";
import { AuthContext } from "../../shared/context/auth-context";
import "./Auth.css";
import { API_URL } from "../../config";

const FIELDS = [
  { id: "name", message: "Enter your name" },
  { id: "image", message: "Wait for your photo to be ready" },
  { id: "email", message: "Enter a valid email address" },
  { id: "password", message: "Passwords need at least 6 characters" },
];

/** Sign up: name, email and password; a profile photo is optional. */
const Signup = () => {
  const auth = useContext(AuthContext);
  const [params] = useSearchParams();
  useDocumentTitle("Sign up");
  const { isLoading, error, sendRequest, clearError } = useHttpClient();
  const [formState, inputHandler] = useForm(
    {
      name: { value: "", isValid: false },
      email: { value: "", isValid: false },
      password: { value: "", isValid: false },
      image: { value: null, isValid: true },
    },
    false,
  );

  const signUp = async () => {
    const formData = new FormData();
    formData.append("name", formState.inputs.name.value);
    formData.append("email", formState.inputs.email.value);
    formData.append("password", formState.inputs.password.value);
    if (formState.inputs.image.value) formData.append("image", formState.inputs.image.value);

    let data;
    try {
      data = await sendRequest(`${API_URL}/users/signup`, "POST", formData);
    } catch {
      return; // shown in the error dialog
    }
    auth.login(data.userId, data.token);
  };
  const { attempted, errors, handleSubmit } = useValidatedSubmit(formState, FIELDS, signUp);

  const next = params.get("next");
  return (
    <React.Fragment>
      <ErrorModal error={error} onClear={clearError} />
      <div className="auth-page">
        <Card className="authentication">
          <PageHeading className="authentication__heading">Sign up</PageHeading>
          <hr />
          <form onSubmit={handleSubmit} noValidate>
            <ErrorSummary errors={errors} />
            <Input
              element="input"
              id="name"
              type="text"
              label="Name"
              autoComplete="name"
              required
              validators={[VALIDATOR_REQUIRE()]}
              errorText={FIELDS[0].message}
              onInput={inputHandler}
              showErrors={attempted}
            />
            <ImageUpload
              id="image"
              optional
              round
              onInput={inputHandler}
              text="Add a profile photo (optional)"
              uploadText="Choose a different photo"
            />
            <Input
              element="input"
              id="email"
              type="email"
              label="Email"
              autoComplete="email"
              required
              validators={[VALIDATOR_EMAIL()]}
              errorText={FIELDS[2].message}
              onInput={inputHandler}
              showErrors={attempted}
            />
            <Input
              element="input"
              id="password"
              type="password"
              label="Password"
              hint="At least 6 characters."
              autoComplete="new-password"
              required
              validators={[VALIDATOR_MINLENGTH(6)]}
              errorText={FIELDS[3].message}
              onInput={inputHandler}
              showErrors={attempted}
            />
            <div className="auth__button">
              <Button type="submit" busy={isLoading}>
                {isLoading ? "Signing up…" : "Sign up"}
              </Button>
            </div>
          </form>
          <p className="authentication__switch">
            Already have an account?{" "}
            <Link to={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}>Log in</Link>
          </p>
        </Card>
      </div>
    </React.Fragment>
  );
};

export default Signup;
