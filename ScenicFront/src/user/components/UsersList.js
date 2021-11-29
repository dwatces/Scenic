import React from "react";
import UserItem from "./UserItem";
import LoadingSpinner from "../../shared/components/UIElements/LoadingSpinner";
import Card from "../../shared/components/UIElements/Card";
import { useHttpClient } from "../../shared/hooks/http-hook";
import "./UserList.css";

const UserList = (props) => {
  const { isLoading } = useHttpClient();
  if (props.items.length === 0) {
    return (
      <div className="center user__margin">
        <Card>
          <h2>No Users Found</h2>
        </Card>
      </div>
    );
  }

  return (
    <React.Fragment>
      {isLoading && (
        <div className="center">
          <LoadingSpinner asOverlay />
        </div>
      )}
      {!isLoading && (
        <React.Fragment>
          <h1 className="center user__header">
            <span className="user__header__underline">Our Community</span>
          </h1>
          <ul className="users-list">
            {props.items.map((user) => (
              <UserItem
                key={user.id}
                id={user.id}
                image={user.image.data}
                content={user.contentType}
                name={user.name}
                sceneCount={user.scenes.length}
              />
            ))}
          </ul>
        </React.Fragment>
      )}
    </React.Fragment>
  );
};

export default UserList;
