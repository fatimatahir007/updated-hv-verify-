import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import UserTable from "../components/tables/UserTable";
import {
  createUser,
  deleteUser,
  getUsers,
  updateUser,
} from "../services/userService";

export default function Users() {
  const emptyForm = {
    full_name: "",
    email: "",
    role: "viewer",
  };

  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingUser, setEditingUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadUsers = async () => {
    setLoading(true);

    try {
      setUsers(await getUsers());
    } catch (error) {
      toast.error(
        error.response?.data?.detail || "Failed to load users"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.full_name.trim() || !form.email.trim()) {
      toast.error("Full name and email are required");
      return;
    }

    setSaving(true);

    try {
      if (editingUser) {
        await updateUser(editingUser.user_id, form);
        toast.success("User updated");
      } else {
        await createUser(form);
        toast.success("User created");
      }

      setForm(emptyForm);
      setEditingUser(null);

      await loadUsers();
    } catch (error) {
      toast.error(
        error.response?.data?.detail || "User save failed"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);

    setForm({
      full_name: user.full_name || "",
      email: user.email || "",
      role: user.role || "viewer",
    });
  };

  const handleDelete = async (user) => {
    if (
      !window.confirm(
        `Delete ${user.full_name || user.email}?`
      )
    ) {
      return;
    }

    try {
      await deleteUser(user.user_id);

      toast.success("User deleted");

      await loadUsers();
    } catch (error) {
      toast.error(
        error.response?.data?.detail || "Delete failed"
      );
    }
  };

  return (
    <main className="page">
      <div className="page-header">
        <div className="eyebrow">
          Administration
        </div>

        <h1>Users</h1>

        <p>
          Manage admin users from the backend User CRUD API.
        </p>
      </div>

      <div
        className="card admin-panel"
        style={{ marginBottom: 18 }}
      >
        <div className="card-header">
          <div>
            <h2 className="card-title">
              {editingUser
                ? "Edit User"
                : "Create User"}
            </h2>

            <p className="card-subtitle">
              Current schema supports full name, email, and role.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          <input
            className="input"
            value={form.full_name}
            onChange={(e) =>
              setForm({
                ...form,
                full_name: e.target.value,
              })
            }
            placeholder="Full name"
          />

          <input
            className="input"
            value={form.email}
            onChange={(e) =>
              setForm({
                ...form,
                email: e.target.value,
              })
            }
            placeholder="Email"
            type="email"
          />

          <select
            className="input"
            value={form.role}
            onChange={(e) =>
              setForm({
                ...form,
                role: e.target.value,
              })
            }
          >
            <option value="viewer">Viewer</option>
  <option value="admin">Admin</option>
  <option value="super_admin">Super Admin</option>
  <option value="commissioner">Commissioner</option>
  <option value="district_officer">District Officer</option>
  <option value="polling_officer">Polling Officer</option>
  <option value="auditor">Auditor</option>
  <option value="observer">Observer</option>
  <option value="support">Support Officer</option>
  <option value="nadra_officer">NADRA Officer</option>
          </select>

          <div
            style={{
              display: "flex",
              gap: 10,
            }}
          >
            <button
              className={`button ${
                saving ? "is-loading" : ""
              }`}
              type="submit"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : editingUser
                ? "Update User"
                : "Create User"}
            </button>

            {editingUser && (
              <button
                className="button secondary"
                type="button"
                onClick={() => {
                  setEditingUser(null);
                  setForm(emptyForm);
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="card admin-panel">
        <div className="card-header">
          <div>
            <h2 className="card-title">
              User Directory
            </h2>

            <p className="card-subtitle">
              {users.length} users loaded
            </p>
          </div>

          <button
            className="button secondary"
            onClick={loadUsers}
          >
            Refresh
          </button>
        </div>

        <UserTable
          users={users}
          loading={loading}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </div>
    </main>
  );
}