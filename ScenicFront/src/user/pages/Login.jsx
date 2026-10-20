import React, { useContext } from "react";
import { Link, useLocation, useSearchParams } from "react-router";

import Card from "../../shared/components/UIElements/Card";
import Input from "../../shared/components/FormElements/Input";
import Button from "../../shared/components/FormElements/Button";
import ErrorModal from "../../shared/components/UIElements/ErrorModal";
import PageHeading from "../../shared/components/UIElements/PageHeading";
import { VALIDATOR_EMAIL, VALIDATOR_REQUIRE } from "../../shared/Util/validators";
import { useForm } from "../../shared/hooks/form";
import { useHttpClient } from "../../shared/hooks/http-hook";
import { useDocumentTitle } from "../../shared/hooks/use-document-title";
import { AuthContext } from "../../shared/context/auth-context";
import "./Auth.css";
import { API_URL } from "../../config";

/**
 * Log in. After logging in, GuestOnly (App.jsx) sends the visitor on to
 * ?next= (a path on this site) or home.
 */
const Login = () => {
  const auth = useContext(AuthContext);
  const location = useLocation();
  const [params] = useSearchParams();
  useDocumentTitle("Log in");
  const { isLoading, error, sendRequest, clearError } = useHttpClient();

  const [formState, inputHandler] = useForm(
    {
      email: { value: "", isValid: false },
      password: { value: "", isValid: false },
    },
    false,
  );

  const authSubmitHandler = async (event) => {
    event.preventDefault();
    let data;
    try {
      data = await sendRequest(
        `${API_URL}/users/login`,
        "POST",
        JSON.stringify({
          email: formState.inputs.email.value,
          password: formState.inputs.password.value,
        }),
        { "Content-Type": "application/json" },
      );
    } catch {
      return; // shown in the error modal
    }
    auth.login(data.userId, data.token);
  };

  const notice = location.state && location.state.notice;
  const next = params.get("next");
  return (
    <React.Fragment>
      <ErrorModal error={error} onClear={clearError} />
      <Card className="authentication">
        <PageHeading className="authentication__heading">Log in</PageHeading>
        {notice && (
          <p className="authentication__notice" role="status">
            {notice}
          </p>
        )}
        <hr />
        <form onSubmit={authSubmitHandler}>
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
            validators={[VALIDATOR_REQUIRE()]}
            errorText="Enter your password."
            onInput={inputHandler}
          />
          <div className="auth__button">
            <Button type="submit" disabled={!formState.isValid || isLoading} busy={isLoading}>
              {isLoading ? "Logging in…" : "Log in"}
            </Button>
          </div>
        </form>
        <p className="authentication__switch">
          New to Scenic?{" "}
          <Link to={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}>Sign up</Link>
        </p>
      </Card>
    </React.Fragment>
  );
};

export default Login;
