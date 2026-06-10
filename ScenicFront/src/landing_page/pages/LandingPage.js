import React, { useState, useContext } from "react";
import { NavLink } from "react-router-dom";
import { AuthContext } from "../../shared/context/auth-context";
import "./LandingPage.css";

const headers = [
  "street scenes",
  "landscape scenes",
  "family memories",
  "portraits",
];

const LandingPage = () => {
  const auth = useContext(AuthContext);
  const [index, setIndex] = useState(0);
  const [imgarray] = useState([
    "Street.jpg",
    "Landscape.jpg",
    "Family.jpg",
    "Portrait.jpg",
  ]);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % imgarray.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [imgarray, imgarray.length]);

  return (
    <header
      className="hero"
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(15,15,17,0.7) 0%, rgba(15,15,17,0.25) 32%, rgba(15,15,17,0.6) 72%, rgba(15,15,17,0.96) 100%), url("/assets/${imgarray[index]}")`,
        backgroundAttachment: "scroll",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        backgroundSize: "cover",
      }}
      role="img"
      aria-label="Image Description"
    >
      <h1 className="landingpage__header">What should I do with my </h1>
      <h1 className="underline__header">
        <span className="underline">{headers[index]}</span>
      </h1>

      <h2 className="subheader">
        Scenic is your first choice for sharing your most precious images.
        <br />
        Create a free account and upload your favourite images to share with the
        community.
      </h2>

      {!auth.isLoggedIn && (
        <NavLink activeClassName="active__link" to="/signup">
          <button className="signup_button" tabIndex="-1">
            Sign up!
          </button>
        </NavLink>
      )}
      {auth.isLoggedIn && (
        <NavLink activeClassName="active__link" to="/users">
          <button className="signup_button" tabIndex="-1">
            Our Community
          </button>
        </NavLink>
      )}
    </header>
  );
};

export default LandingPage;
