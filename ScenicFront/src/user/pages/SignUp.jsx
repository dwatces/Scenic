import React, { useContext } from "react";
import { Link, useSearchParams } from "react-router";

import Card from "../../shared/components/UIElements/Card";
import Input from "../../shared/components/FormElements/Input";
import Button from "../../shared/components/FormElements/Button";
import ErrorModal from "../../shared/components/UIElements/ErrorModal";
import ImageUpload from "../../shared/components/FormElements/ImageUpload";
import PageHeading from "../../shared/components/UIElements/PageHeading";
import {
  VALIDATOR_EMAIL,
  VALIDATOR_MINLENGTH,
  VALIDATOR_REQUIRE,
} from "../../shared/Util/validators";
import { useForm } from "../../shared/hooks/form";
import { useHttpClient } from "../../shared/hooks/http-hook";
import { useDocumentTitle } from "../../shared/hooks/use-document-title";
import { AuthContext } from "../../shared/context/auth-context";
import "./Auth.css";
import { API_URL } from "../../config";

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

  const authSubmitHandler = async (event) => {
    event.preventDefault();
    const formData = new FormData();
    formData.append("name", formState.inputs.name.value);
    formData.append("email", formState.inputs.email.value);
    formData.append("password", formState.inputs.password.value);
    if (formState.inputs.image.value) formData.append("image", formState.inputs.image.value);

    let data;
    try {
      data = await sendRequest(`${API_URL}/users/signup`, "POST", formData);
    } catch {
      return; // shown in the error modal
    }
    auth.login(data.userId, data.token);
  };

  const next = params.get("next");
  return (
    <React.Fragment>
      <ErrorModal error={error} onClear={clearError} />
      <Card className="authentication">
        <PageHeading className="authentication__heading">Sign up</PageHeading>
        <hr />
        <form onSubmit={authSubmitHandler}>
          <Input
            element="input"
            id="name"
            type="text"
            label="Name"
            validators={[VALIDATOR_REQUIRE()]}
            errorText="Enter your name."
            onInput={inputHandler}
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
            validators={[VALIDATOR_EMAIL()]}
            errorText="Enter a valid email address."
            onInput={inputHandler}
          />
          <Input
            element="input"
            id="password"
            type="password"
            label="Password"
            validators={[VALIDATOR_MINLENGTH(6)]}
            errorText="Passwords need at least 6 characters."
            onInput={inputHandler}
          />
          <Button type="submit" disabled={!formState.isValid || isLoading} busy={isLoading}>
            {isLoading ? "Signing up…" : "Sign up"}
          </Button>
        </form>
        <p className="authentication__switch">
          Already have an account?{" "}
          <Link to={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}>Log in</Link>
        </p>
      </Card>
    </React.Fragment>
  );
};

export default Signup;
