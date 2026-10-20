import React from "react";
import { Link } from "react-router-dom";
import Avatar from "../../shared/components/UIElements/Avatar";
import "./UserItems.css";

const UserItem = (props) => {
  return (
    <li className="user-item">
      <Link to={`/${props.id}/scenes`}>
        <div className="user-item__image">
          <Avatar
            content={props.content}
            image={props.image}
            alt={props.name}
          />
        </div>
        <div className="user-item__info">
          <h2>{props.name}</h2>
          <h3>
            {props.sceneCount} {props.sceneCount === 1 ? "Scene" : "Scenes"}
          </h3>
        </div>
      </Link>
    </li>
  );
};

export default UserItem;
