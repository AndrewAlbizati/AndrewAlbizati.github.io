(() => {
  const { pathname, search, hash } = window.location;

  if (!pathname.endsWith("/index.html")) {
    return;
  }

  const normalizedPath = pathname.replace(/index\.html$/, "");
  window.history.replaceState(null, "", `${normalizedPath}${search}${hash}`);
})();
