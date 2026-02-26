
window.AUTH_CONFIG = {
  // To enable local-only authentication for testing without a backend,
  // set `users` to a list of user objects.
  // The app will use these users instead of calling the backend.
  users: [
    {
      username: 'testuser',
      password: 'Password123!',
      name: 'Test User',
      email: 'test@example.com',
      role: 'user',
      id: 'local-user-123'
    },
    {
      username: 'admin',
      password: 'Password123!',
      name: 'Admin User',
      email: 'admin@example.com',
      role: 'admin',
      id: 'local-admin-456'
    }
  ]
};
