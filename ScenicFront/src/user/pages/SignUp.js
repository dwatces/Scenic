import React, { useContext } from "react";

import Card from "../../shared/components/UIElements/Card";
import Input from "../../shared/components/FormElements/Input";
import Button from "../../shared/components/FormElements/Button";
import ErrorModal from "../../shared/components/UIElements/ErrorModal";
import LoadingSpinner from "../../shared/components/UIElements/LoadingSpinner";
import ImageUpload from "../../shared/components/FormElements/ImageUpload";
import {
  VALIDATOR_EMAIL,
  VALIDATOR_MINLENGTH,
  VALIDATOR_REQUIRE,
} from "../../shared/Util/validators";
import { useForm } from "../../shared/hooks/form";
import { useHttpClient } from "../../shared/hooks/http-hook";
import { AuthContext } from "../../shared/context/auth-context";
import "./Auth.css";

const Signup = () => {
  const auth = useContext(AuthContext);
  const { isLoading, error, sendRequest, clearError } = useHttpClient();
  const [formState, inputHandler] = useForm(
    {
      email: {
        value: "",
        isValid: false,
      },
      password: {
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

  const authSubmitHandler = async (event) => {
    event.preventDefault();

    try {
      const formData = new FormData();
      formData.append("email", formState.inputs.email.value);
      formData.append("name", formState.inputs.name.value);
      formData.append("password", formState.inputs.password.value);
      formData.append("image", formState.inputs.image.value);
      const responseData = await sendRequest(
        `${process.env.REACT_APP_BACKEND_URL}/users/signup`,
        "POST",
        formData
      );
      auth.login(responseData.userId, responseData.token);
    } catch (err) {}
  };

  return (
    <React.Fragment>
      <ErrorModal error={error} onClear={clearError} />
      <Card className="authentication">
        <h2 className="center">Sign Up</h2>
        <hr />
        <form onSubmit={authSubmitHandler} encType="multipart/form-data">
          <Input
            element="input"
            id="name"
            type="text"
            label="Name"
            validators={[VALIDATOR_REQUIRE()]}
            errorText="Please Enter A Name."
            onInput={inputHandler}
          />
          <ImageUpload
            center
            id="image"
            name="file"
            text="Upload Avatar"
            uploadText="Change Avatar"
            errorText="Please upload an avatar"
            onInput={inputHandler}
          />
          <Input
            element="input"
            id="email"
            type="email"
            label="Email"
            validators={[VALIDATOR_EMAIL()]}
            errorText="Please Enter A Valid Email Address."
            onInput={inputHandler}
          />
          <Input
            element="input"
            id="password"
            type="password"
            label="Password"
            validators={[VALIDATOR_MINLENGTH(6)]}
            errorText="Please Enter A Valid Password. (at least 6 characters)"
            onInput={inputHandler}
          />
          <Button type="submit" disabled={!formState.isValid}>
            Sign Up
          </Button>
        </form>
      </Card>
      {isLoading && <LoadingSpinner asOverlay />}
    </React.Fragment>
  );
};

export default Signup;
