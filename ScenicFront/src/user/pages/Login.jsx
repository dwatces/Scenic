import React, { useContext } from "react";
import { Link, useLocation, useSearchParams } from "react-router";

import Card from "../../shared/components/UIElements/Card";
import Input from "../../shared/components/FormElements/Input";
import Button from "../../shared/components/FormElements/Button";
import ErrorSummary from "../../shared/components/FormElements/ErrorSummary";
import ErrorModal from "../../shared/components/UIElements/ErrorModal";
import PageHeading from "../../shared/components/UIElements/PageHeading";
import AuthIntro from "../components/AuthIntro";
import { VALIDATOR_EMAIL, VALIDATOR_REQUIRE } from "../../shared/Util/validators";
import { useForm, useValidatedSubmit } from "../../shared/hooks/form";
import { useHttpClient } from "../../shared/hooks/http-hook";
import { useDocumentTitle } from "../../shared/hooks/use-document-title";
import { AuthContext } from "../../shared/context/auth-context";
import "./Auth.css";
import { API_URL } from "../../config";

const FIELDS = [
  { id: "email", message: "Enter a valid email address" },
  { id: "password", message: "Enter your password" },
];

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

  const logIn = async () => {
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
      return; // shown in the error dialog
    }
    auth.login(data.userId, data.token);
  };
  const { attempted, errors, handleSubmit } = useValidatedSubmit(formState, FIELDS, logIn);

  const notice = location.state && location.state.notice;
  const next = params.get("next");
  return (
    <React.Fragment>
      <ErrorModal error={error} onClear={clearError} />
      <div className="auth-page">
        <Card className="authentication">
          <PageHeading className="authentication__heading">Log in</PageHeading>
          {notice && (
            <p className="authentication__notice" role="status">
              {notice}
            </p>
          )}
          <hr />
          <form onSubmit={handleSubmit} noValidate>
            <ErrorSummary errors={errors} />
            <Input
              element="input"
              id="email"
              type="email"
              label="Email"
              autoComplete="email"
              required
              validators={[VALIDATOR_EMAIL()]}
              errorText={FIELDS[0].message}
              onInput={inputHandler}
              showErrors={attempted}
            />
            <Input
              element="input"
              id="password"
              type="password"
              label="Password"
              autoComplete="current-password"
              required
              validators={[VALIDATOR_REQUIRE()]}
              errorText={FIELDS[1].message}
              onInput={inputHandler}
              showErrors={attempted}
            />
            <div className="auth__button">
              <Button type="submit" busy={isLoading}>
                {isLoading ? "Logging in…" : "Log in"}
              </Button>
            </div>
          </form>
          <p className="authentication__switch">
            New to Scenic?{" "}
            <Link to={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}>Sign up</Link>
          </p>
        </Card>
        <AuthIntro />
      </div>
    </React.Fragment>
  );
};

export default Login;
