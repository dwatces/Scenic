import UserItem from "./UserItem";
import "./UserList.css";

const UsersList = ({ items }) => {
  if (items.length === 0) {
    return <p className="members-page__empty">No one has signed up yet.</p>;
  }
  return (
    <ul className="users-list">
      {items.map((user) => (
        <UserItem key={user.id} user={user} />
      ))}
    </ul>
  );
};

export default UsersList;
