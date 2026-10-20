import { Link } from "react-router";

import Avatar from "../../shared/components/UIElements/Avatar";
import { DemoBadge } from "../../shared/components/UIElements/Demo";
import { apiAsset } from "../../config";
import "./UserItems.css";

const UserItem = ({ user }) => (
  <li className="user-item">
    <Link to={`/${user.id}/scenes`}>
      <Avatar src={apiAsset(user.avatarUrl)} name={user.name} size={56} />
      <div className="user-item__info">
        <h2>{user.name}</h2>
        <p className="user-item__count">
          {user.sceneCount} {user.sceneCount === 1 ? "scene" : "scenes"}
        </p>
        {user.isDemo && <DemoBadge kind="account" />}
      </div>
    </Link>
  </li>
);

export default UserItem;
