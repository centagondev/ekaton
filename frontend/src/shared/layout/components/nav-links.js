export const getNavLinks = (isAuthenticated) => {
  const links = [
    {
      label: "HOME",
      path: "/",
    },
    {
      label: "EVENTS",
      path: "/events",
    },
    {
      label: "COMPLAINT BOX",
      path: "/complaints",
    },
  ];

  if (!isAuthenticated) {
    links.push({
      label: "LOGIN",
      path: "/verify-email",
    });
  }

  return links;
};
